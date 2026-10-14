import { applyBall, createBingoCard, drawRandomBall, hasMotus, isInUrn } from './bingo';
import { nextTeam, unchanged, type GameDeps, type ReduceResult } from './common';
import {
  BALLS_PER_DRAW,
  GIVEN_LETTERS,
  LAST_WORD_POINTS,
  MAX_ATTEMPTS,
  MOTUS_POINTS,
  WORD_POINTS,
} from './config';
import type { GameEvent } from './events';
import { leaders } from './ranking';
import type { GameBase, Line, PlayingState, PlayingStep, Team } from './state';
import { startSuperPartie } from './super-partie';
import { startTieBreak } from './tie-break';
import {
  giveBonusLetter,
  isWinningLine,
  judgeProposal,
  startWordRound,
  withLine,
} from './word-round';

export function startWord(
  base: GameBase,
  wordNumber: number,
  team: number,
  deps: GameDeps,
): ReduceResult {
  const picked = startWordRound(base, GIVEN_LETTERS, deps.words, deps.random);
  const state: PlayingState = {
    ...base,
    phase: 'playing',
    usedWords: picked.usedWords,
    forced: picked.forced,
    wordNumber,
    word: picked.round,
    activeTeam: team,
    starter: team,
    lastChance: false,
    step: { kind: 'revealing' },
  };
  const isLastWord = wordNumber === base.settings.wordCount;
  return { state, events: [{ type: 'wordStarted', wordNumber, isLastWord, team }] };
}

function wordPoints(state: PlayingState): number {
  return state.wordNumber === state.settings.wordCount ? LAST_WORD_POINTS : WORD_POINTS;
}

function addPoints(teams: readonly Team[], team: number, points: number): Team[] {
  return teams.map((entry, i) => (i === team ? { ...entry, score: entry.score + points } : entry));
}

export function proposeWord(state: PlayingState, input: string, deps: GameDeps): ReduceResult {
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
    return failTurn(played, [refused], deps);
  }
  const attempt: GameEvent = { type: 'attemptMade', team, word: line.word, marks: line.marks };
  if (isWinningLine(line)) return wordFound(played, line, [attempt]);
  if (state.lastChance) return missWord(played, [attempt]);
  if (played.word.lines.length >= MAX_ATTEMPTS) return passHand(played, true, [attempt], deps);
  return { state: { ...played, step: { kind: 'revealing' } }, events: [attempt] };
}

function wordFound(
  state: PlayingState,
  line: Line & { kind: 'attempt' },
  events: GameEvent[],
): ReduceResult {
  const points = wordPoints(state);
  const team = state.activeTeam;
  return {
    state: {
      ...state,
      teams: addPoints(state.teams, team, points),
      step: { kind: 'drawing', ballsLeft: BALLS_PER_DRAW },
    },
    events: [...events, { type: 'wordFound', team, word: line.word, points }],
  };
}

/** Refused word or timeout: the hand passes, or the word is lost after the last chance. */
function failTurn(state: PlayingState, events: GameEvent[], deps: GameDeps): ReduceResult {
  if (state.lastChance) return missWord(state, events);
  return passHand(state, state.word.lines.length >= MAX_ATTEMPTS, events, deps);
}

/** The next team gets a bonus letter, then the remaining lines or one last chance. */
function passHand(
  state: PlayingState,
  lastChance: boolean,
  events: GameEvent[],
  deps: GameDeps,
): ReduceResult {
  const team = nextTeam(state.activeTeam, state.teams.length);
  const bonus = giveBonusLetter(state.word, deps.random);
  return {
    state: {
      ...state,
      word: bonus.round,
      activeTeam: team,
      lastChance,
      step: { kind: 'revealing' },
    },
    events: [...events, { type: 'handPassed', team, bonusPosition: bonus.position, lastChance }],
  };
}

/** Nobody found: the word is revealed and goes to the team after the one that started it. */
function missWord(state: PlayingState, events: GameEvent[]): ReduceResult {
  return {
    state: {
      ...state,
      step: { kind: 'wordOver', nextTeam: nextTeam(state.starter, state.teams.length) },
    },
    events: [...events, { type: 'wordMissed', word: state.word.secret }],
  };
}

export function attemptTimeUp(state: PlayingState, deps: GameDeps): ReduceResult {
  const seconds = state.settings.attemptSeconds;
  if (state.step.kind !== 'guessing' || seconds === null) return unchanged(state);
  if (deps.now() - state.step.startedAt < seconds * 1000) return unchanged(state);
  const played = { ...state, word: withLine(state.word, { kind: 'timeUp' }) };
  return failTurn(played, [{ type: 'attemptTimedOut', team: state.activeTeam }], deps);
}

export function drawBall(state: PlayingState, deps: GameDeps): ReduceResult {
  if (state.step.kind !== 'drawing') return unchanged(state);
  const team = state.activeTeam;
  const current = state.teams[team];
  if (current === undefined) return unchanged(state);
  const forced = state.forced.ball;
  const ball =
    forced !== null && isInUrn(current.card.urn, forced)
      ? forced
      : drawRandomBall(current.card.urn, deps.random);
  const base = { ...state, forced: { ...state.forced, ball: null } };
  if (ball.kind === 'black') {
    const step: PlayingStep = { kind: 'wordOver', nextTeam: nextTeam(team, state.teams.length) };
    return { state: { ...base, step }, events: [{ type: 'blackBall', team }] };
  }
  const card = applyBall(current.card, ball);
  const teams = base.teams.map((entry, i) => (i === team ? { ...entry, card } : entry));
  const drawn: GameEvent = { type: 'ballDrawn', team, value: ball.value };
  if (hasMotus(card.grid)) return motus({ ...base, teams }, [drawn], deps);
  const ballsLeft = state.step.ballsLeft - 1;
  const step: PlayingStep =
    ballsLeft > 0 ? { kind: 'drawing', ballsLeft } : { kind: 'wordOver', nextTeam: team };
  return { state: { ...base, teams, step }, events: [drawn] };
}

/** MOTUS: bonus points, drawing stops, every team gets a new grid, the team keeps the hand. */
function motus(state: PlayingState, events: GameEvent[], deps: GameDeps): ReduceResult {
  const team = state.activeTeam;
  const scored = addPoints(state.teams, team, MOTUS_POINTS);
  const teams = scored.map((entry, i) => ({ ...entry, card: createBingoCard(i, deps.random) }));
  return {
    state: { ...state, teams, step: { kind: 'wordOver', nextTeam: team } },
    events: [...events, { type: 'motus', team, points: MOTUS_POINTS }, { type: 'gridsReset' }],
  };
}

/** After the last word: the best team plays the Super partie, or tied teams play a tie-break. */
export function nextWord(state: PlayingState, deps: GameDeps): ReduceResult {
  if (state.step.kind !== 'wordOver') return unchanged(state);
  const base: GameBase = state;
  if (state.wordNumber < state.settings.wordCount) {
    return startWord(base, state.wordNumber + 1, state.step.nextTeam, deps);
  }
  const best = leaders(state.teams);
  const [first] = best;
  if (first === undefined) return unchanged(state);
  return best.length === 1 ? startSuperPartie(base, first, deps) : startTieBreak(base, best, deps);
}
