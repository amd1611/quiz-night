import {useEffect, useState, type FormEvent} from 'react';
import {Check, Clock3, Crown, Lightbulb, Sparkles, Target} from 'lucide-react';
import {MODES, RULES, type ModeId} from '@shared/config';
import type {MyView, PublicQ, Snapshot} from '@shared/types';
import {myId} from './net';

export type Act = (event: string, data?: object) => Promise<any>;
export const money = (mode: ModeId, amount: number) =>
  ['mill', 'jeo', 'chase', 'wheel'].includes(mode) ? '$' + amount.toLocaleString() : String(amount);

export default function Game({snap, act}: {snap: Snapshot; act: Act}) {
  const me = snap.me!;
  const question = snap.question!;
  const mode = MODES[snap.mode];
  const self = snap.players.find(player => player.pid === myId);
  const [receivedAt, setReceivedAt] = useState(Date.now());
  const [now, setNow] = useState(Date.now());
  useEffect(() => setReceivedAt(Date.now()), [snap]);
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 300);
    return () => window.clearInterval(timer);
  }, []);

  const secondsLeft = Math.max(0, Math.ceil((snap.ms - (now - receivedAt)) / 1000));
  const progress = Math.min(100, ((snap.q + (me.answered ? 1 : 0)) / Math.max(snap.total, 1)) * 100);

  return <div className="game-view">
    <div className="game-topline">
      <div className="game-mode-heading">
        <span className="mode-glyph" style={{background: mode.color}}>{mode.emoji}</span>
        <div><span className="eyebrow">NOW PLAYING</span><h1>{mode.name}{snap.ai && <span className="ai-tag"><Sparkles size={13} /> FRESH AI ROUND</span>}</h1></div>
      </div>
      <div className={'game-clock' + (secondsLeft <= 5 ? ' clock-low' : '')}><Clock3 size={17} /><b>{secondsLeft}</b><span>sec</span></div>
    </div>
    <div className="round-progress"><span style={{width: progress + '%'}} /></div>

    <div className="game-players">
      <div className="game-player-strip">
        {snap.players.map((player, index) => <div className={'game-player' + (player.pid === myId ? ' current-player' : '') + (player.out ? ' player-out' : '')} key={player.pid}>
          <span className={'player-avatar avatar-tone-' + index % 5}>{player.score === Math.max(...snap.players.map(item => item.score)) && player.score > 0 && snap.st === 'end' ? <Crown size={15} /> : player.name.slice(0, 1).toUpperCase()}</span>
          <span className="game-player-copy"><b>{player.name}</b><strong>{money(snap.mode, player.score)}</strong></span>
          {player.answered && <Check size={14} className="player-check" />}
        </div>)}
      </div>
      <span className="round-count">ROUND <b>{snap.q + 1}</b><span>/</span>{snap.total}</span>
    </div>

    {self?.out && <div className="game-notice out-notice"><Target size={17} />{snap.mode === 'chase' && self.gap >= RULES.chase.homeGap ? 'You made it home — nice chase!' : 'You’re out for this round. Cheer on the crew!'}</div>}
    <div className="game-layout">
      <main className="question-column">
        {snap.mode === 'chase' && <ChaseTrack gap={self?.gap ?? RULES.chase.startGap} />}
        {question.kind === 'mcq' && snap.mode === 'chase' && snap.q === RULES.chase.cashBuilder && !me.offer
          ? <ChaseOffer bank={self?.score ?? 0} act={act} />
          : question.kind === 'mcq' && <MultipleChoice question={question} view={me} mode={snap.mode} act={act} />}
        {question.kind === 'jeo' && <JeopardyClue question={question} view={me} act={act} />}
        {question.kind === 'lingo' && <Lingo key={snap.q} question={question} view={me} act={act} />}
        {question.kind === 'wheel' && <Wheel key={snap.q} question={question} view={me} act={act} />}
        <div className="answer-status">{me.answered ? <><Check size={15} /> Answer locked in — hang tight for the reveal.</> : <><span className="status-dot online" /> Your answer is private until everyone’s in.</>}</div>
      </main>
      {snap.mode === 'mill' && <MillionaireLadder round={snap.q} />}
      {snap.mode === 'jeo' && <JeopardyNote />}
      {snap.mode === 'pct' && <ClubNote round={snap.q} />}
    </div>
  </div>;
}

