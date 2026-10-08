// Pure game logic used by the authoritative server.
import {RULES, type ModeId} from './config';
import {QUESTIONS, WORDS, PHRASES} from './content';
import type {PublicQ} from './types';

export type McqItem = {kind: 'mcq'; cat: string; q: string; options: string[]; answer: string; value: number; pct: number; chaserRight: boolean};
export type LingoItem = {kind: 'lingo'; word: string};
export type WheelItem = {kind: 'wheel'; hint: string; phrase: string};
export type Item = McqItem | LingoItem | WheelItem;
export type PState = {score: number; out: boolean; gap: number; ll: boolean};
export type WheelRound = {gs: string; sp: number | null; rs: number; bad: number; last: string};

export const freshState = (): PState => ({score: 0, out: false, gap: RULES.chase.startGap, ll: false});
export const newWheel = (): WheelRound => ({gs: '', sp: null, rs: 0, bad: 0, last: ''});
export const makeRng = (seed: number) => { let a = seed >>> 0; return () => (a = (a * 1664525 + 1013904223) % 4294967296) / 4294967296; };
export function shuffle<T>(arr: T[], r: () => number): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

export type RawQ = {cat: string; q: string; answer: string; wrong: string[]};
/** Turns raw questions (from the bank or from the AI) into playable items. */
export function itemsFromRaw(_mode: ModeId, seed: number, raw: RawQ[]): McqItem[] {
  const r = makeRng(seed + 7);
  return raw.map((x, i) => ({
    kind: 'mcq' as const, cat: x.cat, q: x.q, answer: x.answer, options: shuffle([x.answer, ...x.wrong], r),
    value: RULES.jeoValues[i] ?? 1000, pct: RULES.pctLadder[i] ?? 1, chaserRight: r() < RULES.chase.chaserAccuracy
  }));
}

export function buildItems(mode: ModeId, seed: number): Item[] {
  const r = makeRng(seed), n = RULES.count[mode];
  if (mode === 'lingo') return shuffle(WORDS, r).slice(0, n).map(word => ({kind: 'lingo' as const, word}));
  if (mode === 'wheel') return shuffle(PHRASES, r).slice(0, n).map(p => ({kind: 'wheel' as const, ...p}));
  return itemsFromRaw(mode, seed, shuffle(QUESTIONS, r).slice(0, n));
}

export function gradeMcq(mode: ModeId, q: number, it: McqItem, ok: boolean, p: PState): PState {
  const s = {...p}, c = RULES.chase;
  if ((mode === 'pub' || mode === 'pct') && ok) s.score++;
  if (mode === 'mill' && ok) s.score = RULES.millLadder[q];
  if (mode === 'jeo') s.score += (ok ? 1 : -1) * it.value;
  if ((mode === 'mill' || mode === 'pct') && !ok) s.out = true;
  if (mode === 'chase') {
    if (q < c.cashBuilder) { if (ok) s.score += c.cashPerCorrect; }
    else {
      if (ok) s.gap++;
      if (it.chaserRight) s.gap--;
      if (s.gap <= 0) { s.out = true; s.score = 0; } else if (s.gap >= c.homeGap) s.out = true;
    }
  }
  return s;
}

export function publicQ(mode: ModeId, q: number, it: Item, p: PState): PublicQ {
  if (it.kind === 'lingo') return {kind: 'lingo', first: it.word[0], len: RULES.lingo.length, tries: RULES.lingo.tries};
  if (it.kind === 'wheel') return {kind: 'wheel', hint: it.hint};
  const c = RULES.chase;
  const meta = mode === 'mill' ? '💰 $' + RULES.millLadder[q]
    : mode === 'pct' ? `${it.pct}% of people get this right`
    : mode === 'jeo' ? `${it.cat} for $${it.value}`
    : mode === 'chase' ? (q < c.cashBuilder ? `Cash builder: $${c.cashPerCorrect} each` : `The Chase - gap ${p.gap} (caught at 0, home at ${c.homeGap})`)
    : it.cat;
  return {kind: 'mcq', meta, q: it.q, options: it.options};
}

export function lingoColors(guess: string, word: string): string[] {
  const r = Array(word.length).fill('x'), u = word.split('') as (string | 0)[];
  for (let i = 0; i < word.length; i++) if (guess[i] === word[i]) { r[i] = 'g'; u[i] = 0; }
  for (let i = 0; i < word.length; i++) if (r[i] !== 'g') { const k = u.indexOf(guess[i]); if (k > -1) { r[i] = 'y'; u[k] = 0; } }
  return r;
}

export function wheelSpin(w: WheelRound, roll: number): WheelRound {
  const v = RULES.wheel.segments[roll % RULES.wheel.segments.length];
  return typeof v === 'number' ? {...w, sp: v, last: `Spun $${v} - pick a consonant`} : {...w, sp: null, rs: 0, last: '💥 Bankrupt! Round cash lost.'};
}
export function wheelKey(w: WheelRound, phrase: string, l: string): {w: WheelRound; done: boolean; error?: string} {
  const W = RULES.wheel, vow = 'AEIOU'.includes(l);
  if (!/^[A-Z]$/.test(l) || w.gs.includes(l)) return {w, done: false, error: 'Letter already used'};
  if (vow && w.rs < W.vowelCost) return {w, done: false, error: `Vowels cost $${W.vowelCost}`};
  if (!vow && w.sp === null) return {w, done: false, error: 'Spin first!'};
  const n = phrase.split(l).length - 1, x = {...w, gs: w.gs + l};
  if (vow) x.rs -= W.vowelCost; else { if (n) x.rs += (w.sp as number) * n; x.sp = null; }
  if (!n) x.bad++;
  const solved = phrase.replace(/ /g, '').split('').every(c => x.gs.includes(c));
  if (solved) x.rs += W.solveBonus;
  return {w: x, done: solved || x.bad >= W.maxWrong};
}
export const wheelMask = (w: WheelRound, phrase: string, reveal: boolean) =>
  phrase.split('').map(c => (c === ' ' ? ' ' : reveal || w.gs.includes(c) ? c : '_'));
