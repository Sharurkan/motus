import { describe, expect, it } from 'vitest';
import { hintLine, knownPositions, pickBonusPosition, startingLetters } from './letters';
import { seededRandom } from './testing';

describe('startingLetters', () => {
  it.each([1, 2, 3, 4, 5, 6, 7, 8, 9, 10])(
    'shows the first letter plus one other, never the first (seed %i)',
    (seed) => {
      const known = startingLetters(7, 2, seededRandom(seed));
      expect(known).toHaveLength(7);
      expect(known[0]).toBe(true);
      expect(known.filter(Boolean)).toHaveLength(2);
    },
  );

  it('shows 3 letters in the Super partie', () => {
    const known = startingLetters(10, 3, seededRandom(42));
    expect(known[0]).toBe(true);
    expect(known.filter(Boolean)).toHaveLength(3);
  });

  it('spreads the second letter over every other position', () => {
    const seen = new Set<number>();
    for (let seed = 0; seed < 200; seed++) {
      seen.add(startingLetters(6, 2, seededRandom(seed)).indexOf(true, 1));
    }
    expect([...seen].sort()).toEqual([1, 2, 3, 4, 5]);
  });
});

describe('knownPositions', () => {
  it('adds the letters found well placed on any line', () => {
    const revealed = [true, false, false, false];
    const lines = [
      ['placed', 'absent', 'misplaced', 'absent'] as const,
      null,
      ['placed', 'absent', 'absent', 'placed'] as const,
    ];
    expect(knownPositions(revealed, lines)).toEqual([true, false, false, true]);
  });
});

describe('hintLine', () => {
  it('shows known letters and leaves the others blank', () => {
    expect(hintLine('MAISON', [true, false, true, false, false, true])).toEqual([
      'M',
      null,
      'I',
      null,
      null,
      'N',
    ]);
  });
});

describe('pickBonusPosition', () => {
  it('picks a position not known yet', () => {
    for (let seed = 0; seed < 50; seed++) {
      const position = pickBonusPosition([true, false, true, false], seededRandom(seed));
      expect([1, 3]).toContain(position);
    }
  });

  it('returns null when every letter is known', () => {
    expect(pickBonusPosition([true, true, true], seededRandom(1))).toBeNull();
  });
});
