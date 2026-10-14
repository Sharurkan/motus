import {
  BLACK_BALLS,
  GRID_COLUMN_RANGE,
  GRID_SIZE,
  MAX_PRE_COVERED_PER_LINE,
  POOL_SIZE,
  PRE_COVERED_CELLS,
} from './config';
import { randomInt, shuffled, type Random } from './random';

/** 5×5 numbers, row by row, and which cells are covered. */
export interface Grid {
  numbers: number[];
  covered: boolean[];
}

/** Numbers still to draw, plus black balls, which always go back into the urn. */
export interface Urn {
  numbers: number[];
  blackBalls: number;
}

export interface BingoCard {
  grid: Grid;
  urn: Urn;
}

export type Ball = { kind: 'number'; value: number } | { kind: 'black' };

/** Cells of every row, column and both diagonals, as indexes into the grid. */
export const GRID_LINES: readonly (readonly number[])[] = buildLines();

function buildLines(): number[][] {
  const range = Array.from({ length: GRID_SIZE }, (_, i) => i);
  const rows = range.map((row) => range.map((column) => row * GRID_SIZE + column));
  const columns = range.map((column) => range.map((row) => row * GRID_SIZE + column));
  const diagonal = range.map((i) => i * GRID_SIZE + i);
  const antiDiagonal = range.map((i) => i * GRID_SIZE + (GRID_SIZE - 1 - i));
  return [...rows, ...columns, diagonal, antiDiagonal];
}

/** Team 1 plays odd numbers (1–69), team 2 even ones (2–70); teams 3 and 4 reuse them. */
export function poolFor(team: number): number[] {
  const first = team % 2 === 0 ? 1 : 2;
  return Array.from({ length: POOL_SIZE }, (_, i) => first + 2 * i);
}

/** Each column takes 5 numbers of its own range of 7, sorted from top to bottom. */
function gridNumbers(team: number, random: Random): number[] {
  const pool = poolFor(team);
  const columns = Array.from({ length: GRID_SIZE }, (_, column) => {
    const range = pool.slice(column * GRID_COLUMN_RANGE, (column + 1) * GRID_COLUMN_RANGE);
    return shuffled(range, random)
      .slice(0, GRID_SIZE)
      .sort((a, b) => a - b);
  });
  return Array.from(
    { length: GRID_SIZE * GRID_SIZE },
    (_, cell) => columns[cell % GRID_SIZE]?.[Math.floor(cell / GRID_SIZE)] ?? 0,
  );
}

function fitsLineLimit(covered: readonly boolean[]): boolean {
  return GRID_LINES.every(
    (line) => line.filter((cell) => covered[cell]).length <= MAX_PRE_COVERED_PER_LINE,
  );
}

/** One random attempt: cells in random order, each kept if no line gets too full. */
function tryPreCover(random: Random): boolean[] {
  const covered: boolean[] = Array.from({ length: GRID_SIZE * GRID_SIZE }, () => false);
  let count = 0;
  for (const cell of shuffled([...covered.keys()], random)) {
    if (count === PRE_COVERED_CELLS) break;
    covered[cell] = true;
    if (fitsLineLimit(covered)) count += 1;
    else covered[cell] = false;
  }
  return covered;
}

/** Retries until 8 cells fit (almost always at the first or second try). */
const MAX_PRE_COVER_TRIES = 1000;

function preCover(random: Random): boolean[] {
  for (let i = 0; i < MAX_PRE_COVER_TRIES; i++) {
    const covered = tryPreCover(random);
    if (covered.filter(Boolean).length === PRE_COVERED_CELLS) return covered;
  }
  throw new Error('Could not pre-cover the bingo grid');
}

export function createBingoCard(team: number, random: Random): BingoCard {
  const numbers = gridNumbers(team, random);
  const covered = preCover(random);
  const urn = { numbers: numbers.filter((_, cell) => !covered[cell]), blackBalls: BLACK_BALLS };
  return { grid: { numbers, covered }, urn };
}

/** Every ball is equally likely, black ones included. */
export function drawRandomBall(urn: Urn, random: Random): Ball {
  const index = randomInt(random, urn.numbers.length + urn.blackBalls);
  const value = urn.numbers[index];
  return value === undefined ? { kind: 'black' } : { kind: 'number', value };
}

/** True when the ball can come out of this urn (used for a forced ball in test mode). */
export function isInUrn(urn: Urn, ball: Ball): boolean {
  return ball.kind === 'black' ? urn.blackBalls > 0 : urn.numbers.includes(ball.value);
}

/** A numbered ball leaves the urn and covers its cell. A black ball changes nothing. */
export function applyBall(card: BingoCard, ball: Ball): BingoCard {
  if (ball.kind === 'black') return card;
  const numbers = card.urn.numbers.filter((value) => value !== ball.value);
  const covered = card.grid.covered.map(
    (isCovered, cell) => isCovered || card.grid.numbers[cell] === ball.value,
  );
  return { grid: { ...card.grid, covered }, urn: { ...card.urn, numbers } };
}

/** A full row, column or diagonal. */
export function hasMotus(grid: Grid): boolean {
  return GRID_LINES.some((line) => line.every((cell) => grid.covered[cell]));
}
