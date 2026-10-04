import express from 'express';
import http from 'http';
import path from 'path';
import {Server} from 'socket.io';
import {Game} from './game';
import {Store} from './store';

const PORT = +(process.env.PORT || 3001);
const DATA = process.env.DATA_DIR || path.join(process.cwd(), 'data');
const store = new Store(path.join(DATA, 'leagues.json'));
const app = express(), srv = http.createServer(app);
const io = new Server(srv, {cors: {origin: '*'}});

const pushLeague = (code: string) => { const v = game.leagueView(code); if (v) io.to('l:' + code).emit('league', v); };
const game = new Game((pid, ev, d) => io.to('p:' + pid).emit(ev, d), store, pushLeague);

const dist = path.join(process.cwd(), 'client', 'dist');
app.use(express.static(dist));
app.use((_req, res) => res.sendFile(path.join(dist, 'index.html')));

io.on('connection', s => {
  const pid = String(s.handshake.auth.pid || '').slice(0, 40), name = String(s.handshake.auth.name || '').trim().slice(0, 16);
  if (!pid || !name) { s.disconnect(); return; }
  s.join('p:' + pid); game.onConnect(pid, name);
  const on = (ev: string, fn: (d: any) => unknown) => s.on(ev, (d: any, ack?: (r: unknown) => void) => {
    try { const r = fn(d || {}); ack?.(r ?? {ok: true}); } catch (e) { console.error(ev, e); ack?.({error: 'Server error'}); }
  });
  on('create', d => game.create(pid, name, d));
  on('join', d => game.join(pid, name, String(d.code)));
  on('leave', () => game.leave(pid));
  on('mode', d => game.setMode(pid, d.mode, d.genre));
  on('ready', () => game.toggleReady(pid));
  on('start', () => game.start(pid));
  on('again', () => game.again(pid));
  on('answer', d => game.answer(pid, +d.i));
  on('fifty', () => game.fifty(pid));
  on('guess', d => game.guess(pid, String(d.w)));
  on('spin', () => game.spin(pid));
  on('key', d => game.key(pid, String(d.l)));
  on('league:create', d => { const l = store.create(String(d.name || '').trim().slice(0, 30) || name + "'s league", pid, name); return {ok: true, code: l.code}; });
  on('league:join', d => { const l = store.join(String(d.code).trim().toUpperCase(), pid, name); if (!l) return {error: 'League not found'}; pushLeague(l.code); return {ok: true, code: l.code}; });
  on('league:open', d => { const code = String(d.code).toUpperCase(), v = store.isMember(code, pid) ? game.leagueView(code) : null; if (!v) return {error: 'Not in that league'}; s.join('l:' + code); return {ok: true, league: v}; });
  on('league:mine', d => ({leagues: (Array.isArray(d.codes) ? d.codes : []).map((c: string) => store.leagues.get(String(c))).filter((l: any) => l && l.members[pid]).map((l: any) => ({code: l.code, name: l.name}))}));
  s.on('disconnect', async () => { if (!(await io.in('p:' + pid).fetchSockets()).length) game.onDisconnect(pid); });
});

srv.listen(PORT, () => console.log(`Quiz Night server on http://localhost:${PORT}`));
