import { describe, expect, it } from 'vitest';
import { formatClock, secondsLeft } from './format';

describe('formatClock', () => {
  it.each([
    [270_000, '4:30'],
    [60_000, '1:00'],
    [7_000, '0:07'],
    [6_001, '0:07'],
    [999, '0:01'],
    [0, '0:00'],
    [-500, '0:00'],
  ])('shows %i ms as %s', (ms, text) => {
    expect(formatClock(ms)).toBe(text);
  });
});

describe('secondsLeft', () => {
  it('rounds up and never goes below zero', () => {
    expect(secondsLeft(4_200)).toBe(5);
    expect(secondsLeft(5_000)).toBe(5);
    expect(secondsLeft(-1)).toBe(0);
  });
});
