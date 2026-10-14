import type { RoomView } from '../protocol/room';
import type { PhaseView } from '../protocol/view';

/** What the phone shows, derived only from the public view sent by the TV. */
export type PhoneScreen =
  | { kind: 'setup' }
  /** The TV is showing something (new word, letters): nothing to do yet. */
  | { kind: 'watching' }
  | { kind: 'guessing'; superPartie: boolean }
  | { kind: 'drawing'; ball: number }
  | { kind: 'wordOver'; isLastWord: boolean }
  | { kind: 'tieBreakWon' }
  | { kind: 'bonusChoice' }
  | { kind: 'gameOver' };

/** Balls drawn after a word: the first, then the second. */
const BALLS_PER_DRAW = 2;

export function describeScreen(game: PhaseView): PhoneScreen {
  switch (game.phase) {
    case 'setup':
      return { kind: 'setup' };
    case 'gameOver':
      return { kind: 'gameOver' };
    case 'playing':
      switch (game.step) {
        case 'revealing':
          return { kind: 'watching' };
        case 'guessing':
          return { kind: 'guessing', superPartie: false };
        case 'drawing':
          return { kind: 'drawing', ball: BALLS_PER_DRAW - game.ballsLeft + 1 };
        case 'wordOver':
          return { kind: 'wordOver', isLastWord: game.isLastWord };
      }
      break;
    case 'tieBreak':
      if (game.step === 'won') return { kind: 'tieBreakWon' };
      return game.step === 'guessing'
        ? { kind: 'guessing', superPartie: false }
        : { kind: 'watching' };
    case 'superPartie':
      if (game.step === 'bonusChoice') return { kind: 'bonusChoice' };
      return game.step === 'guessing'
        ? { kind: 'guessing', superPartie: true }
        : { kind: 'watching' };
  }
}

/** What this phone may do right now. With one phone, it may do everything. */
export interface PhoneRole {
  /** Turn actions: propose a word, draw a ball, pass, bonus word. */
  canPlay: boolean;
  /** Game management: start, next word, abandon, new game, test mode. */
  canManage: boolean;
  /** Team whose turn it is, when this phone is not playing. */
  waitingFor: number | null;
  /** The master may play for the team whose turn it is: its phone is disconnected. */
  canStandIn: boolean;
}

const FULL_ROLE: PhoneRole = {
  canPlay: true,
  canManage: true,
  waitingFor: null,
  canStandIn: false,
};

function turnOf(game: PhaseView): number | null {
  return 'activeTeam' in game ? game.activeTeam : null;
}

/** `standingIn`: team the master chose to play for, if any. */
export function phoneRole(game: PhaseView, room: RoomView, standingIn: number | null): PhoneRole {
  if (room.mode !== 'multi') return FULL_ROLE;
  const canManage = room.isMaster;
  const turn = turnOf(game);
  if (turn === null) return { canPlay: false, canManage, waitingFor: null, canStandIn: false };
  const own = turn === room.team;
  const canStandIn = room.isMaster && !own && room.seats[turn]?.connected === false;
  const canPlay = own || (canStandIn && standingIn === turn);
  return { canPlay, canManage, waitingFor: canPlay ? null : turn, canStandIn };
}

/** One name per team, empty when not typed: the TV then uses the default name. */
export function teamNamesFor(
  typedNames: readonly (string | undefined)[],
  teamCount: number,
): string[] {
  return Array.from({ length: teamCount }, (_, index) => typedNames[index] ?? '');
}

/** Time left now, from the time left when the TV sent its state. Uses only the phone clock. */
export function remainingNow(
  timer: { remainingMs: number; running: boolean },
  receivedAt: number,
  now: number,
): number {
  if (!timer.running) return timer.remainingMs;
  return Math.max(0, timer.remainingMs - (now - receivedAt));
}
