import { describe, expect, it } from 'vitest';
import type { TieBreakState } from './state';
import { createTestGame, eventTypes, inPhase, last, type TestGame } from './test-game';

/** A 3-team game after its last word: teams 1 and 3 tied at the top. */
function tiedGame(): TestGame {
  const game = createTestGame({ teams: 3, wordCount: 6 });
  const state = inPhase(game.state, 'playing');
  const scores = [150, 50, 150];
  game.set({
    ...state,
    wordNumber: 6,
    teams: state.teams.map((team, i) => ({ ...team, score: scores[i] ?? 0 })),
    step: { kind: 'wordOver', nextTeam: 0 },
  });
  return game;
}

function tieBreak(game: TestGame): TieBreakState {
  return inPhase(game.state, 'tieBreak');
}

/** The tie-break word is MAISON and the first contender may play. */
function startedTieBreak(): TestGame {
  const game = tiedGame();
  game.act({ type: 'nextWord' });
  game.act({ type: 'forceSecret', word: 'MAISON' });
  game.act({ type: 'revealDone' });
  return game;
}

describe('tie-break', () => {
  it('starts with the tied teams only, in playing order', () => {
    const game = tiedGame();
    const events = game.act({ type: 'nextWord' });
    expect(events[0]).toEqual({ type: 'tieBreakStarted', teams: [0, 2] });
    expect(tieBreak(game)).toMatchObject({ contenders: [0, 2], activeTeam: 0 });
  });

  it('gives one attempt to each team in turn, without a bonus letter after a valid word', () => {
    const game = startedTieBreak();
    const known = tieBreak(game).word.revealed;
    const events = game.act({ type: 'proposeWord', word: 'MOUTON' });
    expect(events[1]).toEqual({
      type: 'handPassed',
      team: 2,
      bonusPosition: null,
      lastChance: false,
    });
    expect(tieBreak(game).activeTeam).toBe(2);
    expect(tieBreak(game).word.revealed).toEqual(known);
    game.act({ type: 'revealDone' });
    game.act({ type: 'proposeWord', word: 'MARRON' });
    expect(tieBreak(game).activeTeam).toBe(0);
  });

  it('gives a bonus letter to the next team after a refused word', () => {
    const game = startedTieBreak();
    const before = tieBreak(game).word.revealed.filter(Boolean).length;
    const events = game.act({ type: 'proposeWord', word: 'MZZZZZ' });
    expect(events[1]).toMatchObject({ type: 'handPassed', team: 2 });
    expect(tieBreak(game).word.revealed.filter(Boolean)).toHaveLength(before + 1);
  });

  it('gives a bonus letter to the next team after a timeout', () => {
    const game = startedTieBreak();
    game.wait(30_000);
    const events = game.act({ type: 'timeUp' });
    expect(eventTypes(events)).toEqual(['attemptTimedOut', 'handPassed']);
    expect(events[1]).toMatchObject({ team: 2 });
  });

  it('the team that finds the word wins, without points, and plays the Super partie', () => {
    const game = startedTieBreak();
    game.act({ type: 'proposeWord', word: 'MOUTON' });
    game.act({ type: 'revealDone' });
    const events = game.act({ type: 'proposeWord', word: 'MAISON' });
    expect(last(events)).toEqual({ type: 'wordFound', team: 2, word: 'MAISON', points: 0 });
    expect(tieBreak(game).step).toEqual({ kind: 'won', winner: 2 });
    expect(tieBreak(game).teams[2]?.score).toBe(150);
    game.act({ type: 'nextWord' });
    expect(inPhase(game.state, 'superPartie').finalist).toBe(2);
  });

  it('after 6 lines without a winner, reveals the word and starts a new one with the next team', () => {
    const game = startedTieBreak();
    for (const word of ['MARRON', 'MOUTON', 'MOUCHE', 'MANCHE', 'MARCHE']) {
      game.act({ type: 'proposeWord', word });
      game.act({ type: 'revealDone' });
    }
    // Lines alternate 0, 2, 0, 2, 0: team 2 plays the 6th line.
    expect(tieBreak(game).activeTeam).toBe(2);
    const events = game.act({ type: 'proposeWord', word: 'MELONS' });
    expect(eventTypes(events)).toEqual(['attemptMade', 'wordMissed', 'tieBreakWordStarted']);
    expect(tieBreak(game).activeTeam).toBe(0);
    expect(tieBreak(game).word.secret).not.toBe('MAISON');
    expect(tieBreak(game).word.lines).toEqual([]);
  });
});
