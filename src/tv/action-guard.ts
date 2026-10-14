import { canAct } from '../game/permissions';
import type { GameAction, GameState } from '../game/state';
import type { LinkId } from '../net/host';
import { actorFor, isMaster, isTeamConnected, type Room } from './room';

/**
 * Whether the phone behind this link may run the action. With one phone, it
 * plays for every team; with one phone per team, `game/permissions` decides.
 */
export function mayAct(room: Room, state: GameState, link: LinkId, action: GameAction): boolean {
  switch (room.mode) {
    case null:
      return false;
    case 'single':
      return (
        isMaster(room, link) && canAct(state, action, { team: 0, isMaster: true }, () => false)
      );
    case 'multi': {
      const actor = actorFor(room, link);
      const connected = (team: number): boolean => isTeamConnected(room, team);
      return actor !== null && canAct(state, action, actor, connected);
    }
  }
}

/** With one phone per team, the teams are the ones that joined, whatever the phone sent. */
export function withSeatNames(room: Room, action: GameAction): GameAction {
  if (action.type !== 'startGame' || room.mode !== 'multi') return action;
  return { ...action, teamNames: room.seats.map((seat) => seat.name) };
}
