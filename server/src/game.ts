// Authoritative game server logic. Knows nothing about sockets: it gets a `send` function.
import {RULES, MODE_IDS, GENRES, type ModeId} from '../../shared/src/config';
import {buildItems, freshState, gradeMcq, lingoColors, newWheel, publicQ, wheelKey, wheelMask, wheelSpin, type Item, type LingoItem, type PState, type WheelRound} from '../../shared/src/engine';
import type {LeagueView, MyView, Snapshot} from '../../shared/src/types';
import type {Store} from './store';

type Send = (pid: string, ev: string, data: unknown) => void;
type Res = {ok?: true; error?: string; code?: string};
interface RP {
  pid: string; name: string; ready: boolean; connected: boolean; st: PState; answered: boolean; sel: number;
  correct: boolean | null; ok: boolean | null; hide: number[]; guesses: string[]; wheel: WheelRound; wbase: number; dc?: NodeJS.Timeout;
}
interface Room {
  code: string; host: string; solo: boolean; mode: ModeId; genre: string; st: 'lobby' | 'play' | 'end'; q: number; items: Item[];
  players: Map<string, RP>; league: string; deadline: number; timer?: NodeJS.Timeout; adv?: NodeJS.Timeout;
}
const mk = (pid: string, name: string): RP => ({pid, name, ready: false, connected: true, st: freshState(), answered: false, sel: -1, correct: null, ok: null, hide: [], guesses: [], wheel: newWheel(), wbase: 0});
const ERR = (error: string): Res => ({error});

export class Game {
  rooms = new Map<string, Room>();
  constructor(private send: Send, private store: Store, private onLeague: (code: string) => void) {}