function ChaseOffer({bank, act}: {bank: number; act: Act}) {
  return <section className="question-card chase-offer-card">
    <div className="question-card-head"><span className="question-category">CASH BUILDER COMPLETE</span><span className="question-number">CHOOSE YOUR STARTING OFFER</span></div>
    <h2 className="question-prompt">How bold are you feeling?</h2>
    <p className="question-subprompt">Banked so far: <strong>{money('chase', bank)}</strong>. A safer offer gives you more room; the bold offer brings the Chaser closer.</p>
    <div className="offer-grid">
      <button className="offer-choice offer-safe" onClick={() => void act('offer', {choice: 'safe'})}>
        <span className="eyebrow">SAFER START</span><b>{money('chase', Math.floor(bank / 2))}</b><small>More space from the Chaser</small><span className="offer-gap">4 steps to home</span>
      </button>
      <button className="offer-choice offer-standard" onClick={() => void act('offer', {choice: 'standard'})}>
        <span className="eyebrow">THE STANDARD</span><b>{money('chase', bank)}</b><small>The classic middle ground</small><span className="offer-gap">3 steps to home</span>
      </button>
      <button className="offer-choice offer-bold" onClick={() => void act('offer', {choice: 'bold'})}>
        <span className="eyebrow">HIGH OFFER</span><b>{money('chase', bank * 2)}</b><small>Big reward, Chaser closer</small><span className="offer-gap">2 steps to home</span>
      </button>
    </div>
  </section>;
}

function MultipleChoice({question, view, mode, act}: {question: Extract<PublicQ, {kind: 'mcq'}>; view: MyView; mode: ModeId; act: Act}) {
  const answered = view.answered;
  return <section className="question-card">
    <div className="question-card-head"><span className="question-category">{question.meta}</span><span className="question-number">{mode === 'mill' ? 'CLIMB THE LADDER' : 'QUESTION'}</span></div>
    <h2 className="question-prompt">{question.q}</h2>
    <div className="answer-options">
      {question.options.map((option, index) => <button key={index} disabled={answered || view.hide.includes(index)}
        className={'answer-option' + (answered && option === view.answer ? ' answer-correct' : '') + (answered && view.sel === index && !view.correct ? ' answer-wrong' : '') + (view.hide.includes(index) ? ' answer-hidden' : '')}
        onClick={() => void act('answer', {i: index})}>
        <span className="option-letter">{String.fromCharCode(65 + index)}</span><span>{option}</span>{answered && option === view.answer && <Check size={18} />}
      </button>)}
    </div>
    <div className="question-card-footer">
      {mode === 'mill' && !view.ll && !answered && <button className="lifeline-button" onClick={() => void act('fifty')}><span>50:50</span> Use lifeline</button>}
      {answered && <div className={'answer-reveal' + (view.correct ? ' reveal-correct' : ' reveal-wrong')}><span>{view.correct ? 'That’s right!' : 'The answer was'}</span><b>{view.correct ? 'Nice one.' : view.answer}</b></div>}
      {!answered && mode === 'jeo' && <span className="answer-hint"><Lightbulb size={15} /> Give your response in question form.</span>}
    </div>
  </section>;
}

