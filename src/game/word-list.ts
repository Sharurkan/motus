/**
 * A word list is one string of same-length words glued together in sorted
 * order ("ABACAS" + "ABAQUE" + …). One string keeps memory low on the Fire TV
 * Stick, and a binary search finds a word without building any object.
 */
export interface WordList {
  length: number;
  words: string;
}

export function wordCount(list: WordList): number {
  return Math.floor(list.words.length / list.length);
}

export function wordAt(list: WordList, index: number): string {
  return list.words.slice(index * list.length, (index + 1) * list.length);
}

export function hasWord(list: WordList, word: string): boolean {
  if (word.length !== list.length) return false;
  let low = 0;
  let high = wordCount(list) - 1;
  while (low <= high) {
    const middle = Math.floor((low + high) / 2);
    const candidate = wordAt(list, middle);
    if (candidate === word) return true;
    if (candidate < word) low = middle + 1;
    else high = middle - 1;
  }
  return false;
}
