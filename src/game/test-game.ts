import type { GameDeps, WordSource } from './common';
import type { AttemptSeconds, WordCount } from './config';
import type { GameEvent } from './events';
import { reduce } from './reducer';
import { INITIAL_STATE, type GameAction, type GameState } from './state';
import { seededRandom } from './testing';

/** Test helper: 6-letter words. Secrets are also valid. */
export const TEST_SECRETS = [
  'BATEAU',
  'CAMION',
  'CHEVAL',
  'JARDIN',
  'MAISON',
  'PAPIER',
  'POMMES',
  'TOMATE',
  'VOLCAN',
  'SAPINS',
  'LAPINS',
  'NUAGES',
  'BOUGIE',
  'CERISE',
  'DRAGON',
  'FUSEES',
  'GIRAFE',
  'HIBOUX',
  'ORANGE',
  'RADEAU',
  'SOLEIL',
  'TIROIR',
  'VALISE',
  'ZEBRES',
  'BALLON',
  'CANARD',
  'FRAISE',
];

const OTHER_VALID = [
  'MARRON',
  'MOUTON',
  'MOUCHE',
  'MANCHE',
  'MARCHE',
  'MELONS',
  'MIROIR',
  'PAPAYE',
];

export const TEST_WORDS: WordSource = {
  length: 6,
  secrets: TEST_SECRETS,
  isValid: (word) => TEST_SECRETS.includes(word) || OTHER_VALID.includes(word),
};

export interface GameOptions {
  teams?: number;
  wordCount?: WordCount;
  attemptSeconds?: AttemptSeconds;
  seed?: number;
  startAtSuperPartie?: boolean;
}

export interface TestGame {
  readonly state: GameState;
  act(action: GameAction): GameEvent[];
  /** Moves the injected clock forward. */
  wait(ms: number): void;
  /** Puts the game in a state built by the test. */
  set(state: GameState): void;
}

/** Test helper: a game already started, with a controlled clock and seeded randomness. */
export function createTestGame(options: GameOptions = {}): TestGame {
  let now = 1_000_000;
  let state: GameState = INITIAL_STATE;
  const deps: GameDeps = {
    random: seededRandom(options.seed ?? 1),
    now: () => now,
    words: TEST_WORDS,
  };
  const game: TestGame = {
    get state() {
      return state;
    },
    act(action) {
      const result = reduce(state, action, deps);
      state = result.state;
      return result.events;
    },
    wait(ms) {
      now += ms;
    },
    set(next) {
      state = next;
    },
  };
  const teams = options.teams ?? 2;
  game.act({
    type: 'startGame',
    teamNames: Array.from({ length: teams }, () => ''),
    wordLength: 6,
    attemptSeconds: options.attemptSeconds === undefined ? 30 : options.attemptSeconds,
    wordCount: options.wordCount ?? 10,
    startAtSuperPartie: options.startAtSuperPartie ?? false,
  });
  return game;
}

/** Test helper: narrows the state to a phase, or fails the test. */
export function inPhase<P extends GameState['phase']>(
  state: GameState,
  phase: P,
): Extract<GameState, { phase: P }> {
  if (state.phase !== phase) throw new Error(`Expected phase ${phase}, got ${state.phase}`);
  // Safe: the phase was just checked, and the union is discriminated by it.
  return state as Extract<GameState, { phase: P }>;
}

export function eventTypes(events: readonly GameEvent[]): string[] {
  return events.map((event) => event.type);
}

/** Test helper: the last item (Array.prototype.at is not in the ES2020 target). */
export function last<T>(items: readonly T[]): T | undefined {
  return items[items.length - 1];
}
