import { describe, expect, it } from 'vitest';
import { applyBall, GRID_LINES } from './bingo';
import { LAST_WORD_POINTS, MOTUS_POINTS, PRE_COVERED_CELLS, WORD_POINTS } from './config';
import { reduce } from './reducer';
import type { PlayingState } from './state';
import {
  createTestGame,
  eventTypes,
  inPhase,
  last,
  TEST_SECRETS,
  TEST_WORDS,
  type TestGame,
} from './test-game';
import { seededRandom } from './testing';

const WRONG_M_WORDS = ['MARRON', 'MOUTON', 'MOUCHE', 'MANCHE', 'MARCHE', 'MELONS', 'MIROIR'];

/** A started game whose current word is MAISON, ready for the first attempt. */
function gameOnMaison(options: Parameters<typeof createTestGame>[0] = {}): TestGame {
  const game = createTestGame(options);
  game.act({ type: 'forceSecret', word: 'maison' });
  game.act({ type: 'revealDone' });
  return game;
}

function playing(game: TestGame): PlayingState {
  return inPhase(game.state, 'playing');
}

/** Plays a wrong valid word, then lets the TV finish its animation. */
function missLine(game: TestGame, word: string): void {
  game.act({ type: 'proposeWord', word });
  game.act({ type: 'revealDone' });
}

describe('startGame', () => {
  it('starts the first word with the first team and default names', () => {
    const game = createTestGame({ teams: 3 });
    const state = playing(game);
    expect(state.teams.map((team) => team.name)).toEqual(['Équipe 1', 'Équipe 2', 'Équipe 3']);
    expect(state.teams.every((team) => team.score === 0)).toBe(true);
    expect(state.wordNumber).toBe(1);
    expect(state.activeTeam).toBe(0);
    expect(state.step.kind).toBe('revealing');
    expect(TEST_SECRETS).toContain(state.word.secret);
    expect(state.word.revealed[0]).toBe(true);
    expect(state.word.revealed.filter(Boolean)).toHaveLength(2);
  });

  it('gives each team its own grid: odd numbers for team 1, even for team 2', () => {
    const state = playing(createTestGame());
    expect(state.teams[0]?.card.grid.numbers.every((n) => n % 2 === 1)).toBe(true);
    expect(state.teams[1]?.card.grid.numbers.every((n) => n % 2 === 0)).toBe(true);
  });

  it('keeps typed team names, trimmed', () => {
    const result = reduce(
      { phase: 'setup' },
      {
        type: 'startGame',
        teamNames: ['  Les Bleus ', 'Mamie'],
        wordLength: 6,
        attemptSeconds: 30,
        wordCount: 10,
      },
      { random: seededRandom(1), now: () => 0, words: TEST_WORDS },
    );
    expect(inPhase(result.state, 'playing').teams.map((team) => team.name)).toEqual([
      'Les Bleus',
      'Mamie',
    ]);
  });

  it.each([1, 5])('refuses %i teams', (teams) => {
    const result = reduce(
      { phase: 'setup' },
      {
        type: 'startGame',
        teamNames: Array.from({ length: teams }, () => ''),
        wordLength: 6,
        attemptSeconds: 30,
        wordCount: 10,
      },
      { random: seededRandom(1), now: () => 0, words: TEST_WORDS },
    );
    expect(result.state.phase).toBe('setup');
  });

  it('refuses a length whose word lists are not loaded', () => {
    const result = reduce(
      { phase: 'setup' },
      { type: 'startGame', teamNames: ['', ''], wordLength: 8, attemptSeconds: 30, wordCount: 10 },
      { random: seededRandom(1), now: () => 0, words: TEST_WORDS },
    );
    expect(result.state.phase).toBe('setup');
  });
});

