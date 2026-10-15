import {useEffect, useState, type FormEvent} from 'react';
import {
  ArrowRight, ArrowUpRight, Check, ChevronRight, Clock3, Copy, Crown, DoorOpen,
  Gamepad2, House, KeyRound, LogOut, Medal, Plus, Sparkles, Trophy, UsersRound, Zap,
  type LucideIcon,
} from 'lucide-react';
import {MODES, MODE_IDS, type ModeId} from '@shared/config';
import type {LeagueView, Snapshot} from '@shared/types';
import {call, connect, disconnect, myId, setMyId} from './net';
import Game, {money, type Act} from './Game';

type Page = 'home' | 'quick' | 'leagues' | 'league';
type Account = {id: string; username: string};
type LeagueLink = {code: string; name: string};

const pageLabel: Record<Page, string> = {
  home: 'Home',
  quick: 'Quick play',
  leagues: 'Leagues',
  league: 'League',
};

export default function App() {
  const [user, setUser] = useState<Account | null>(null);
  const [checkingSession, setCheckingSession] = useState(true);
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [league, setLeague] = useState<LeagueView | null>(null);
  const [leagues, setLeagues] = useState<LeagueLink[]>([]);
  const [online, setOnline] = useState(false);
  const [page, setPage] = useState<Page>('home');
  const [toast, setToast] = useState('');

  const flash = (message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(''), 2800);
  };

  useEffect(() => {
    let mounted = true;
    fetch('/api/me', {credentials: 'same-origin'})
      .then(async response => response.ok ? response.json() : null)
      .then(result => { if (mounted && result?.user) setUser(result.user); })
      .catch(() => { if (mounted) flash('Could not reach the game server. Try again in a moment.'); })
      .finally(() => { if (mounted) setCheckingSession(false); });
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    if (!user) {
      setOnline(false);
      setMyId('');
      disconnect();
      return;
    }
    setMyId(user.id);
    connect({
      state: setSnapshot,
      league: next => setLeague(current => current?.code === next.code ? next : current),
      status: setOnline,
    });
    return () => disconnect();
  }, [user?.id]);

  useEffect(() => {
    if (!online) return;
    call('league:mine').then(result => setLeagues(result?.leagues || []));
  }, [online]);

  useEffect(() => {
    const code = new URLSearchParams(location.search).get('room');
    if (!code || !online || snapshot) return;
    call('join', {code}).then(result => {
      if (result?.error) flash(result.error);
      history.replaceState({}, '', location.pathname);
    });
  }, [online, snapshot]);

  const act: Act = async (event, data = {}) => {
    const result = await call(event, data, event === 'start' ? 40000 : 30000);
    if (result?.error) flash(result.error);
    return result;
  };

  const loadLeagues = async () => {
    const result = await call('league:mine');
    setLeagues(result?.leagues || []);
  };

  const openLeague = async (code: string) => {
    const result = await act('league:open', {code});
    if (result?.ok) {
      setLeague(result.league);
      setPage('league');
    }
  };

  const navigate = (next: Page) => {
    if (snapshot) void act('leave');
    setSnapshot(null);
    setPage(next);
    if (next !== 'league') setLeague(null);
  };

  const logout = async () => {
    try {
      await fetch('/api/auth/logout', {method: 'POST', credentials: 'same-origin'});
    } finally {
      disconnect();
      setSnapshot(null);
      setUser(null);
      setPage('home');
    }
  };

  if (checkingSession) {
    return <div className="boot-screen"><div className="brand-mark"><Sparkles size={22} /></div><span>Setting the table…</span></div>;
  }
  if (!user) return <AuthScreen onAuthenticated={setUser} flash={flash} />;

  let body;
  if (snapshot) {
    if (snapshot.st === 'lobby') body = <Lobby snapshot={snapshot} act={act} />;
    else if (snapshot.st === 'play') body = <Game snap={snapshot} act={act} />;
    else body = <Results snapshot={snapshot} act={act} />;
  } else if (page === 'quick') {
    body = <QuickPlay act={act} back={() => navigate('home')} />;
  } else if (page === 'leagues') {
    body = <Leagues leagues={leagues} act={act} open={openLeague} refresh={loadLeagues} />;
  } else if (page === 'league' && league) {
    body = <LeagueScreen league={league} act={act} back={() => navigate('leagues')} />;
  } else {
    body = <Home name={user.username} leagues={leagues} go={navigate} />;
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <Brand />
        <div className="side-label">YOUR SPACE</div>
        <nav className="side-nav" aria-label="Main navigation">
          <SideLink page="home" active={page === 'home' && !snapshot} onClick={navigate} Icon={House} />
          <SideLink page="quick" active={page === 'quick' && !snapshot} onClick={navigate} Icon={Zap} />
          <SideLink page="leagues" active={(page === 'leagues' || page === 'league') && !snapshot} onClick={navigate} Icon={UsersRound} />
        </nav>

        <div className="sidebar-promo">
          <div className="promo-spark"><Sparkles size={16} /></div>
          <strong>Game night is better together</strong>
          <span>Invite your crew and make it a league.</span>
          <button onClick={() => navigate('leagues')}>Explore leagues <ArrowRight size={15} /></button>
        </div>

        <div className="sidebar-bottom">
          <div className="sidebar-user">
            <div className="avatar">{initials(user.username)}</div>
            <div className="user-copy"><strong>{user.username}</strong><span>Quiz Club member</span></div>
            <button className="icon-button" onClick={logout} title="Sign out" aria-label="Sign out"><LogOut size={17} /></button>
          </div>
          <div className="connection"><span className={online ? 'status-dot online' : 'status-dot'} />{online ? 'Connected' : 'Reconnecting…'}</div>
        </div>
      </aside>

      <main className="main-panel">
        <header className="topbar">
          <div className="breadcrumb"><span>Quiz Club</span><ChevronRight size={15} /><b>{snapshot ? snapshot.st === 'lobby' ? 'Party lobby' : snapshot.st === 'play' ? MODES[snapshot.mode].name : 'Results' : pageLabel[page]}</b></div>
          <div className="topbar-actions">
            <span className="topbar-status"><span className={online ? 'status-dot online' : 'status-dot'} />{online ? 'All systems ready' : 'Connecting'}</span>
            <div className="avatar avatar-small">{initials(user.username)}</div>
          </div>
        </header>

        <div className={'content-grid' + (snapshot || page !== 'home' ? ' content-wide' : '')}>
          <div className="page-content">{snapshot?.st === 'play' && !snapshot.ai && snapshot.aiNote && <div className="ai-warning" role="status"><Sparkles size={15} /><span>{snapshot.aiNote}</span></div>}{body}</div>
          {!snapshot && page === 'home' && <HomeRail leagues={leagues} go={navigate} open={openLeague} />}
        </div>
      </main>

      <nav className="mobile-nav" aria-label="Main navigation">
        <MobileLink page="home" active={page === 'home' && !snapshot} onClick={navigate} Icon={House} />
        <MobileLink page="quick" active={page === 'quick' && !snapshot} onClick={navigate} Icon={Zap} />
        <MobileLink page="leagues" active={(page === 'leagues' || page === 'league') && !snapshot} onClick={navigate} Icon={UsersRound} />
        <button onClick={logout}><LogOut size={19} /><span>Sign out</span></button>
      </nav>
      {toast && <div className="toast" role="status">{toast}</div>}
    </div>
  );
}

