import type { LetterMark } from './coloring';
import { randomInt, shuffled, type Random } from './random';
import { lettersOf } from './text';

/** The first letter, plus `count - 1` other positions at random (never the first one twice). */
export function startingLetters(length: number, count: number, random: Random): boolean[] {
  const others = shuffled(
    Array.from({ length: length - 1 }, (_, i) => i + 1),
    random,
  ).slice(0, count - 1);
  return Array.from({ length }, (_, i) => i === 0 || others.includes(i));
}

/**
 * Positions whose letter is known: given at the start, given as a bonus, or
 * already found well placed on a line.
 */
export function knownPositions(
  revealed: readonly boolean[],
  lines: readonly (readonly LetterMark[] | null)[],
): boolean[] {
  return revealed.map(
    (isRevealed, i) => isRevealed || lines.some((marks) => marks?.[i] === 'placed'),
  );
}

/** Next empty line: known letters shown as hints, the others blank (null). */
export function hintLine(secret: string, known: readonly boolean[]): (string | null)[] {
  return lettersOf(secret).map((letter, i) => (known[i] === true ? letter : null));
}

/** A position not known yet, at random. Null when every letter is already known. */
export function pickBonusPosition(known: readonly boolean[], random: Random): number | null {
  const unknown = known.flatMap((isKnown, i) => (isKnown ? [] : [i]));
  if (unknown.length === 0) return null;
  return unknown[randomInt(random, unknown.length)] ?? null;
}
