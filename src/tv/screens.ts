import type { PlayMode, RoomView } from '../protocol/room';
import type { PhaseView } from '../protocol/view';
import { createElement } from '../shared/dom';
import { createQrCode } from './qr';
import { createTeamPanel } from './team-panel';
import { TV_TEXTS } from './texts';
import { createWordGrid, type WordGrid } from './word-grid';

export type InGameView = Extract<PhaseView, { word: unknown }>;
type GameOverView = Extract<PhaseView, { phase: 'gameOver' }>;

export interface SetupScreen {
  element: HTMLElement;
  soundButton: HTMLButtonElement;
  showRoom(code: string, controllerUrl: string): void;
  showConnection(label: string, kind: string): void;
  showLobby(mode: PlayMode | null, seats: RoomView['seats']): void;
}

/** Name shown for a team joined without a name, as the game will name it. */
function seatName(name: string, index: number): string {
  return name === '' ? `Équipe ${String(index + 1)}` : name;
}

function lobbyHint(mode: PlayMode | null): string {
  if (mode === null) return TV_TEXTS.lobby.choosing;
  return mode === 'single' ? TV_TEXTS.lobby.single : TV_TEXTS.lobby.multi;
}

function seatRow(seat: RoomView['seats'][number], index: number): HTMLElement {
  const state = seat.connected ? TV_TEXTS.lobby.connected : TV_TEXTS.lobby.disconnected;
  return createElement(
    'li',
    { className: `seat team-${String(index)}${seat.connected ? '' : ' offline'}` },
    [
      createElement('span', { className: 'seat-name', text: seatName(seat.name, index) }),
      createElement('span', { className: 'seat-state', text: state }),
    ],
  );
}

export function createSetupScreen(): SetupScreen {
  const code = createElement('div', { className: 'setup-code' });
  const qrSlot = createElement('div', { className: 'setup-qr' });
  const url = createElement('div', { className: 'setup-url' });
  const connection = createElement('div', { className: 'connection' });
  const lobbyHintElement = createElement('p', { className: 'muted', text: lobbyHint(null) });
  const seatList = createElement('ul', { className: 'seats' });
  const soundButton = createElement('button', {
    className: 'sound-button',
    text: TV_TEXTS.soundButton,
  });
  const element = createElement('section', { className: 'setup' }, [
    createElement('h1', { className: 'logo', text: TV_TEXTS.title }),
    code,
    createElement('div', { className: 'setup-join' }, [
      qrSlot,
      createElement('div', { className: 'setup-help' }, [
        createElement('p', { text: TV_TEXTS.scanToPlay }),
        createElement('p', { className: 'muted', text: TV_TEXTS.orOpen }),
        url,
      ]),
    ]),
    connection,
    lobbyHintElement,
    seatList,
    soundButton,
  ]);
  return {
    element,
    soundButton,
    showRoom: (roomCode, controllerUrl) => {
      code.textContent = roomCode;
      url.textContent = controllerUrl;
      qrSlot.replaceChildren(createQrCode(controllerUrl));
    },
    showConnection: (label, kind) => {
      connection.textContent = label;
      connection.dataset['kind'] = kind;
    },
    showLobby: (mode, seats) => {
      lobbyHintElement.textContent = lobbyHint(mode);
      seatList.hidden = mode !== 'multi';
      seatList.replaceChildren(
        ...(seats.length === 0
          ? [createElement('li', { className: 'muted', text: TV_TEXTS.lobby.noTeam })]
          : seats.map(seatRow)),
      );
    },
  };
}

/** Title above the grid: which word, which part of the game. */
export function phaseTitle(view: InGameView): string {
  switch (view.phase) {
    case 'playing':
      return view.isLastWord
        ? TV_TEXTS.lastWord
        : TV_TEXTS.wordOf(view.wordNumber, view.settings.wordCount);
    case 'tieBreak':
      return TV_TEXTS.tieBreak;
    case 'superPartie': {
      const word = view.wordIndex > 10 ? TV_TEXTS.bonusWord : TV_TEXTS.superWordOf(view.wordIndex);
      return `${TV_TEXTS.superPartie} · ${word} · ${TV_TEXTS.foundCount(view.found)}`;
    }
  }
}