function AuthScreen({onAuthenticated, flash}: {onAuthenticated: (user: Account) => void; flash: (message: string) => void}) {
  const [mode, setMode] = useState<'signup' | 'login'>('signup');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    try {
      const response = await fetch('/api/auth/' + mode, {
        method: 'POST',
        credentials: 'same-origin',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({username, password}),
      });
      const result = await response.json();
      if (!response.ok) return flash(result.error || 'Could not sign you in');
      onAuthenticated(result.user);
    } catch {
      flash('Could not reach the game server. Try again in a moment.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="auth-screen">
      <section className="auth-showcase">
        <Brand light />
        <div className="showcase-copy">
          <span className="eyebrow eyebrow-light"><Sparkles size={14} /> GOOD GAMES, GOOD COMPANY</span>
          <h1>Bring your<br />people. Bring<br /><em>your A-game.</em></h1>
          <p>Seven ways to play. One place to keep score. Your next favourite game night starts here.</p>
        </div>
        <div className="showcase-scene" aria-hidden="true">
          <div className="scene-orbit orbit-one" /><div className="scene-orbit orbit-two" />
          <div className="scene-bubble bubble-one">?</div><div className="scene-bubble bubble-two">5</div>
          <div className="scene-wheel">Q<span>!</span></div>
          <div className="scene-chip chip-one">LINGO</div><div className="scene-chip chip-two">1% CLUB</div>
          <div className="scene-chip chip-three">PUB QUIZ</div>
        </div>
        <div className="showcase-foot"><span>Made for the group chat that actually meets up.</span><span>01 / 07</span></div>
      </section>

      <section className="auth-form-side">
        <div className="auth-form-wrap">
          <div className="auth-mobile-brand"><Brand /></div>
          <div className="auth-kicker">YOUR SEAT IS WAITING</div>
          <h2>{mode === 'signup' ? 'Join the club' : 'Welcome back'}</h2>
          <p className="auth-subtitle">{mode === 'signup' ? 'Create your player profile and get the night rolling.' : 'Pick up right where the fun left off.'}</p>
          <div className="auth-tabs" role="tablist">
            <button className={mode === 'signup' ? 'selected' : ''} onClick={() => setMode('signup')} type="button">Create account</button>
            <button className={mode === 'login' ? 'selected' : ''} onClick={() => setMode('login')} type="button">Sign in</button>
          </div>
          <form onSubmit={submit} className="auth-form">
            <label htmlFor="username">Username</label>
            <input id="username" autoComplete="username" required minLength={3} maxLength={16} pattern="[A-Za-z0-9_]{3,16}" value={username} onChange={event => setUsername(event.target.value)} placeholder="e.g. quizwhiz" />
            <span className="field-hint">3–16 letters, numbers, or underscores</span>
            <label htmlFor="password">Password</label>
            <input id="password" type="password" autoComplete={mode === 'signup' ? 'new-password' : 'current-password'} required minLength={8} maxLength={72} value={password} onChange={event => setPassword(event.target.value)} placeholder="At least 8 characters" />
            <button className="button button-primary auth-submit" disabled={busy} type="submit">
              {busy ? 'One sec…' : mode === 'signup' ? 'Create my account' : 'Sign in'} <ArrowRight size={17} />
            </button>
          </form>
          <div className="auth-note"><KeyRound size={15} /> Your account keeps your username and league wins together.</div>
        </div>
      </section>
    </main>
  );
}

function Brand({light = false}: {light?: boolean}) {
  return <div className={'brand' + (light ? ' brand-light' : '')}>
    <div className="brand-mark"><Sparkles size={19} strokeWidth={2.6} /></div>
    <span>quiz<span>club</span></span>
  </div>;
}

function SideLink({page, active, onClick, Icon}: {page: Page; active: boolean; onClick: (page: Page) => void; Icon: LucideIcon}) {
  return <button className={'side-link' + (active ? ' active' : '')} onClick={() => onClick(page)}>
    <Icon size={19} strokeWidth={2} /><span>{pageLabel[page]}</span>{page === 'quick' && <span className="nav-shortcut">NEW</span>}
  </button>;
}

function MobileLink({page, active, onClick, Icon}: {page: Page; active: boolean; onClick: (page: Page) => void; Icon: LucideIcon}) {
  return <button className={active ? 'active' : ''} onClick={() => onClick(page)}>
    <Icon size={19} /><span>{page === 'quick' ? 'Play' : pageLabel[page]}</span>
  </button>;
}

function Home({name, leagues, go}: {name: string; leagues: LeagueLink[]; go: (page: Page) => void}) {
  const greeting = new Date().getHours() < 12 ? 'Good morning' : new Date().getHours() < 18 ? 'Good afternoon' : 'Good evening';
  return <>
    <div className="page-heading home-heading">
      <div><span className="eyebrow">YOUR GAME NIGHT HQ</span><h1>{greeting}, {name}<span className="heading-period">.</span></h1><p>What sounds fun today?</p></div>
      <button className="button button-dark" onClick={() => go('quick')}><Zap size={16} /> Start a quick game</button>
    </div>

    <section className="hero-card">
      <div className="hero-copy">
        <span className="eyebrow eyebrow-light"><span className="live-pulse" /> THE NIGHT IS YOUNG</span>
        <h2>Seven shows.<br /><em>Your living room.</em></h2>
        <p>Bring the crew together for a little friendly competition. The scoreboard will remember everything.</p>
        <button className="button button-lime" onClick={() => go('quick')}>Let’s play <ArrowRight size={17} /></button>
      </div>
      <div className="hero-art" aria-hidden="true">
        <div className="hero-ring ring-back" /><div className="hero-ring ring-front" />
        <div className="hero-orbit-dot dot-a" /><div className="hero-orbit-dot dot-b" /><div className="hero-orbit-dot dot-c" />
        <div className="hero-card-float float-one"><span>ROUND 04</span><b>WHO KNOWS<br />THE MOST?</b><small><span /> LIVE PARTY</small></div>
        <div className="hero-card-float float-two"><span>★</span><b>+200 pts</b><small>LOOK AT YOU GO</small></div>
        <div className="hero-score">Q<span>!</span></div>
      </div>
      <div className="hero-bottom"><span><Sparkles size={14} /> Fresh questions, every game</span><span>MAKE TONIGHT COUNT <ArrowUpRight size={14} /></span></div>
    </section>

    <div className="section-heading">
      <div><span className="eyebrow">PICK YOUR SHOW</span><h2>Choose a game mode</h2></div>
      <span className="section-count">07 FORMATS</span>
    </div>
    <div className="mode-grid">
      {MODE_IDS.map((id, index) => <ModeCard key={id} id={id} index={index} />)}
    </div>

    <div className="section-heading room-heading">
      <div><span className="eyebrow">FIND YOUR PEOPLE</span><h2>Pick a room</h2></div>
    </div>
    <div className="room-choice-grid">
      <button className="room-choice league-choice" onClick={() => go('leagues')}>
        <span className="room-icon"><Trophy size={21} /></span><span className="room-text"><b>Leagues</b><small>Your crew, your leaderboard</small></span><span className="room-arrow"><ArrowUpRight size={18} /></span>
      </button>
      <button className="room-choice quick-choice" onClick={() => go('quick')}>
        <span className="room-icon"><Zap size={21} /></span><span className="room-text"><b>Quick Play</b><small>Make a room or join a code</small></span><span className="room-arrow"><ArrowUpRight size={18} /></span>
      </button>
    </div>
    <div className="home-footnote"><Sparkles size={15} /> {leagues.length ? 'Your ' + leagues.length + ' league' + (leagues.length === 1 ? ' is' : 's are') + ' ready when you are.' : 'Your scoreboard is just one game away.'}</div>
  </>;
}

function ModeCard({id, index}: {id: ModeId; index: number}) {
  const mode = MODES[id];
  return <article className={'mode-card mode-tone-' + index}>
    <div className="mode-card-top"><span className="mode-glyph" style={{background: mode.color}}>{mode.emoji}</span><ArrowUpRight size={16} className="mode-card-arrow" /></div>
    <h3>{mode.name}</h3><p>{mode.desc}</p>
  </article>;
}

function HomeRail({leagues, go, open}: {leagues: LeagueLink[]; go: (page: Page) => void; open: (code: string) => void}) {
  return <aside className="home-rail">
    <div className="rail-card rail-stats">
      <div className="rail-heading"><span className="rail-icon"><Medal size={17} /></span><span>YOUR SNAPSHOT</span></div>
      <div className="snapshot-stat"><strong>07</strong><span>ways to play</span></div>
      <div className="snapshot-stat"><strong>{String(leagues.length).padStart(2, '0')}</strong><span>leagues joined</span></div>
      <div className="rail-note"><span className="status-dot online" /> Ready for a rematch?</div>
    </div>
    <div className="rail-card">
      <div className="rail-heading"><span className="rail-icon rail-icon-purple"><UsersRound size={17} /></span><span>YOUR LEAGUES</span><button onClick={() => go('leagues')}>See all</button></div>
      {leagues.length ? leagues.slice(0, 4).map((item, index) => <button className="rail-league" key={item.code} onClick={() => open(item.code)}>
        <span className={'league-dot dot-tone-' + index}>{item.name.slice(0, 1).toUpperCase()}</span><span className="rail-league-name">{item.name}<small>{item.code}</small></span><ChevronRight size={15} />
      </button>) : <div className="empty-rail"><p>Your crew needs a home base.</p><button onClick={() => go('leagues')}><Plus size={15} /> Start a league</button></div>}
    </div>
    <div className="rail-tip"><span>THE QUICK TIP</span><p>League games count toward your crew’s wins. Quick Play is the place for a solo warm-up.</p><div className="tip-doodle">✳</div></div>
  </aside>;
}

function QuickPlay({act, back}: {act: Act; back: () => void}) {
  const [code, setCode] = useState(new URLSearchParams(location.search).get('room') || '');
  const join = (event: FormEvent) => {
    event.preventDefault();
    if (code.trim().length !== 6) return;
    void act('join', {code: code.trim()});
  };
  return <>
    <PageTitle eyebrow="NO SCORE TO SETTLE… YET" title="Quick Play" subtitle="Start a fresh room, hop into a friend’s game, or play solo." onBack={back} />
    <div className="quick-grid">
      <article className="quick-card create-card">
        <div className="quick-card-icon"><UsersRound size={22} /></div><span className="eyebrow">YOU’RE HOSTING</span>
        <h2>Create a lobby</h2><p>Pick a show, share your six-digit code, and get the room buzzing.</p>
        <button className="button button-primary" onClick={() => void act('create')}>Create lobby <ArrowRight size={17} /></button>
        <div className="quick-card-decoration">01</div>
      </article>
      <article className="quick-card join-card">
        <div className="quick-card-icon"><KeyRound size={22} /></div><span className="eyebrow">FRIEND SENT A CODE?</span>
        <h2>Join with a code</h2><p>Type in the room code and slide into the game.</p>
        <form className="join-code-form" onSubmit={join}>
          <label className="sr-only" htmlFor="room-code">Six-digit room code</label>
          <input id="room-code" value={code} inputMode="numeric" maxLength={6} placeholder="000 000" onChange={event => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))} />
          <button className="button button-dark" disabled={code.length !== 6} type="submit">Join room <ArrowRight size={16} /></button>
        </form>
        <div className="quick-card-decoration">02</div>
      </article>
      <article className="quick-card solo-card">
        <div className="quick-card-icon"><Gamepad2 size={22} /></div><span className="eyebrow">JUST YOU AND THE CLOCK</span>
        <h2>Play solo</h2><p>Warm up on any show. Solo games stay in Quick Play.</p>
        <button className="button button-outline" onClick={() => void act('create', {solo: true})}>Start a solo game <ArrowRight size={17} /></button>
        <div className="quick-card-decoration">03</div>
      </article>
    </div>
  </>;
}

