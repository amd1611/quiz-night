import {useEffect, useState} from 'react';
import {GENRES, MODES, MODE_IDS} from '@shared/config';
import type {LeagueView, Snapshot} from '@shared/types';
import {call, connect, myId} from './net';
import Game, {money, type Act} from './Game';

const myLeagues = (): string[] => { try { return JSON.parse(localStorage.getItem('qn_lg') || '[]'); } catch { return []; } };
const addLeague = (c: string) => localStorage.setItem('qn_lg', JSON.stringify([...new Set([c, ...myLeagues()])]));
type View = 'home' | 'qp' | 'leagues' | 'league';

export default function App() {
  const [name, setName] = useState(localStorage.getItem('qn_name') || '');
  const [snap, setSnap] = useState<Snapshot | null>(null);
  const [lg, setLg] = useState<LeagueView | null>(null);
  const [online, setOnline] = useState(false);
  const [view, setView] = useState<View>('home');
  const [msg, setMsg] = useState('');
  const flash = (m: string) => { setMsg(m); setTimeout(() => setMsg(''), 2600); };
  useEffect(() => { if (name) connect(name, {state: setSnap, league: l => setLg(cur => (cur && cur.code === l.code ? l : cur)), status: setOnline}); }, [name]);
  const act: Act = async (ev, d = {}) => { const r = await call(ev, d); if (r?.error) flash(r.error); return r; };
  const openLeague = async (code: string) => { const r = await act('league:open', {code}); if (r.ok) { setLg(r.league); setView('league'); } };

  let body;
  if (!name) body = <NameScreen onDone={n => { localStorage.setItem('qn_name', n); setName(n); }} />;
  else if (snap) body = snap.st === 'lobby' ? <Lobby snap={snap} act={act} /> : snap.st === 'play' ? <Game snap={snap} act={act} /> : <Results snap={snap} act={act} />;
  else if (view === 'qp') body = <QuickPlay act={act} back={() => setView('home')} />;
  else if (view === 'leagues') body = <Leagues act={act} open={openLeague} back={() => setView('home')} />;
  else if (view === 'league' && lg) body = <LeagueScreen lg={lg} act={act} back={() => setView('leagues')} />;
  else body = <Home name={name} go={setView} rename={() => setName('')} />;
  return <div id="app">{name && !online && <div className="off">Connecting…</div>}{body}{msg && <div className="toast">{msg}</div>}</div>;
}

function NameScreen({onDone}: {onDone: (n: string) => void}) {
  const [n, setN] = useState(localStorage.getItem('qn_name') || '');
  const go = () => n.trim() && onDone(n.trim().slice(0, 16));
  return <><h1>🎉 Quiz Night</h1><p className="mut">Pick a username to get started.</p>
    <input value={n} maxLength={16} placeholder="Username" onChange={e => setN(e.target.value)} onKeyDown={e => e.key === 'Enter' && go()} />
    <button className="btn" onClick={go}>Let's play</button></>;
}

function Home({name, go, rename}: {name: string; go: (v: View) => void; rename: () => void}) {
  return <><h1>Hi, {name} 👋</h1><p className="mut">What are we playing?</p>
    <button className="big" style={{background: 'linear-gradient(135deg,#6c5ce7,#a855f7)'}} onClick={() => go('leagues')}><span>🏆</span><div>Leagues<small>Track wins with friends</small></div></button>
    <button className="big" style={{background: 'linear-gradient(135deg,#f97316,#ef4444)'}} onClick={() => go('qp')}><span>⚡</span><div>Quick Play<small>Lobby, code or solo</small></div></button>
    <button className="btn sec" onClick={rename}>Change username</button></>;
}

function QuickPlay({act, back}: {act: Act; back: () => void}) {
  const [code, setCode] = useState(new URLSearchParams(location.search).get('room') || '');
  return <><h1>⚡ Quick Play</h1>
    <button className="btn" onClick={() => act('create')}>Create lobby</button>
    <div className="card"><b>Join with code</b><input value={code} inputMode="numeric" maxLength={6} placeholder="6-digit code" onChange={e => setCode(e.target.value)} />
      <button className="btn" onClick={() => act('join', {code})}>Join</button></div>
    <button className="btn sec" onClick={() => act('create', {solo: true})}>Play solo</button>
    <button className="btn sec" onClick={back}>Back</button></>;
}

function Leagues({act, open, back}: {act: Act; open: (c: string) => void; back: () => void}) {
  const [mine, setMine] = useState<{code: string; name: string}[]>([]);
  const [n, setN] = useState(''), [c, setC] = useState('');
  useEffect(() => { call('league:mine', {codes: myLeagues()}).then(r => setMine(r.leagues || [])); }, []);
  const make = async () => { const r = await act('league:create', {name: n}); if (r.ok) { addLeague(r.code); open(r.code); } };
  const join = async () => { const r = await act('league:join', {code: c}); if (r.ok) { addLeague(r.code); open(r.code); } };
  return <><h1>🏆 Leagues</h1>
    {mine.map(l => <button key={l.code} className="btn sec" onClick={() => open(l.code)}>{l.name} <span className="mut">{l.code}</span></button>)}
    <div className="card"><b>Create a league</b><input value={n} placeholder="League name" onChange={e => setN(e.target.value)} /><button className="btn" onClick={make}>Create</button></div>
    <div className="card"><b>Join with a code</b><input value={c} maxLength={6} placeholder="League code" onChange={e => setC(e.target.value)} /><button className="btn" onClick={join}>Join</button></div>
    <button className="btn sec" onClick={back}>Back</button></>;
}

