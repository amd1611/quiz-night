// Authoritative game server logic. Knows nothing about sockets: it gets a `send` function.
import {RULES, MODE_IDS, type ModeId} from '../../shared/src/config';
import {buildItems, freshState, gradeMcq, lingoColors, newWheel, publicQ, wheelKey, wheelMask, wheelSpin, type Item, type LingoItem, type PState, type WheelRound} from '../../shared/src/engine';
import type {LeagueView, MyView, Snapshot} from '../../shared/src/types';
import type {Store} from './store';
import type {QuestionSource} from './ai';

type Send = (pid: string, ev: string, data: unknown) => void;
type Res = {ok?: true; error?: string; code?: string};
interface RP {
  pid: string; name: string; ready: boolean; connected: boolean; st: PState; answered: boolean; sel: number;
  correct: boolean | null; ok: boolean | null; hide: number[]; guesses: string[]; wheel: WheelRound; wbase: number; dc?: NodeJS.Timeout;
}
interface Room {
  code: string; host: string; solo: boolean; mode: ModeId; st: 'lobby' | 'play' | 'end'; q: number; items: Item[];
  players: Map<string, RP>; league: string; deadline: number; timer?: NodeJS.Timeout; adv?: NodeJS.Timeout;
  seen: string[]; busy: boolean; ai: boolean; pre?: {key: string; p: Promise<{items: Item[]; ai: boolean}>}; warmT?: NodeJS.Timeout;
}
const mk = (pid: string, name: string): RP => ({pid, name, ready: false, connected: true, st: freshState(), answered: false, sel: -1, correct: null, ok: null, hide: [], guesses: [], wheel: newWheel(), wbase: 0});
const ERR = (error: string): Res => ({error});

export class Game {
  rooms = new Map<string, Room>();
  constructor(private send: Send, private store: Store, private onLeague: (code: string) => void, private source: QuestionSource) {}

  // ---------- helpers ----------
  private roomOf(pid: string) { for (const r of this.rooms.values()) if (r.players.has(pid)) return r; }
  private ctx(pid: string) {
    const r = this.roomOf(pid), p = r?.players.get(pid);
    return r && p && r.st === 'play' ? {r, p, it: r.items[r.q]} : null;
  }
  private party(lg: string) { for (const r of this.rooms.values()) if (r.league === lg && !r.solo && r.st !== 'end') return {code: r.code, state: r.st}; return null; }
  private hook(r: Room) { if (r.league) this.onLeague(r.league); }
  private push(r: Room) { for (const p of r.players.values()) this.send(p.pid, 'state', this.snapshot(r, p.pid)); }

  leagueView(code: string): LeagueView | null {
    const l = this.store.leagues.get(code); if (!l) return null;
    const members = Object.entries(l.members).map(([pid, m]) => ({pid, ...m})).sort((a, b) => b.t - a.t || a.name.localeCompare(b.name));
    return {code, name: l.name, members, party: this.party(code)};
  }

  snapshot(r: Room, pid: string): Snapshot {
    const me = r.players.get(pid)!, it = r.st === 'play' ? r.items[r.q] : null;
    let view: MyView | null = null;
    if (it) {
      view = {answered: me.answered, sel: me.sel, correct: me.correct, hide: me.hide, ll: me.st.ll, offer: me.st.offer, ok: me.ok, guesses: [], answer: undefined};
      if (it.kind === 'mcq' && me.answered) view.answer = it.answer;
      if (it.kind === 'lingo') { view.guesses = me.guesses.map(w => ({w, c: lingoColors(w, it.word)})); if (me.answered) view.word = it.word; }
      if (it.kind === 'wheel') view.wheel = {mask: wheelMask(me.wheel, it.phrase, me.answered), sp: me.wheel.sp, rs: me.wheel.rs, bad: me.wheel.bad, last: me.wheel.last, used: me.wheel.gs};
    }
    return {
      code: r.solo ? '' : r.code, solo: r.solo, host: r.host, mode: r.mode, st: r.st, q: r.q, total: r.items.length, league: r.league, busy: r.busy, ai: r.ai,
      ms: Math.max(0, r.deadline - Date.now()),
      players: [...r.players.values()].map(p => ({pid: p.pid, name: p.name, ready: p.ready || p.pid === r.host, connected: p.connected, score: p.st.score, out: p.st.out, answered: p.answered, gap: p.st.gap})),
      question: it ? publicQ(r.mode, r.q, it, me.st) : null, me: view
    };
  }