function Leagues({leagues, act, open, refresh}: {leagues: LeagueLink[]; act: Act; open: (code: string) => void; refresh: () => void}) {
  const [name, setName] = useState('');
  const [code, setCode] = useState('');

  const create = async (event: FormEvent) => {
    event.preventDefault();
    const result = await act('league:create', {name});
    if (result?.ok) {
      setName('');
      await refresh();
      await open(result.code);
    }
  };
  const join = async (event: FormEvent) => {
    event.preventDefault();
    const result = await act('league:join', {code});
    if (result?.ok) {
      setCode('');
      await refresh();
      await open(result.code);
    }
  };

  return <>
    <PageTitle eyebrow="YOUR CREW’S SCOREBOARD" title="Leagues" subtitle="Bring your people together and keep every win on the board." />
    <div className="league-actions">
      <form className="action-panel" onSubmit={create}>
        <span className="action-icon action-icon-orange"><Plus size={19} /></span><span className="eyebrow">START YOUR OWN</span>
        <h2>Create a league</h2><p>Give your crew a name. They can join with the code you share.</p>
        <label className="sr-only" htmlFor="new-league-name">League name</label>
        <input id="new-league-name" value={name} maxLength={30} required placeholder="Friday Night Legends" onChange={event => setName(event.target.value)} />
        <button className="button button-primary" type="submit">Create league <ArrowRight size={16} /></button>
      </form>
      <form className="action-panel" onSubmit={join}>
        <span className="action-icon action-icon-purple"><KeyRound size={19} /></span><span className="eyebrow">GOT AN INVITE?</span>
        <h2>Join with a code</h2><p>Enter the league code your friend sent you.</p>
        <label className="sr-only" htmlFor="league-code">League code</label>
        <input id="league-code" className="code-input" value={code} maxLength={6} required placeholder="ABC123" onChange={event => setCode(event.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6))} />
        <button className="button button-dark" disabled={code.length !== 6} type="submit">Join league <ArrowRight size={16} /></button>
      </form>
    </div>
    <div className="section-heading league-list-heading"><div><span className="eyebrow">YOUR GROUPS</span><h2>My leagues <span className="count-bubble">{leagues.length}</span></h2></div></div>
    {leagues.length ? <div className="league-list">{leagues.map((item, index) => <button className="league-list-card" key={item.code} onClick={() => open(item.code)}>
      <span className={'league-emblem emblem-' + index % 4}><Trophy size={21} /></span><span className="league-list-copy"><b>{item.name}</b><small>League code <strong>{item.code}</strong></small></span><span className="league-list-open">Open board <ArrowUpRight size={16} /></span>
    </button>)}</div> : <div className="empty-state"><div className="empty-icon"><UsersRound size={25} /></div><h3>Your leagues will show up here</h3><p>Create a home for your crew or join one with an invite code.</p></div>}
  </>;
}

