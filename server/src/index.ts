import 'dotenv/config';
import bcrypt from 'bcryptjs';
import express, {type NextFunction, type Request, type Response} from 'express';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import http from 'node:http';
import path from 'node:path';
import jwt from 'jsonwebtoken';
import {Server, type Socket} from 'socket.io';
import {Game} from './game';
import {QuestionSource} from './ai';
import {Store, type User} from './store';

const PORT = Number(process.env.PORT || 3001);
const isProduction = process.env.NODE_ENV === 'production';
if (isProduction && !process.env.JWT_SECRET) {
  throw new Error('JWT_SECRET must be configured before starting the production server');
}
const JWT_SECRET = process.env.JWT_SECRET || 'local-development-secret-change-before-deploy';
const COOKIE_NAME = 'qn_session';
const SESSION_AGE = 30 * 24 * 60 * 60 * 1000;
const store = new Store();
const app = express();
const srv = http.createServer(app);
const io = new Server(srv, {
  cors: {origin: false, credentials: true},
  allowRequest: (req, callback) => {
    const origin = req.headers.origin;
    if (!origin) return callback(null, true);
    try {
      callback(null, new URL(origin).host === req.headers.host);
    } catch {
      callback(null, false);
    }
  },
});
const source = new QuestionSource();
const game = new Game(
  (pid, event, data) => io.to('p:' + pid).emit(event, data),
  store,
  code => {
    const league = game.leagueView(code);
    if (league) io.to('l:' + code).emit('league', league);
  },
  source
);

app.set('trust proxy', 1);
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", 'data:'],
      connectSrc: ["'self'", 'ws:', 'wss:'],
      objectSrc: ["'none'"],
      baseUri: ["'self'"],
      frameAncestors: ["'none'"],
    },
  },
}));
app.use(express.json({limit: '24kb'}));

type SessionRequest = Request & {user?: User};
function cookieValue(header: string | undefined, name: string) {
  for (const part of (header || '').split(';')) {
    const [key, ...value] = part.trim().split('=');
    if (key === name) return decodeURIComponent(value.join('='));
  }
  return '';
}

function userFromToken(token: string | undefined) {
  if (!token) return null;
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    if (typeof payload === 'string' || !payload.sub) return null;
    return store.findUserById(String(payload.sub));
  } catch {
    return null;
  }
}

function authOptional(req: SessionRequest, _res: Response, next: NextFunction) {
  req.user = userFromToken(cookieValue(req.headers.cookie, COOKIE_NAME)) ?? undefined;
  next();
}

function sameOrigin(req: Request, res: Response, next: NextFunction) {
  const origin = req.get('origin');
  if (!origin) return res.status(403).json({error: 'Request origin is required'});
  try {
    if (new URL(origin).host !== req.get('host')) {
      return res.status(403).json({error: 'Request origin is not allowed'});
    }
  } catch {
    return res.status(403).json({error: 'Request origin is invalid'});
  }
  next();
}

function publicUser(user: User) {
  return {id: user.id, username: user.username};
}

function setSession(res: Response, user: User) {
  const token = jwt.sign({sub: user.id}, JWT_SECRET, {expiresIn: '30d'});
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    secure: isProduction,
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_AGE,
  });
}

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: true,
  legacyHeaders: false,
});

app.get('/healthz', (_req, res) => res.json({ok: true}));
app.get('/api/me', authOptional, (req: SessionRequest, res) => {
  if (!req.user) return res.status(401).json({error: 'Sign in to continue'});
  res.json({user: publicUser(req.user)});
});

app.post('/api/auth/signup', authLimiter, sameOrigin, async (req, res) => {
  const username = String(req.body?.username || '').trim();
  const password = String(req.body?.password || '');
  if (!/^[a-zA-Z0-9_]{3,16}$/.test(username)) {
    return res.status(400).json({error: 'Usernames use 3–16 letters, numbers, or underscores'});
  }
  if (password.length < 8 || password.length > 72) {
    return res.status(400).json({error: 'Choose a password between 8 and 72 characters'});
  }
  try {
    const user = await store.createUser(username, await bcrypt.hash(password, 12));
    setSession(res, user);
    res.status(201).json({user: publicUser(user)});
  } catch (error) {
    if (error instanceof Error && error.message === 'USERNAME_TAKEN') {
      return res.status(409).json({error: 'That username is already taken'});
    }
    console.error('Account creation failed');
    res.status(500).json({error: 'Could not create your account right now'});
  }
});