  // ---------- connection ----------
  onConnect(pid: string, name: string) {
    const r = this.roomOf(pid);
    if (!r) return this.send(pid, 'state', null);
    const p = r.players.get(pid)!; clearTimeout(p.dc); p.connected = true; p.name = name;
    this.push(r);
  }
  onDisconnect(pid: string) {
    const r = this.roomOf(pid); if (!r) return;
    const p = r.players.get(pid)!; p.connected = false;
    p.dc = setTimeout(() => { if (!p.connected) this.leave(pid); }, RULES.graceMs * 5);
    this.push(r); if (r.st === 'play') this.check(r);
  }

  // ---------- rooms ----------
  create(pid: string, name: string, o: {solo?: boolean; league?: string} = {}): Res {
    const lg = String(o.league || '').toUpperCase();
    if (o.solo && lg) return ERR('Solo games are only available in Quick Play');
    if (lg) {
      if (!this.store.isMember(lg, pid)) return ERR('Join the league first');
      const party = this.party(lg); if (party) return {error: 'A party is already open', code: party.code};
    }
    this.leave(pid);
    let code = ''; do code = String(Math.floor(Math.random() * 10 ** RULES.roomCodeLength)).padStart(RULES.roomCodeLength, '0'); while (this.rooms.has(code));
    const r: Room = {code, host: pid, solo: !!o.solo, mode: 'pub', st: 'lobby', q: 0, items: [], players: new Map(), league: lg, deadline: 0, seen: [], busy: false, ai: false};
    r.players.set(pid, mk(pid, name)); this.rooms.set(code, r);
    this.warm(r); this.push(r); this.hook(r); return {ok: true, code};
  }
  join(pid: string, name: string, code: string): Res {
    const r = this.rooms.get(code.trim());
    if (!r || r.solo) return ERR('No lobby with that code');
    if (r.players.has(pid)) { this.onConnect(pid, name); return {ok: true, code: r.code}; }
    if (r.st !== 'lobby' && !(r.league && r.st === 'play')) return ERR('Game already started');
    if (r.players.size >= RULES.maxPlayers) return ERR('Lobby is full');
    if (r.league && !this.store.isMember(r.league, pid)) return ERR('Join the league first');
    this.leave(pid);
    r.players.set(pid, mk(pid, name)); this.push(r); this.hook(r); return {ok: true, code: r.code};
  }
  leave(pid: string): Res {
    const r = this.roomOf(pid); if (!r) return {ok: true};
    clearTimeout(r.players.get(pid)!.dc); r.players.delete(pid);
    if (!r.players.size) { clearTimeout(r.timer); clearTimeout(r.adv); clearTimeout(r.warmT); this.rooms.delete(r.code); }
    else {
      if (r.host === pid) r.host = ([...r.players.values()].find(x => x.connected) ?? [...r.players.values()][0]).pid;
      this.push(r); if (r.st === 'play') this.check(r);
    }
    this.send(pid, 'state', null); this.hook(r); return {ok: true};
  }

  // ---------- lobby ----------
  setMode(pid: string, mode: ModeId): Res {
    const r = this.roomOf(pid); if (!r || r.host !== pid || r.st !== 'lobby' || r.busy) return ERR('Only the host can do that');
    if (MODE_IDS.includes(mode)) r.mode = mode;
    this.warm(r); this.push(r); return {ok: true};
  }
  toggleReady(pid: string): Res { const r = this.roomOf(pid); if (!r || r.st !== 'lobby') return ERR('Not in a lobby'); const p = r.players.get(pid)!; p.ready = !p.ready; this.push(r); return {ok: true}; }
  async start(pid: string): Promise<Res> {
    const r = this.roomOf(pid); if (!r || r.host !== pid || r.st !== 'lobby') return ERR('Only the host can start');
    if (r.busy) return ERR('Already starting');
    if (![...r.players.values()].every(p => p.pid === r.host || p.ready)) return ERR('Everyone must be ready');
    clearTimeout(r.warmT);
    const job = r.pre?.key === r.mode ? r.pre.p : this.gen(r);
    r.pre = undefined; r.busy = true; if (this.source.enabled) this.push(r);
    let res: {items: Item[]; ai: boolean};
    try { res = await job; } finally { r.busy = false; }
    if (this.rooms.get(r.code) !== r || r.st !== 'lobby') return ERR('Lobby changed');
    r.items = res.items; r.ai = res.ai; r.q = 0; r.st = 'play'; r.adv = undefined;
    r.seen.push(...res.items.map(it => it.kind === 'mcq' ? it.q : it.kind === 'lingo' ? it.word : it.phrase)); r.seen = r.seen.slice(-200);
    for (const p of r.players.values()) p.st = freshState();
    this.begin(r); this.hook(r); return {ok: true};
  }
  // Pre-generate the next game's questions a moment after the host settles on a mode (hides AI latency).
  private warm(r: Room) {
    if (!this.source.enabled) return;
    clearTimeout(r.warmT);
    r.warmT = setTimeout(() => { r.pre = {key: r.mode, p: this.gen(r)}; }, RULES.ai.warmDelayMs);
  }
  private gen(r: Room) { return this.source.items(r.mode, 1 + Math.floor(Math.random() * 1e9), r.seen.slice(-RULES.ai.avoidRecent)); }
  again(pid: string): Res {
    const r = this.roomOf(pid); if (!r || r.host !== pid || r.st !== 'end') return ERR('Only the host can do that');
    r.st = 'lobby'; r.items = []; for (const p of r.players.values()) { p.ready = false; p.st = freshState(); }
    this.warm(r); this.push(r); this.hook(r); return {ok: true};
  }

