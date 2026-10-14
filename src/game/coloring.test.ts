import { describe, expect, it } from 'vitest';
import { colorGuess, isAllPlaced, type LetterMark } from './coloring';

const P: LetterMark = 'placed';
const M: LetterMark = 'misplaced';
const A: LetterMark = 'absent';

describe('colorGuess', () => {
  it('marks everything red when the word is found', () => {
    expect(colorGuess('MAISON', 'MAISON')).toEqual([P, P, P, P, P, P]);
  });

  it('marks everything absent when no letter is shared', () => {
    expect(colorGuess('BATEAU', 'FRIGOS')).toEqual([A, A, A, A, A, A]);
  });

  it('follows the spec example PAPIER / PAPAYE', () => {
    expect(colorGuess('PAPIER', 'PAPAYE')).toEqual([P, P, P, A, A, M]);
  });

  it('marks a letter repeated in the guess only as often as it is in the secret', () => {
    // One E in the secret: only the first misplaced E is yellow.
    expect(colorGuess('CHEVAL', 'EEEEEE')).toEqual([A, A, P, A, A, A]);
    // Two T in the secret: one red (position 4), so only one other T is yellow.
    expect(colorGuess('TOMATE', 'EETTTT')).toEqual([M, A, M, A, P, A]);
  });

  it('marks every occurrence of a letter repeated in the secret', () => {
    // Two S in the secret, two misplaced S in the guess.
    expect(colorGuess('SAUSSE', 'ASSAAA')).toEqual([M, M, M, A, A, A]);
  });

  it('gives the red letter its occurrence before any yellow one', () => {
    // The single A of the secret is red at position 1: the A at position 0 is absent.
    expect(colorGuess('BATEAU', 'AAXXXX')).toEqual([M, P, A, A, A, A]);
    expect(colorGuess('MARINE', 'AAAAAA')).toEqual([A, P, A, A, A, A]);
  });

  it('marks a letter both red and yellow in the same guess', () => {
    // Secret has two R: one well placed, one elsewhere.
    expect(colorGuess('RAREST', 'RRXXXX')).toEqual([P, M, A, A, A, A]);
  });
});

describe('isAllPlaced', () => {
  it('is true only when every letter is red', () => {
    expect(isAllPlaced([P, P, P])).toBe(true);
    expect(isAllPlaced([P, M, P])).toBe(false);
  });
});
