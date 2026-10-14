import { describe, expect, it } from 'vitest';
import { createTestGame, inPhase, type TestGame } from '../game/test-game';
import { SINGLE_PHONE_ROOM, type RoomView } from '../protocol/room';
import { toPublicView, type PhaseView } from '../protocol/view';
import { describeScreen, phoneRole, remainingNow, teamNamesFor } from './controls';

function phaseView(game: TestGame): PhaseView {
  return toPublicView(game.state, { events: [], busy: false, now: 1_000_000 }).game;
}

function multiRoom(team: number, isMaster: boolean, connected = [true, true]): RoomView {
  return {
    mode: 'multi',
    isMaster,
    team,
    seats: connected.map((isConnected, i) => ({ name: `T${String(i)}`, connected: isConnected })),
  };
}

describe('describeScreen', () => {
  it('waits while the TV shows the new word, then asks for a word', () => {
    const game = createTestGame();
    expect(describeScreen(phaseView(game))).toEqual({ kind: 'watching' });
    game.act({ type: 'revealDone' });
    expect(describeScreen(phaseView(game))).toEqual({ kind: 'guessing', superPartie: false });
  });

  it('asks for the first, then the second ball', () => {
    const game = createTestGame();
    game.act({ type: 'revealDone' });
    game.act({ type: 'proposeWord', word: inPhase(game.state, 'playing').word.secret });
    expect(describeScreen(phaseView(game))).toEqual({ kind: 'drawing', ball: 1 });
    const state = inPhase(game.state, 'playing');
    const value = state.teams[0]?.card.urn.numbers[0] ?? 0;
    game.act({ type: 'forceBall', ball: { kind: 'number', value } });
    game.act({ type: 'drawBall' });
    expect(describeScreen(phaseView(game))).toEqual({ kind: 'drawing', ball: 2 });
  });

  it('shows the end of a word, and the choice of the bonus word', () => {
    const game = createTestGame();
    game.act({ type: 'revealDone' });
    game.act({ type: 'proposeWord', word: inPhase(game.state, 'playing').word.secret });
    game.act({ type: 'forceBall', ball: { kind: 'black' } });
    game.act({ type: 'drawBall' });
    expect(describeScreen(phaseView(game))).toEqual({ kind: 'wordOver', isLastWord: false });
  });

  it('asks for a word in the Super partie', () => {
    const game = createTestGame({ startAtSuperPartie: true });
    game.act({ type: 'revealDone' });
    expect(describeScreen(phaseView(game))).toEqual({ kind: 'guessing', superPartie: true });
  });
});

describe('phoneRole', () => {
  const game = phaseView(createTestGame());

  it('lets the only phone do everything', () => {
    expect(phoneRole(game, SINGLE_PHONE_ROOM, null)).toMatchObject({
      canPlay: true,
      canManage: true,
    });
  });

  it('lets only the active team play, and says whose turn it is', () => {
    expect(phoneRole(game, multiRoom(0, false), null)).toMatchObject({
      canPlay: true,
      waitingFor: null,
    });
    expect(phoneRole(game, multiRoom(1, false), null)).toMatchObject({
      canPlay: false,
      waitingFor: 0,
    });
  });

  it('lets the master stand in for a disconnected team, once chosen', () => {
    const room = multiRoom(1, true, [false, true]);
    expect(phoneRole(game, room, null)).toMatchObject({ canPlay: false, canStandIn: true });
    expect(phoneRole(game, room, 0)).toMatchObject({ canPlay: true });
  });

  it('gives game management to the master only', () => {
    expect(phoneRole(game, multiRoom(1, true), null).canManage).toBe(true);
    expect(phoneRole(game, multiRoom(0, false), null).canManage).toBe(false);
  });
});

describe('teamNamesFor', () => {
  it('keeps one name per team, empty when not typed', () => {
    expect(teamNamesFor(['A', undefined, 'C', 'D'], 3)).toEqual(['A', '', 'C']);
  });
});

describe('remainingNow', () => {
  it('counts down with the phone clock from the time left sent by the TV', () => {
    expect(remainingNow({ remainingMs: 30_000, running: true }, 1000, 6000)).toBe(25_000);
    expect(remainingNow({ remainingMs: 3000, running: true }, 1000, 9000)).toBe(0);
  });

  it('stays still while the timer is stopped', () => {
    expect(remainingNow({ remainingMs: 30_000, running: false }, 1000, 60_000)).toBe(30_000);
  });
});
