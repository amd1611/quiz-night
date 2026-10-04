// ALL game rules live here. Change a number and both server and client follow.
export type ModeId = 'pub' | 'mill' | 'pct' | 'jeo' | 'chase' | 'song' | 'lingo' | 'wheel';
export const MODE_IDS: ModeId[] = ['pub', 'mill', 'pct', 'jeo', 'chase', 'song', 'lingo', 'wheel'];
export const GENRES = ['all', 'Pop', 'Rock', 'Hip-Hop', 'Dance'];

export const MODES: Record<ModeId, {name: string; emoji: string; color: string; desc: string}> = {
  pub:   {name: 'Pub Quiz', emoji: '🍺', color: '#d97706', desc: '12 mixed questions, 1 point each. Most points wins.'},
  mill:  {name: 'Millionaire', emoji: '💰', color: '#2563eb', desc: 'Climb the money ladder. One wrong answer and you are out. One 50:50 lifeline.'},
  pct:   {name: '1% Club', emoji: '💯', color: '#db2777', desc: 'Questions get harder (90% down to 1%). One wrong answer and you are eliminated.'},
  jeo:   {name: 'Jeopardy', emoji: '❓', color: '#1d4ed8', desc: 'Clues worth $200-$1000. Right adds, wrong subtracts.'},
  chase: {name: 'The Chase', emoji: '🏃', color: '#7c3aed', desc: 'Build a bank with 5 cash-builder questions, then outrun the Chaser. Get caught and you lose it all.'},
  song:  {name: 'Guess the Song', emoji: '🎵', color: '#059669', desc: 'Clue-based song quiz. Pick a genre.'},
  lingo: {name: 'Lingo', emoji: '🔤', color: '#0891b2', desc: 'Guess the 5-letter word in 5 tries. The first letter is given.'},
  wheel: {name: 'Wheel of Fortune', emoji: '🎡', color: '#ea580c', desc: 'Spin, guess consonants for cash, buy vowels, reveal the puzzle.'}
};

export const RULES = {
  maxPlayers: 10,
  roomCodeLength: 6,
  leagueCodeLength: 6,
  advanceDelayMs: 1800,         // pause after everyone answered, to show the answer
  graceMs: 6000,                // x5 = how long a disconnected player is kept
  time: {mcq: 20, lingo: 90, wheel: 120},   // seconds per question / round
  count: {pub: 12, mill: 10, pct: 10, jeo: 10, chase: 17, song: 8, lingo: 4, wheel: 3},
  millLadder: [100, 200, 300, 500, 1000, 2000, 4000, 8000, 16000, 32000],
  pctLadder: [90, 80, 70, 60, 50, 40, 30, 20, 10, 1],
  jeoValues: [200, 200, 400, 400, 600, 600, 800, 800, 1000, 1000],
  chase: {cashBuilder: 5, cashPerCorrect: 1000, startGap: 3, homeGap: 7, chaserAccuracy: 0.75},
  lingo: {length: 5, tries: 5},                // points = tries + 1 - guessesUsed
  wheel: {segments: [100, 200, 300, 400, 500, 800, 1000, 'BANKRUPT'] as (number | 'BANKRUPT')[], vowelCost: 250, solveBonus: 500, maxWrong: 6}
};
