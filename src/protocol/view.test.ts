import { describe, expect, it } from 'vitest';
import type { GameState } from '../game/state';
import { createTestGame, inPhase, type TestGame } from '../game/test-game';
import { publicViewSchema, toPublicView, type PhaseView, type PublicView } from './view';

const NOW = 1_000_000;

function viewOf(state: GameState, now = NOW): PublicView {
  return toPublicView(state, { events: [], busy: false, now });
}

function expectValid(view: PublicView): void {
  expect(publicViewSchema.safeParse(view).success).toBe(true);
}

function inGame<P extends PhaseView['phase']>(view: PublicView, phase: P) {
  const game = view.game;
  if (game.phase !== phase) throw new Error(`Expected ${phase}, got ${game.phase}`);
  // Safe: the phase was just checked, and the union is discriminated by it.
  return game as Extract<PhaseView, { phase: P }>;
}

/** A first-part game on MAISON, one wrong line played. */
function gameWithLine(): TestGame {
  const game = createTestGame();
  game.act({ type: 'forceSecret', word: 'MAISON' });
  game.act({ type: 'revealDone' });
  game.act({ type: 'proposeWord', word: 'MOUTON' });
  return game;
}

describe('toPublicView', () => {
  it('shows the setup', () => {
    const view = viewOf({ phase: 'setup' });
    expect(view.game).toEqual({ phase: 'setup' });
    expectValid(view);
  });

  it('never sends the secret word while it is being played', () => {
    const game = gameWithLine();
    const view = viewOf(game.state);
    expectValid(view);
    expect(inGame(view, 'playing').word.secret).toBeNull();
    expect(JSON.stringify(view)).not.toContain('MAISON');
  });

  it('only shows letters that are known', () => {
    const game = gameWithLine();
    const state = inPhase(game.state, 'playing');
    const hints = inGame(viewOf(state), 'playing').word.hints;
    hints.forEach((hint, i) => {
      const known = state.word.revealed[i] === true || [0, 4, 5].includes(i);
      expect(hint).toBe(known ? 'MAISON'.charAt(i) : null);
    });
  });

  it('reveals the secret word once the word is over', () => {
    const game = gameWithLine();
    game.act({ type: 'revealDone' });
    game.act({ type: 'proposeWord', word: 'MAISON' });
    const view = viewOf(game.state);
    expectValid(view);
    expect(inGame(view, 'playing')).toMatchObject({ step: 'drawing', ballsLeft: 2 });
    expect(inGame(view, 'playing').word.secret).toBe('MAISON');
  });

  it('sends the time left of the attempt, stopped while the TV animates', () => {
    const game = gameWithLine();
    expect(inGame(viewOf(game.state), 'playing').timer).toEqual({
      remainingMs: 30_000,
      running: false,
    });
    game.act({ type: 'revealDone' });
    game.wait(12_000);
    expect(inGame(viewOf(game.state, NOW + 12_000), 'playing').timer).toEqual({
      remainingMs: 18_000,
      running: true,
    });
  });

  it('sends no timer without a time limit', () => {
    const game = createTestGame({ attemptSeconds: null });
    expect(inGame(viewOf(game.state), 'playing').timer).toBeNull();
  });

  it('shows the teams, scores and grids, with the balls left', () => {
    const view = inGame(viewOf(createTestGame({ teams: 3 }).state), 'playing');
    expect(view.teams).toHaveLength(3);
    expect(view.teams[0]).toMatchObject({
      name: 'Équipe 1',
      score: 0,
      urnNumbers: 17,
      blackBalls: 3,
    });
    expect(view.teams[0]?.grid.numbers).toHaveLength(25);
  });

  it('shows the Super partie with its global timer, without the secret', () => {
    const game = createTestGame({ startAtSuperPartie: true });
    const ready = viewOf(game.state);
    expectValid(ready);
    expect(inGame(ready, 'superPartie')).toMatchObject({
      step: 'ready',
      wordIndex: 1,
      found: 0,
      timer: { remainingMs: 210_000, running: false },
    });
    const secret = inPhase(game.state, 'superPartie').word.secret;
    expect(JSON.stringify(ready)).not.toContain(secret);
  });

  it('shows the tie-break', () => {
    const game = createTestGame({ wordCount: 6 });
    const state = inPhase(game.state, 'playing');
    game.set({ ...state, wordNumber: 6, step: { kind: 'wordOver', nextTeam: 0 } });
    game.act({ type: 'nextWord' });
    const view = viewOf(game.state);
    expectValid(view);
    expect(inGame(view, 'tieBreak')).toMatchObject({ contenders: [0, 1], step: 'revealing' });
  });

  it('shows the final ranking', () => {
    const game = createTestGame();
    game.act({ type: 'abandonGame' });
    const view = viewOf(game.state);
    expectValid(view);
    expect(inGame(view, 'gameOver')).toEqual({
      phase: 'gameOver',
      teams: [
        { name: 'Équipe 1', score: 0 },
        { name: 'Équipe 2', score: 0 },
      ],
      ranking: [0, 1],
      result: null,
    });
  });

  it('keeps the events and the busy flag', () => {
    const view = toPublicView(
      { phase: 'setup' },
      { events: [{ type: 'gridsReset' }], busy: true, now: NOW },
    );
    expect(view).toMatchObject({ busy: true, events: [{ type: 'gridsReset' }] });
    expectValid(view);
  });
});
