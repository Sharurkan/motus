import { describe, expect, it } from 'vitest';
import {
  applyBall,
  createBingoCard,
  drawRandomBall,
  GRID_LINES,
  hasMotus,
  isInUrn,
  poolFor,
  type BingoCard,
  type Grid,
} from './bingo';
import { BLACK_BALLS, GRID_SIZE, MAX_PRE_COVERED_PER_LINE, PRE_COVERED_CELLS } from './config';
import { fixedRandom, seededRandom } from './testing';

const SEEDS = Array.from({ length: 1000 }, (_, i) => i);

function column(grid: Grid, index: number): number[] {
  return Array.from({ length: GRID_SIZE }, (_, row) => grid.numbers[row * GRID_SIZE + index] ?? 0);
}

function gridWith(coveredCells: readonly number[]): Grid {
  return {
    numbers: Array.from({ length: 25 }, (_, i) => i + 1),
    covered: Array.from({ length: 25 }, (_, i) => coveredCells.includes(i)),
  };
}

describe('poolFor', () => {
  it('gives odd numbers 1–69 to team 1 and even numbers 2–70 to team 2', () => {
    expect(poolFor(0)).toHaveLength(35);
    expect(poolFor(0)[0]).toBe(1);
    expect(poolFor(0)[34]).toBe(69);
    expect(poolFor(1)[0]).toBe(2);
    expect(poolFor(1)[34]).toBe(70);
  });

  it('reuses the odd and even pools for teams 3 and 4', () => {
    expect(poolFor(2)).toEqual(poolFor(0));
    expect(poolFor(3)).toEqual(poolFor(1));
  });
});

describe('createBingoCard', () => {
  it.each(SEEDS)('respects every grid rule (seed %i)', (seed) => {
    const team = seed % 4;
    const { grid, urn } = createBingoCard(team, seededRandom(seed));
    const pool = poolFor(team);
    // Columns: 5 sorted numbers from their own range of 7.
    for (let index = 0; index < GRID_SIZE; index++) {
      const values = column(grid, index);
      const range = pool.slice(index * 7, index * 7 + 7);
      expect(values.every((value) => range.includes(value))).toBe(true);
      expect(values).toEqual([...values].sort((a, b) => a - b));
      expect(new Set(values).size).toBe(GRID_SIZE);
    }
    // 8 pre-covered cells, at most 2 per row, column or diagonal.
    expect(grid.covered.filter(Boolean)).toHaveLength(PRE_COVERED_CELLS);
    for (const line of GRID_LINES) {
      const count = line.filter((cell) => grid.covered[cell]).length;
      expect(count).toBeLessThanOrEqual(MAX_PRE_COVERED_PER_LINE);
    }
    // Urn: the 17 uncovered numbers plus 3 black balls.
    const uncovered = grid.numbers.filter((_, cell) => grid.covered[cell] !== true);
    expect(urn.numbers).toEqual(uncovered);
    expect(urn.numbers).toHaveLength(17);
    expect(urn.blackBalls).toBe(BLACK_BALLS);
  });

  it('never allows a MOTUS after the first two balls', () => {
    for (const seed of SEEDS.slice(0, 200)) {
      const card = createBingoCard(0, seededRandom(seed));
      for (const first of card.urn.numbers) {
        for (const second of card.urn.numbers) {
          const after = applyBall(applyBall(card, { kind: 'number', value: first }), {
            kind: 'number',
            value: second,
          });
          expect(hasMotus(after.grid)).toBe(false);
        }
      }
    }
  });
});

describe('drawRandomBall', () => {
  const card: BingoCard = createBingoCard(0, seededRandom(7));

  it('draws a numbered ball from the urn', () => {
    expect(drawRandomBall(card.urn, fixedRandom(0))).toEqual({
      kind: 'number',
      value: card.urn.numbers[0],
    });
  });

  it('draws a black ball with the last indexes', () => {
    expect(drawRandomBall(card.urn, fixedRandom(0.999))).toEqual({ kind: 'black' });
  });

  it('draws black balls 3 times out of 20 on average', () => {
    const random = seededRandom(3);
    let black = 0;
    for (let i = 0; i < 20000; i++) if (drawRandomBall(card.urn, random).kind === 'black') black++;
    expect(black / 20000).toBeCloseTo(3 / 20, 1);
  });
});

describe('applyBall', () => {
  const card = createBingoCard(1, seededRandom(11));

  it('covers the cell of a numbered ball and removes it from the urn', () => {
    const value = card.urn.numbers[0] ?? 0;
    const after = applyBall(card, { kind: 'number', value });
    expect(after.urn.numbers).not.toContain(value);
    expect(after.urn.numbers).toHaveLength(16);
    expect(after.grid.covered[card.grid.numbers.indexOf(value)]).toBe(true);
  });

  it('puts a black ball back: nothing changes', () => {
    expect(applyBall(card, { kind: 'black' })).toEqual(card);
  });
});

describe('isInUrn', () => {
  const card = createBingoCard(0, seededRandom(5));

  it('accepts a number still in the urn and a black ball', () => {
    expect(isInUrn(card.urn, { kind: 'number', value: card.urn.numbers[0] ?? 0 })).toBe(true);
    expect(isInUrn(card.urn, { kind: 'black' })).toBe(true);
  });

  it('refuses a number already covered or from the other pool', () => {
    const covered = card.grid.numbers.find((_, cell) => card.grid.covered[cell]) ?? 0;
    expect(isInUrn(card.urn, { kind: 'number', value: covered })).toBe(false);
    expect(isInUrn(card.urn, { kind: 'number', value: 2 })).toBe(false);
  });
});

describe('hasMotus', () => {
  it.each([
    ['a row', [5, 6, 7, 8, 9]],
    ['a column', [2, 7, 12, 17, 22]],
    ['the diagonal', [0, 6, 12, 18, 24]],
    ['the other diagonal', [4, 8, 12, 16, 20]],
  ])('detects %s', (_, cells) => {
    expect(hasMotus(gridWith(cells))).toBe(true);
  });

  it('needs the whole line', () => {
    expect(hasMotus(gridWith([5, 6, 7, 8, 0, 1, 2, 3]))).toBe(false);
  });

  it('detects a row and a column completed together', () => {
    expect(hasMotus(gridWith([0, 1, 2, 3, 4, 5, 10, 15, 20]))).toBe(true);
  });
});
