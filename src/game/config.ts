/** Allowed word lengths, fixed for a whole game. */
export const WORD_LENGTHS = [6, 7, 8, 9, 10] as const;

export type WordLength = (typeof WORD_LENGTHS)[number];
