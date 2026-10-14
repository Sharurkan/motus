import { WORD_LENGTHS, type WordLength } from '../game/config';
import { hasWord, wordAt, wordCount, type WordList } from '../game/word-list';
import { loadValidWords } from '../tv/word-loader';

const LOOKUP_COUNT = 10000;
/** A prime step spreads the probed words over the whole list. */
const LOOKUP_STEP = 7919;

export interface DictionaryMeasure {
  length: WordLength;
  words: number;
  loadMs: number;
  lookupMs: number;
}

/**
 * JavaScript heap in use. `performance.memory` only exists in Chromium
 * browsers (maybe Silk), and is only refreshed now and then: a hint, not an
 * exact figure, so it is read before and after loading every list.
 */
export function usedHeapBytes(): number | null {
  const memory: unknown = Reflect.get(performance, 'memory');
  if (typeof memory !== 'object' || memory === null) return null;
  const used: unknown = Reflect.get(memory, 'usedJSHeapSize');
  return typeof used === 'number' ? used : null;
}

/** Half of the lookups hit a word of the list, the other half miss (last letter changed). */
function timeLookups(list: WordList): number {
  const count = wordCount(list);
  const start = performance.now();
  let found = 0;
  for (let i = 0; i < LOOKUP_COUNT; i++) {
    const word = wordAt(list, (i * LOOKUP_STEP) % count);
    const probe = i % 2 === 0 ? word : `${word.slice(0, -1)}#`;
    if (hasWord(list, probe)) found += 1;
  }
  const elapsed = performance.now() - start;
  if (found !== LOOKUP_COUNT / 2) throw new Error(`Lookup check failed (${String(found)})`);
  return elapsed;
}

async function measure(length: WordLength): Promise<DictionaryMeasure> {
  const start = performance.now();
  const list = await loadValidWords(length);
  const loadMs = performance.now() - start;
  return {
    length,
    words: wordCount(list),
    loadMs,
    lookupMs: timeLookups(list),
  };
}

/** Loads every length one after the other, and reports each result as soon as it is known. */
export async function probeDictionary(
  onMeasure: (result: DictionaryMeasure) => void,
): Promise<void> {
  for (const length of WORD_LENGTHS) onMeasure(await measure(length));
}
