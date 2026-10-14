import type { Ball, BingoCard } from './bingo';
import type { LetterMark } from './coloring';
import type { AttemptSeconds, WordCount, WordLength } from './config';
import type { Refusal } from './proposal';

export interface Team {
  name: string;
  score: number;
  card: BingoCard;
}

/** Chosen by the master at setup, fixed for the whole game. */
export interface Settings {
  wordLength: WordLength;
  attemptSeconds: AttemptSeconds;
  wordCount: WordCount;
}

/** One line of the grid. A refused word or a timeout loses the line. */
export type Line =
  | { kind: 'attempt'; word: string; marks: LetterMark[] }
  | { kind: 'refused'; word: string; refusal: Refusal }
  | { kind: 'timeUp' };

export interface WordRound {
  secret: string;
  /** Letters given at the start or as a bonus. */
  revealed: boolean[];
  lines: Line[];
}

/** Test mode only: the next secret word or ball, chosen on the phone. */
export interface Forced {
  secret: string | null;
  ball: Ball | null;
}

interface Common {
  settings: Settings;
  teams: Team[];
  /** Secret words of the whole game, so that none comes back. */
  usedWords: string[];
  forced: Forced;
}

/**
 * `revealing`: the TV animates (letters, bonus letter, banner); the attempt
 * timer starts when it is done.
 */
export type TurnStep = { kind: 'revealing' } | { kind: 'guessing'; startedAt: number };

export type PlayingStep =
  | TurnStep
  | { kind: 'drawing'; ballsLeft: number }
  /** The word is over: the master moves on. `nextTeam` starts the next word. */
  | { kind: 'wordOver'; nextTeam: number };

/** What every phase of a running game carries over to the next one. */
export type GameBase = Common;

export type PlayingState = Common & {
  phase: 'playing';
  /** 1 to settings.wordCount. */
  wordNumber: number;
  word: WordRound;
  activeTeam: number;
  /** The team that started this word: the next word goes to the team after it if nobody finds. */
  starter: number;
  /** After 6 failed lines: the next team has one single attempt. */
  lastChance: boolean;
  step: PlayingStep;
};

export type TieBreakStep = TurnStep | { kind: 'won'; winner: number };

export type TieBreakState = Common & {
  phase: 'tieBreak';
  /** Teams tied at the top, in playing order. */
  contenders: number[];
  activeTeam: number;
  word: WordRound;
  step: TieBreakStep;
};

export type SuperPartieStep =
  /** Before the global timer starts: the TV shows the first word. */
  | { kind: 'ready' }
  | { kind: 'guessing' }
  /** 10 words found with time left: play the bonus word or finish. */
  | { kind: 'bonusChoice' };

export type SuperPartieState = Common & {
  phase: 'superPartie';
  finalist: number;
  /** 1 to 10, then 11 for the bonus word. */
  wordIndex: number;
  word: WordRound;
  /** Words found among the first 10. */
  found: number;
  /** Null until the first word is shown. */
  startedAt: number | null;
  step: SuperPartieStep;
};

export type BonusResult = 'notPlayed' | 'found' | 'missed';

export interface SuperResult {
  finalist: number;
  found: number;
  bonus: BonusResult;
}

export interface GameOverState {
  phase: 'gameOver';
  teams: Team[];
  /** Null when the game was abandoned before the end of the Super partie. */
  result: SuperResult | null;
}

export type GameState =
  { phase: 'setup' } | PlayingState | TieBreakState | SuperPartieState | GameOverState;

export type GameAction =
  | {
      type: 'startGame';
      teamNames: string[];
      wordLength: WordLength;
      attemptSeconds: AttemptSeconds;
      wordCount: WordCount;
      /** Test mode: skip the first part, the first team plays the Super partie. */
      startAtSuperPartie?: boolean | undefined;
    }
  | { type: 'proposeWord'; word: string }
  | { type: 'drawBall' }
  | { type: 'nextWord' }
  | { type: 'skipWord' }
  | { type: 'playBonusWord' }
  | { type: 'finishSuperPartie' }
  | { type: 'abandonGame' }
  | { type: 'newGame' }
  | { type: 'forceSecret'; word: string }
  | { type: 'forceBall'; ball: Ball }
  /** TV only: the animation is over. */
  | { type: 'revealDone' }
  /** TV only: a timer ran out. The reducer checks it with the clock. */
  | { type: 'timeUp' };

export const INITIAL_STATE: GameState = { phase: 'setup' };