function JeopardyClue({question, view, act}: {question: Extract<PublicQ, {kind: 'jeo'}>; view: MyView; act: Act}) {
  const [response, setResponse] = useState('');
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!response.trim() || view.answered) return;
    void act('jeopardy:answer', {response});
    setResponse('');
  };
  return <section className="question-card jeopardy-card">
    <div className="question-card-head"><span className="question-category">{question.meta}</span><span className="question-number">RESPOND IN QUESTION FORM</span></div>
    <div className="jeopardy-frame"><span className="eyebrow">HERE IS YOUR CLUE</span><h2>{question.q}</h2><span className="jeopardy-spark">✦</span></div>
    {view.answered
      ? <div className={'answer-reveal jeopardy-reveal ' + (view.correct ? 'reveal-correct' : 'reveal-wrong')}><span>{view.correct ? 'Correct response' : 'The correct response'}</span><b>{view.answer}</b></div>
      : <form className="jeopardy-form" onSubmit={submit}>
        <label className="sr-only" htmlFor="jeopardy-response">Your response</label>
        <input id="jeopardy-response" value={response} autoComplete="off" placeholder="What is… or Who is…" onChange={event => setResponse(event.target.value)} />
        <button className="button button-primary" type="submit" disabled={!response.trim()}>Lock response <Check size={16} /></button>
      </form>}
  </section>;
}

function MillionaireLadder({round}: {round: number}) {
  return <aside className="game-side-card millionaire-card">
    <div className="side-card-heading"><span className="ladder-icon">✦</span><span>THE MONEY LADDER</span></div>
    <div className="prize-list">
      {[...RULES.millLadder].reverse().map((prize, index) => {
        const level = RULES.millLadder.length - 1 - index;
        const safe = level === 4 || level === 9;
        return <div className={'prize-step' + (level === round ? ' prize-current' : '') + (level < round ? ' prize-past' : '') + (safe ? ' prize-safe' : '')} key={prize}>
          <span>{safe && <span className="safe-star">★</span>}{level + 1}</span><b>{money('mill', prize)}</b>
        </div>;
      })}
    </div>
    <div className="safe-haven-note"><Check size={14} /> Safe havens at $1,000 and $32,000</div>
  </aside>;
}

function JeopardyNote() {
  return <aside className="game-side-card format-note jeopardy-note">
    <div className="format-note-icon">?</div><span className="eyebrow">THE JEOPARDY! WAY</span><h3>Clue in. Response out.</h3><p>Read the category closely, then put your response in the form of a question.</p><span className="note-decoration">DAILY DOUBLE ENERGY</span>
  </aside>;
}

function ClubNote({round}: {round: number}) {
  const percent = RULES.pctLadder[round] ?? 1;
  return <aside className="game-side-card format-note club-note">
    <div className="club-mark">1<span>%</span></div><span className="eyebrow">HOW MANY GET IT?</span><h3>{percent}% challenge</h3><p>Take a breath and spot the pattern. This round is about logic, not trivia.</p><div className="club-progress">{RULES.pctLadder.map((_, index) => <span className={index <= round ? 'passed' : ''} key={index} />)}</div>
  </aside>;
}

function ChaseTrack({gap}: {gap: number}) {
  const max = RULES.chase.homeGap;
  return <div className="chase-track-card">
    <div className="chase-track-label"><span className="eyebrow">THE CHASE</span><span>Stay ahead to take the cash</span></div>
    <div className="chase-track"><span className="track-line" /><span className="track-start">START</span>
      {Array.from({length: max + 1}, (_, index) => <span className={'track-step' + (index < gap ? ' player-step' : '') + (index === 0 ? ' chaser-step' : '') + (index === max ? ' home-step' : '')} key={index}>
        {index === 0 ? '♟' : index === gap ? '●' : index === max ? '⌂' : ''}
      </span>)}
      <span className="track-home">HOME</span>
    </div>
  </div>;
}