app.post('/api/auth/login', authLimiter, sameOrigin, async (req, res) => {
  const username = String(req.body?.username || '').trim();
  const password = String(req.body?.password || '');
  const user = store.findUser(username);
  if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
    return res.status(401).json({error: 'Username or password is incorrect'});
  }
  setSession(res, user);
  res.json({user: publicUser(user)});
});

app.post('/api/auth/logout', sameOrigin, (_req, res) => {
  res.clearCookie(COOKIE_NAME, {
    httpOnly: true,
    secure: isProduction,
    sameSite: 'lax',
    path: '/',
  });
  res.status(204).end();
});

const dist = path.resolve(process.cwd(), 'client', 'dist');

async function start() {
  await store.init();
  console.log(source.enabled
    ? 'AI questions: ON'
    : 'AI questions: OFF (set GEMINI_API_KEY to generate fresh rounds)');
  console.log(store.databaseEnabled
    ? 'League and account storage: Postgres'
    : 'League and account storage: in-memory development mode');

  io.use((socket: Socket, next) => {
    const user = userFromToken(cookieValue(socket.handshake.headers.cookie, COOKIE_NAME));
    if (!user) return next(new Error('Sign in to play'));
    socket.data.user = user;
    next();
  });

  io.on('connection', socket => {
    const user = socket.data.user as User;
    const pid = user.id;
    const name = user.username;
    socket.join('p:' + pid);
    game.onConnect(pid, name);

    const on = (event: string, fn: (data: any) => unknown) => socket.on(
      event,
      async (data: any, ack?: (result: unknown) => void) => {
        try {
          const result = await fn(data || {});
          if (event === 'league:create' || event === 'league:join') await store.flush();
          ack?.(result ?? {ok: true});
        } catch (error) {
          console.error('Realtime action failed:', event, error instanceof Error ? error.message : 'unknown');
          ack?.({error: 'Server error'});
        }
      }
    );

    on('create', data => game.create(pid, name, data));
    on('join', data => game.join(pid, name, String(data.code || '')));
    on('leave', () => game.leave(pid));
    on('mode', data => game.setMode(pid, data.mode));
    on('ready', () => game.toggleReady(pid));
    on('start', () => game.start(pid));
    on('again', () => game.again(pid));
    on('answer', data => game.answer(pid, Number(data.i)));
    on('jeopardy:answer', data => game.jeopardyAnswer(pid, String(data.response || '')));
    on('fifty', () => game.fifty(pid));
    on('offer', data => game.chooseOffer(pid, String(data.choice || '')));
    on('guess', data => game.guess(pid, String(data.w || '')));
    on('spin', () => game.spin(pid));
    on('key', data => game.key(pid, String(data.l || '')));
    on('solve', data => game.solveWheel(pid, String(data.phrase || '')));
    on('league:create', data => {
      const leagueName = String(data.name || '').trim().slice(0, 30) || user.username + "'s league";
      const league = store.create(leagueName, pid, user.username);
      return {ok: true, code: league.code};
    });
    on('league:join', data => {
      const league = store.join(String(data.code || '').trim().toUpperCase(), pid, user.username);
      if (!league) return {error: 'League not found — check the code and try again'};
      const view = game.leagueView(league.code);
      if (view) io.to('l:' + league.code).emit('league', view);
      return {ok: true, code: league.code};
    });
    on('league:open', data => {
      const code = String(data.code || '').trim().toUpperCase();
      const view = store.isMember(code, pid) ? game.leagueView(code) : null;
      if (!view) return {error: 'That league is not in your account'};
      socket.join('l:' + code);
      return {ok: true, league: view};
    });
    on('league:mine', () => ({leagues: store.listFor(pid)}));

    socket.on('disconnect', async () => {
      if (!(await io.in('p:' + pid).fetchSockets()).length) game.onDisconnect(pid);
    });
  });

  app.use(express.static(dist, {index: false, maxAge: isProduction ? '1h' : 0}));
  app.get(/.*/, (_req, res) => res.sendFile(path.join(dist, 'index.html')));

  srv.listen(PORT, '0.0.0.0', () => {
    console.log('Quiz Night listening on port ' + PORT);
  });
}

void start().catch(error => {
  console.error('Server could not start:', error instanceof Error ? error.message : 'unknown error');
  process.exitCode = 1;
});