function LeagueScreen({league, act, back}: {league: LeagueView; act: Act; back: () => void}) {
  const [copied, setCopied] = useState(false);
  const members = [...league.members].sort((a, b) => b.t - a.t || a.name.localeCompare(b.name));
  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(league.code);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch { /* clipboard can be unavailable outside secure contexts */ }
  };
  const enterParty = async () => {
    if (league.party) {
      await act('join', {code: league.party.code});
      return;
    }
    await act('create', {league: league.code});
  };

  return <>
    <PageTitle eyebrow="THE CREW’S SCOREBOARD" title={league.name} subtitle="Every mode. Every match. All the friendly bragging rights." onBack={back} />
    <div className="league-code-banner">
      <div><span className="eyebrow">INVITE YOUR CREW</span><strong>{league.code}</strong><small>Share this code so friends can join your league.</small></div>
      <button className="button button-outline" onClick={copyCode}>{copied ? <Check size={16} /> : <Copy size={16} />}{copied ? 'Copied' : 'Copy code'}</button>
    </div>
    <div className="league-detail-grid">
      <section className="panel leaderboard-panel">
        <div className="panel-heading"><div><span className="eyebrow">SEASON TOTALS</span><h2>Leaderboard</h2></div><span className="member-count"><UsersRound size={15} /> {members.length} players</span></div>
        <div className="leaderboard-head"><span>PLAYER</span><span>WINS</span></div>
        {members.map((member, index) => <div className={'leader-row' + (member.pid === myId ? ' is-you' : '')} key={member.pid}>
          <span className={'leader-rank' + (index < 3 ? ' top-rank rank-' + index : '')}>{index === 0 ? <Crown size={17} /> : index === 1 || index === 2 ? <Medal size={17} /> : String(index + 1).padStart(2, '0')}</span>
          <span className="leader-avatar">{initials(member.name)}</span>
          <span className="leader-name">{member.name}{member.pid === myId && <small>YOU</small>}</span>
          <span className="leader-score">{member.t}<small>{member.t === 1 ? 'WIN' : 'WINS'}</small></span>
        </div>)}
        {!members.length && <div className="empty-state compact"><p>No players yet. Invite your crew to get started.</p></div>}
        <div className="mode-wins">
          <span className="eyebrow">WINS BY SHOW</span>
          {MODE_IDS.map(id => {
            const wins = members.reduce((sum, member) => sum + (member.w[id] || 0), 0);
            return <span className="mode-win-chip" key={id}><span style={{background: MODES[id].color}}>{MODES[id].emoji}</span>{MODES[id].name}<b>{wins}</b></span>;
          })}
        </div>
      </section>

      <aside className="party-panel">
        <div className="party-illustration"><div className="party-orbit" /><div className="party-star star-a">✦</div><div className="party-star star-b">✳</div><div className="party-ticket"><UsersRound size={24} /><b>YOUR<br />TURN</b></div></div>
        <span className="eyebrow">{league.party ? 'THE PARTY IS OPEN' : 'GET THE CREW TOGETHER'}</span>
        <h2>{league.party ? league.party.state === 'play' ? 'Game night is live' : 'Your crew is in the lobby' : 'Ready to play?'}</h2>
        <p>{league.party ? league.party.state === 'play' ? 'Join your league mates and jump into the current game.' : 'Your league already has a party waiting. Hop in and get ready.' : 'Create a party for this league. Everyone who joins can ready up before the host starts a show.'}</p>
        {league.party && <div className="party-code"><span>ROOM CODE</span><strong>{league.party.code}</strong><span className="status-dot online" />{league.party.state === 'play' ? 'IN PROGRESS' : 'WAITING'}</div>}
        <button className="button button-primary party-button" onClick={() => void enterParty()}>
          {league.party ? 'Join the party' : 'Create a party'} <ArrowRight size={17} />
        </button>
        <div className="party-foot"><Check size={14} /> League wins update automatically</div>
      </aside>
    </div>
  </>;
}