describe('an attempt', () => {
  it('waits for the TV animation before accepting a word', () => {
    const game = createTestGame();
    game.act({ type: 'forceSecret', word: 'MAISON' });
    expect(game.act({ type: 'proposeWord', word: 'MOUTON' })).toEqual([]);
  });

  it('colors a valid word and lets the same team play the next line', () => {
    const game = gameOnMaison();
    const events = game.act({ type: 'proposeWord', word: 'mouton' });
    expect(events).toEqual([
      {
        type: 'attemptMade',
        team: 0,
        word: 'MOUTON',
        // The only O of MAISON is red at position 4: the O at position 1 is absent.
        marks: ['placed', 'absent', 'absent', 'absent', 'placed', 'placed'],
      },
    ]);
    expect(playing(game).activeTeam).toBe(0);
    expect(playing(game).step.kind).toBe('revealing');
    expect(playing(game).word.lines).toHaveLength(1);
  });

  it('scores 50 points when the word is found, then the team draws 2 balls', () => {
    const game = gameOnMaison();
    const events = game.act({ type: 'proposeWord', word: 'MAISON' });
    expect(eventTypes(events)).toEqual(['attemptMade', 'wordFound']);
    expect(events[1]).toEqual({ type: 'wordFound', team: 0, word: 'MAISON', points: WORD_POINTS });
    expect(playing(game).teams[0]?.score).toBe(WORD_POINTS);
    expect(playing(game).step).toEqual({ kind: 'drawing', ballsLeft: 2 });
  });
});

describe('the hand passes', () => {
  it.each([
    ['an unknown word', 'MZZZZZ', 'unknownWord'],
    ['a word of the wrong length', 'MAISONS', 'wrongLength'],
    ['a wrong first letter', 'BATEAU', 'wrongFirstLetter'],
  ])('after %s, with a bonus letter for the next team', (_, word, refusal) => {
    const game = gameOnMaison();
    const before = playing(game).word.revealed.filter(Boolean).length;
    const events = game.act({ type: 'proposeWord', word });
    expect(events[0]).toMatchObject({ type: 'proposalRefused', team: 0, refusal });
    expect(events[1]).toMatchObject({ type: 'handPassed', team: 1, lastChance: false });
    const state = playing(game);
    expect(state.activeTeam).toBe(1);
    expect(state.word.revealed.filter(Boolean)).toHaveLength(before + 1);
    expect(state.word.lines).toHaveLength(1);
  });

  it('after a word already proposed', () => {
    const game = gameOnMaison();
    missLine(game, 'MOUTON');
    const events = game.act({ type: 'proposeWord', word: 'MOUTON' });
    expect(events[0]).toMatchObject({ type: 'proposalRefused', refusal: 'alreadyProposed' });
    expect(playing(game).activeTeam).toBe(1);
  });

  it('the next team plays the remaining lines', () => {
    const game = gameOnMaison();
    game.act({ type: 'proposeWord', word: 'MZZZZZ' });
    game.act({ type: 'revealDone' });
    missLine(game, 'MOUTON');
    expect(playing(game).activeTeam).toBe(1);
    expect(playing(game).word.lines).toHaveLength(2);
  });

  it('the bonus letter is a letter not known yet', () => {
    const game = gameOnMaison();
    const known = playing(game).word.revealed;
    const events = game.act({ type: 'proposeWord', word: 'MZZZZZ' });
    const passed = events.find((event) => event.type === 'handPassed');
    if (passed?.type !== 'handPassed' || passed.bonusPosition === null) throw new Error('no bonus');
    expect(known[passed.bonusPosition]).toBe(false);
  });

  it('goes back to the first team after the last one', () => {
    const game = gameOnMaison({ teams: 3 });
    game.act({ type: 'proposeWord', word: 'MZZZZZ' });
    game.act({ type: 'revealDone' });
    game.act({ type: 'proposeWord', word: 'MZZZZZ' });
    game.act({ type: 'revealDone' });
    expect(playing(game).activeTeam).toBe(2);
    game.act({ type: 'proposeWord', word: 'MZZZZZ' });
    expect(playing(game).activeTeam).toBe(0);
  });
});

describe('the attempt timer', () => {
  it('passes the hand once the time is really over', () => {
    const game = gameOnMaison({ attemptSeconds: 30 });
    game.wait(29_999);
    expect(game.act({ type: 'timeUp' })).toEqual([]);
    game.wait(1);
    const events = game.act({ type: 'timeUp' });
    expect(eventTypes(events)).toEqual(['attemptTimedOut', 'handPassed']);
    expect(playing(game).activeTeam).toBe(1);
    expect(playing(game).word.lines).toEqual([{ kind: 'timeUp' }]);
  });

  it('starts only when the TV animation is over', () => {
    const game = createTestGame({ attemptSeconds: 30 });
    game.wait(60_000);
    game.act({ type: 'revealDone' });
    expect(game.act({ type: 'timeUp' })).toEqual([]);
  });

  it('never runs out without a time limit', () => {
    const game = gameOnMaison({ attemptSeconds: null });
    game.wait(3_600_000);
    expect(game.act({ type: 'timeUp' })).toEqual([]);
  });
});

