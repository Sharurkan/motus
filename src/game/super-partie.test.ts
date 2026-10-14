import { describe, expect, it } from 'vitest';
import { SUPER_DURATION_MS, SUPER_WORD_COUNT } from './config';
import type { SuperPartieState } from './state';
import { superTimeLeft } from './super-partie';
import { createTestGame, eventTypes, inPhase, type TestGame } from './test-game';

const DURATION_6_LETTERS = 3 * 60_000 + 30_000;

function superPartie(game: TestGame): SuperPartieState {
  return inPhase(game.state, 'superPartie');
}

/** The Super partie with its timer running. */
function startedSuperPartie(): TestGame {
  const game = createTestGame({ startAtSuperPartie: true });
  game.act({ type: 'revealDone' });
  return game;
}

function findCurrentWord(game: TestGame) {
  return game.act({ type: 'proposeWord', word: superPartie(game).word.secret });
}

function findTenWords(game: TestGame): void {
  for (let i = 0; i < SUPER_WORD_COUNT; i++) findCurrentWord(game);
}

describe('Super partie timer', () => {
  it('lasts 3:30 for 6 letters, up to 5:30 for 10 letters', () => {
    expect(SUPER_DURATION_MS).toEqual({
      6: DURATION_6_LETTERS,
      7: 4 * 60_000,
      8: 4 * 60_000 + 30_000,
      9: 5 * 60_000,
      10: 5 * 60_000 + 30_000,
    });
  });

  it('starts when the first word is on screen', () => {
    const game = createTestGame({ startAtSuperPartie: true });
    const state = superPartie(game);
    expect(state.step.kind).toBe('ready');
    expect(superTimeLeft(state, 0)).toBe(DURATION_6_LETTERS);
    game.act({ type: 'revealDone' });
    expect(superPartie(game).step.kind).toBe('guessing');
    expect(superPartie(game).startedAt).not.toBeNull();
  });

  it('ends the Super partie when the time is really over', () => {
    const game = startedSuperPartie();
    findCurrentWord(game);
    game.wait(DURATION_6_LETTERS - 1);
    expect(game.act({ type: 'timeUp' })).toEqual([]);
    game.wait(1);
    expect(eventTypes(game.act({ type: 'timeUp' }))).toEqual(['superTimeUp', 'gameOver']);
    expect(inPhase(game.state, 'gameOver').result).toEqual({
      finalist: 0,
      found: 1,
      bonus: 'notPlayed',
    });
  });

  it('keeps running between words: no animation step', () => {
    const game = startedSuperPartie();
    findCurrentWord(game);
    expect(superPartie(game).step.kind).toBe('guessing');
  });

  it('refuses a word proposed after the end of the time', () => {
    const game = startedSuperPartie();
    game.wait(DURATION_6_LETTERS);
    const events = findCurrentWord(game);
    expect(eventTypes(events)).toEqual(['superTimeUp', 'gameOver']);
  });
});

describe('Super partie words', () => {
  it('shows 3 letters at the start of each word', () => {
    const game = startedSuperPartie();
    expect(superPartie(game).word.revealed.filter(Boolean)).toHaveLength(3);
    findCurrentWord(game);
    expect(superPartie(game).word.revealed.filter(Boolean)).toHaveLength(3);
  });

  it('counts a found word and moves to the next one', () => {
    const game = startedSuperPartie();
    const events = findCurrentWord(game);
    expect(eventTypes(events)).toEqual(['attemptMade', 'superWordFound', 'superWordStarted']);
    expect(superPartie(game)).toMatchObject({ found: 1, wordIndex: 2 });
  });

  it('a refused word costs only the line', () => {
    const game = startedSuperPartie();
    game.act({ type: 'forceSecret', word: 'MAISON' });
    const events = game.act({ type: 'proposeWord', word: 'MZZZZZ' });
    expect(events[0]).toMatchObject({ type: 'proposalRefused', refusal: 'unknownWord' });
    expect(superPartie(game)).toMatchObject({ wordIndex: 1, found: 0 });
    expect(superPartie(game).word.lines).toHaveLength(1);
  });

  it('after 6 failed lines, reveals the word and starts the next one', () => {
    const game = startedSuperPartie();
    game.act({ type: 'forceSecret', word: 'MAISON' });
    for (const word of ['MARRON', 'MOUTON', 'MOUCHE', 'MANCHE', 'MARCHE']) {
      game.act({ type: 'proposeWord', word });
    }
    const events = game.act({ type: 'proposeWord', word: 'MELONS' });
    expect(events[1]).toEqual({ type: 'superWordMissed', word: 'MAISON', skipped: false });
    expect(superPartie(game)).toMatchObject({ wordIndex: 2, found: 0 });
  });

  it('"Passer" reveals the word, counts it as not found and starts the next one', () => {
    const game = startedSuperPartie();
    const secret = superPartie(game).word.secret;
    const events = game.act({ type: 'skipWord' });
    expect(events[0]).toEqual({ type: 'superWordMissed', word: secret, skipped: true });
    expect(superPartie(game)).toMatchObject({ wordIndex: 2, found: 0 });
  });

  it('ends after the 10th word when not all were found', () => {
    const game = startedSuperPartie();
    game.act({ type: 'skipWord' });
    for (let i = 0; i < 9; i++) findCurrentWord(game);
    expect(inPhase(game.state, 'gameOver').result).toEqual({
      finalist: 0,
      found: 9,
      bonus: 'notPlayed',
    });
  });
});

describe('Super partie bonus word', () => {
  it('is offered after 10 words found with time left', () => {
    const game = startedSuperPartie();
    findTenWords(game);
    expect(superPartie(game).step.kind).toBe('bonusChoice');
    expect(superPartie(game).found).toBe(10);
  });

  it('can be refused: the game ends with 10 words', () => {
    const game = startedSuperPartie();
    findTenWords(game);
    game.act({ type: 'finishSuperPartie' });
    expect(inPhase(game.state, 'gameOver').result).toEqual({
      finalist: 0,
      found: 10,
      bonus: 'notPlayed',
    });
  });

  it('is played with the time left, and counted apart from the 10 words', () => {
    const game = startedSuperPartie();
    findTenWords(game);
    const events = game.act({ type: 'playBonusWord' });
    expect(events).toEqual([{ type: 'superWordStarted', index: 11, isBonus: true }]);
    findCurrentWord(game);
    expect(inPhase(game.state, 'gameOver').result).toEqual({
      finalist: 0,
      found: 10,
      bonus: 'found',
    });
  });

  it('is missed when skipped or when the time runs out', () => {
    const skipped = startedSuperPartie();
    findTenWords(skipped);
    skipped.act({ type: 'playBonusWord' });
    skipped.act({ type: 'skipWord' });
    expect(inPhase(skipped.state, 'gameOver').result?.bonus).toBe('missed');

    const late = startedSuperPartie();
    findTenWords(late);
    late.act({ type: 'playBonusWord' });
    late.wait(DURATION_6_LETTERS);
    late.act({ type: 'timeUp' });
    expect(inPhase(late.state, 'gameOver').result?.bonus).toBe('missed');
  });
});

describe('Super partie history', () => {
  it('keeps every word played, found or missed, in order', () => {
    const game = startedSuperPartie();
    const first = superPartie(game).word.secret;
    findCurrentWord(game);
    const second = superPartie(game).word.secret;
    game.act({ type: 'skipWord' });
    expect(superPartie(game).results).toEqual([
      { word: first, found: true },
      { word: second, found: false },
    ]);
  });
});
