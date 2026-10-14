import * as z from 'zod/mini';
import {
  ATTEMPT_SECONDS_CHOICES,
  type AttemptSeconds,
  MAX_TEAM_NAME_LENGTH,
  MAX_TEAMS,
  MIN_TEAMS,
  POOL_SIZE,
  WORD_COUNT_CHOICES,
  WORD_LENGTHS,
} from '../game/config';
import type { GameAction } from '../game/state';

/** A typed word is short; a little room is kept for spaces and accents before normalization. */
const MAX_TYPED_WORD_LENGTH = 30;
/** Balls are numbered 1 to 70 (odd and even pools of 35). */
const MAX_BALL = 2 * POOL_SIZE;

const typedWord = z.string().check(z.maxLength(MAX_TYPED_WORD_LENGTH));
const attemptSeconds = ATTEMPT_SECONDS_CHOICES.filter(
  (choice): choice is Exclude<AttemptSeconds, null> => choice !== null,
);

export const ballSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('number'), value: z.int().check(z.minimum(1), z.maximum(MAX_BALL)) }),
  z.object({ kind: z.literal('black') }),
]);

/** Actions a phone may send. Timing (end of an animation, timeout) only comes from the TV. */
export type PhoneAction = Exclude<GameAction, { type: 'revealDone' | 'timeUp' }>;

export const phoneActionSchema: z.ZodMiniType<PhoneAction> = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('startGame'),
    teamNames: z
      .array(z.string().check(z.maxLength(MAX_TEAM_NAME_LENGTH)))
      .check(z.minLength(MIN_TEAMS), z.maxLength(MAX_TEAMS)),
    wordLength: z.literal(WORD_LENGTHS),
    attemptSeconds: z.nullable(z.literal(attemptSeconds)),
    wordCount: z.literal(WORD_COUNT_CHOICES),
    startAtSuperPartie: z.optional(z.boolean()),
  }),
  z.object({ type: z.literal('proposeWord'), word: typedWord }),
  z.object({ type: z.literal('drawBall') }),
  z.object({ type: z.literal('nextWord') }),
  z.object({ type: z.literal('skipWord') }),
  z.object({ type: z.literal('playBonusWord') }),
  z.object({ type: z.literal('finishSuperPartie') }),
  z.object({ type: z.literal('abandonGame') }),
  z.object({ type: z.literal('newGame') }),
  z.object({ type: z.literal('forceSecret'), word: typedWord }),
  z.object({ type: z.literal('forceBall'), ball: ballSchema }),
]);