export function LeagueScreen({lg, act, back}: {lg: LeagueView; act: Act; back: () => void}) {
  const party = async () => {
    if (lg.party) return act('join', {code: lg.party.code});
    const r = await call('create', {league: lg.code});
    if (r.error && r.code) act('join', {code: r.code}); else if (r.error) act('noop');
  };
  return <><h1>🏆 {lg.name}</h1><div className="mut">League code: <b>{lg.code}</b></div>
    <div className="card"><h2 style={{marginTop: 0}}>Leaderboard</h2>
      {lg.members.map((m, i) => <div className="row" key={m.pid}><span>{['🥇', '🥈', '🥉'][i] || i + 1 + '.'} {m.name}{m.pid === myId ? ' (you)' : ''}</span>
        <span><b>{m.t}</b> <span className="mut">{Object.entries(m.w).map(([k, v]) => (MODES as any)[k].emoji + v).join(' ')}</span></span></div>)}</div>
    {lg.party?.state === 'play' ? <button className="btn" disabled>Game in progress…</button>
      : <button className="btn" onClick={party}>{lg.party ? '🎉 Join party' : '🎉 Create party'}</button>}
    <button className="btn sec" onClick={back}>Back</button></>;
}

export function Lobby({snap, act}: {snap: Snapshot; act: Act}) {
  const host = snap.host === myId, M = MODES[snap.mode], me = snap.players.find(p => p.pid === myId);
  const all = snap.players.every(p => p.ready);
  const share = async () => {
    const url = `${location.origin}/?room=${snap.code}`;
    try { if (navigator.share) await navigator.share({title: 'Quiz Night', text: `Join my game! Code ${snap.code}`, url}); else await navigator.clipboard.writeText(url); } catch { /* cancelled */ }
  };
  return <><h1>{snap.solo ? 'Solo game' : 'Lobby'}</h1>
    {!snap.solo && <><div className="mut center">Share this code to join</div><div className="code">{snap.code}</div><button className="btn sec" onClick={share}>📤 Share invite link</button></>}
    {snap.league && <div className="mut center">🏆 League party - wins count!</div>}
    <div className="card">{snap.players.map(p => <div className="row" key={p.pid}><span>{p.name} {p.pid === snap.host && '👑'} {!p.connected && '(offline)'}</span><span>{p.ready ? '✅ Ready' : '⏳'}</span></div>)}</div>
    {host ? <><h2>Game mode</h2>
      <div className="grid">{MODE_IDS.map(id => <button key={id} className={'mode' + (snap.mode === id ? ' on' : '')} style={{background: MODES[id].color}} onClick={() => act('mode', {mode: id})}><span>{MODES[id].emoji}</span>{MODES[id].name}</button>)}</div>
      {snap.mode === 'song' && <div style={{marginTop: 8}}>{GENRES.map(g => <button key={g} className={'chip' + (snap.genre === g ? ' on' : '')} onClick={() => act('mode', {mode: 'song', genre: g})}>{g === 'all' ? 'All genres' : g}</button>)}</div>}
      <p className="mut">{M.desc}</p>
      <button className="btn" disabled={!all} onClick={() => act('start')}>{all ? 'Start game' : 'Waiting for players to be ready'}</button></>
      : <><div className="card">Host picked: <b>{M.emoji} {M.name}</b><div className="mut">{M.desc}</div></div>
        <button className="btn" onClick={() => act('ready')}>{me?.ready ? 'Not ready' : "I'm ready!"}</button></>}
    <button className="btn sec" onClick={() => act('leave')}>Leave</button></>;
}

export function Results({snap, act}: {snap: Snapshot; act: Act}) {
  const r = [...snap.players].sort((a, b) => b.score - a.score), top = r[0]?.score ?? 0;
  return <><h1>🏁 Results</h1>
    <div className="card">{r.map((p, i) => <div className="row" key={p.pid}><span>{p.score === top && top > 0 ? '👑' : i + 1 + '.'} {p.name}</span><b>{money(snap.mode, p.score)}</b></div>)}</div>
    {snap.league && top > 0 && <p className="mut">Win added to the league leaderboard.</p>}
    {snap.host === myId ? <button className="btn" onClick={() => act('again')}>Back to lobby</button> : <p className="mut">Waiting for the host…</p>}
    <button className="btn sec" onClick={() => act('leave')}>Leave</button></>;
}
