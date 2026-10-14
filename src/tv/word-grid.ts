import type { LetterMark } from '../game/coloring';
import { MAX_ATTEMPTS } from '../game/config';
import { lettersOf } from '../game/text';
import type { PhaseView } from '../protocol/view';
import { createElement } from '../shared/dom';
import { TV_TEXTS } from './texts';

type WordView = Extract<PhaseView, { word: unknown }>['word'];
type LineView = WordView['lines'][number];

export interface WordGridOptions {
  /** Line written but not colored yet: its letters are revealed one by one afterwards. */
  hiddenLine: number | null;
  /** The single bonus attempt adds a 7th line. */
  lastChance: boolean;
}

export interface WordGrid {
  element: HTMLElement;
  render(word: WordView, options: WordGridOptions): void;
  /** Colors a written line letter by letter, calling `onLetter` for each one (sound). */
  revealLine(
    line: number,
    marks: readonly LetterMark[],
    letterMs: number,
    onLetter: (mark: LetterMark) => void,
  ): Promise<void>;
  /** Shows the known letters of the next line one by one (start of a word). */
  revealHints(letterMs: number, onLetter: () => void): Promise<void>;
  /** Makes a hint cell of the next line blink (bonus letter). */
  highlightHint(position: number): void;
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function cell(letter: string, className: string): HTMLElement {
  return createElement('div', { className: `cell ${className}` }, [
    createElement('span', { className: 'letter', text: letter }),
  ]);
}

function row(cells: HTMLElement[], className = ''): HTMLElement {
  return createElement('div', { className: `word-row ${className}` }, cells);
}

function emptyRow(length: number): HTMLElement {
  return row(Array.from({ length }, () => cell('', 'empty')));
}

function lineRow(line: LineView, length: number, hidden: boolean): HTMLElement {
  switch (line.kind) {
    case 'attempt':
      return row(
        lettersOf(line.word).map((letter, i) => cell(letter, hidden ? '' : (line.marks[i] ?? ''))),
      );
    case 'refused':
      return row(
        Array.from({ length }, (_, i) => cell(line.word.charAt(i), 'refused')),
        'refused-row',
      );
    case 'timeUp':
      return row(
        Array.from({ length }, (_, i) => cell(i === 0 ? '⏱' : '', 'refused')),
        'refused-row',
      );
  }
}

function hintRow(word: WordView): HTMLElement {
  return row(
    word.hints.map((hint) => cell(hint ?? '.', hint === null ? 'unknown' : 'hint')),
    'hint-row',
  );
}

function isFound(word: WordView): boolean {
  const last = word.lines[word.lines.length - 1];
  return last?.kind === 'attempt' && last.marks.every((mark) => mark === 'placed');
}

export function createWordGrid(): WordGrid {
  const element = createElement('div', { className: 'word-grid' });
  let rows: HTMLElement[] = [];
  let hint: HTMLElement | null = null;

  function render(word: WordView, options: WordGridOptions): void {
    const length = word.length;
    const total = Math.max(MAX_ATTEMPTS + (options.lastChance ? 1 : 0), word.lines.length);
    hint = null;
    rows = Array.from({ length: total }, (_, index) => {
      const line = word.lines[index];
      if (line !== undefined) return lineRow(line, length, index === options.hiddenLine);
      if (index === word.lines.length && word.secret === null) {
        hint = hintRow(word);
        return hint;
      }
      return emptyRow(length);
    });
    const solution =
      word.secret !== null && !isFound(word)
        ? [
            createElement('div', { className: 'solution-label', text: TV_TEXTS.solution }),
            row(
              lettersOf(word.secret).map((letter) => cell(letter, 'placed')),
              'solution-row',
            ),
          ]
        : [];
    element.style.setProperty('--letters', String(length));
    element.replaceChildren(...rows, ...solution);
  }

  async function revealLine(
    line: number,
    marks: readonly LetterMark[],
    letterMs: number,
    onLetter: (mark: LetterMark) => void,
  ): Promise<void> {
    const cells = rows[line]?.querySelectorAll('.cell') ?? [];
    for (const [i, mark] of marks.entries()) {
      await wait(letterMs);
      cells[i]?.classList.add(mark);
      onLetter(mark);
    }
  }

  async function revealHints(letterMs: number, onLetter: () => void): Promise<void> {
    const cells = [...(hint?.querySelectorAll('.cell.hint') ?? [])];
    for (const cell of cells) cell.classList.add('pending');
    for (const cell of cells) {
      await wait(letterMs);
      cell.classList.remove('pending');
      onLetter();
    }
  }

  function highlightHint(position: number): void {
    hint?.querySelectorAll('.cell')[position]?.classList.add('bonus');
  }

  return { element, render, revealLine, revealHints, highlightHint };
}
