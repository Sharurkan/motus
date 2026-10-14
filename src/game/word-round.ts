import { colorGuess, isAllPlaced } from './coloring';
import type { WordSource } from './common';
import { knownPositions, pickBonusPosition, startingLetters } from './letters';
import { checkProposal } from './proposal';
import type { Random } from './random';
import { pickSecret } from './secret-picker';
import type { Forced, Line, WordRound } from './state';
import { normalizeText } from './text';

export interface PickedWord {
  round: WordRound;
  usedWords: string[];
  forced: Forced;
}

/** A new word: the forced one in test mode, else a random one never used in this game. */
export function startWordRound(
  base: { usedWords: string[]; forced: Forced },
  givenLetters: number,
  words: WordSource,
  random: Random,
): PickedWord {
  const secret = base.forced.secret ?? pickSecret(words.secrets, base.usedWords, random);
  return {
    round: { secret, revealed: startingLetters(secret.length, givenLetters, random), lines: [] },
    usedWords: [...base.usedWords, secret],
    forced: { ...base.forced, secret: null },
  };
}

function lineMarks(round: WordRound) {
  return round.lines.map((line) => (line.kind === 'attempt' ? line.marks : null));
}

export function knownLetters(round: WordRound): boolean[] {
  return knownPositions(round.revealed, lineMarks(round));
}

/** Words written on the grid (refused ones are not). */
export function proposedWords(round: WordRound): string[] {
  return round.lines.flatMap((line) => (line.kind === 'attempt' ? [line.word] : []));
}

/** The line a proposal takes: colored, or refused with its reason. */
export function judgeProposal(
  round: WordRound,
  input: string,
  words: WordSource,
): Exclude<Line, { kind: 'timeUp' }> {
  const word = normalizeText(input.trim());
  const refusal = checkProposal(word, {
    secret: round.secret,
    proposed: proposedWords(round),
    isValidWord: (candidate) => words.isValid(candidate),
  });
  if (refusal !== null) return { kind: 'refused', word, refusal };
  return { kind: 'attempt', word, marks: colorGuess(round.secret, word) };
}

export function isWinningLine(line: Line): boolean {
  return line.kind === 'attempt' && isAllPlaced(line.marks);
}

export function withLine(round: WordRound, line: Line): WordRound {
  return { ...round, lines: [...round.lines, line] };
}

/** Reveals one letter not known yet. The position is null when every letter is known. */
export function giveBonusLetter(
  round: WordRound,
  random: Random,
): { round: WordRound; position: number | null } {
  const position = pickBonusPosition(knownLetters(round), random);
  if (position === null) return { round, position };
  const revealed = round.revealed.map((isRevealed, i) => isRevealed || i === position);
  return { round: { ...round, revealed }, position };
}

/** Test mode: a forced word replaces the current one if nobody has played on it yet. */
export function replaceUnplayedSecret(round: WordRound, secret: string): WordRound {
  return round.lines.length === 0 ? { ...round, secret } : round;
}