describe('after 6 failed lines', () => {
  function sixLines(game: TestGame): void {
    for (const word of WRONG_M_WORDS.slice(0, 5)) missLine(game, word);
  }

  it('the next team gets a bonus letter and one single attempt', () => {
    const game = gameOnMaison();
    sixLines(game);
    const events = game.act({ type: 'proposeWord', word: 'MELONS' });
    expect(events[1]).toMatchObject({ type: 'handPassed', team: 1, lastChance: true });
    expect(playing(game).lastChance).toBe(true);
  });

  it('a failed last chance reveals the word; the team after the starter plays next', () => {
    const game = gameOnMaison({ teams: 3 });
    // Team 1 gets the hand at line 2, uses the lines up to 6, team 2 gets the last chance.
    game.act({ type: 'proposeWord', word: 'MZZZZZ' });
    game.act({ type: 'revealDone' });
    for (const word of WRONG_M_WORDS.slice(0, 5)) missLine(game, word);
    expect(playing(game)).toMatchObject({ activeTeam: 2, lastChance: true });
    const events = game.act({ type: 'proposeWord', word: 'MIROIR' });
    expect(last(events)).toEqual({ type: 'wordMissed', word: 'MAISON' });
    expect(playing(game).step).toEqual({ kind: 'wordOver', nextTeam: 1 });
    expect(playing(game).teams.every((team) => team.score === 0)).toBe(true);
  });

  it.each([
    ['a refused word', (game: TestGame) => game.act({ type: 'proposeWord', word: 'MZZZZZ' })],
    [
      'a timeout',
      (game: TestGame) => {
        game.wait(30_000);
        return game.act({ type: 'timeUp' });
      },
    ],
  ])('the last chance also fails on %s', (_, fail) => {
    const game = gameOnMaison();
    sixLines(game);
    missLine(game, 'MELONS');
    expect(last(eventTypes(fail(game)))).toBe('wordMissed');
  });

  it('a found last chance scores and draws balls', () => {
    const game = gameOnMaison();
    sixLines(game);
    missLine(game, 'MELONS');
    game.act({ type: 'proposeWord', word: 'MAISON' });
    expect(playing(game).teams[1]?.score).toBe(WORD_POINTS);
    expect(playing(game).step.kind).toBe('drawing');
  });
});