function Lobby({snapshot, act}: {snapshot: Snapshot; act: Act}) {
  const isHost = snapshot.host === myId;
  const player = snapshot.players.find(item => item.pid === myId);
  const allReady = snapshot.players.every(item => item.ready);
  const mode = MODES[snapshot.mode];
  const share = async () => {
    const url = location.origin + '/?room=' + snapshot.code;
    try {
      if (navigator.share) await navigator.share({title: 'Join my Quiz Club game', text: 'Room code: ' + snapshot.code, url});
      else { await navigator.clipboard.writeText(url); }
    } catch { /* share dismissed */ }
  };
  return <>
    <PageTitle eyebrow={snapshot.league ? 'LEAGUE PARTY' : snapshot.solo ? 'QUICK PLAY · SOLO' : 'QUICK PLAY · PARTY'} title={snapshot.solo ? 'Your solo game' : 'The lobby'} subtitle={snapshot.league ? 'Ready up with your league and make this one count.' : 'A room full of friends and seven shows to choose from.'} />
    {!snapshot.solo && <div className="room-code-banner">
      <div><span className="eyebrow">SEND THIS TO YOUR CREW</span><strong>{snapshot.code}</strong></div>
      <button className="button button-outline" onClick={() => void share()}><Copy size={16} /> Share invite</button>
    </div>}
    <div className="lobby-grid">
      <section className="panel mode-select-panel">
        <div className="panel-heading"><div><span className="eyebrow">THE HOST PICKS THE SHOW</span><h2>Choose a game mode</h2></div>{snapshot.ai && <span className="ai-status"><Sparkles size={14} /> AI questions on</span>}</div>
        <div className="mode-select-grid">
          {MODE_IDS.map(id => <button key={id} disabled={!isHost || snapshot.busy} onClick={() => void act('mode', {mode: id})} className={'select-mode' + (snapshot.mode === id ? ' chosen' : '')}>
            <span className="select-mode-icon" style={{background: MODES[id].color}}>{MODES[id].emoji}</span><span><b>{MODES[id].name}</b><small>{MODES[id].desc}</small></span>{snapshot.mode === id && <Check size={17} className="selected-check" />}
          </button>)}
        </div>
      </section>
      <aside className="panel players-panel">
        <div className="panel-heading"><div><span className="eyebrow">THE CREW</span><h2>Players <span className="count-bubble">{snapshot.players.length}</span></h2></div><span className="online-count"><span className="status-dot online" /> LIVE</span></div>
        <div className="lobby-player-list">{snapshot.players.map((item, index) => <div className="lobby-player" key={item.pid}>
          <span className={'player-avatar avatar-tone-' + index % 5}>{initials(item.name)}</span><span className="lobby-player-name">{item.name}{item.pid === snapshot.host && <small>HOST</small>}</span>
          <span className={'ready-pill' + (item.ready ? ' ready' : '')}>{item.ready ? <><Check size={13} /> READY</> : 'NOT READY'}</span>
        </div>)}</div>
        <div className="lobby-mode-note"><span className="mode-glyph" style={{background: mode.color}}>{mode.emoji}</span><span><b>{mode.name}</b><small>{mode.desc}</small></span></div>
        {!snapshot.ai && snapshot.aiNote && <div className="ai-warning" role="status"><Sparkles size={15} /><span>{snapshot.aiNote}</span></div>}
        {isHost ? <button className="button button-primary full-button" disabled={!allReady || snapshot.busy} onClick={() => void act('start')}>
          {snapshot.busy ? <><Sparkles size={16} /> Dreaming up questions…</> : allReady ? <>Start the game <ArrowRight size={17} /></> : 'Waiting for everyone'}
        </button> : <button className={'button full-button ' + (player?.ready ? 'button-outline' : 'button-primary')} onClick={() => void act('ready')}>
          {player?.ready ? <><Check size={16} /> You’re ready</> : <>I’m ready <ArrowRight size={17} /></>}
        </button>}
        <button className="text-button leave-button" onClick={() => void act('leave')}><DoorOpen size={15} /> Leave this lobby</button>
      </aside>
    </div>
  </>;
}

