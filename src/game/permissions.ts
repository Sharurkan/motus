import type { GameAction, GameState } from './state';

/**
 * Who may send an action with one phone per team. Null when no phone may,
 * either because only the TV sends it or because nobody can act at this moment.
 */
export type ActionOwner = { kind: 'master' } | { kind: 'team'; team: number };

export interface Actor {
  team: number;
  /** The first phone connected: it runs the game and plays for its own team. */
  isMaster: boolean;
}

/** Team whose turn it is, or null when no team is playing. */
export function turnTeam(state: GameState): number | null {
  switch (state.phase) {
    case 'playing':
    case 'tieBreak':
      return state.activeTeam;
    case 'superPartie':
      return state.finalist;
    case 'setup':
    case 'gameOver':
      return null;
  }
}

export function actionOwner(state: GameState, action: GameAction): ActionOwner | null {
  switch (action.type) {
    case 'startGame':
    case 'nextWord':
    case 'abandonGame':
    case 'newGame':
    case 'forceSecret':
    case 'forceBall':
      return { kind: 'master' };
    case 'revealDone':
    case 'timeUp':
    case 'resumeClock':
      return null;
    case 'proposeWord':
    case 'drawBall':
    case 'skipWord':
    case 'playBonusWord':
    case 'finishSuperPartie': {
      const team = turnTeam(state);
      return team === null ? null : { kind: 'team', team };
    }
  }
}

/** The master may play the turn of a team whose phone is disconnected, so that the game never gets stuck. */
export function canAct(
  state: GameState,
  action: GameAction,
  actor: Actor,
  isTeamConnected: (team: number) => boolean,
): boolean {
  const owner = actionOwner(state, action);
  if (owner === null) return false;
  if (owner.kind === 'master') return actor.isMaster;
  if (owner.team === actor.team) return true;
  return actor.isMaster && !isTeamConnected(owner.team);
}