describe('drawing balls', () => {
  function drawingGame(): TestGame {
    const game = gameOnMaison();
    game.act({ type: 'proposeWord', word: 'MAISON' });
    return game;
  }

  function urnNumber(game: TestGame, team: number, index: number): number {
    return playing(game).teams[team]?.card.urn.numbers[index] ?? 0;
  }

  it('covers numbered balls and keeps the hand after 2 balls', () => {
    const game = drawingGame();
    const first = urnNumber(game, 0, 0);
    game.act({ type: 'forceBall', ball: { kind: 'number', value: first } });
    expect(game.act({ type: 'drawBall' })).toEqual([{ type: 'ballDrawn', team: 0, value: first }]);
    expect(playing(game).step).toEqual({ kind: 'drawing', ballsLeft: 1 });
    const card = playing(game).teams[0]?.card;
    expect(card?.urn.numbers).not.toContain(first);
    expect(card?.grid.covered[card.grid.numbers.indexOf(first)]).toBe(true);
    game.act({ type: 'forceBall', ball: { kind: 'number', value: urnNumber(game, 0, 0) } });
    game.act({ type: 'drawBall' });
    expect(playing(game).step).toEqual({ kind: 'wordOver', nextTeam: 0 });
  });

  it('a black ball stops the draw and the next team plays the next word', () => {
    const game = drawingGame();
    game.act({ type: 'forceBall', ball: { kind: 'black' } });
    expect(game.act({ type: 'drawBall' })).toEqual([{ type: 'blackBall', team: 0 }]);
    expect(playing(game).step).toEqual({ kind: 'wordOver', nextTeam: 1 });
    expect(playing(game).teams[0]?.card.urn.blackBalls).toBe(3);
  });

  it('ignores a forced ball that is not in the urn', () => {
    const game = drawingGame();
    game.act({ type: 'forceBall', ball: { kind: 'number', value: 2 } });
    const [event] = game.act({ type: 'drawBall' });
    expect(event).not.toEqual({ type: 'ballDrawn', team: 0, value: 2 });
  });

  it('refuses to draw outside the drawing step', () => {
    const game = gameOnMaison();
    expect(game.act({ type: 'drawBall' })).toEqual([]);
  });

  it('a MOTUS scores 100, stops the draw and gives every team a new grid', () => {
    const game = drawingGame();
    // Cover 4 cells of a line that has no pre-covered cell left to cover, keep the 5th in the urn.
    const state = playing(game);
    const team = state.teams[0];
    if (team === undefined) throw new Error('no team');
    const line = GRID_LINES.find((cells) =>
      cells.some((cell) => team.card.grid.covered[cell] !== true),
    );
    if (line === undefined) throw new Error('no line');
    const open = line.filter((cell) => team.card.grid.covered[cell] !== true);
    const lastNumber = team.card.grid.numbers[last(open) ?? 0] ?? 0;
    let card = team.card;
    for (const cell of open.slice(0, -1)) {
      card = applyBall(card, { kind: 'number', value: team.card.grid.numbers[cell] ?? 0 });
    }
    const teams = state.teams.map((entry, i) => (i === 0 ? { ...entry, card } : entry));
    game.set({ ...state, teams });
    game.act({ type: 'forceBall', ball: { kind: 'number', value: lastNumber } });
    const events = game.act({ type: 'drawBall' });
    expect(eventTypes(events)).toEqual(['ballDrawn', 'motus', 'gridsReset']);
    const after = playing(game);
    expect(after.teams[0]?.score).toBe(WORD_POINTS + MOTUS_POINTS);
    expect(after.step).toEqual({ kind: 'wordOver', nextTeam: 0 });
    for (const entry of after.teams) {
      expect(entry.card.grid.covered.filter(Boolean)).toHaveLength(PRE_COVERED_CELLS);
      expect(entry.card.urn.numbers).toHaveLength(17);
    }
  });
});

describe('words of the first part', () => {
  /** Finds the current word and ends the draw with a black ball. */
  function findAndPass(game: TestGame): void {
    const state = playing(game);
    game.act({ type: 'revealDone' });
    game.act({ type: 'proposeWord', word: state.word.secret });
    game.act({ type: 'forceBall', ball: { kind: 'black' } });
    game.act({ type: 'drawBall' });
  }

  it('the master moves to the next word, started by the team chosen at the end of the last one', () => {
    const game = createTestGame();
    findAndPass(game);
    const events = game.act({ type: 'nextWord' });
    expect(events).toEqual([{ type: 'wordStarted', wordNumber: 2, isLastWord: false, team: 1 }]);
    expect(playing(game)).toMatchObject({ wordNumber: 2, activeTeam: 1, starter: 1 });
  });

  it('refuses the next word while the word is being played', () => {
    const game = gameOnMaison();
    expect(game.act({ type: 'nextWord' })).toEqual([]);
  });

  it('announces the last word and makes it worth 100 points', () => {
    const game = createTestGame({ wordCount: 6 });
    for (let i = 0; i < 5; i++) {
      findAndPass(game);
      const events = game.act({ type: 'nextWord' });
      expect(events[0]).toMatchObject({ isLastWord: i === 4 });
    }
    const state = playing(game);
    game.act({ type: 'revealDone' });
    const events = game.act({ type: 'proposeWord', word: state.word.secret });
    expect(last(events)).toMatchObject({ type: 'wordFound', points: LAST_WORD_POINTS });
  });

  it('the best team goes to the Super partie after the last word', () => {
    const game = createTestGame({ wordCount: 6 });
    for (let i = 0; i < 6; i++) {
      findAndPass(game);
      if (i < 5) game.act({ type: 'nextWord' });
    }
    // Teams alternate: team 1 found 3 words of 50 + the last one of 100.
    const events = game.act({ type: 'nextWord' });
    expect(events[0]).toMatchObject({ type: 'superPartieStarted', team: 1 });
    expect(inPhase(game.state, 'superPartie').finalist).toBe(1);
  });

  it('never repeats a secret word in the whole game', () => {
    const game = createTestGame({ wordCount: 14 });
    for (let i = 0; i < 14; i++) {
      findAndPass(game);
      game.act({ type: 'nextWord' });
    }
    const superPartie = inPhase(game.state, 'superPartie');
    game.act({ type: 'revealDone' });
    for (let i = 0; i < 9; i++) {
      game.act({ type: 'skipWord' });
    }
    const words = inPhase(game.state, 'superPartie').usedWords;
    expect(words).toHaveLength(24);
    expect(new Set(words).size).toBe(24);
    expect(superPartie.usedWords).toHaveLength(15);
  });
});

