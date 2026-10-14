import { describe, expect, it } from 'vitest';
import { INITIAL_STATE } from '../game/state';
import type { PhoneAction } from './actions';
import {
  actionMessage,
  HEARTBEAT,
  heartbeatSchema,
  parsePhoneMessage,
  parseTvMessage,
  PROTOCOL_VERSION,
  stateMessage,
} from './messages';
import { SINGLE_PHONE_ROOM } from './room';
import { toPublicView } from './view';

const invalid = { ok: false, reason: 'invalid' };
const otherVersion = { ok: false, reason: 'version' };

const START: PhoneAction = {
  type: 'startGame',
  teamNames: ['Les Bleus', ''],
  wordLength: 7,
  attemptSeconds: 30,
  wordCount: 10,
};

describe('parsePhoneMessage', () => {
  it.each([
    START,
    { ...START, attemptSeconds: null, wordLength: 10, wordCount: 14 },
    { ...START, startAtSuperPartie: true },
    { type: 'proposeWord', word: 'maison' },
    { type: 'drawBall' },
    { type: 'nextWord' },
    { type: 'skipWord' },
    { type: 'playBonusWord' },
    { type: 'finishSuperPartie' },
    { type: 'abandonGame' },
    { type: 'newGame' },
    { type: 'forceSecret', word: 'CHEVAL' },
    { type: 'forceBall', ball: { kind: 'number', value: 70 } },
    { type: 'forceBall', ball: { kind: 'black' } },
  ] satisfies PhoneAction[])('accepts the action $type', (action) => {
    expect(parsePhoneMessage(actionMessage(action))).toEqual({
      ok: true,
      message: { v: PROTOCOL_VERSION, type: 'action', action },
    });
  });

  it.each([
    { ...START, teamNames: ['Seuls'] },
    { ...START, teamNames: ['A', 'B', 'C', 'D', 'E'] },
    { ...START, teamNames: ['A'.repeat(21), 'B'] },
    { ...START, wordLength: 5 },
    { ...START, wordLength: 11 },
    { ...START, attemptSeconds: 25 },
    { ...START, wordCount: 8 },
    { type: 'proposeWord' },
    { type: 'proposeWord', word: 'A'.repeat(31) },
    { type: 'forceBall', ball: { kind: 'number', value: 0 } },
    { type: 'forceBall', ball: { kind: 'number', value: 71 } },
    { type: 'forceBall', ball: { kind: 'number', value: 2.5 } },
    { type: 'forceBall', ball: { kind: 'red' } },
    { type: 'revealDone' },
    { type: 'timeUp' },
    { type: 'cheat' },
  ])('rejects the action %j', (action) => {
    expect(parsePhoneMessage({ v: PROTOCOL_VERSION, type: 'action', action })).toEqual(invalid);
  });

  it('accepts a heartbeat', () => {
    expect(parsePhoneMessage(HEARTBEAT)).toEqual({ ok: true, message: HEARTBEAT });
  });

  it('drops unknown fields', () => {
    const data = {
      v: PROTOCOL_VERSION,
      type: 'action',
      action: { type: 'drawBall', cheat: true },
      extra: 1,
    };
    expect(parsePhoneMessage(data)).toEqual({
      ok: true,
      message: { v: PROTOCOL_VERSION, type: 'action', action: { type: 'drawBall' } },
    });
  });

  it('tells apart a message from another version', () => {
    expect(parsePhoneMessage({ ...HEARTBEAT, v: PROTOCOL_VERSION + 1 })).toEqual(otherVersion);
  });

  it.each([null, 'hello', 42, [], {}, { v: PROTOCOL_VERSION, type: 'unknown' }])(
    'rejects %j as invalid',
    (data) => {
      expect(parsePhoneMessage(data)).toEqual(invalid);
    },
  );
});

describe('parseTvMessage', () => {
  const view = toPublicView(INITIAL_STATE, { events: [], busy: false, now: 0 });

  it('accepts a state message', () => {
    const message = stateMessage(view, SINGLE_PHONE_ROOM);
    expect(parseTvMessage(message)).toEqual({ ok: true, message });
  });

  it('tells apart a state from another version', () => {
    const message = { ...stateMessage(view, SINGLE_PHONE_ROOM), v: PROTOCOL_VERSION + 1 };
    expect(parseTvMessage(message)).toEqual(otherVersion);
  });

  it('rejects a phone message', () => {
    expect(parseTvMessage(actionMessage({ type: 'drawBall' }))).toEqual(invalid);
  });
});

describe('heartbeatSchema', () => {
  it('accepts the heartbeat the app sends and refuses another version', () => {
    expect(heartbeatSchema.safeParse(HEARTBEAT).success).toBe(true);
    expect(heartbeatSchema.safeParse({ ...HEARTBEAT, v: PROTOCOL_VERSION + 1 }).success).toBe(
      false,
    );
  });
});
