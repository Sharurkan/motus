import { describe, expect, it } from 'vitest';
import {
  acceptedWords,
  isAcceptedForm,
  isBaseForm,
  parseBlocklist,
  parseLexique,
  secretWords,
  type LexiqueRow,
} from './lexique.ts';

function row(fields: Partial<LexiqueRow>): LexiqueRow {
  return {
    ortho: 'maison',
    lemme: 'maison',
    cgram: 'NOM',
    genre: 'f',
    nombre: 's',
    freqLemFilms: 100,
    freqLemBooks: 100,
    infover: '',
    ...fields,
  };
}

const LENGTHS = [6, 7];

describe('parseLexique', () => {
  it('reads the needed columns by name, with Windows line endings', () => {
    const tsv =
      'ortho\tphon\tlemme\tcgram\tgenre\tnombre\tfreqlemfilms2\tfreqlemlivres\tinfover\r\n' +
      'parlé\tpaRle\tparler\tVER\tm\ts\t12.5\t3.5\tpar:pas;\r\n';
    expect(parseLexique(tsv)).toEqual([
      row({
        ortho: 'parlé',
        lemme: 'parler',
        cgram: 'VER',
        genre: 'm',
        nombre: 's',
        freqLemFilms: 12.5,
        freqLemBooks: 3.5,
        infover: 'par:pas;',
      }),
    ]);
  });

  it('fails clearly when a column is missing', () => {
    expect(() => parseLexique('ortho\tlemme\n')).toThrow('Lexique column missing');
  });
});

describe('isAcceptedForm', () => {
  it('accepts nouns, adjectives and other words', () => {
    expect(isAcceptedForm(row({}))).toBe(true);
    expect(isAcceptedForm(row({ cgram: 'ADV' }))).toBe(true);
  });

  it.each(['inf;', 'par:pre;', 'par:pas;', 'ind:pas:3s;par:pas;'])(
    'accepts the verb form %s',
    (infover) => {
      expect(isAcceptedForm(row({ cgram: 'VER', infover }))).toBe(true);
    },
  );

  it.each(['ind:pre:3p;', 'sub:pre:1s;ind:pre:1s;', 'imp:pre:2p;'])(
    'refuses the conjugated form %s',
    (infover) => {
      expect(isAcceptedForm(row({ cgram: 'VER', infover }))).toBe(false);
      expect(isAcceptedForm(row({ cgram: 'AUX', infover }))).toBe(false);
    },
  );
});

describe('isBaseForm', () => {
  it('keeps singular nouns', () => {
    expect(isBaseForm(row({}))).toBe(true);
  });

  it('keeps masculine singular adjectives', () => {
    const adjective = row({ ortho: 'joyeux', lemme: 'joyeux', cgram: 'ADJ', genre: 'm' });
    expect(isBaseForm(adjective)).toBe(true);
  });

  it('keeps infinitives', () => {
    const verb = row({ ortho: 'parler', lemme: 'parler', cgram: 'VER', infover: 'inf;' });
    expect(isBaseForm(verb)).toBe(true);
  });

  it('drops plurals, feminine adjectives, participles and other categories', () => {
    expect(isBaseForm(row({ ortho: 'maisons', nombre: 'p' }))).toBe(false);
    expect(isBaseForm(row({ ortho: 'joyeuse', lemme: 'joyeux', cgram: 'ADJ' }))).toBe(false);
    const participle = row({
      ortho: 'parlant',
      lemme: 'parler',
      cgram: 'VER',
      infover: 'par:pre;',
    });
    expect(isBaseForm(participle)).toBe(false);
    expect(isBaseForm(row({ ortho: 'dehors', lemme: 'dehors', cgram: 'ADV' }))).toBe(false);
  });
});

describe('acceptedWords', () => {
  const rows = [
    row({ ortho: 'école' }),
    row({ ortho: 'écoles', nombre: 'p' }),
    row({ ortho: 'parlent', lemme: 'parler', cgram: 'VER', infover: 'ind:pre:3p;' }),
    row({ ortho: 'couvent', lemme: 'couver', cgram: 'VER', infover: 'ind:pre:3p;' }),
    row({ ortho: 'couvent', lemme: 'couvent', cgram: 'NOM' }),
    row({ ortho: 'abat-jour' }),
    row({ ortho: 'a priori' }),
    row({ ortho: 'chat' }),
    row({ ortho: 'cœurs' }),
  ];

  it('normalizes, filters, sorts and groups words by length', () => {
    const words = acceptedWords(rows, LENGTHS);
    expect(words.get(6)).toEqual(['COEURS', 'ECOLES']);
    expect(words.get(7)).toEqual(['COUVENT']);
  });

  it('keeps an empty list for a length without words', () => {
    expect(acceptedWords([], LENGTHS).get(6)).toEqual([]);
  });
});

describe('secretWords', () => {
  const rows = [
    row({ ortho: 'maison', freqLemFilms: 300 }),
    row({ ortho: 'bateau', lemme: 'bateau', genre: 'm', freqLemFilms: 200 }),
    row({ ortho: 'abaque', lemme: 'abaque', freqLemFilms: 1, freqLemBooks: 1 }),
    row({ ortho: 'putain', lemme: 'putain', freqLemFilms: 900 }),
    row({ ortho: 'maisons', lemme: 'maison', nombre: 'p', freqLemFilms: 999 }),
  ];

  it('keeps the most frequent base forms, minus the blocklist, sorted', () => {
    const words = secretWords(rows, LENGTHS, new Set(['PUTAIN']), 2);
    expect(words.get(6)).toEqual(['BATEAU', 'MAISON']);
    expect(words.get(7)).toEqual([]);
  });
});

describe('parseBlocklist', () => {
  it('normalizes words and skips comments and empty lines', () => {
    const text = '# Rude\r\nputain\n\n  enculé  \n# end\n';
    expect(parseBlocklist(text)).toEqual(new Set(['PUTAIN', 'ENCULE']));
  });
});