  // ---------- game flow ----------
  private begin(r: Room) {
    const it = r.items[r.q], lim = RULES.time[it.kind];
    for (const p of r.players.values()) { p.answered = p.st.out; p.sel = -1; p.correct = null; p.ok = null; p.hide = []; p.guesses = []; p.wheel = newWheel(); p.wbase = p.st.score; }
    r.deadline = Date.now() + lim * 1000; clearTimeout(r.timer); r.adv = undefined;
    r.timer = setTimeout(() => this.expire(r), lim * 1000);
    this.push(r); this.check(r);
  }
  private expire(r: Room) {
    if (r.st !== 'play') return;
    for (const p of r.players.values()) if (!p.answered) this.finalize(r, p);
    this.push(r); this.sched(r);
  }
  private check(r: Room) {
    if (r.st !== 'play' || r.adv) return;
    if ([...r.players.values()].every(p => p.answered || !p.connected)) { clearTimeout(r.timer); this.sched(r); }
  }
  private sched(r: Room) { if (!r.adv) r.adv = setTimeout(() => { r.adv = undefined; void this.next(r); }, RULES.advanceDelayMs); }
  private async next(r: Room) {
    if (r.st !== 'play') return;
    const elim = ['mill', 'pct', 'chase'].includes(r.mode);
    if (r.q + 1 >= r.items.length || (elim && [...r.players.values()].every(p => p.st.out))) return this.finish(r);
    r.q++; this.begin(r);
  }
  private async finish(r: Room) {
    r.st = 'end'; clearTimeout(r.timer); clearTimeout(r.adv); r.adv = undefined;
    const ps = [...r.players.values()], top = Math.max(...ps.map(p => p.st.score));
    if (!r.solo && r.league && top > 0) for (const p of ps) if (p.st.score === top) this.store.addWin(r.league, p.pid, r.mode);
    await this.store.flush();
    this.push(r); this.hook(r);
  }
  private finalize(r: Room, p: RP) {
    const it = r.items[r.q];
    if (it.kind === 'mcq') { p.st = gradeMcq(r.mode, r.q, it, false, p.st); p.correct = false; }
    else if (it.kind === 'lingo') this.endLingo(p, false);
    else this.endWheel(p);
    p.answered = true;
  }
  private endLingo(p: RP, ok: boolean) { p.ok = ok; p.st.score += ok ? RULES.lingo.tries + 1 - p.guesses.length : 0; p.answered = true; }
  private endWheel(p: RP) { p.st.score = p.wbase + Math.max(p.wheel.rs, 0); p.answered = true; }

