import { describe, expect, it } from 'vitest';
import { hasWord, wordAt, wordCount, type WordList } from './word-list';

const LIST: WordList = { length: 6, words: 'ABAQUEBATEAUCHEVALMAISONTOMATE' };

describe('word list', () => {
  it('counts and reads the words', () => {
    expect(wordCount(LIST)).toBe(5);
    expect(wordAt(LIST, 0)).toBe('ABAQUE');
    expect(wordAt(LIST, 4)).toBe('TOMATE');
  });

  it.each(['ABAQUE', 'BATEAU', 'CHEVAL', 'MAISON', 'TOMATE'])('finds %s', (word) => {
    expect(hasWord(LIST, word)).toBe(true);
  });

  it.each(['AAAAAA', 'BATEAX', 'ZZZZZZ', 'MAISONS', 'MAISO'])('does not find %s', (word) => {
    expect(hasWord(LIST, word)).toBe(false);
  });

  it('finds nothing in an empty list', () => {
    expect(hasWord({ length: 6, words: '' }, 'MAISON')).toBe(false);
  });
});