function Lingo({question, view, act}: {question: Extract<PublicQ, {kind: 'lingo'}>; view: MyView; act: Act}) {
  const [guess, setGuess] = useState('');
  const submit = (event?: FormEvent) => {
    event?.preventDefault();
    if (guess.length !== question.len || view.answered) return;
    void act('guess', {w: guess});
    setGuess('');
  };
  return <section className="question-card lingo-card">
    <div className="question-card-head"><span className="question-category">WORD ROUND</span><span className="question-number">5 LETTERS · {question.tries} GUESSES</span></div>
    <h2 className="question-prompt">Crack the word.</h2><p className="question-subprompt">Green is in the right spot. Gold is in the word, somewhere else.</p>
    <div className="lingo-board">
      {Array.from({length: question.tries}).map((_, row) => {
        const item = view.guesses[row];
        return <div className="lingo-row" key={row}>{Array.from({length: question.len}).map((_, column) => {
          const letter = item?.w[column] || (!item && row === 0 && column === 0 ? question.first : '');
          return <span className={'lingo-tile' + (item ? ' tile-' + item.c[column] : '') + (letter && !item ? ' tile-given' : '')} key={column}>{letter}</span>;
        })}</div>;
      })}
    </div>
    {view.answered ? <div className={'answer-reveal lingo-reveal ' + (view.ok ? 'reveal-correct' : 'reveal-wrong')}><span>{view.ok ? 'LINGO!' : 'The word was'}</span><b>{view.ok ? 'Well played.' : view.word}</b></div> : <form className="lingo-form" onSubmit={submit}>
      <label className="sr-only" htmlFor="lingo-guess">Five-letter word</label>
      <input id="lingo-guess" value={guess} maxLength={question.len} autoCapitalize="characters" autoComplete="off" placeholder="TYPE YOUR GUESS" onChange={event => setGuess(event.target.value.toUpperCase().replace(/[^A-Z]/g, ''))} />
      <button className="button button-primary" type="submit" disabled={guess.length !== question.len}>Lock guess <Check size={16} /></button>
    </form>}
  </section>;
}

function Wheel({question, view, act}: {question: Extract<PublicQ, {kind: 'wheel'}>; view: MyView; act: Act}) {
  const wheel = view.wheel!;
  const [solution, setSolution] = useState('');
  const solve = (event: FormEvent) => {
    event.preventDefault();
    if (!solution.trim()) return;
    void act('solve', {phrase: solution});
    setSolution('');
  };
  return <section className="question-card wheel-card">
    <div className="question-card-head"><span className="question-category">{question.hint}</span><span className="wheel-bank">ROUND BANK <b>{money('wheel', wheel.rs)}</b></span></div>
    <h2 className="question-prompt">Spin, guess, solve.</h2>
    <div className="wheel-puzzle">{wheel.mask.map((letter, index) => letter === ' ' ? <span className="puzzle-space" key={index} /> : <span className={'puzzle-letter' + (letter !== '_' ? ' letter-shown' : '')} key={index}>{letter === '_' ? '' : letter}</span>)}</div>
    <div className="wheel-feedback">{wheel.last || 'Consonants earn cash. Vowels cost ' + money('wheel', RULES.wheel.vowelCost) + '.'}</div>
    {!view.answered && <>
      <div className="wheel-controls"><button className="spin-button" disabled={wheel.sp !== null} onClick={() => void act('spin')}><span className="spin-symbol">✦</span>Spin the wheel</button>
        {wheel.sp !== null && <span className="spin-value">{money('wheel', wheel.sp)}<small>PER CONSONANT</small></span>}
        <span className="wrong-count">{wheel.bad}<small>WRONG</small></span>
      </div>
      <div className="wheel-keyboard">{[...'ABCDEFGHIJKLMNOPQRSTUVWXYZ'].map(letter => {
        const vowel = 'AEIOU'.includes(letter);
        const disabled = wheel.used.includes(letter) || (vowel && wheel.rs < RULES.wheel.vowelCost);
        return <button key={letter} disabled={disabled} className={(vowel ? 'vowel-key' : '') + (wheel.used.includes(letter) ? ' used-key' : '')} onClick={() => void act('key', {l: letter})}>{letter}</button>;
      })}</div>
      <form className="wheel-solve-form" onSubmit={solve}><label className="sr-only" htmlFor="wheel-solution">Solve the phrase</label>
        <input id="wheel-solution" value={solution} autoComplete="off" placeholder="Or solve the phrase…" onChange={event => setSolution(event.target.value)} />
        <button className="button button-dark" type="submit">Solve <Check size={16} /></button>
      </form>
    </>}
    {view.answered && <div className="answer-reveal reveal-correct wheel-reveal"><span>{wheel.last || 'Puzzle solved'}</span><b>{money('wheel', wheel.rs)} round bank</b></div>}
  </section>;
}
