import type { WordLength } from './config';
import type { GameEvent } from './events';
import type { Random } from './random';
import type { GameState } from './state';

/** The word lists of the game's length, loaded by the TV before the game starts. */
export interface WordSource {
  length: WordLength;
  secrets: readonly string[];
  isValid(word: string): boolean;
}

export interface GameDeps {
  random: Random;
  /** Milliseconds, like Date.now. */
  now(): number;
  words: WordSource;
}

export interface ReduceResult {
  state: GameState;
  events: GameEvent[];
}

/** An action that does not fit the current phase: nothing happens. */
export function unchanged(state: GameState): ReduceResult {
  return { state, events: [] };
}

export function nextTeam(team: number, teamCount: number): number {
  return (team + 1) % teamCount;
}
