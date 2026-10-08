// Headless test: plays every mode through the real Game logic with a fake transport. Run: npm test
import {Game} from './game';
import {Store} from './store';
import {QuestionSource, aiConfig} from './ai';
import {RULES, MODE_IDS} from '../../shared/src/config';

RULES.advanceDelayMs = 5; RULES.time.mcq = RULES.time.lingo = RULES.time.wheel = 0.12;
const snaps = new Map<string, any>();
const store = new Store();
const game = new Game((pid, ev, d) => { if (ev === 'state') snaps.set(pid, d); }, store, () => {}, new QuestionSource(null));
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));
let fails = 0;
const check = (name: string, ok: boolean, extra = '') => { console.log((ok ? 'PASS ' : 'FAIL ') + name + (extra ? ' ' + extra : '')); if (!ok) fails++; };

const lg = store.create('Fam', 'A', 'Ann'); store.join(lg.code, 'B', 'Bob');
const made = game.create('A', 'Ann', {league: lg.code}) as any;
check('league party created', !!made.code && game.leagueView(lg.code)?.party?.code === made.code);
check('second party blocked', !!(game.create('B', 'Bob', {league: lg.code}) as any).error);
check('join party', !!(game.join('B', 'Bob', made.code) as any).ok);
check('start blocked until ready', !!((await game.start('A')) as any).error);
game.toggleReady('B');
const room = game.rooms.get(made.code)!;

for (const mode of MODE_IDS) {
  game.setMode('A', mode);
  check(mode + ' starts', !!((await game.start('A')) as any).ok);
  const seen = new Set<string>();
  for (let guard = 0; guard < 400 && room.st === 'play'; guard++) {
    const it = room.items[room.q], key = room.q + ':' + (snaps.get('A')?.me?.answered);
    if (it.kind === 'mcq') { const i = it.options.indexOf(it.answer); if (!room.players.get('A')!.answered) game.answer('A', i); }
    else if (it.kind === 'lingo') { if (!room.players.get('A')!.answered) { game.guess('A', 'zz'); game.guess('A', it.word); } }
    else if (!room.players.get('A')!.answered) {
      const p = room.players.get('A')!;
      for (const l of 'RSTNLDCHPMBGKFWYVXJQZ') { if (p.answered) break; if (p.wheel.sp === null) game.spin('A'); game.key('A', l); }
    }
    seen.add(key); await sleep(20);
  }
  const a = room.players.get('A')!.st, b = room.players.get('B')!.st;
  check(mode + ' finished', room.st === 'end', `A=${a.score} B=${b.score}`);
  const leak = JSON.stringify(snaps.get('B')?.question ?? {});
  check(mode + ' hides answers', !leak.includes('"answer"'));
  game.again('A'); game.toggleReady('B');
}
const board = game.leagueView(lg.code)!.members;
console.log(JSON.stringify(board));
check('A earned league wins', (board.find(m => m.pid === 'A')?.t ?? 0) >= 6);
check('B reconnect keeps room', (game.onConnect('B', 'Bob'), snaps.get('B')?.code === made.code));
game.leave('A'); check('host passes on leave', room.host === 'B');
game.leave('B'); check('empty room removed', game.rooms.size === 0 && game.leagueView(lg.code)?.party === null);
const solo = game.create('A', 'Ann', {solo: true}) as any; game.setMode('A', 'pub'); check('solo starts alone', !!((await game.start('A')) as any).ok);
game.leave('A');
// ---- AI question source (fake fetch, no network) ----
RULES.ai.warmDelayMs = 20;
let fetches = 0, failAi = false;
const WORDS5 = ['ALPHA', 'BRAVO', 'CHARM', 'DELTA', 'EAGLE', 'FLAME', 'GRAPE', 'HOUSE', 'IVORY', 'JOLLY'];
globalThis.fetch = (async (_u: any, init: any) => {
  fetches++; if (failAi) throw new Error('boom');
  const text: string = JSON.parse(init.body).contents[0].parts[0].text, n = +/with (\d+) /.exec(text)![1];
  const payload = text.includes('"words"') ? {words: WORDS5}
    : text.includes('"puzzles"') ? {puzzles: ['BIG APPLE', 'HOT DOG', 'BLUE MOON', 'RED WINE', 'DARK HORSE', 'SUN HAT', 'ICE CREAM'].map(p => ({hint: 'THING', phrase: p}))}
    : {questions: Array.from({length: n}, (_, i) => ({cat: 'AI', q: 'AI question ' + i + ' ' + fetches, answer: 'Right' + i, wrong: ['W1_' + i, 'W2_' + i, 'W3_' + i]}))};
  return {ok: true, json: async () => ({candidates: [{content: {parts: [{text: JSON.stringify(payload)}]}}]})};
}) as any;
const aiSnaps = new Map<string, any>();
const ag = new Game((pid, ev, d) => { if (ev === 'state' && d) aiSnaps.set(pid, d); }, new Store(), () => {}, new QuestionSource(aiConfig({GEMINI_API_KEY: 'x'})));
ag.create('Z', 'Zed', {solo: true});
for (const mode of MODE_IDS) {
  ag.setMode('Z', mode); await sleep(60);
  const before = fetches; const res: any = await ag.start('Z');
  const room = [...ag.rooms.values()][0], it = room.items[0];
  const fromAi = it.kind === 'mcq' ? it.q.startsWith('AI question') : it.kind === 'lingo' ? WORDS5.includes(it.word) : /^[A-Z]+( [A-Z]+)+$/.test(it.phrase);
  check(mode + ' uses AI questions', !!res.ok && aiSnaps.get('Z').ai === true && fromAi, `fetches +${fetches - before} (prefetched)`);
  check(mode + ' prefetch avoided a second call', fetches - before === 0);
  room.st = 'end'; clearTimeout(room.timer); clearTimeout(room.adv); ag.again('Z');
}
failAi = true; ag.setMode('Z', 'pub'); await sleep(60);
const fb: any = await ag.start('Z');
check('falls back to built-in bank when AI fails', !!fb.ok && aiSnaps.get('Z').ai === false && aiSnaps.get('Z').total === RULES.count.pub);
ag.leave('Z');
console.log(fails ? `\n${fails} FAILED` : '\nALL PASSED'); process.exit(fails ? 1 : 0);
