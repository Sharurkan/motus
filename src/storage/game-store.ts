import * as z from 'zod/mini';
import {
  ATTEMPT_SECONDS_CHOICES,
  GRID_SIZE,
  MAX_ATTEMPTS,
  MAX_TEAM_NAME_LENGTH,
  MAX_TEAMS,
  MIN_TEAMS,
  SUPER_WORD_COUNT,
  WORD_COUNT_CHOICES,
  WORD_LENGTHS,
  type AttemptSeconds,
} from '../game/config';
import type { GameState } from '../game/state';
import { ballSchema } from '../protocol/actions';

const GAME_KEY = 'motus.game';
/** Bump when the saved shape changes: older saves are then dropped instead of misread. */
const SAVE_VERSION = 2;

const CELLS = GRID_SIZE * GRID_SIZE;
const MAX_WORD_LENGTH = WORD_LENGTHS[WORD_LENGTHS.length - 1] ?? 10;

const count = z.int().check(z.minimum(0));
const time = z.number().check(z.minimum(0));
const word = z.string().check(z.regex(/^[A-Z]*$/), z.maxLength(MAX_WORD_LENGTH));
const marks = z
  .array(z.enum(['placed', 'misplaced', 'absent']))
  .check(z.maxLength(MAX_WORD_LENGTH));
const attemptSeconds = ATTEMPT_SECONDS_CHOICES.filter(
  (choice): choice is Exclude<AttemptSeconds, null> => choice !== null,
);

const settingsSchema = z.object({
  wordLength: z.literal(WORD_LENGTHS),
  attemptSeconds: z.nullable(z.literal(attemptSeconds)),
  wordCount: z.literal(WORD_COUNT_CHOICES),
});

const teamsSchema = z
  .array(
    z.object({
      name: z.string().check(z.maxLength(MAX_TEAM_NAME_LENGTH)),
      score: count,
      card: z.object({
        grid: z.object({
          numbers: z.array(count).check(z.length(CELLS)),
          covered: z.array(z.boolean()).check(z.length(CELLS)),
        }),
        urn: z.object({ numbers: z.array(count).check(z.maxLength(CELLS)), blackBalls: count }),
      }),
    }),
  )
  .check(z.minLength(MIN_TEAMS), z.maxLength(MAX_TEAMS));

const lineSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('attempt'), word, marks }),
  z.object({
    kind: z.literal('refused'),
    // What the player typed, after normalization: not always letters only.
    word: z.string().check(z.maxLength(30)),
    refusal: z.enum(['wrongLength', 'wrongFirstLetter', 'alreadyProposed', 'unknownWord']),
  }),
  z.object({ kind: z.literal('timeUp') }),
]);

const wordRoundSchema = z.object({
  secret: word,
  revealed: z.array(z.boolean()).check(z.maxLength(MAX_WORD_LENGTH)),
  lines: z.array(lineSchema).check(z.maxLength(MAX_ATTEMPTS + 1)),
});

const commonShape = {
  settings: settingsSchema,
  teams: teamsSchema,
  usedWords: z.array(word),
  forced: z.object({ secret: z.nullable(word), ball: z.nullable(ballSchema) }),
  word: wordRoundSchema,
};

const turnSteps = [
  z.object({ kind: z.literal('revealing') }),
  z.object({ kind: z.literal('guessing'), startedAt: time }),
] as const;

interface WithWord {
  settings: { wordLength: number };
  teams: unknown[];
  word: { secret: string; revealed: boolean[] };
}

/** The word fits the game's length, and every team index points to a team. */
function isConsistent(state: WithWord, teamIndexes: readonly number[]): boolean {
  const length = state.settings.wordLength;
  return (
    state.word.secret.length === length &&
    state.word.revealed.length === length &&
    teamIndexes.every((team) => team < state.teams.length)
  );
}

const playingSchema = z
  .object({
    phase: z.literal('playing'),
    ...commonShape,
    wordNumber: z.int().check(z.minimum(1)),
    activeTeam: count,
    starter: count,
    lastChance: z.boolean(),
    step: z.discriminatedUnion('kind', [
      ...turnSteps,
      z.object({ kind: z.literal('drawing'), ballsLeft: count }),
      z.object({ kind: z.literal('wordOver'), nextTeam: count }),
    ]),
  })
  .check(
    z.refine((state) => {
      const next = state.step.kind === 'wordOver' ? [state.step.nextTeam] : [];
      return isConsistent(state, [state.activeTeam, state.starter, ...next]);
    }),
  );

const tieBreakSchema = z
  .object({
    phase: z.literal('tieBreak'),
    ...commonShape,
    contenders: z.array(count).check(z.minLength(2), z.maxLength(MAX_TEAMS)),
    activeTeam: count,
    step: z.discriminatedUnion('kind', [
      ...turnSteps,
      z.object({ kind: z.literal('won'), winner: count }),
    ]),
  })
  .check(
    z.refine((state) => {
      const winner = state.step.kind === 'won' ? [state.step.winner] : [];
      return isConsistent(state, [state.activeTeam, ...state.contenders, ...winner]);
    }),
  );

const superPartieSchema = z
  .object({
    phase: z.literal('superPartie'),
    ...commonShape,
    finalist: count,
    wordIndex: z.int().check(z.minimum(1)),
    found: count,
    results: z
      .array(z.object({ word, found: z.boolean() }))
      .check(z.maxLength(SUPER_WORD_COUNT + 1)),
    startedAt: z.nullable(time),
    step: z.discriminatedUnion('kind', [
      z.object({ kind: z.literal('ready') }),
      z.object({ kind: z.literal('guessing') }),
      z.object({ kind: z.literal('bonusChoice') }),
    ]),
  })
  .check(z.refine((state) => isConsistent(state, [state.finalist])));

const gameOverSchema = z
  .object({
    phase: z.literal('gameOver'),
    teams: teamsSchema,
    result: z.nullable(
      z.object({
        finalist: count,
        found: count,
        bonus: z.enum(['notPlayed', 'found', 'missed']),
      }),
    ),
  })
  .check(z.refine((state) => state.result === null || state.result.finalist < state.teams.length));

const gameStateSchema: z.ZodMiniType<GameState> = z.union([
  z.object({ phase: z.literal('setup') }),
  playingSchema,
  tieBreakSchema,
  superPartieSchema,
  gameOverSchema,
]);

const saveSchema = z.object({ v: z.literal(SAVE_VERSION), state: gameStateSchema });

export type LoadResult =
  | { kind: 'empty' }
  | { kind: 'loaded'; state: GameState }
  /** Unreadable, from another version, or storage blocked: the game starts over. */
  | { kind: 'unreadable' };

export function loadGame(): LoadResult {
  let raw: string | null;
  try {
    raw = localStorage.getItem(GAME_KEY);
  } catch {
    return { kind: 'unreadable' };
  }
  if (raw === null) return { kind: 'empty' };
  try {
    const parsed = saveSchema.safeParse(JSON.parse(raw));
    return parsed.success ? { kind: 'loaded', state: parsed.data.state } : { kind: 'unreadable' };
  } catch {
    return { kind: 'unreadable' };
  }
}

/** Returns false when the game could not be saved (storage blocked or full). */
export function saveGame(state: GameState): boolean {
  try {
    localStorage.setItem(GAME_KEY, JSON.stringify({ v: SAVE_VERSION, state }));
    return true;
  } catch {
    return false;
  }
}
