import { describe, expect, it } from 'vitest';
import { pickSecret } from './secret-picker';
import { seededRandom } from './testing';

const SECRETS = ['BATEAU', 'CHEVAL', 'MAISON', 'TOMATE'];

describe('pickSecret', () => {
  it('never picks a word already used in the game', () => {
    const random = seededRandom(1);
    const used: string[] = [];
    for (let i = 0; i < SECRETS.length; i++) used.push(pickSecret(SECRETS, used, random));
    expect([...used].sort()).toEqual(SECRETS);
  });

  it('picks again from the whole list once every word was used', () => {
    expect(SECRETS).toContain(pickSecret(SECRETS, SECRETS, seededRandom(2)));
  });
});
