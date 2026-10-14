import { lettersOf } from './text';

/** Red square, yellow circle, or nothing. */
export type LetterMark = 'placed' | 'misplaced' | 'absent';

function countLetters(letters: readonly string[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const letter of letters) counts.set(letter, (counts.get(letter) ?? 0) + 1);
  return counts;
}

/**
 * Two passes, so that a letter is never marked more times than it appears in
 * the secret word: well placed letters first, then misplaced ones with what is left.
 */
export function colorGuess(secret: string, guess: string): LetterMark[] {
  const secretLetters = lettersOf(secret);
  const guessLetters = lettersOf(guess);
  const marks: LetterMark[] = guessLetters.map((letter, i) =>
    letter === secretLetters[i] ? 'placed' : 'absent',
  );
  // Each red letter consumed its occurrence: only the other positions are left.
  const left = countLetters(secretLetters.filter((_, i) => marks[i] !== 'placed'));
  guessLetters.forEach((letter, i) => {
    if (marks[i] === 'placed') return;
    const count = left.get(letter) ?? 0;
    if (count === 0) return;
    marks[i] = 'misplaced';
    left.set(letter, count - 1);
  });
  return marks;
}

export function isAllPlaced(marks: readonly LetterMark[]): boolean {
  return marks.every((mark) => mark === 'placed');
}
