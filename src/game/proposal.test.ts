import { describe, expect, it } from 'vitest';
import { checkProposal, type ProposalContext } from './proposal';

const VALID = new Set(['MAISON', 'MARRON', 'MOUTON']);

const context: ProposalContext = {
  secret: 'MAISON',
  proposed: ['MARRON'],
  isValidWord: (word) => VALID.has(word),
};

describe('checkProposal', () => {
  it('accepts a valid word not proposed yet', () => {
    expect(checkProposal('MOUTON', context)).toBeNull();
  });

  it('refuses a word of the wrong length', () => {
    expect(checkProposal('MAISONS', context)).toBe('wrongLength');
    expect(checkProposal('MAIS', context)).toBe('wrongLength');
  });

  it('refuses a word that does not start with the given letter', () => {
    expect(checkProposal('BATEAU', context)).toBe('wrongFirstLetter');
  });

  it('refuses a word already proposed on this word', () => {
    expect(checkProposal('MARRON', context)).toBe('alreadyProposed');
  });

  it('refuses a word missing from the dictionary', () => {
    expect(checkProposal('MZZZZZ', context)).toBe('unknownWord');
  });

  it('refuses characters other than A to Z, even if the dictionary had them', () => {
    expect(checkProposal('M-ISON', { ...context, isValidWord: () => true })).toBe('unknownWord');
  });
});
