import type { GameEvent } from '../game/events';
import type { Refusal } from '../game/proposal';
import type { ConnectionStatus } from '../net/connection-status';

export const REFUSAL_LABELS: Readonly<Record<Refusal, string>> = {
  wrongLength: 'Mauvaise longueur',
  wrongFirstLetter: 'Mauvaise première lettre',
  alreadyProposed: 'Mot déjà proposé',
  unknownWord: 'Mot inconnu',
};

export const TV_TEXTS = {
  title: 'Motus',
  scanToPlay: 'Scanne le QR code avec ton téléphone pour jouer.',
  orOpen: 'Ou ouvre cette adresse et tape le code :',
  soundButton: 'Appuie sur OK pour activer le son',
  soundOn: 'Son activé',
  soundHint: 'appuie sur OK pour le son',
  roomCode: (code: string) => `Code ${code}`,
  lobby: {
    choosing: 'Le premier téléphone connecté choisit le mode de jeu.',
    single: 'Un seul téléphone : on le passe à l’équipe dont c’est le tour.',
    multi: 'Un téléphone par équipe : chaque équipe tape son nom.',
    noTeam: 'Aucune équipe inscrite pour l’instant.',
    connected: 'connectée',
    disconnected: 'déconnectée',
  },
  wordOf: (number: number, count: number) => `Mot ${String(number)} sur ${String(count)}`,
  lastWord: 'Dernier mot ! (100 points)',
  tieBreak: 'Mot décisif',
  superPartie: 'Super partie',
  superWordOf: (index: number) => `Mot ${String(index)} sur 10`,
  bonusWord: 'Mot bonus',
  superCount: (found: number) => `${String(found)} / 10`,
  foundCount: (found: number) => `${String(found)} / 10 trouvés`,
  points: (score: number) => `${String(score)} pts`,
  timeUpCell: 'temps écoulé',
  offlineTeam: 'téléphone déconnecté',
  solution: 'Solution',
  bonusChoice: 'Mot bonus ? L’équipe choisit sur son téléphone.',
  ranking: 'Classement',
  superResult: (team: string, found: number) =>
    `Super partie : ${team} a trouvé ${String(found)} mot${found > 1 ? 's' : ''} sur 10.`,
  bonusResult: {
    notPlayed: '',
    found: 'Mot bonus trouvé !',
    missed: 'Mot bonus manqué.',
  },
  abandoned: 'Partie abandonnée.',
  newGameHint: 'Nouvelle partie : bouton sur le téléphone du maître.',
  gameResumed: 'Partie reprise',
  saveFailed: 'sauvegarde impossible',
  saveUnreadable: 'sauvegarde illisible : nouvelle partie',
  storageFailed: 'code non sauvegardé',
  offline: 'TV hors ligne',
  updateController: 'un téléphone doit recharger sa page',
  loadingWords: 'Chargement des mots…',
  loadingFailed: 'Impossible de charger les mots : recharge la page.',
} as const;

const ERROR_LABELS: Readonly<Record<string, string>> = {
  'unavailable-id': 'code déjà pris, nouvel essai',
  network: 'serveur PeerJS injoignable',
  'server-error': 'serveur PeerJS injoignable',
  'socket-error': 'connexion au serveur PeerJS perdue',
  'socket-closed': 'connexion au serveur PeerJS perdue',
  'browser-incompatible': 'navigateur incompatible avec WebRTC',
};

export function statusLabel(status: ConnectionStatus): string {
  switch (status.kind) {
    case 'waiting':
      return 'En attente des téléphones';
    case 'connected':
      return 'Téléphone connecté';
    case 'disconnected':
      return 'Téléphone déconnecté';
    case 'error':
      return `Erreur : ${ERROR_LABELS[status.reason] ?? status.reason}`;
  }
}

/** Banner text for an event, or null when the event needs none. */
export function eventMessage(event: GameEvent, teamName: (team: number) => string): string | null {
  switch (event.type) {
    case 'wordStarted':
      return event.isLastWord ? TV_TEXTS.lastWord : `${teamName(event.team)}, à vous de jouer !`;
    case 'tieBreakStarted':
      return `Égalité ! ${TV_TEXTS.tieBreak}`;
    case 'superPartieStarted':
      return `${TV_TEXTS.superPartie} pour ${teamName(event.team)} !`;
    case 'proposalRefused':
      return REFUSAL_LABELS[event.refusal];
    case 'attemptTimedOut':
      return 'Temps écoulé !';
    case 'handPassed':
      return handPassedMessage(event, teamName);
    case 'wordFound':
      return event.points > 0
        ? `${teamName(event.team)} trouve le mot : +${String(event.points)} points`
        : `${teamName(event.team)} trouve le mot !`;
    case 'wordMissed':
      return `Personne n’a trouvé : ${event.word}`;
    case 'blackBall':
      return 'Boule noire ! La main passe';
    case 'motus':
      return `MOTUS ! +${String(event.points)} points`;
    case 'superWordMissed':
      return event.skipped ? `Mot passé : ${event.word}` : `Raté : ${event.word}`;
    case 'bonusWordOffered':
      return '10 mots trouvés ! Mot bonus ?';
    case 'superTimeUp':
      return 'Temps écoulé !';
    case 'tieBreakWordStarted':
    case 'superWordStarted':
    case 'attemptMade':
    case 'ballDrawn':
    case 'gridsReset':
    case 'superWordFound':
    case 'gameOver':
      return null;
  }
}

function handPassedMessage(
  event: Extract<GameEvent, { type: 'handPassed' }>,
  teamName: (team: number) => string,
): string {
  const name = teamName(event.team);
  if (event.lastChance) return `Dernière chance pour ${name}, avec une lettre bonus`;
  if (event.bonusPosition !== null) return `La main passe à ${name}, avec une lettre bonus`;
  return `${name}, à vous de jouer !`;
}
