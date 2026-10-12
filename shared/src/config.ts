// ALL game rules live here. Change a number and both server and client follow.
export type ModeId = 'pub' | 'mill' | 'pct' | 'jeo' | 'chase' | 'lingo' | 'wheel';
export const MODE_IDS: ModeId[] = ['pub', 'mill', 'pct', 'jeo', 'chase', 'lingo', 'wheel'];

export const MODES: Record<ModeId, {name: string; emoji: string; color: string; desc: string}> = {
  pub:   {name: 'Pub Quiz', emoji: '\u{1F37A}', color: '#d97706', desc: 'A lively set of mixed-category questions. Highest score takes the night.'},
  mill:  {name: 'Millionaire', emoji: '\u{1F4B0}', color: '#2563eb', desc: 'Climb 15 prize steps with a 50:50 lifeline and two safe checkpoints.'},
  pct:   {name: '1% Club', emoji: '\u{1F4AF}', color: '#db2777', desc: 'Logic and common-sense puzzles get tougher as the crowd gets smaller.'},
  jeo:   {name: 'Jeopardy', emoji: '\u{2753}', color: '#1d4ed8', desc: 'Choose a clue, make your response in question form, and wager your points.'},
  chase: {name: 'The Chase', emoji: '\u{1F3C3}', color: '#7c3aed', desc: 'Build a cash pot, take an offer, and try to stay ahead of the Chaser.'},
  lingo: {name: 'Lingo', emoji: '\u{1F524}', color: '#0891b2', desc: 'Use the colour clues to solve a five-letter word in five guesses.'},
  wheel: {name: 'Wheel of Fortune', emoji: '\u{1F3A1}', color: '#ea580c', desc: 'Spin for a consonant value, buy vowels, then solve the hidden phrase.'}
};

export const RULES = {
  ai: {timeoutMs: 15000, avoidRecent: 40, warmDelayMs: 1500, extra: 3},  // AI question generation (see server/src/ai.ts)
  maxPlayers: 10,
  roomCodeLength: 6,
  leagueCodeLength: 6,
  advanceDelayMs: 2000,         // pause after everyone answered, to show the answer
  graceMs: 6000,                // x5 = how long a disconnected player is kept
  time: {mcq: 20, lingo: 90, wheel: 120},   // seconds per question / round
  count: {pub: 12, mill: 15, pct: 10, jeo: 15, chase: 17, lingo: 4, wheel: 3},
  millLadder: [100, 200, 300, 500, 1000, 2000, 4000, 8000, 16000, 32000, 64000, 125000, 250000, 500000, 1000000],
  pctLadder: [90, 80, 70, 60, 50, 40, 30, 20, 10, 1],
  jeoValues: [200, 400, 600, 800, 1000, 200, 400, 600, 800, 1000, 200, 400, 600, 800, 1000],
  chase: {cashBuilder: 5, cashPerCorrect: 1000, startGap: 3, homeGap: 7, chaserAccuracy: 0.75},
  lingo: {length: 5, tries: 5},                // points = tries + 1 - guessesUsed
  wheel: {segments: [100, 200, 300, 400, 500, 800, 1000, 'BANKRUPT'] as (number | 'BANKRUPT')[], vowelCost: 250, solveBonus: 500, maxWrong: 6}
};
