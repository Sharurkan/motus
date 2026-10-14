import { describe, expect, it } from 'vitest';
import { messageFor } from './texts';

const teamName = (team: number): string => ['Les Bleus', 'Mamie'][team] ?? '';

describe('messageFor', () => {
  it('joins the messages of one action, as an error if one of them is', () => {
    const message = messageFor(
      [
        { type: 'proposalRefused', team: 0, word: 'MZZZZZ', refusal: 'unknownWord' },
        { type: 'handPassed', team: 1, bonusPosition: 2, lastChance: false },
      ],
      teamName,
    );
    expect(message).toEqual({ text: 'Mot inconnu · À jouer : Mamie', isError: true });
  });

  it('announces a found word and a MOTUS', () => {
    expect(messageFor([{ type: 'motus', team: 0, points: 100 }], teamName)).toEqual({
      text: 'MOTUS ! +100 points',
      isError: false,
    });
  });

  it('has nothing to say for silent events', () => {
    expect(messageFor([{ type: 'gridsReset' }], teamName)).toBeNull();
  });
});
