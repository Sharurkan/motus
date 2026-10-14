import { describe, expect, it } from 'vitest';
import { WORD_LENGTHS, type WordLength } from './config';
import { isPlainWord } from './text';
import { hasWord, wordAt, wordCount, type WordList } from './word-list';
import { SECRET_WORDS as SECRET_6 } from './words/secret-6';
import { SECRET_WORDS as SECRET_7 } from './words/secret-7';
import { SECRET_WORDS as SECRET_8 } from './words/secret-8';
import { SECRET_WORDS as SECRET_9 } from './words/secret-9';
import { SECRET_WORDS as SECRET_10 } from './words/secret-10';
import { VALID_WORDS as VALID_6 } from './words/valid-6';
import { VALID_WORDS as VALID_7 } from './words/valid-7';
import { VALID_WORDS as VALID_8 } from './words/valid-8';
import { VALID_WORDS as VALID_9 } from './words/valid-9';
import { VALID_WORDS as VALID_10 } from './words/valid-10';

/** docs/SPEC.md: at least 400 secret words per length. */
const MIN_SECRET_WORDS = 400;

const VALID: Record<WordLength, WordList> = {
  6: { length: 6, words: VALID_6 },
  7: { length: 7, words: VALID_7 },
  8: { length: 8, words: VALID_8 },
  9: { length: 9, words: VALID_9 },
  10: { length: 10, words: VALID_10 },
};

const SECRET: Record<WordLength, readonly string[]> = {
  6: SECRET_6,
  7: SECRET_7,
  8: SECRET_8,
  9: SECRET_9,
  10: SECRET_10,
};

function lengthOf(word: string): WordLength {
  const length = WORD_LENGTHS.find((candidate) => candidate === word.length);
  if (length === undefined) throw new Error(`No list for ${word}`);
  return length;
}

function isValid(word: string): boolean {
  return hasWord(VALID[lengthOf(word)], word);
}

function validWords(length: WordLength): string[] {
  const list = VALID[length];
  return Array.from({ length: wordCount(list) }, (_, index) => wordAt(list, index));
}

function isStrictlySorted(words: readonly string[]): boolean {
  return words.every((word, index) => index === 0 || (words[index - 1] ?? '') < word);
}

describe.each(WORD_LENGTHS)('word lists of %i letters', (length) => {
  it('valid words fill the string exactly', () => {
    expect(VALID[length].words.length % length).toBe(0);
  });

  it('valid words are A to Z only, sorted, without duplicates', () => {
    const words = validWords(length);
    expect(words.length).toBeGreaterThan(1000);
    expect(words.every(isPlainWord)).toBe(true);
    expect(isStrictlySorted(words)).toBe(true);
  });

  it('secret words have the right length, are A to Z only, sorted, without duplicates', () => {
    const words = SECRET[length];
    expect(words.length).toBeGreaterThanOrEqual(MIN_SECRET_WORDS);
    expect(words.every((word) => word.length === length && isPlainWord(word))).toBe(true);
    expect(isStrictlySorted(words)).toBe(true);
  });

  it('every secret word is a valid word', () => {
    expect(SECRET[length].filter((word) => !isValid(word))).toEqual([]);
  });
});

describe('valid words', () => {
  it.each(['PARLER', 'PARLANT', 'PARLEE', 'PARLEES', 'CHEVAUX', 'BLEUES', 'COUVENT', 'MAISON'])(
    'accept %s',
    (word) => {
      expect(isValid(word)).toBe(true);
    },
  );

  it.each(['PARLENT', 'MANGEONS', 'MANGEAIT', 'FINIRAIT'])(
    'refuse the conjugated form %s',
    (word) => {
      expect(isValid(word)).toBe(false);
    },
  );
});

describe('secret words', () => {
  it.each(['PUTAIN', 'CANCER', 'SUICIDE', 'CADAVRE', 'THOMAS'])('never include %s', (word) => {
    expect(SECRET[lengthOf(word)]).not.toContain(word);
  });
});
