// Headless test: plays every mode through the real Game logic with a fake transport. Run: npm test
import {Game} from './game';
import {Store} from './store';
import {RULES, MODE_IDS} from '../../shared/src/config';

RULES.advanceDelayMs = 5; RULES.time.mcq = RULES.time.lingo = RULES.time.wheel = 0.12;
const snaps = new Map<string, any>();
const store = new Store();
const game = new Game((pid, ev, d) => { if (ev === 'state') snaps.set(pid, d); }, store, () => {});
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));
let fails = 0;
const check = (name: string, ok: boolean, extra = '') => { console.log((ok ? 'PASS ' : 'FAIL ') + name + (extra ? ' ' + extra : '')); if (!ok) fails++; };

const lg = store.create('Fam', 'A', 'Ann'); store.join(lg.code, 'B', 'Bob');
const made = game.create('A', 'Ann', {league: lg.code}) as any;
check('league party created', !!made.code && game.leagueView(lg.code)?.party?.code === made.code);
check('second party blocked', !!(game.create('B', 'Bob', {league: lg.code}) as any).error);
check('join party', !!(game.join('B', 'Bob', made.code) as any).ok);
check('start blocked until ready', !!(game.start('A') as any).error);
game.toggleReady('B');
const room = game.rooms.get(made.code)!;

for (const mode of MODE_IDS) {
  game.setMode('A', mode, 'all');
  check(mode + ' starts', !!(game.start('A') as any).ok);
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
const solo = game.create('A', 'Ann', {solo: true}) as any; game.setMode('A', 'pub'); check('solo starts alone', !!(game.start('A') as any).ok);
game.leave('A');
console.log(fails ? `\n${fails} FAILED` : '\nALL PASSED'); process.exit(fails ? 1 : 0);