export interface GameRenderOptions {
  hiddenLine: number | null;
  /** Teams whose phone is disconnected, with one phone per team. */
  offline: readonly number[];
}

export interface GameScreen {
  element: HTMLElement;
  grid: WordGrid;
  ballLayer: HTMLElement;
  render(view: InGameView, options: GameRenderOptions): void;
  showMessage(text: string): void;
  /** Null hides the timer. `urgent` turns it red for the last seconds. */
  showTimer(text: string | null, urgent: boolean): void;
  panel(team: number): HTMLElement | undefined;
}

/** Plays a CSS animation again, even if the class is already there. */
function restartAnimation(element: HTMLElement, className: string): void {
  element.classList.remove(className);
  element.getBoundingClientRect(); // Forces a layout, so that the browser sees the class as new.
  element.classList.add(className);
}

function shownTeams(view: InGameView): number[] {
  if (view.phase === 'superPartie') return [view.activeTeam];
  return view.teams.map((_, index) => index);
}

export function createGameScreen(): GameScreen {
  const grid = createWordGrid();
  const title = createElement('div', { className: 'phase-title' });
  const timer = createElement('div', { className: 'timer' });
  const banner = createElement('div', { className: 'banner' });
  const ballLayer = createElement('div', { className: 'ball-layer' });
  const teams = createElement('aside', { className: 'teams' });
  const panels = new Map<number, HTMLElement>();
  const element = createElement('section', { className: 'game' }, [
    createElement('div', { className: 'board' }, [
      createElement('div', { className: 'board-head' }, [title, timer]),
      grid.element,
      banner,
    ]),
    teams,
    ballLayer,
  ]);

  function render(view: InGameView, options: GameRenderOptions): void {
    title.textContent = phaseTitle(view);
    grid.render(view.word, {
      hiddenLine: options.hiddenLine,
      lastChance: view.phase === 'playing' && view.lastChance,
    });
    panels.clear();
    const shown = shownTeams(view);
    teams.dataset['count'] = String(shown.length);
    teams.replaceChildren(
      ...shown.map((index) => {
        const team = view.teams[index];
        if (team === undefined) return createElement('div');
        const panel = createTeamPanel(team, index, {
          active: index === view.activeTeam,
          offline: options.offline.includes(index),
        });
        panels.set(index, panel);
        return panel;
      }),
    );
  }

  return {
    element,
    grid,
    ballLayer,
    render,
    showMessage: (text) => {
      banner.textContent = text;
      restartAnimation(banner, 'show');
    },
    showTimer: (text, urgent) => {
      timer.hidden = text === null;
      timer.textContent = text ?? '';
      timer.classList.toggle('urgent', urgent);
    },
    panel: (team) => panels.get(team),
  };
}

export interface RankingScreen {
  element: HTMLElement;
  render(view: GameOverView): void;
}

function resultText(view: GameOverView): string {
  const result = view.result;
  if (result === null) return TV_TEXTS.abandoned;
  const team = view.teams[result.finalist]?.name ?? '';
  const bonus = TV_TEXTS.bonusResult[result.bonus];
  return [TV_TEXTS.superResult(team, result.found), bonus].filter((part) => part !== '').join(' ');
}

export function createRankingScreen(): RankingScreen {
  const list = createElement('ol', { className: 'ranking' });
  const result = createElement('p', { className: 'final-result' });
  const element = createElement('section', { className: 'final' }, [
    createElement('h1', { className: 'logo', text: TV_TEXTS.ranking }),
    result,
    list,
    createElement('p', { className: 'muted', text: TV_TEXTS.newGameHint }),
  ]);
  return {
    element,
    render: (view) => {
      result.textContent = resultText(view);
      list.replaceChildren(
        ...view.ranking.map((team, rank) =>
          createElement('li', { className: `team-${String(team)}${rank === 0 ? ' winner' : ''}` }, [
            createElement('span', { className: 'rank', text: String(rank + 1) }),
            createElement('span', {
              className: 'ranking-name',
              text: view.teams[team]?.name ?? '',
            }),
            createElement('span', {
              className: 'ranking-total',
              text: TV_TEXTS.points(view.teams[team]?.score ?? 0),
            }),
          ]),
        ),
      );
    },
  };
}
