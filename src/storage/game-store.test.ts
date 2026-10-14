import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { GameState } from '../game/state';
import { createTestGame, inPhase, type TestGame } from '../game/test-game';
import { loadGame, saveGame } from './game-store';
import { blockedStorage, MemoryStorage } from './testing';

let storage: MemoryStorage;

beforeEach(() => {
  storage = new MemoryStorage();
  vi.stubGlobal('localStorage', storage);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function roundTrip(state: GameState): GameState | null {
  expect(saveGame(state)).toBe(true);
  const loaded = loadGame();
  return loaded.kind === 'loaded' ? loaded.state : null;
}

/** A game with a word played: one line, then the word found. */
function drawingGame(): TestGame {
  const game = createTestGame({ teams: 3 });
  game.act({ type: 'forceSecret', word: 'MAISON' });
  game.act({ type: 'revealDone' });
  game.act({ type: 'proposeWord', word: 'MZZZZZ' });
  game.act({ type: 'revealDone' });
  game.act({ type: 'proposeWord', word: 'MAISON' });
  game.act({ type: 'forceBall', ball: { kind: 'black' } });
  return game;
}

describe('game store', () => {
  it('is empty at first', () => {
    expect(loadGame()).toEqual({ kind: 'empty' });
  });

  it('keeps the setup', () => {
    expect(roundTrip({ phase: 'setup' })).toEqual({ phase: 'setup' });
  });

  it('keeps a word being played, with its timer start', () => {
    const game = createTestGame();
    game.act({ type: 'revealDone' });
    expect(roundTrip(game.state)).toEqual(game.state);
  });

  it('keeps a draw, refused lines, scores, grids and the forced ball', () => {
    const state = drawingGame().state;
    expect(inPhase(state, 'playing').step.kind).toBe('drawing');
    expect(roundTrip(state)).toEqual(state);
  });

  it('keeps a tie-break', () => {
    const game = createTestGame({ wordCount: 6 });
    game.set({
      ...inPhase(game.state, 'playing'),
      wordNumber: 6,
      step: { kind: 'wordOver', nextTeam: 0 },
    });
    game.act({ type: 'nextWord' });
    expect(game.state.phase).toBe('tieBreak');
    expect(roundTrip(game.state)).toEqual(game.state);
  });

  it('keeps the Super partie and the end screen', () => {
    const game = createTestGame({ startAtSuperPartie: true });
    game.act({ type: 'revealDone' });
    game.act({ type: 'skipWord' });
    expect(roundTrip(game.state)).toEqual(game.state);
    game.act({ type: 'abandonGame' });
    expect(roundTrip(game.state)).toEqual(game.state);
  });

  it('drops a save from another version', () => {
    storage.setItem('motus.game', JSON.stringify({ v: 999, state: { phase: 'setup' } }));
    expect(loadGame()).toEqual({ kind: 'unreadable' });
  });

  it('drops broken JSON', () => {
    storage.setItem('motus.game', '{not json');
    expect(loadGame()).toEqual({ kind: 'unreadable' });
  });

  it('drops a save whose word does not fit the game length', () => {
    const state = inPhase(createTestGame().state, 'playing');
    const broken = { ...state, word: { ...state.word, secret: 'MAISONS' } };
    storage.setItem('motus.game', JSON.stringify({ v: 2, state: broken }));
    expect(loadGame()).toEqual({ kind: 'unreadable' });
  });

  it('drops a save whose active team does not exist', () => {
    const state = inPhase(createTestGame().state, 'playing');
    storage.setItem('motus.game', JSON.stringify({ v: 2, state: { ...state, activeTeam: 3 } }));
    expect(loadGame()).toEqual({ kind: 'unreadable' });
  });

  it('copes with blocked storage', () => {
    vi.stubGlobal('localStorage', blockedStorage());
    expect(saveGame({ phase: 'setup' })).toBe(false);
    expect(loadGame()).toEqual({ kind: 'unreadable' });
  });
});
