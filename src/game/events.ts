import type { LetterMark } from './coloring';
import type { Refusal } from './proposal';

/** What happened, for the TV to animate and play sounds. Secret words appear only once revealed. */
export type GameEvent =
  | { type: 'wordStarted'; wordNumber: number; isLastWord: boolean; team: number }
  | { type: 'tieBreakStarted'; teams: number[] }
  | { type: 'tieBreakWordStarted'; team: number }
  | { type: 'superPartieStarted'; team: number; durationMs: number }
  | { type: 'superWordStarted'; index: number; isBonus: boolean }
  | { type: 'attemptMade'; team: number; word: string; marks: LetterMark[] }
  | { type: 'proposalRefused'; team: number; word: string; refusal: Refusal }
  | { type: 'attemptTimedOut'; team: number }
  /** `bonusPosition` is null when every letter was already known. */
  | { type: 'handPassed'; team: number; bonusPosition: number | null; lastChance: boolean }
  | { type: 'wordFound'; team: number; word: string; points: number }
  /** Nobody found it: the word is revealed. */
  | { type: 'wordMissed'; word: string }
  | { type: 'ballDrawn'; team: number; value: number }
  | { type: 'blackBall'; team: number }
  | { type: 'motus'; team: number; points: number }
  | { type: 'gridsReset' }
  | { type: 'superWordFound'; word: string; found: number }
  | { type: 'superWordMissed'; word: string; skipped: boolean }
  | { type: 'bonusWordOffered' }
  | { type: 'superTimeUp' }
  | { type: 'gameOver' };
