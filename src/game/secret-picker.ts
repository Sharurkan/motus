import { randomInt, type Random } from './random';

/**
 * A secret word not used yet in this game. If every word was used (never with
 * hundreds of words per length), any word may come back rather than blocking the game.
 */
export function pickSecret(
  secrets: readonly string[],
  used: readonly string[],
  random: Random,
): string {
  const fresh = secrets.filter((word) => !used.includes(word));
  const choices = fresh.length > 0 ? fresh : secrets;
  return choices[randomInt(random, choices.length)] ?? '';
}
