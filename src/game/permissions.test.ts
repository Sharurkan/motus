import { describe, expect, it } from 'vitest';
import { actionOwner, canAct, turnTeam } from './permissions';
import type { GameAction } from './state';
import { createTestGame } from './test-game';

const connected = (): boolean => true;
const disconnected = (): boolean => false;

describe('turnTeam', () => {
  it('is the active team while playing, the finalist in the Super partie, nobody at setup', () => {
    expect(turnTeam(createTestGame().state)).toBe(0);
    expect(turnTeam(createTestGame({ startAtSuperPartie: true }).state)).toBe(0);
    expect(turnTeam({ phase: 'setup' })).toBeNull();
  });
});

describe('actionOwner', () => {
  const state = createTestGame().state;

  it.each<GameAction>([
    { type: 'nextWord' },
    { type: 'abandonGame' },
    { type: 'newGame' },
    { type: 'forceSecret', word: 'MAISON' },
    { type: 'forceBall', ball: { kind: 'black' } },
  ])('gives $type to the master', (action) => {
    expect(actionOwner(state, action)).toEqual({ kind: 'master' });
  });

  it.each<GameAction>([
    { type: 'proposeWord', word: 'MAISON' },
    { type: 'drawBall' },
    { type: 'skipWord' },
    { type: 'playBonusWord' },
    { type: 'finishSuperPartie' },
  ])('gives $type to the team whose turn it is', (action) => {
    expect(actionOwner(state, action)).toEqual({ kind: 'team', team: 0 });
  });

  it.each<GameAction>([
    { type: 'revealDone' },
    { type: 'timeUp' },
    { type: 'resumeClock', pausedMs: 1 },
  ])('never lets a phone send $type', (action) => {
    expect(actionOwner(state, action)).toBeNull();
  });
});

describe('canAct', () => {
  const state = createTestGame().state;
  const propose: GameAction = { type: 'proposeWord', word: 'MAISON' };

  it('lets the active team play and refuses the other teams', () => {
    expect(canAct(state, propose, { team: 0, isMaster: false }, connected)).toBe(true);
    expect(canAct(state, propose, { team: 1, isMaster: false }, connected)).toBe(false);
  });

  it('lets only the master move to the next word', () => {
    expect(canAct(state, { type: 'nextWord' }, { team: 1, isMaster: true }, connected)).toBe(true);
    expect(canAct(state, { type: 'nextWord' }, { team: 0, isMaster: false }, connected)).toBe(
      false,
    );
  });

  it('lets the master play for a disconnected team, not for a connected one', () => {
    expect(canAct(state, propose, { team: 1, isMaster: true }, disconnected)).toBe(true);
    expect(canAct(state, propose, { team: 1, isMaster: true }, connected)).toBe(false);
  });

  it('refuses TV-only actions from any phone, even the master', () => {
    expect(canAct(state, { type: 'timeUp' }, { team: 0, isMaster: true }, connected)).toBe(false);
  });
});
