/** Returns a number in [0, 1), like Math.random. Injected so that tests are reproducible. */
export type Random = () => number;

/** Integer in [0, max). */
export function randomInt(random: Random, max: number): number {
  return Math.min(Math.floor(random() * max), max - 1);
}

/** A shuffled copy (Fisher–Yates). */
export function shuffled<T>(items: readonly T[], random: Random): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = randomInt(random, i + 1);
    const item = copy[i];
    const other = copy[j];
    if (item === undefined || other === undefined) continue;
    copy[i] = other;
    copy[j] = item;
  }
  return copy;
}
