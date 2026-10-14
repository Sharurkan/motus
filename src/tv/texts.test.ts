import { describe, expect, it } from 'vitest';
import type { GameEvent } from '../game/events';
import { eventMessage, statusLabel } from './texts';

const names = ['Les Bleus', 'Mamie'];
const teamName = (team: number): string => names[team] ?? '';

describe('eventMessage', () => {
  it.each<[GameEvent, string | null]>([
    [
      { type: 'wordStarted', wordNumber: 3, isLastWord: false, team: 1 },
      'Mamie, à vous de jouer !',
    ],
    [
      { type: 'wordStarted', wordNumber: 10, isLastWord: true, team: 0 },
      'Dernier mot ! (100 points)',
    ],
    [{ type: 'proposalRefused', team: 0, word: 'MZZZZZ', refusal: 'unknownWord' }, 'Mot inconnu'],
    [
      { type: 'proposalRefused', team: 0, word: 'MOUTON', refusal: 'alreadyProposed' },
      'Mot déjà proposé',
    ],
    [{ type: 'attemptTimedOut', team: 0 }, 'Temps écoulé !'],
    [
      { type: 'handPassed', team: 1, bonusPosition: 3, lastChance: false },
      'La main passe à Mamie, avec une lettre bonus',
    ],
    [
      { type: 'handPassed', team: 1, bonusPosition: 3, lastChance: true },
      'Dernière chance pour Mamie, avec une lettre bonus',
    ],
    [
      { type: 'handPassed', team: 0, bonusPosition: null, lastChance: false },
      'Les Bleus, à vous de jouer !',
    ],
    [
      { type: 'wordFound', team: 0, word: 'MAISON', points: 50 },
      'Les Bleus trouve le mot : +50 points',
    ],
    [{ type: 'wordFound', team: 1, word: 'MAISON', points: 0 }, 'Mamie trouve le mot !'],
    [{ type: 'wordMissed', word: 'MAISON' }, 'Personne n’a trouvé : MAISON'],
    [{ type: 'blackBall', team: 0 }, 'Boule noire ! La main passe'],
    [{ type: 'motus', team: 0, points: 100 }, 'MOTUS ! +100 points'],
    [{ type: 'superWordMissed', word: 'CHEVAL', skipped: true }, 'Mot passé : CHEVAL'],
    [{ type: 'ballDrawn', team: 0, value: 12 }, null],
  ])('%j → %s', (event, message) => {
    expect(eventMessage(event, teamName)).toBe(message);
  });
});

describe('statusLabel', () => {
  it('explains a known PeerJS error in French', () => {
    expect(statusLabel({ kind: 'error', reason: 'network' })).toBe(
      'Erreur : serveur PeerJS injoignable',
    );
  });
});
