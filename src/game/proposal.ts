import { isPlainWord } from './text';

/** Why a proposal is refused. The hand passes (first part) or the line is lost (Super partie). */
export type Refusal = 'wrongLength' | 'wrongFirstLetter' | 'alreadyProposed' | 'unknownWord';

export interface ProposalContext {
  secret: string;
  /** Words already proposed on this word. */
  proposed: readonly string[];
  isValidWord(word: string): boolean;
}

/** Null when the (already normalized) word may be written on the grid. */
export function checkProposal(word: string, context: ProposalContext): Refusal | null {
  if (word.length !== context.secret.length) return 'wrongLength';
  if (word.charAt(0) !== context.secret.charAt(0)) return 'wrongFirstLetter';
  if (context.proposed.includes(word)) return 'alreadyProposed';
  if (!isPlainWord(word) || !context.isValidWord(word)) return 'unknownWord';
  return null;
}