  // ---------- player actions ----------
  answer(pid: string, i: number): Res {
    const c = this.ctx(pid); if (!c || c.p.answered || c.it.kind !== 'mcq') return ERR('Not now');
    const ok = Number.isInteger(i) && c.it.options[i] === c.it.answer;
    c.p.st = gradeMcq(c.r.mode, c.r.q, c.it, ok, c.p.st); c.p.sel = i; c.p.correct = ok; c.p.answered = true;
    this.push(c.r); this.check(c.r); return {ok: true};
  }
  jeopardyAnswer(pid: string, raw: string): Res {
    const c = this.ctx(pid);
    if (!c || c.r.mode !== 'jeo' || c.p.answered || c.it.kind !== 'mcq') return ERR('Not now');
    const response = raw.trim();
    if (!response) return ERR('Enter your response first');
    const normalize = (value: string) => value.toLocaleLowerCase('en-US')
      .replace(/^(what|who|where|when|which)\s+(is|are|was|were)\s+/i, '')
      .replace(/[^\p{L}\p{N}]+/gu, '');
    const ok = normalize(response) === normalize(c.it.answer);
    c.p.st = gradeMcq('jeo', c.r.q, c.it, ok, c.p.st);
    c.p.sel = -1; c.p.correct = ok; c.p.answered = true;
    this.push(c.r); this.check(c.r); return {ok: true};
  }
  fifty(pid: string): Res {
    const c = this.ctx(pid); if (!c || c.p.answered || c.it.kind !== 'mcq' || c.r.mode !== 'mill' || c.p.st.ll) return ERR('Not available');
    const it = c.it; c.p.hide = it.options.map((_, i) => i).filter(i => it.options[i] !== it.answer).slice(0, 2); c.p.st.ll = true;
    this.push(c.r); return {ok: true};
  }
  chooseOffer(pid: string, raw: string): Res {
    const c = this.ctx(pid);
    if (!c || c.r.mode !== 'chase' || c.r.q !== RULES.chase.cashBuilder || c.p.answered || c.p.st.offer) return ERR('Offer choice is closed');
    if (!['safe', 'standard', 'bold'].includes(raw)) return ERR('Choose one of the three offers');
    const next = {...c.p.st, offer: raw as 'safe' | 'standard' | 'bold'};
    if (next.offer === 'safe') {
      next.score = Math.floor(next.score / 2);
      next.gap = RULES.chase.startGap + 1;
    } else if (next.offer === 'bold') {
      next.score *= 2;
      next.gap = RULES.chase.startGap - 1;
    }
    c.p.st = next;
    this.push(c.r);
    return {ok: true};
  }
  guess(pid: string, raw: string): Res {
    const c = this.ctx(pid); if (!c || c.p.answered || c.it.kind !== 'lingo') return ERR('Not now');
    const w = raw.toUpperCase().replace(/[^A-Z]/g, '');
    if (w.length !== RULES.lingo.length) return ERR(`Need ${RULES.lingo.length} letters`);
    c.p.guesses.push(w);
    if (w === (c.it as LingoItem).word || c.p.guesses.length >= RULES.lingo.tries) this.endLingo(c.p, w === (c.it as LingoItem).word);
    this.push(c.r); this.check(c.r); return {ok: true};
  }
  spin(pid: string): Res {
    const c = this.ctx(pid); if (!c || c.p.answered || c.it.kind !== 'wheel' || c.p.wheel.sp !== null) return ERR('Not now');
    c.p.wheel = wheelSpin(c.p.wheel, Math.floor(Math.random() * RULES.wheel.segments.length));
    this.push(c.r); return {ok: true};
  }
  key(pid: string, letter: string): Res {
    const c = this.ctx(pid); if (!c || c.p.answered || c.it.kind !== 'wheel') return ERR('Not now');
    const res = wheelKey(c.p.wheel, c.it.phrase, letter.toUpperCase());
    if (res.error) return ERR(res.error);
    c.p.wheel = res.w; if (res.done) this.endWheel(c.p);
    this.push(c.r); this.check(c.r); return {ok: true};
  }

  solveWheel(pid: string, raw: string): Res {
    const c = this.ctx(pid); if (!c || c.p.answered || c.it.kind !== 'wheel') return ERR('Not now');
    const answer = raw.toUpperCase().replace(/[^A-Z ]/g, ' ').replace(/\s+/g, ' ').trim();
    if (!answer) return ERR('Enter your solution first');
    if (answer === c.it.phrase) {
      c.p.wheel.rs += RULES.wheel.solveBonus;
      c.p.wheel.last = 'Puzzle solved!';
      this.endWheel(c.p);
    } else {
      c.p.wheel.bad++;
      c.p.wheel.last = 'Not quite — try another letter';
      if (c.p.wheel.bad >= RULES.wheel.maxWrong) this.endWheel(c.p);
    }
    this.push(c.r); this.check(c.r); return {ok: true};
  }
}
