import type { GameEvent } from '../game/events';
import type { Refusal } from '../game/proposal';
import type { ConnectionStatus } from '../net/connection-status';

const REFUSALS: Readonly<Record<Refusal, string>> = {
  wrongLength: 'Mauvaise longueur',
  wrongFirstLetter: 'Mauvaise première lettre',
  alreadyProposed: 'Mot déjà proposé',
  unknownWord: 'Mot inconnu',
};

export const PHONE_TEXTS = {
  title: 'Motus',
  codeLabel: 'Code affiché sur la TV',
  codePlaceholder: 'ABCD',
  connect: 'Se connecter',
  invalidCode: 'Code invalide : 4 lettres, comme sur la TV.',
  room: (code: string) => `Salle ${code}`,
  changeCode: 'Changer de code',
  codeNotRemembered:
    'Ce téléphone ne peut pas garder le code : rescanne le QR code après un rechargement.',
  replaced: 'Un autre téléphone a pris la main.',
  takeOver: 'Reprendre la main',
  offline: 'Pas d’Internet sur ce téléphone',
  updatePage: 'Mets à jour la page (version différente de la TV)',
  setupTitle: 'Nouvelle partie',
  rankingTitle: 'Classement',
  wordOf: (number: number, count: number) => `Mot ${String(number)} sur ${String(count)}`,
  lastWord: 'Dernier mot !',
  tieBreak: 'Mot décisif',
  superPartie: (found: number) => `Super partie · ${String(found)} / 10`,
  bonusWord: 'Mot bonus',
  turnOf: (team: string) => `À jouer : ${team}`,
  yourTeam: (team: string) => `Ton équipe : ${team}`,
  notYourTurn: (team: string) => `Ce n’est pas ton tour : c’est à ${team}`,
  standIn: (team: string) => `Jouer à la place de ${team}`,
  teamPlaceholder: (index: number) => `Équipe ${String(index + 1)}`,
  score: (name: string, score: number) => `${name} ${String(score)}`,
  mode: {
    title: 'Comment jouez-vous ?',
    single: 'Un seul téléphone',
    singleHint: 'On le passe à l’équipe dont c’est le tour.',
    multi: 'Un téléphone par équipe',
    multiHint: 'Chaque équipe joue sur son téléphone.',
    change: 'Changer de mode',
    waitMaster: 'Le premier téléphone connecté choisit le mode de jeu.',
  },
  teams: 'Équipes',
  teamCount: (count: number) => `${String(count)} équipes`,
  teamName: (index: number) => `Nom de l’équipe ${String(index + 1)}`,
  ownTeamName: 'Nom de ton équipe',
  join: 'Rejoindre',
  rename: 'Changer le nom',
  remove: 'Retirer',
  joinedTeams: 'Équipes inscrites',
  noTeam: 'Aucune équipe pour l’instant.',
  waitStart: 'Le maître lance la partie.',
  needTeams: 'Il faut au moins 2 équipes, dont la tienne.',
  wordLength: 'Longueur des mots',
  letters: (count: number) => `${String(count)} lettres`,
  attemptTime: 'Temps par essai',
  seconds: (count: number) => `${String(count)} s`,
  noLimit: 'Sans limite',
  wordCount: 'Mots de la 1re partie',
  words: (count: number) => `${String(count)} mots`,
  start: 'Commencer',
  startSuper: 'Commencer en Super partie (test)',
  erase: 'Effacer',
  validate: 'Valider',
  skip: 'Passer',
  drawBall: (ball: number) => `Tirer une boule (${String(ball)}/2)`,
  nextWord: 'Mot suivant',
  toFinal: 'Voir la suite',
  toSuperPartie: 'Lancer la Super partie',
  playBonus: 'Jouer le mot bonus',
  finish: 'Terminer',
  watchTv: 'Regardez la TV…',
  waitMasterNext: 'Le maître passe au mot suivant.',
  newGame: 'Nouvelle partie',
  waitNewGame: 'Le maître peut lancer une nouvelle partie.',
  abandon: 'Abandonner la partie',
  confirmAbandon: 'Oui, abandonner',
  cancel: 'Annuler',
  test: {
    title: 'Mode test',
    secret: 'Mot secret forcé',
    forceSecret: 'Forcer le mot',
    ball: 'Prochaine boule (numéro)',
    forceBall: 'Forcer la boule',
    blackBall: 'Boule noire',
  },
} as const;

const ERROR_LABELS: Readonly<Record<string, string>> = {
  'peer-unavailable': 'TV introuvable, nouvel essai…',
  timeout: 'pas de réponse de la TV, nouvel essai…',
  network: 'serveur PeerJS injoignable',
  'server-error': 'serveur PeerJS injoignable',
  'browser-incompatible': 'navigateur incompatible avec WebRTC',
};

export function statusLabel(status: ConnectionStatus): string {
  switch (status.kind) {
    case 'waiting':
      return 'Connexion à la TV…';
    case 'connected':
      return 'Connecté à la TV';
    case 'disconnected':
      return 'Déconnecté, reconnexion…';
    case 'error':
      return `Erreur : ${ERROR_LABELS[status.reason] ?? status.reason}`;
  }
}

export interface BannerMessage {
  text: string;
  isError: boolean;
}

function eventText(event: GameEvent, teamName: (team: number) => string): BannerMessage | null {
  switch (event.type) {
    case 'proposalRefused':
      return { text: REFUSALS[event.refusal], isError: true };
    case 'attemptTimedOut':
      return { text: 'Temps écoulé !', isError: true };
    case 'handPassed':
      return { text: PHONE_TEXTS.turnOf(teamName(event.team)), isError: false };
    case 'wordFound':
      return { text: `Trouvé : ${event.word} !`, isError: false };
    case 'wordMissed':
      return { text: `Personne n’a trouvé : ${event.word}`, isError: true };
    case 'blackBall':
      return { text: 'Boule noire ! La main passe', isError: true };
    case 'motus':
      return { text: `MOTUS ! +${String(event.points)} points`, isError: false };
    case 'ballDrawn':
      return { text: `Boule ${String(event.value)}`, isError: false };
    case 'superWordFound':
      return { text: `Trouvé : ${event.word} !`, isError: false };
    case 'superWordMissed':
      return { text: `${event.skipped ? 'Passé' : 'Raté'} : ${event.word}`, isError: true };
    case 'superTimeUp':
      return { text: 'Temps écoulé !', isError: true };
    default:
      return null;
  }
}

/** Every message of the last action, in order: "Mot inconnu · À jouer : Mamie". */
export function messageFor(
  events: readonly GameEvent[],
  teamName: (team: number) => string,
): BannerMessage | null {
  const messages = events.map((event) => eventText(event, teamName)).filter((m) => m !== null);
  if (messages.length === 0) return null;
  return {
    text: messages.map((message) => message.text).join(' · '),
    isError: messages.some((message) => message.isError),
  };
}