describe('abandon and new game', () => {
  it('abandoning shows the ranking with the current scores', () => {
    const game = gameOnMaison();
    game.act({ type: 'proposeWord', word: 'MAISON' });
    expect(game.act({ type: 'abandonGame' })).toEqual([{ type: 'gameOver' }]);
    const over = inPhase(game.state, 'gameOver');
    expect(over.result).toBeNull();
    expect(over.teams[0]?.score).toBe(WORD_POINTS);
  });

  it('a new game goes back to the setup, only from the end screen', () => {
    const game = gameOnMaison();
    expect(game.act({ type: 'newGame' })).toEqual([]);
    game.act({ type: 'abandonGame' });
    game.act({ type: 'newGame' });
    expect(game.state).toEqual({ phase: 'setup' });
  });
});

describe('test mode', () => {
  it('a forced word replaces the current word if nobody played on it', () => {
    const game = createTestGame();
    game.act({ type: 'forceSecret', word: 'Cheval' });
    expect(playing(game).word.secret).toBe('CHEVAL');
    expect(playing(game).usedWords).toContain('CHEVAL');
  });

  it('a forced word is kept for the next word once a line is played', () => {
    const game = gameOnMaison();
    missLine(game, 'MOUTON');
    game.act({ type: 'forceSecret', word: 'CHEVAL' });
    expect(playing(game).word.secret).toBe('MAISON');
    expect(playing(game).forced.secret).toBe('CHEVAL');
  });

  it.each(['CHEVA', 'ZZZZZZ', 'CHE-AL'])('ignores the invalid forced word %s', (word) => {
    const game = createTestGame();
    const secret = playing(game).word.secret;
    game.act({ type: 'forceSecret', word });
    expect(playing(game).word.secret).toBe(secret);
  });

  it('can start directly at the Super partie', () => {
    const game = createTestGame({ startAtSuperPartie: true });
    expect(inPhase(game.state, 'superPartie').finalist).toBe(0);
  });
});

describe('resumeClock', () => {
  it('shifts the attempt timer by the time the TV was gone', () => {
    const game = gameOnMaison({ attemptSeconds: 30 });
    game.wait(20_000);
    // The TV is reloading for one minute: that minute must not count.
    game.wait(60_000);
    game.act({ type: 'resumeClock', pausedMs: 60_000 });
    game.wait(9_000);
    expect(game.act({ type: 'timeUp' })).toEqual([]);
    game.wait(1_000);
    expect(eventTypes(game.act({ type: 'timeUp' }))).toContain('attemptTimedOut');
  });

  it('shifts the Super partie timer', () => {
    const game = createTestGame({ startAtSuperPartie: true });
    game.act({ type: 'revealDone' });
    const before = inPhase(game.state, 'superPartie').startedAt ?? 0;
    game.act({ type: 'resumeClock', pausedMs: 5_000 });
    expect(inPhase(game.state, 'superPartie').startedAt).toBe(before + 5_000);
  });

  it('changes nothing when no timer is running', () => {
    const game = createTestGame();
    const before = game.state;
    game.act({ type: 'resumeClock', pausedMs: 5_000 });
    expect(game.state).toBe(before);
  });

  it.each([0, -10, Number.NaN])('ignores a pause of %d ms', (pausedMs) => {
    const game = gameOnMaison();
    const before = game.state;
    game.act({ type: 'resumeClock', pausedMs });
    expect(game.state).toBe(before);
  });
});
