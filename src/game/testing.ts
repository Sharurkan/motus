import type { Random } from './random';

/** Test helper: a small seeded generator (mulberry32), the same numbers for the same seed. */
export function seededRandom(seed: number): Random {
  let state = seed;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Test helper: always returns the given values in turn, for exact control of a draw. */
export function fixedRandom(...values: number[]): Random {
  let index = 0;
  return () => {
    const value = values[index % values.length] ?? 0;
    index += 1;
    return value;
  };
}
