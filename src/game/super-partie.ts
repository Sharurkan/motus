import { unchanged, type GameDeps, type ReduceResult } from './common';
import { MAX_ATTEMPTS, SUPER_DURATION_MS, SUPER_GIVEN_LETTERS, SUPER_WORD_COUNT } from './config';
import type { GameEvent } from './events';
import type { BonusResult, GameBase, SuperPartieState } from './state';
import { isWinningLine, judgeProposal, startWordRound, withLine } from './word-round';

const BONUS_WORD_INDEX = SUPER_WORD_COUNT + 1;

export function superDuration(state: SuperPartieState): number {
  return SUPER_DURATION_MS[state.settings.wordLength];
}

/** Time left in milliseconds; the full duration before the timer starts. */
export function superTimeLeft(state: SuperPartieState, now: number): number {
  if (state.startedAt === null) return superDuration(state);
  return Math.max(0, superDuration(state) - (now - state.startedAt));
}

export function startSuperPartie(base: GameBase, finalist: number, deps: GameDeps): ReduceResult {
  const picked = startWordRound(base, SUPER_GIVEN_LETTERS, deps.words, deps.random);
  const state: SuperPartieState = {
    settings: base.settings,
    teams: base.teams,
    usedWords: picked.usedWords,
    forced: picked.forced,
    phase: 'superPartie',
    finalist,
    wordIndex: 1,
    word: picked.round,
    found: 0,
    results: [],
    startedAt: null,
    step: { kind: 'ready' },
  };
  return {
    state,
    events: [
      { type: 'superPartieStarted', team: finalist, durationMs: superDuration(state) },
      { type: 'superWordStarted', index: 1, isBonus: false },
    ],
  };
}

/** The first word is on screen: the global timer starts. */
export function startSuperTimer(state: SuperPartieState, deps: GameDeps): ReduceResult {
  if (state.step.kind !== 'ready') return unchanged(state);
  return { state: { ...state, startedAt: deps.now(), step: { kind: 'guessing' } }, events: [] };
}

function isTimeUp(state: SuperPartieState, deps: GameDeps): boolean {
  return state.startedAt !== null && superTimeLeft(state, deps.now()) === 0;
}

export function proposeSuperWord(
  state: SuperPartieState,
  input: string,
  deps: GameDeps,
): ReduceResult {
  if (state.step.kind !== 'guessing') return unchanged(state);
  if (isTimeUp(state, deps)) return superTimeUp(state, deps);
  const line = judgeProposal(state.word, input, deps.words);
  const played = { ...state, word: withLine(state.word, line) };
  const team = state.finalist;
  if (line.kind === 'refused') {
    const refused: GameEvent = {
      type: 'proposalRefused',
      team,
      word: line.word,
      refusal: line.refusal,
    };
    return afterLine(played, [refused], deps);
  }
  const attempt: GameEvent = { type: 'attemptMade', team, word: line.word, marks: line.marks };
  if (!isWinningLine(line)) return afterLine(played, [attempt], deps);
  const isBonus = state.wordIndex === BONUS_WORD_INDEX;
  const found = isBonus ? state.found : state.found + 1;
  const foundEvent: GameEvent = { type: 'superWordFound', word: line.word, found };
  const results = [...state.results, { word: line.word, found: true }];
  if (isBonus) return endSuperPartie(played, 'found', [attempt, foundEvent]);
  return nextSuperWord({ ...played, found, results }, [attempt, foundEvent], deps);
}

/** A refused word costs only the line. After 6 lines, the word is revealed and the next one starts. */
function afterLine(state: SuperPartieState, events: GameEvent[], deps: GameDeps): ReduceResult {
  if (state.word.lines.length < MAX_ATTEMPTS) return { state, events };
  return missSuperWord(state, false, events, deps);
}

function missSuperWord(
  state: SuperPartieState,
  skipped: boolean,
  events: GameEvent[],
  deps: GameDeps,
): ReduceResult {
  const missed: GameEvent = { type: 'superWordMissed', word: state.word.secret, skipped };
  if (state.wordIndex === BONUS_WORD_INDEX) {
    return endSuperPartie(state, 'missed', [...events, missed]);
  }
  const results = [...state.results, { word: state.word.secret, found: false }];
  return nextSuperWord({ ...state, results }, [...events, missed], deps);
}

export function skipSuperWord(state: SuperPartieState, deps: GameDeps): ReduceResult {
  if (state.step.kind !== 'guessing') return unchanged(state);
  if (isTimeUp(state, deps)) return superTimeUp(state, deps);
  return missSuperWord(state, true, [], deps);
}

/** After the 10th word: the bonus word is offered only if all 10 were found. */
function nextSuperWord(state: SuperPartieState, events: GameEvent[], deps: GameDeps): ReduceResult {
  if (state.wordIndex >= SUPER_WORD_COUNT) {
    if (state.found < SUPER_WORD_COUNT) return endSuperPartie(state, 'notPlayed', events);
    return {
      state: { ...state, step: { kind: 'bonusChoice' } },
      events: [...events, { type: 'bonusWordOffered' }],
    };
  }
  return startSuperWord(state, state.wordIndex + 1, events, deps);
}

function startSuperWord(
  state: SuperPartieState,
  wordIndex: number,
  events: GameEvent[],
  deps: GameDeps,
): ReduceResult {
  const picked = startWordRound(state, SUPER_GIVEN_LETTERS, deps.words, deps.random);
  return {
    state: {
      ...state,
      usedWords: picked.usedWords,
      forced: picked.forced,
      wordIndex,
      word: picked.round,
      step: { kind: 'guessing' },
    },
    events: [
      ...events,
      { type: 'superWordStarted', index: wordIndex, isBonus: wordIndex === BONUS_WORD_INDEX },
    ],
  };
}

/** The bonus word is played with the time left. */
export function playBonusWord(state: SuperPartieState, deps: GameDeps): ReduceResult {
  if (state.step.kind !== 'bonusChoice') return unchanged(state);
  if (isTimeUp(state, deps)) return superTimeUp(state, deps);
  return startSuperWord(state, BONUS_WORD_INDEX, [], deps);
}

export function finishSuperPartie(state: SuperPartieState): ReduceResult {
  if (state.step.kind !== 'bonusChoice') return unchanged(state);
  return endSuperPartie(state, 'notPlayed', []);
}

export function superTimeUp(state: SuperPartieState, deps: GameDeps): ReduceResult {
  if (state.step.kind === 'ready' || !isTimeUp(state, deps)) return unchanged(state);
  const bonus = state.wordIndex === BONUS_WORD_INDEX ? 'missed' : 'notPlayed';
  return endSuperPartie(state, bonus, [{ type: 'superTimeUp' }]);
}

function endSuperPartie(
  state: SuperPartieState,
  bonus: BonusResult,
  events: GameEvent[],
): ReduceResult {
  return {
    state: {
      phase: 'gameOver',
      teams: state.teams,
      result: { finalist: state.finalist, found: state.found, bonus },
    },
    events: [...events, { type: 'gameOver' }],
  };
}
