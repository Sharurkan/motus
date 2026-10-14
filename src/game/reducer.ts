import { createBingoCard } from './bingo';
import { unchanged, type GameDeps, type ReduceResult } from './common';
import {
  ATTEMPT_SECONDS_CHOICES,
  MAX_TEAM_NAME_LENGTH,
  MAX_TEAMS,
  MIN_TEAMS,
  WORD_COUNT_CHOICES,
} from './config';
import { attemptTimeUp, drawBall, nextWord, proposeWord, startWord } from './first-part';
import {
  finishSuperPartie,
  playBonusWord,
  proposeSuperWord,
  skipSuperWord,
  startSuperPartie,
  startSuperTimer,
  superTimeUp,
} from './super-partie';
import type { Ball } from './bingo';
import type { GameAction, GameBase, GameState } from './state';
import { isPlainWord, normalizeText } from './text';
import { proposeTieBreakWord, tieBreakTimeUp } from './tie-break';
import { replaceUnplayedSecret } from './word-round';

export type { GameDeps, ReduceResult, WordSource } from './common';

/** The single source of truth: every change of the game goes through here. */
export function reduce(state: GameState, action: GameAction, deps: GameDeps): ReduceResult {
  switch (action.type) {
    case 'startGame':
      return startGame(state, action, deps);
    case 'proposeWord':
      return propose(state, action.word, deps);
    case 'drawBall':
      return state.phase === 'playing' ? drawBall(state, deps) : unchanged(state);
    case 'nextWord':
      return goToNextWord(state, deps);
    case 'skipWord':
      return state.phase === 'superPartie' ? skipSuperWord(state, deps) : unchanged(state);
    case 'playBonusWord':
      return state.phase === 'superPartie' ? playBonusWord(state, deps) : unchanged(state);
    case 'finishSuperPartie':
      return state.phase === 'superPartie' ? finishSuperPartie(state) : unchanged(state);
    case 'abandonGame':
      return abandonGame(state);
    case 'newGame':
      return state.phase === 'gameOver'
        ? { state: { phase: 'setup' }, events: [] }
        : unchanged(state);
    case 'forceSecret':
      return forceSecret(state, action.word, deps);
    case 'forceBall':
      return forceBall(state, action.ball);
    case 'revealDone':
      return revealDone(state, deps);
    case 'timeUp':
      return timeUp(state, deps);
  }
}

function teamName(input: string, index: number): string {
  const name = input.trim().slice(0, MAX_TEAM_NAME_LENGTH);
  return name === '' ? `Équipe ${String(index + 1)}` : name;
}

function isValidSetup(action: Extract<GameAction, { type: 'startGame' }>, deps: GameDeps): boolean {
  const teams = action.teamNames.length;
  return (
    teams >= MIN_TEAMS &&
    teams <= MAX_TEAMS &&
    ATTEMPT_SECONDS_CHOICES.includes(action.attemptSeconds) &&
    WORD_COUNT_CHOICES.includes(action.wordCount) &&
    deps.words.length === action.wordLength &&
    deps.words.secrets.length > 0
  );
}

function startGame(
  state: GameState,
  action: Extract<GameAction, { type: 'startGame' }>,
  deps: GameDeps,
): ReduceResult {
  if (state.phase !== 'setup' || !isValidSetup(action, deps)) return unchanged(state);
  const base: GameBase = {
    settings: {
      wordLength: action.wordLength,
      attemptSeconds: action.attemptSeconds,
      wordCount: action.wordCount,
    },
    teams: action.teamNames.map((name, index) => ({
      name: teamName(name, index),
      score: 0,
      card: createBingoCard(index, deps.random),
    })),
    usedWords: [],
    forced: { secret: null, ball: null },
  };
  return action.startAtSuperPartie === true
    ? startSuperPartie(base, 0, deps)
    : startWord(base, 1, 0, deps);
}

function propose(state: GameState, word: string, deps: GameDeps): ReduceResult {
  switch (state.phase) {
    case 'playing':
      return proposeWord(state, word, deps);
    case 'tieBreak':
      return proposeTieBreakWord(state, word, deps);
    case 'superPartie':
      return proposeSuperWord(state, word, deps);
    case 'setup':
    case 'gameOver':
      return unchanged(state);
  }
}

function goToNextWord(state: GameState, deps: GameDeps): ReduceResult {
  if (state.phase === 'playing') return nextWord(state, deps);
  if (state.phase === 'tieBreak' && state.step.kind === 'won') {
    return startSuperPartie(state, state.step.winner, deps);
  }
  return unchanged(state);
}

function revealDone(state: GameState, deps: GameDeps): ReduceResult {
  if (state.phase === 'superPartie') return startSuperTimer(state, deps);
  if (
    (state.phase === 'playing' || state.phase === 'tieBreak') &&
    state.step.kind === 'revealing'
  ) {
    return { state: { ...state, step: { kind: 'guessing', startedAt: deps.now() } }, events: [] };
  }
  return unchanged(state);
}

function timeUp(state: GameState, deps: GameDeps): ReduceResult {
  switch (state.phase) {
    case 'playing':
      return attemptTimeUp(state, deps);
    case 'tieBreak':
      return tieBreakTimeUp(state, deps);
    case 'superPartie':
      return superTimeUp(state, deps);
    case 'setup':
    case 'gameOver':
      return unchanged(state);
  }
}

/** Ranking right away with the current scores. */
function abandonGame(state: GameState): ReduceResult {
  if (state.phase === 'setup' || state.phase === 'gameOver') return unchanged(state);
  return {
    state: { phase: 'gameOver', teams: state.teams, result: null },
    events: [{ type: 'gameOver' }],
  };
}

/** Test mode: the word replaces the current one if nobody played on it yet, else the next one. */
function forceSecret(state: GameState, input: string, deps: GameDeps): ReduceResult {
  if (state.phase === 'setup' || state.phase === 'gameOver') return unchanged(state);
  const word = normalizeText(input.trim());
  if (
    !isPlainWord(word) ||
    word.length !== state.settings.wordLength ||
    !deps.words.isValid(word)
  ) {
    return unchanged(state);
  }
  if (state.word.lines.length === 0) {
    const usedWords = [...state.usedWords, word];
    return {
      state: { ...state, word: replaceUnplayedSecret(state.word, word), usedWords },
      events: [],
    };
  }
  return { state: { ...state, forced: { ...state.forced, secret: word } }, events: [] };
}

/** Test mode: the next ball drawn, if it is still in the urn at that time. */
function forceBall(state: GameState, ball: Ball): ReduceResult {
  if (state.phase !== 'playing') return unchanged(state);
  return { state: { ...state, forced: { ...state.forced, ball } }, events: [] };
}
