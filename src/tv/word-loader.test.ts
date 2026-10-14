import { describe, expect, it } from 'vitest';
import { WORD_LENGTHS } from '../game/config';
import { loadWordSource } from './word-loader';

describe('loadWordSource', () => {
  it.each(WORD_LENGTHS)('loads both lists of %i letters', async (length) => {
    const source = await loadWordSource(length);
    expect(source.length).toBe(length);
    expect(source.secrets.length).toBeGreaterThanOrEqual(400);
    const [first = ''] = source.secrets;
    expect(source.isValid(first)).toBe(true);
    expect(source.isValid('Z'.repeat(length))).toBe(false);
  });
});
