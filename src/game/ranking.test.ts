import { describe, expect, it } from 'vitest';
import { leaders, rankTeams } from './ranking';

describe('rankTeams', () => {
  it('ranks by score, keeping the playing order for equal scores', () => {
    expect(rankTeams([{ score: 50 }, { score: 200 }, { score: 50 }, { score: 100 }])).toEqual([
      1, 3, 0, 2,
    ]);
  });
});

describe('leaders', () => {
  it('returns the only best team', () => {
    expect(leaders([{ score: 50 }, { score: 200 }, { score: 100 }])).toEqual([1]);
  });

  it('returns every team tied at the top', () => {
    expect(leaders([{ score: 150 }, { score: 50 }, { score: 150 }])).toEqual([0, 2]);
  });
});