  // ---------- helpers ----------
  private roomOf(pid: string) { for (const r of this.rooms.values()) if (r.players.has(pid)) return r; }
  private ctx(pid: string) {
    const r = this.roomOf(pid), p = r?.players.get(pid);
    return r && p && r.st === 'play' ? {r, p, it: r.items[r.q]} : null;
  }
  private party(lg: string) { for (const r of this.rooms.values()) if (r.league === lg && !r.solo) return {code: r.code, state: r.st}; return null; }
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
      view = {answered: me.answered, sel: me.sel, correct: me.correct, hide: me.hide, ll: me.st.ll, ok: me.ok, guesses: [], answer: undefined};
      if (it.kind === 'mcq' && me.answered) view.answer = it.answer;
      if (it.kind === 'lingo') { view.guesses = me.guesses.map(w => ({w, c: lingoColors(w, it.word)})); if (me.answered) view.word = it.word; }
      if (it.kind === 'wheel') view.wheel = {mask: wheelMask(me.wheel, it.phrase, me.answered), sp: me.wheel.sp, rs: me.wheel.rs, bad: me.wheel.bad, last: me.wheel.last, used: me.wheel.gs};
    }
    return {
      code: r.solo ? '' : r.code, solo: r.solo, host: r.host, mode: r.mode, genre: r.genre, st: r.st, q: r.q, total: r.items.length, league: r.league,
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
    if (lg) {
      if (!this.store.isMember(lg, pid)) return ERR('Join the league first');
      const party = this.party(lg); if (party) return {error: 'A party is already open', code: party.code};
    }
    this.leave(pid);
    let code = ''; do code = String(Math.floor(Math.random() * 10 ** RULES.roomCodeLength)).padStart(RULES.roomCodeLength, '0'); while (this.rooms.has(code));
    const r: Room = {code, host: pid, solo: !!o.solo, mode: 'pub', genre: 'all', st: 'lobby', q: 0, items: [], players: new Map(), league: lg, deadline: 0};
    r.players.set(pid, mk(pid, name)); this.rooms.set(code, r);
    this.push(r); this.hook(r); return {ok: true, code};
  }
  join(pid: string, name: string, code: string): Res {
    const r = this.rooms.get(code.trim());
    if (!r || r.solo) return ERR('No lobby with that code');
    if (r.players.has(pid)) { this.onConnect(pid, name); return {ok: true, code: r.code}; }
    if (r.st === 'play') return ERR('Game already started');
    if (r.players.size >= RULES.maxPlayers) return ERR('Lobby is full');
    if (r.league && !this.store.isMember(r.league, pid)) return ERR('Join the league first');
    this.leave(pid);
    r.players.set(pid, mk(pid, name)); this.push(r); this.hook(r); return {ok: true, code: r.code};
  }
  leave(pid: string): Res {
    const r = this.roomOf(pid); if (!r) return {ok: true};
    clearTimeout(r.players.get(pid)!.dc); r.players.delete(pid);
    if (!r.players.size) { clearTimeout(r.timer); clearTimeout(r.adv); this.rooms.delete(r.code); }
    else {
      if (r.host === pid) r.host = ([...r.players.values()].find(x => x.connected) ?? [...r.players.values()][0]).pid;
      this.push(r); if (r.st === 'play') this.check(r);
    }
    this.send(pid, 'state', null); this.hook(r); return {ok: true};
  }

  // ---------- lobby ----------
  setMode(pid: string, mode: ModeId, genre?: string): Res {
    const r = this.roomOf(pid); if (!r || r.host !== pid || r.st !== 'lobby') return ERR('Only the host can do that');
    if (MODE_IDS.includes(mode)) r.mode = mode;
    if (genre && GENRES.includes(genre)) r.genre = genre;
    this.push(r); return {ok: true};
  }
  toggleReady(pid: string): Res { const r = this.roomOf(pid); if (!r || r.st !== 'lobby') return ERR('Not in a lobby'); const p = r.players.get(pid)!; p.ready = !p.ready; this.push(r); return {ok: true}; }
  start(pid: string): Res {
    const r = this.roomOf(pid); if (!r || r.host !== pid || r.st !== 'lobby') return ERR('Only the host can start');
    if (![...r.players.values()].every(p => p.pid === r.host || p.ready)) return ERR('Everyone must be ready');
    r.items = buildItems(r.mode, 1 + Math.floor(Math.random() * 1e9), r.genre); r.q = 0; r.st = 'play'; r.adv = undefined;
    for (const p of r.players.values()) p.st = freshState();
    this.begin(r); this.hook(r); return {ok: true};
  }
  again(pid: string): Res {
    const r = this.roomOf(pid); if (!r || r.host !== pid || r.st !== 'end') return ERR('Only the host can do that');
    r.st = 'lobby'; r.items = []; for (const p of r.players.values()) { p.ready = false; p.st = freshState(); }
    this.push(r); this.hook(r); return {ok: true};
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
  private sched(r: Room) { if (!r.adv) r.adv = setTimeout(() => { r.adv = undefined; this.next(r); }, RULES.advanceDelayMs); }
  private next(r: Room) {
    if (r.st !== 'play') return;
    const elim = ['mill', 'pct', 'chase'].includes(r.mode);
    if (r.q + 1 >= r.items.length || (elim && [...r.players.values()].every(p => p.st.out))) return this.finish(r);
    r.q++; this.begin(r);
  }
  private finish(r: Room) {
    r.st = 'end'; clearTimeout(r.timer); clearTimeout(r.adv); r.adv = undefined;
    const ps = [...r.players.values()], top = Math.max(...ps.map(p => p.st.score));
    if (!r.solo && r.league && top > 0) for (const p of ps) if (p.st.score === top) this.store.addWin(r.league, p.pid, r.mode);
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
  fifty(pid: string): Res {
    const c = this.ctx(pid); if (!c || c.p.answered || c.it.kind !== 'mcq' || c.r.mode !== 'mill' || c.p.st.ll) return ERR('Not available');
    const it = c.it; c.p.hide = it.options.map((_, i) => i).filter(i => it.options[i] !== it.answer).slice(0, 2); c.p.st.ll = true;
    this.push(c.r); return {ok: true};
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
}
