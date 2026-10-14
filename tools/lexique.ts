import { isPlainWord, normalizeText } from '../src/game/text.ts';

/** The Lexique 3.83 columns the word lists need. */
export interface LexiqueRow {
  ortho: string;
  lemme: string;
  cgram: string;
  genre: string;
  nombre: string;
  /** Lemma frequency per million words, in film subtitles and in books. */
  freqLemFilms: number;
  freqLemBooks: number;
  /** Verb forms, e.g. "inf;" or "ind:pre:3s;par:pas;". Empty for other words. */
  infover: string;
}

const COLUMNS = ['ortho', 'lemme', 'cgram', 'genre', 'nombre', 'freqlemfilms2', 'freqlemlivres'];

function columnIndexes(header: string): Map<string, number> {
  const names = header.split('\t');
  const indexes = new Map<string, number>();
  for (const name of [...COLUMNS, 'infover']) {
    const index = names.indexOf(name);
    if (index < 0) throw new Error(`Lexique column missing: ${name}`);
    indexes.set(name, index);
  }
  return indexes;
}

export function parseLexique(tsv: string): LexiqueRow[] {
  const [header = '', ...lines] = tsv.split(/\r?\n/);
  const indexes = columnIndexes(header);
  const cell = (fields: string[], name: string): string => fields[indexes.get(name) ?? -1] ?? '';
  return lines
    .filter((line) => line.trim() !== '')
    .map((line) => {
      const fields = line.split('\t');
      return {
        ortho: cell(fields, 'ortho'),
        lemme: cell(fields, 'lemme'),
        cgram: cell(fields, 'cgram'),
        genre: cell(fields, 'genre'),
        nombre: cell(fields, 'nombre'),
        freqLemFilms: Number(cell(fields, 'freqlemfilms2')),
        freqLemBooks: Number(cell(fields, 'freqlemlivres')),
        infover: cell(fields, 'infover'),
      };
    });
}

function isVerb(row: LexiqueRow): boolean {
  return row.cgram === 'VER' || row.cgram === 'AUX';
}

/** Infinitive, present participle or past participle: the only verb forms allowed. */
function isAllowedVerbForm(row: LexiqueRow): boolean {
  return row.infover.split(';').some((form) => form === 'inf' || form.startsWith('par:'));
}

/** A row whose spelling may be proposed. Any other row with the same spelling may also allow it. */
export function isAcceptedForm(row: LexiqueRow): boolean {
  return !isVerb(row) || isAllowedVerbForm(row);
}

/** Singular noun, masculine singular adjective or infinitive, in its dictionary form. */
export function isBaseForm(row: LexiqueRow): boolean {
  if (row.ortho !== row.lemme) return false;
  switch (row.cgram) {
    case 'NOM':
      return row.nombre !== 'p';
    case 'ADJ':
      return row.nombre !== 'p' && row.genre !== 'f';
    case 'VER':
      return row.infover.split(';').includes('inf');
    default:
      return false;
  }
}

export function frequency(row: LexiqueRow): number {
  return (row.freqLemFilms + row.freqLemBooks) / 2;
}

/** Normalized word if it fits the game (letters A to Z, allowed length), else null. */
function gameWord(row: LexiqueRow, lengths: readonly number[]): string | null {
  const word = normalizeText(row.ortho);
  return isPlainWord(word) && lengths.includes(word.length) ? word : null;
}

/** Accepted words of each length, sorted, without duplicates. */
export function acceptedWords(
  rows: readonly LexiqueRow[],
  lengths: readonly number[],
): Map<number, string[]> {
  const words = new Set<string>();
  for (const row of rows) {
    const word = gameWord(row, lengths);
    if (word !== null && isAcceptedForm(row)) words.add(word);
  }
  return byLength([...words].sort(), lengths);
}

/**
 * The `count` most frequent base forms of each length, minus the blocklist,
 * sorted alphabetically.
 */
export function secretWords(
  rows: readonly LexiqueRow[],
  lengths: readonly number[],
  blocklist: ReadonlySet<string>,
  count: number,
): Map<number, string[]> {
  const best = new Map<string, number>();
  for (const row of rows) {
    const word = gameWord(row, lengths);
    if (word === null || !isBaseForm(row) || blocklist.has(word)) continue;
    best.set(word, Math.max(best.get(word) ?? 0, frequency(row)));
  }
  const ranked = [...best].sort(([a, fa], [b, fb]) => fb - fa || (a < b ? -1 : 1));
  const result = new Map<number, string[]>();
  for (const length of lengths) {
    const top = ranked.filter(([word]) => word.length === length).slice(0, count);
    result.set(length, top.map(([word]) => word).sort());
  }
  return result;
}

function byLength(sorted: readonly string[], lengths: readonly number[]): Map<number, string[]> {
  const result = new Map<number, string[]>(lengths.map((length) => [length, []]));
  for (const word of sorted) result.get(word.length)?.push(word);
  return result;
}

/** One word per line; empty lines and lines starting with "#" are ignored. */
export function parseBlocklist(text: string): Set<string> {
  const words = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line !== '' && !line.startsWith('#'))
    .map(normalizeText);
  return new Set(words);
}
