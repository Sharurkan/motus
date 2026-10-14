/** Allowed word lengths, fixed for a whole game. */
export const WORD_LENGTHS = [6, 7, 8, 9, 10] as const;

export type WordLength = (typeof WORD_LENGTHS)[number];

export const DEFAULT_WORD_LENGTH: WordLength = 7;

export const MIN_TEAMS = 2;
export const MAX_TEAMS = 4;
export const MAX_TEAM_NAME_LENGTH = 20;

/** Lines of the word grid. */
export const MAX_ATTEMPTS = 6;

/** Seconds per attempt the master may choose; null means no limit. */
export const ATTEMPT_SECONDS_CHOICES = [20, 30, 45, 60, null] as const;

export type AttemptSeconds = (typeof ATTEMPT_SECONDS_CHOICES)[number];

/** Longer with one phone: it has to be passed to the team. */
export const DEFAULT_ATTEMPT_SECONDS = { single: 45, multi: 30 } as const;

/** Number of words of the first part the master may choose. */
export const WORD_COUNT_CHOICES = [6, 10, 14] as const;

export type WordCount = (typeof WORD_COUNT_CHOICES)[number];

export const DEFAULT_WORD_COUNT: WordCount = 10;

export const WORD_POINTS = 50;
export const LAST_WORD_POINTS = 100;
export const MOTUS_POINTS = 100;

/** Letters shown when a word starts: the first one, plus others at random positions. */
export const GIVEN_LETTERS = 2;
export const SUPER_GIVEN_LETTERS = 3;

export const SUPER_WORD_COUNT = 10;

const SECOND = 1000;
const MINUTE = 60 * SECOND;

/** One global timer for the whole Super partie. */
export const SUPER_DURATION_MS: Readonly<Record<WordLength, number>> = {
  6: 3 * MINUTE + 30 * SECOND,
  7: 4 * MINUTE,
  8: 4 * MINUTE + 30 * SECOND,
  9: 5 * MINUTE,
  10: 5 * MINUTE + 30 * SECOND,
};

export const GRID_SIZE = 5;
/** Each column takes its numbers from its own range of consecutive pool numbers. */
export const GRID_COLUMN_RANGE = 7;
/** Odd pool 1–69, even pool 2–70: 35 numbers each. */
export const POOL_SIZE = GRID_SIZE * GRID_COLUMN_RANGE;
export const PRE_COVERED_CELLS = 8;
/** At most 2 pre-covered cells per line: no MOTUS on the first draw of 2 balls. */
export const MAX_PRE_COVERED_PER_LINE = 2;
export const BLACK_BALLS = 3;
export const BALLS_PER_DRAW = 2;
