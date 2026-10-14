import { unchanged, type GameDeps, type ReduceResult } from './common';
import { GIVEN_LETTERS, MAX_ATTEMPTS } from './config';
import type { GameEvent } from './events';
import type { GameBase, TieBreakState } from './state';
import {
  giveBonusLetter,
  isWinningLine,
  judgeProposal,
  startWordRound,
  withLine,
} from './word-round';

/** Tied teams play one word, one attempt each in turn. Nobody scores. */
export function startTieBreak(base: GameBase, contenders: number[], deps: GameDeps): ReduceResult {
  const [first = 0] = contenders;
  const word = newTieBreakWord(base, contenders, first, deps);
  return {
    state: word.state,
    events: [{ type: 'tieBreakStarted', teams: contenders }, ...word.events],
  };
}

function newTieBreakWord(
  base: GameBase,
  contenders: number[],
  team: number,
  deps: GameDeps,
): ReduceResult {
  const picked = startWordRound(base, GIVEN_LETTERS, deps.words, deps.random);
  const state: TieBreakState = {
    settings: base.settings,
    teams: base.teams,
    usedWords: picked.usedWords,
    forced: picked.forced,
    phase: 'tieBreak',
    contenders,
    activeTeam: team,
    word: picked.round,
    step: { kind: 'revealing' },
  };
  return { state, events: [{ type: 'tieBreakWordStarted', team }] };
}

function nextContender(state: TieBreakState): number {
  const index = state.contenders.indexOf(state.activeTeam);
  return state.contenders[(index + 1) % state.contenders.length] ?? state.activeTeam;
}

export function proposeTieBreakWord(
  state: TieBreakState,
  input: string,
  deps: GameDeps,
): ReduceResult {
  if (state.step.kind !== 'guessing') return unchanged(state);
  const line = judgeProposal(state.word, input, deps.words);
  const played = { ...state, word: withLine(state.word, line) };
  const team = state.activeTeam;
  if (line.kind === 'refused') {
    const refused: GameEvent = {
      type: 'proposalRefused',
      team,
      word: line.word,
      refusal: line.refusal,
    };
    return endTurn(played, true, [refused], deps);
  }
  const attempt: GameEvent = { type: 'attemptMade', team, word: line.word, marks: line.marks };
  if (isWinningLine(line)) {
    return {
      state: { ...played, step: { kind: 'won', winner: team } },
      events: [attempt, { type: 'wordFound', team, word: line.word, points: 0 }],
    };
  }
  return endTurn(played, false, [attempt], deps);
}

export function tieBreakTimeUp(state: TieBreakState, deps: GameDeps): ReduceResult {
  const seconds = state.settings.attemptSeconds;
  if (state.step.kind !== 'guessing' || seconds === null) return unchanged(state);
  if (deps.now() - state.step.startedAt < seconds * 1000) return unchanged(state);
  const played = { ...state, word: withLine(state.word, { kind: 'timeUp' }) };
  return endTurn(played, true, [{ type: 'attemptTimedOut', team: state.activeTeam }], deps);
}

/**
 * The next contender plays. Only a refused word or a timeout gives it a bonus
 * letter (`bonusPosition` stays null otherwise). After 6 lines, the word is
 * revealed and a new one starts.
 */
function endTurn(
  state: TieBreakState,
  withBonus: boolean,
  events: GameEvent[],
  deps: GameDeps,
): ReduceResult {
  const team = nextContender(state);
  if (state.word.lines.length >= MAX_ATTEMPTS) {
    const next = newTieBreakWord(state, state.contenders, team, deps);
    return {
      state: next.state,
      events: [...events, { type: 'wordMissed', word: state.word.secret }, ...next.events],
    };
  }
  const bonus = withBonus
    ? giveBonusLetter(state.word, deps.random)
    : { round: state.word, position: null };
  const passed: GameEvent = {
    type: 'handPassed',
    team,
    bonusPosition: bonus.position,
    lastChance: false,
  };
  return {
    state: { ...state, word: bonus.round, activeTeam: team, step: { kind: 'revealing' } },
    events: [...events, passed],
  };
}
