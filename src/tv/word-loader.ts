import type { WordSource } from '../game/common';
import type { WordLength } from '../game/config';
import { hasWord, type WordList } from '../game/word-list';

/**
 * Loads the valid words of one length only. Each length is its own chunk
 * (literal import paths, so that Vite splits them), fetched when needed.
 */
export async function loadValidWords(length: WordLength): Promise<WordList> {
  const words = await importValidWords(length);
  return { length, words };
}

async function importValidWords(length: WordLength): Promise<string> {
  switch (length) {
    case 6:
      return (await import('../game/words/valid-6')).VALID_WORDS;
    case 7:
      return (await import('../game/words/valid-7')).VALID_WORDS;
    case 8:
      return (await import('../game/words/valid-8')).VALID_WORDS;
    case 9:
      return (await import('../game/words/valid-9')).VALID_WORDS;
    case 10:
      return (await import('../game/words/valid-10')).VALID_WORDS;
  }
}

async function importSecretWords(length: WordLength): Promise<readonly string[]> {
  switch (length) {
    case 6:
      return (await import('../game/words/secret-6')).SECRET_WORDS;
    case 7:
      return (await import('../game/words/secret-7')).SECRET_WORDS;
    case 8:
      return (await import('../game/words/secret-8')).SECRET_WORDS;
    case 9:
      return (await import('../game/words/secret-9')).SECRET_WORDS;
    case 10:
      return (await import('../game/words/secret-10')).SECRET_WORDS;
  }
}

/** Both lists of the game's length, as the reducer needs them. */
export async function loadWordSource(length: WordLength): Promise<WordSource> {
  const [valid, secrets] = await Promise.all([loadValidWords(length), importSecretWords(length)]);
  return { length, secrets, isValid: (word) => hasWord(valid, word) };
}