function Results({snapshot, act}: {snapshot: Snapshot; act: Act}) {
  const sorted = [...snapshot.players].sort((a, b) => b.score - a.score);
  const winningScore = sorted[0]?.score ?? 0;
  return <>
    <div className="results-hero"><span className="result-cup"><Trophy size={26} /></span><span className="eyebrow eyebrow-light">THAT’S A WRAP</span><h1>What a round.</h1><p>{snapshot.league ? 'The league board has been updated.' : 'The scoreboard is in. Time to claim your bragging rights.'}</p></div>
    <section className="panel results-panel"><div className="panel-heading"><div><span className="eyebrow">{MODES[snapshot.mode].name.toUpperCase()}</span><h2>Final scores</h2></div><span className="member-count">{sorted.length} {sorted.length === 1 ? 'player' : 'players'}</span></div>
      {sorted.map((item, index) => <div className={'result-row' + (item.score === winningScore && winningScore > 0 ? ' result-winner' : '')} key={item.pid}>
        <span className={'result-rank rank-' + index}>{item.score === winningScore && winningScore > 0 ? <Crown size={18} /> : String(index + 1).padStart(2, '0')}</span>
        <span className="leader-avatar">{initials(item.name)}</span><span className="result-name">{item.name}{item.score === winningScore && winningScore > 0 && <small>WINNER</small>}</span>
        <strong>{money(snapshot.mode, item.score)}</strong>
      </div>)}
      <div className="results-actions">
        {snapshot.host === myId ? <button className="button button-primary" onClick={() => void act('again')}>Run it back <ArrowRight size={16} /></button> : <span className="waiting-host"><Clock3 size={15} /> Waiting for the host to start another round</span>}
        <button className="button button-outline" onClick={() => void act('leave')}>Back to rooms <ArrowRight size={16} /></button>
      </div>
    </section>
  </>;
}

function PageTitle({eyebrow, title, subtitle, onBack}: {eyebrow: string; title: string; subtitle: string; onBack?: () => void}) {
  return <div className="page-heading page-title-heading">
    <div>{onBack && <button className="back-link" onClick={onBack}><ChevronRight size={15} /> Back</button>}<span className="eyebrow">{eyebrow}</span><h1>{title}</h1><p>{subtitle}</p></div>
    <span className="title-stamp"><Sparkles size={18} /></span>
  </div>;
}

function initials(value: string) {
  return value.trim().slice(0, 2).toUpperCase();
}
