import { GRID_LINES } from '../game/bingo';
import type { PhaseView } from '../protocol/view';
import { createElement } from '../shared/dom';
import { TV_TEXTS } from './texts';

type TeamView = Extract<PhaseView, { word: unknown }>['teams'][number];

export interface TeamPanelOptions {
  active: boolean;
  offline: boolean;
}

/** Name, score and bingo grid of one team. Team colors come from the index (team-0 to team-3). */
export function createTeamPanel(
  team: TeamView,
  index: number,
  options: TeamPanelOptions,
): HTMLElement {
  const cells = team.grid.numbers.map((value, cell) =>
    createElement('div', {
      className: team.grid.covered[cell] === true ? 'bingo-cell covered' : 'bingo-cell',
      text: String(value),
    }),
  );
  cells.forEach((element, cell) => {
    element.dataset['value'] = String(team.grid.numbers[cell] ?? '');
  });
  const classes = ['team-panel', `team-${String(index)}`];
  if (options.active) classes.push('active');
  if (options.offline) classes.push('offline');
  return createElement('section', { className: classes.join(' ') }, [
    createElement('div', { className: 'team-head' }, [
      createElement('span', { className: 'team-name', text: team.name }),
      createElement('span', { className: 'team-score', text: TV_TEXTS.points(team.score) }),
    ]),
    createElement('div', { className: 'bingo-grid' }, cells),
    createElement('div', {
      className: 'team-phone',
      text: options.offline ? TV_TEXTS.offlineTeam : '',
    }),
  ]);
}

/** Covers the cell of a drawn number, with a short animation. */
export function coverCell(panel: HTMLElement, value: number): void {
  const cell = [...panel.querySelectorAll<HTMLElement>('.bingo-cell')].find(
    (element) => element.dataset['value'] === String(value),
  );
  cell?.classList.add('covered', 'just-covered');
}

/** Makes every full line of the panel blink: the MOTUS. */
export function flashFullLines(panel: HTMLElement): void {
  const cells = [...panel.querySelectorAll<HTMLElement>('.bingo-cell')];
  for (const line of GRID_LINES) {
    if (line.every((cell) => cells[cell]?.classList.contains('covered') === true)) {
      for (const cell of line) cells[cell]?.classList.add('motus-line');
    }
  }
}
