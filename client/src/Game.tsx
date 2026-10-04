import {useEffect, useState} from 'react';
import {MODES, RULES, type ModeId} from '@shared/config';
import type {MyView, PublicQ, Snapshot} from '@shared/types';
import {myId} from './net';

export type Act = (ev: string, d?: object) => Promise<any>;
export const money = (mode: ModeId, n: number) => (['mill', 'jeo', 'chase', 'wheel'].includes(mode) ? '$' : '') + n;

export default function Game({snap, act}: {snap: Snapshot; act: Act}) {
  const me = snap.me!, q = snap.question!, M = MODES[snap.mode], self = snap.players.find(p => p.pid === myId);
  const [recv, setRecv] = useState(Date.now()); useEffect(() => setRecv(Date.now()), [snap]);
  const [now, setNow] = useState(Date.now()); useEffect(() => { const t = setInterval(() => setNow(Date.now()), 250); return () => clearInterval(t); }, []);
  const left = Math.max(0, Math.ceil((snap.ms - (now - recv)) / 1000));
  return <>
    <div className="top"><b>{M.emoji} {M.name}</b><span>{snap.q + 1}/{snap.total}</span><span className="tm">⏱ {left}</span></div>
    <div className="strip">{snap.players.map(p => <span key={p.pid} className={'pl' + (p.pid === myId ? ' me' : '')}>{p.answered && !p.out ? '✓ ' : ''}{p.name} <b>{money(snap.mode, p.score)}</b></span>)}</div>
    {self?.out && <div className="note">{snap.mode === 'chase' && self.gap >= RULES.chase.homeGap ? '🏁 You made it home!' : '💀 You are out - watch the others'}</div>}
    {q.kind === 'mcq' && <Mcq q={q} me={me} mode={snap.mode} act={act} />}
    {q.kind === 'lingo' && <Lingo key={snap.q} q={q} me={me} act={act} />}
    {q.kind === 'wheel' && <Wheel q={q} me={me} act={act} />}
  </>;
}

function Mcq({q, me, mode, act}: {q: Extract<PublicQ, {kind: 'mcq'}>; me: MyView; mode: ModeId; act: Act}) {
  const d = me.answered;
  return <div className="card"><div className="meta">{q.meta}</div><div className="q">{q.q}</div>
    {q.options.map((t, i) => <button key={i} disabled={d}
      className={'opt' + (d && t === me.answer ? ' ok' : '') + (d && me.sel === i && !me.correct ? ' bad' : '') + (me.hide.includes(i) ? ' hid' : '')}
      onClick={() => act('answer', {i})}>{t}</button>)}
    {mode === 'mill' && !me.ll && !d && <button className="btn sec" onClick={() => act('fifty')}>50:50</button>}
    {d && <div className="note">{me.correct ? '✅ Correct!' : '❌ Answer: ' + me.answer}</div>}
  </div>;
}

function Lingo({q, me, act}: {q: Extract<PublicQ, {kind: 'lingo'}>; me: MyView; act: Act}) {
  const [w, setW] = useState('');
  const go = () => { act('guess', {w}); setW(''); };
  return <div className="card"><div className="meta">Starts with {q.first}</div>
    {Array.from({length: q.tries}).map((_, i) => { const g = me.guesses[i]; return <div className="tiles" key={i}>
      {Array.from({length: q.len}).map((_, j) => <div key={j} className={'t ' + (g ? g.c[j] : '')}>{g ? g.w[j] : ''}</div>)}</div>; })}
    {me.answered ? <div className="note">{me.ok ? '🎉 Solved!' : 'The word was ' + me.word}</div>
      : <><input value={w} maxLength={q.len} autoCapitalize="characters" placeholder={`${q.len}-letter guess`} onChange={e => setW(e.target.value)} onKeyDown={e => e.key === 'Enter' && go()} />
        <button className="btn" onClick={go}>Guess</button></>}
  </div>;
}

function Wheel({q, me, act}: {q: Extract<PublicQ, {kind: 'wheel'}>; me: MyView; act: Act}) {
  const W = me.wheel!;
  return <div className="card"><div className="meta">{q.hint} - round cash ${W.rs} {W.last && '| ' + W.last}</div>
    <div className="pz">{W.mask.map((c, i) => c === ' ' ? <div key={i} className="t sp" /> : <div key={i} className="t">{c === '_' ? '' : c}</div>)}</div>
    {me.answered ? <div className="note">Puzzle over</div> : <>
      <button className="btn" disabled={W.sp !== null} onClick={() => act('spin')}>🎡 Spin</button>
      <div className="keys">{[...'ABCDEFGHIJKLMNOPQRSTUVWXYZ'].map(l => <button key={l} className={'k' + ('AEIOU'.includes(l) ? ' v' : '')} disabled={W.used.includes(l)} onClick={() => act('key', {l})}>{l}</button>)}</div>
      <div className="mut note">Vowels cost ${RULES.wheel.vowelCost} · Wrong guesses: {W.bad}/{RULES.wheel.maxWrong}</div></>}
  </div>;
}
