import { describe, expect, it } from 'vitest';
import { createTestGame, inPhase } from '../game/test-game';
import { toPublicView } from '../protocol/view';
import { phaseTitle, type InGameView } from './screens';

function inGameView(game: ReturnType<typeof createTestGame>): InGameView {
  const view = toPublicView(game.state, { events: [], busy: false, now: 0 }).game;
  if (view.phase === 'setup' || view.phase === 'gameOver') throw new Error('not in game');
  return view;
}

describe('phaseTitle', () => {
  it('shows the word number in the first part', () => {
    expect(phaseTitle(inGameView(createTestGame({ wordCount: 10 })))).toBe('Mot 1 sur 10');
  });

  it('announces the last word', () => {
    const game = createTestGame({ wordCount: 6 });
    game.set({ ...inPhase(game.state, 'playing'), wordNumber: 6 });
    expect(phaseTitle(inGameView(game))).toBe('Dernier mot ! (100 points)');
  });

  it('shows the Super partie progress', () => {
    const game = createTestGame({ startAtSuperPartie: true });
    expect(phaseTitle(inGameView(game))).toBe('Super partie · Mot 1 sur 10 · 0 / 10 trouvés');
  });
});
