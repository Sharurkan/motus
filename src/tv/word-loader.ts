import type { WordLength } from '../game/config';
import type { WordList } from '../game/word-list';

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
