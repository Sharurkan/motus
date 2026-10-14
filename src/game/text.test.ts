import { describe, expect, it } from 'vitest';
import { isPlainWord, normalizeText } from './text';

describe('normalizeText', () => {
  it('uppercases', () => {
    expect(normalizeText('bonjour')).toBe('BONJOUR');
  });

  it('removes accents', () => {
    expect(normalizeText('Élève à la fenêtre, ça où')).toBe('ELEVE A LA FENETRE, CA OU');
  });

  it('removes the tilde of borrowed words', () => {
    expect(normalizeText('cañon')).toBe('CANON');
  });

  it('expands ligatures, lowercase or uppercase', () => {
    expect(normalizeText('cœur Œuf ex æquo')).toBe('COEUR OEUF EX AEQUO');
  });

  it('keeps apostrophes, hyphens and punctuation', () => {
    expect(normalizeText("l'arc-en-ciel !")).toBe("L'ARC-EN-CIEL !");
  });
});

describe('isPlainWord', () => {
  it('accepts letters A to Z only', () => {
    expect(isPlainWord('MAISON')).toBe(true);
  });

  it.each(["AUJOURD'HUI", 'ABAT-JOUR', 'A PRIORI', 'MAISON2', 'maison', 'ÉTÉ', ''])(
    'refuses %j',
    (text) => {
      expect(isPlainWord(text)).toBe(false);
    },
  );
});
