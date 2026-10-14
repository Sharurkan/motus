import { describe, expect, it } from 'vitest';
import {
  AZERTY_ROWS,
  draftWord,
  eraseLetter,
  isComplete,
  newDraft,
  typeLetter,
} from './word-draft';

describe('word draft', () => {
  it('starts with the given first letter', () => {
    expect(draftWord(newDraft(6, 'M'))).toBe('M');
  });

  it('adds letters up to the word length only', () => {
    let draft = newDraft(3, 'M');
    for (const letter of 'OTS') draft = typeLetter(draft, letter);
    expect(draftWord(draft)).toBe('MOT');
    expect(isComplete(draft)).toBe(true);
  });

  it('erases the last letter but never the first one', () => {
    let draft = typeLetter(newDraft(6, 'M'), 'A');
    draft = eraseLetter(eraseLetter(eraseLetter(draft)));
    expect(draftWord(draft)).toBe('M');
  });

  it('is incomplete until the word has the right length', () => {
    expect(isComplete(typeLetter(newDraft(6, 'M'), 'A'))).toBe(false);
  });
});

describe('AZERTY_ROWS', () => {
  it('holds the 26 letters once each', () => {
    const letters = AZERTY_ROWS.join('');
    expect(letters).toHaveLength(26);
    expect([...new Set(letters)].sort().join('')).toBe('ABCDEFGHIJKLMNOPQRSTUVWXYZ');
  });
});
