/** The word being typed: the first letter is given and cannot be erased. */
export interface WordDraft {
  length: number;
  letters: string[];
}

export function newDraft(length: number, firstLetter: string): WordDraft {
  return { length, letters: firstLetter === '' ? [] : [firstLetter] };
}

export function typeLetter(draft: WordDraft, letter: string): WordDraft {
  if (draft.letters.length >= draft.length) return draft;
  return { ...draft, letters: [...draft.letters, letter] };
}

export function eraseLetter(draft: WordDraft): WordDraft {
  if (draft.letters.length <= 1) return draft;
  return { ...draft, letters: draft.letters.slice(0, -1) };
}

/** "Valider" stays greyed until the word has the right length. */
export function isComplete(draft: WordDraft): boolean {
  return draft.letters.length === draft.length;
}

export function draftWord(draft: WordDraft): string {
  return draft.letters.join('');
}

/** French phone keyboards: the letters are where the players expect them. */
export const AZERTY_ROWS: readonly string[] = ['AZERTYUIOP', 'QSDFGHJKLM', 'WXCVBN'];
