import { describe, expect, it } from 'vitest';
import type { GameAction } from '../game/state';
import { createTestGame } from '../game/test-game';
import { mayAct, withSeatNames } from './action-guard';
import { chooseMode, dropLink, EMPTY_ROOM, greet, joinTeam, type Room } from './room';

const state = createTestGame().state;
const propose: GameAction = { type: 'proposeWord', word: 'MAISON' };
const nextWord: GameAction = { type: 'nextWord' };

function singleRoom(): Room {
  const room = greet(EMPTY_ROOM, 1, 'phoneaaa').room;
  return chooseMode(room, 1, 'single')?.room ?? room;
}

/** Link 1: master, team 0. Link 2: team 1. */
function multiRoom(): Room {
  let room = greet(EMPTY_ROOM, 1, 'phoneaaa').room;
  room = chooseMode(room, 1, 'multi')?.room ?? room;
  room = greet(room, 2, 'phonebbb').room;
  room = joinTeam(room, 1, 'Les Bleus') ?? room;
  return joinTeam(room, 2, 'Mamie') ?? room;
}

describe('mayAct', () => {
  it('refuses everything before the mode is chosen', () => {
    const room = greet(EMPTY_ROOM, 1, 'phoneaaa').room;
    expect(mayAct(room, state, 1, propose)).toBe(false);
  });

  it('lets the only phone play for every team and run the game', () => {
    const room = singleRoom();
    expect(mayAct(room, state, 1, propose)).toBe(true);
    expect(mayAct(room, state, 1, nextWord)).toBe(true);
  });

  it('refuses TV-only actions, even from the only phone', () => {
    expect(mayAct(singleRoom(), state, 1, { type: 'timeUp' })).toBe(false);
    expect(mayAct(singleRoom(), state, 1, { type: 'revealDone' })).toBe(false);
  });

  it('with one phone per team, only the active team plays', () => {
    const room = multiRoom();
    expect(mayAct(room, state, 1, propose)).toBe(true);
    expect(mayAct(room, state, 2, propose)).toBe(false);
  });

  it('with one phone per team, only the master runs the game', () => {
    const room = multiRoom();
    expect(mayAct(room, state, 1, nextWord)).toBe(true);
    expect(mayAct(room, state, 2, nextWord)).toBe(false);
  });

  it('refuses a phone without a team', () => {
    const room = greet(multiRoom(), 3, 'phoneccc').room;
    expect(mayAct(room, state, 3, propose)).toBe(false);
  });

  it('lets the master play for a disconnected active team', () => {
    // Team 1 plays; its phone (link 2) is gone.
    const turnOfTeam1 = { ...createTestGame().state };
    if (turnOfTeam1.phase !== 'playing') throw new Error('not playing');
    const playingTeam1 = { ...turnOfTeam1, activeTeam: 1 };
    const room = multiRoom();
    expect(mayAct(room, playingTeam1, 1, propose)).toBe(false);
    expect(mayAct(dropLink(room, 2), playingTeam1, 1, propose)).toBe(true);
  });
});

describe('withSeatNames', () => {
  const start: GameAction = {
    type: 'startGame',
    teamNames: ['X', 'Y', 'Z'],
    wordLength: 7,
    attemptSeconds: 30,
    wordCount: 10,
  };

  it('uses the joined teams with one phone per team', () => {
    expect(withSeatNames(multiRoom(), start)).toMatchObject({ teamNames: ['Les Bleus', 'Mamie'] });
  });

  it('keeps the typed names with one phone', () => {
    expect(withSeatNames(singleRoom(), start)).toEqual(start);
  });
});
