import './tv.css';
import type { LetterMark } from '../game/coloring';
import type { WordSource } from '../game/common';
import { DEFAULT_WORD_LENGTH } from '../game/config';
import type { GameEvent } from '../game/events';
import { reduce, type GameDeps, type ReduceResult } from '../game/reducer';
import { INITIAL_STATE, type GameAction, type GameState } from '../game/state';
import type { ConnectionStatus } from '../net/connection-status';
import { startHost, type LinkId } from '../net/host';
import { generateRoomCode, isValidRoomCode } from '../net/room-code';
import {
  HEARTBEAT,
  parsePhoneMessage,
  REPLACED,
  stateMessage,
  type PhoneMessage,
  type RoomMessage,
  type TvMessage,
} from '../protocol/messages';
import { toPublicView, type PhaseView } from '../protocol/view';
import { createElement } from '../shared/dom';
import { isMuted } from '../shared/mode';
import { watchOnline } from '../shared/network';
import { loadAliveAt, saveAliveAt } from '../storage/clock-store';
import { loadGame, saveGame } from '../storage/game-store';
import { loadRoomCode, saveRoomCode } from '../storage/room-code-store';
import { loadRoom, saveRoom } from '../storage/room-store';
import { mayAct, withSeatNames } from './action-guard';
import { showBall } from './ball';
import { formatClock, secondsLeft } from './format';
import {
  chooseMode,
  dropLink,
  EMPTY_ROOM,
  greet,
  isTeamConnected,
  joinTeam,
  removeTeam,
  roomViewFor,
  seatsView,
  type Room,
  type RoomChange,
} from './room';
import {
  createGameScreen,
  createRankingScreen,
  createSetupScreen,
  type InGameView,
} from './screens';
import { createSound, type Sound } from './sound';
import { coverCell, flashFullLines } from './team-panel';
import { eventMessage, statusLabel, TV_TEXTS } from './texts';
import { keepScreenOn } from './wake-lock';
import { loadWordSource } from './word-loader';

/** Time between two letters of a line; much faster in the Super partie, whose timer keeps running. */
const LETTER_MS = 280;
const SUPER_LETTER_MS = 90;
/** A refused word or a timeout stays on screen a moment before the next team plays. */
const REFUSED_PAUSE_MS = 1500;
/** A revealed word (missed) or a MOTUS stays on screen long enough to be read from the sofa. */
const RESULT_PAUSE_MS = 2500;
const SUPER_RESULT_PAUSE_MS = 900;
const TIMER_REFRESH_MS = 250;
/** The timer turns red and ticks during the last seconds. */
const URGENT_SECONDS = 5;
/** Leaves a replaced phone the time to read why before its link is closed. */
const DISMISS_DELAY_MS = 1000;
/** How often the TV writes that it is alive, to measure the time lost by a reload. */
const ALIVE_SAVE_MS = 1000;

/** Until the master starts a game, no word list is loaded: the reducer refuses to start. */
const NO_WORDS: WordSource = { length: DEFAULT_WORD_LENGTH, secrets: [], isValid: () => false };

type Line = InGameView['word']['lines'][number];

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function controllerUrl(code: string): string {
  return `${window.location.origin}${window.location.pathname}?mode=manette&code=${code}`;
}

/** The mode, the master and the teams survive a reload; links do not. */
function initialRoom(): Room {
  const saved = loadRoom();
  return saved === null ? EMPTY_ROOM : { ...saved, links: [] };
}

function initialRoomCode(): string {
  const saved = loadRoomCode();
  return saved !== null && isValidRoomCode(saved) ? saved : generateRoomCode(Math.random);
}

function isInGame(view: PhaseView): view is InGameView {
  return view.phase === 'playing' || view.phase === 'tieBreak' || view.phase === 'superPartie';
}

/** The line an event wrote on the grid, if any. */
function writtenLine(events: readonly GameEvent[]): Line | null {
  for (const event of events) {
    if (event.type === 'attemptMade')
      return { kind: 'attempt', word: event.word, marks: event.marks };
    if (event.type === 'proposalRefused') {
      return { kind: 'refused', word: event.word, refusal: event.refusal };
    }
    if (event.type === 'attemptTimedOut') return { kind: 'timeUp' };
  }
  return null;
}

/** The TV animates until the step needs the end of the animation to go on. */
function waitsForReveal(state: GameState): boolean {
  if (state.phase === 'playing' || state.phase === 'tieBreak')
    return state.step.kind === 'revealing';
  return state.phase === 'superPartie' && state.step.kind === 'ready';
}

function setupSound(sound: Sound | null, onChange: () => void): void {
  const unlock = (): void => {
    if (sound === null || sound.isUnlocked()) return;
    void sound.unlock().then(onChange);
  };
  // The Fire TV remote "OK" button arrives as Enter, or as a click on the focused button.
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') unlock();
  });
  document.addEventListener('click', unlock);
}

function markSound(sound: Sound | null, mark: LetterMark): void {
  if (mark === 'placed') sound?.placed();
  else if (mark === 'misplaced') sound?.misplaced();
  else sound?.absent();
}

export function startTv(root: HTMLElement): void {
  const sound = isMuted(window.location.search) ? null : createSound();
  const setup = createSetupScreen();
  const game = createGameScreen();
  const final = createRankingScreen();
  const corner = createElement('div', { className: 'corner' });

  const warnings = { offline: '', room: '', controller: '', words: '', game: '', teams: '' };
  const saved = loadGame();
  if (saved.kind === 'unreadable') warnings.game = TV_TEXTS.saveUnreadable;
  let state: GameState = saved.kind === 'loaded' ? saved.state : INITIAL_STATE;
  let words: WordSource = NO_WORDS;
  let code = initialRoomCode();
  let room: Room = initialRoom();
  let connection: ConnectionStatus = { kind: 'waiting' };
  let presentation: Promise<void> = Promise.resolve();
  /** Presentations queued or playing: the phones wait while the TV is busy. */
  let queued = 0;
  let loadingWords = false;
  let timeUpSentFor: GameState | null = null;
  let lastTickSecond = -1;
  let lastAliveSave = 0;
  /** False until a game saved before a reload is ready again (word lists loaded, clock shifted). */
  let resumed = false;

  const deps = (): GameDeps => ({ random: Math.random, now: () => Date.now(), words });

  function viewOf(current: GameState): PhaseView {
    return toPublicView(current, { events: [], busy: false, now: Date.now() }).game;
  }

  function updateCorner(): void {
    const soundHint = sound !== null && !sound.isUnlocked() ? TV_TEXTS.soundHint : '';
    corner.textContent = [
      TV_TEXTS.roomCode(code),
      statusLabel(connection),
      soundHint,
      ...Object.values(warnings),
    ]
      .filter((part) => part !== '')
      .join(' · ');
    setup.soundButton.textContent = soundHint === '' ? TV_TEXTS.soundOn : TV_TEXTS.soundButton;
  }

  function showRoom(): void {
    setup.showRoom(code, controllerUrl(code));
    warnings.room = saveRoomCode(code) ? '' : TV_TEXTS.storageFailed;
    updateCorner();
  }

  function offlineTeams(): number[] {
    if (room.mode !== 'multi' || state.phase === 'setup') return [];
    return state.teams.map((_, team) => team).filter((team) => !isTeamConnected(room, team));
  }

  function render(view: PhaseView, hiddenLine: number | null = null): void {
    setup.element.hidden = view.phase !== 'setup';
    game.element.hidden = !isInGame(view);
    final.element.hidden = view.phase !== 'gameOver';
    if (isInGame(view)) game.render(view, { hiddenLine, offline: offlineTeams() });
    if (view.phase === 'gameOver') final.render(view);
  }

  function teamName(team: number): string {
    return state.phase === 'setup' ? '' : (state.teams[team]?.name ?? '');
  }

  /** The line just played, colored letter by letter on the grid as it was before the action. */
  async function revealWrittenLine(before: PhaseView, line: Line): Promise<void> {
    if (!isInGame(before)) return;
    const lines = [...before.word.lines, line];
    const interim: InGameView = { ...before, word: { ...before.word, lines } };
    const index = lines.length - 1;
    render(interim, line.kind === 'attempt' ? index : null);
    if (line.kind === 'attempt') {
      const letterMs = before.phase === 'superPartie' ? SUPER_LETTER_MS : LETTER_MS;
      await game.grid.revealLine(index, line.marks, letterMs, (mark) => {
        markSound(sound, mark);
      });
    } else {
      sound?.refused();
      if (before.phase !== 'superPartie') await wait(REFUSED_PAUSE_MS);
    }
  }

  async function animateBall(event: GameEvent): Promise<void> {
    if (event.type === 'ballDrawn') {
      await showBall(game.ballLayer, event.value);
      sound?.ballDrop();
      const panel = game.panel(event.team);
      if (panel !== undefined) coverCell(panel, event.value);
    } else if (event.type === 'blackBall') {
      sound?.blackBall();
      await showBall(game.ballLayer, null);
    } else if (event.type === 'motus') {
      const panel = game.panel(event.team);
      if (panel !== undefined) flashFullLines(panel);
      sound?.motus();
      await wait(RESULT_PAUSE_MS);
    }
  }

  function playEventSound(event: GameEvent): void {
    switch (event.type) {
      case 'wordStarted':
      case 'tieBreakStarted':
      case 'superPartieStarted':
        sound?.start();
        return;
      case 'wordFound':
      case 'superWordFound':
        sound?.found();
        return;
      case 'wordMissed':
      case 'superWordMissed':
      case 'superTimeUp':
        sound?.refused();
        return;
      case 'handPassed':
        if (event.bonusPosition !== null) sound?.pop();
        return;
      default:
        return;
    }
  }

  function showBanner(events: readonly GameEvent[]): void {
    const messages = events
      .map((event) => eventMessage(event, teamName))
      .filter((message): message is string => message !== null);
    if (messages.length > 0) game.showMessage(messages.join(' · '));
  }

  async function present(before: PhaseView, result: ReduceResult): Promise<void> {
    const { events } = result;
    const line = writtenLine(events);
    if (line !== null) await revealWrittenLine(before, line);
    showBanner(events);
    for (const event of events) {
      await animateBall(event);
      playEventSound(event);
    }
    const next = viewOf(result.state);
    render(next);
    const passed = events.find((event) => event.type === 'handPassed');
    if (passed?.type === 'handPassed' && passed.bonusPosition !== null) {
      game.grid.highlightHint(passed.bonusPosition);
    }
    if (events.some((event) => event.type === 'wordMissed' || event.type === 'superWordMissed')) {
      await wait(next.phase === 'superPartie' ? SUPER_RESULT_PAUSE_MS : RESULT_PAUSE_MS);
    }
  }

  function sendView(events: readonly GameEvent[], to: readonly LinkId[] = host.links()): void {
    const view = toPublicView(state, { events, busy: queued > 0, now: Date.now() });
    for (const link of to) host.send(link, stateMessage(view, roomViewFor(room, link)));
  }

  /** Queues the animations of a result. The phones are told when every animation is over. */
  function queuePresentation(before: PhaseView, result: ReduceResult): void {
    queued += 1;
    // A failed animation must not block the next ones: show the final state instead.
    presentation = presentation
      .then(() => present(before, result))
      .catch(() => {
        render(viewOf(state));
      })
      .then(() => {
        queued -= 1;
        if (queued > 0) return;
        if (waitsForReveal(state)) dispatch({ type: 'revealDone' });
        else sendView([]);
      });
  }

  function dispatch(action: GameAction): void {
    const before = viewOf(state);
    const result = reduce(state, action, deps());
    if (result.state === state) {
      // Refused by the rules: the phones still get an answer, so that they stop waiting.
      sendView([]);
      return;
    }
    state = result.state;
    warnings.game = saveGame(state) ? '' : TV_TEXTS.saveFailed;
    updateCorner();
    if (result.events.length > 0) queuePresentation(before, result);
    else render(viewOf(state));
    sendView(result.events);
  }

  /** Loads the word lists of the chosen length first: the reducer needs them to start. */
  function startGame(action: Extract<GameAction, { type: 'startGame' }>): void {
    if (loadingWords || state.phase !== 'setup') return;
    loadingWords = true;
    warnings.words = TV_TEXTS.loadingWords;
    updateCorner();
    loadWordSource(action.wordLength)
      .then((source) => {
        words = source;
        warnings.words = '';
        dispatch(action);
      })
      .catch(() => {
        warnings.words = TV_TEXTS.loadingFailed;
      })
      .finally(() => {
        loadingWords = false;
        updateCorner();
      });
  }

  /** The phone is told first, so that it does not come back and take over in turn. */
  function dismiss(link: LinkId): void {
    host.send(link, REPLACED);
    setTimeout(() => {
      host.close(link);
    }, DISMISS_DELAY_MS);
  }

  function updateRoom(next: Room, close: readonly LinkId[] = []): void {
    room = next;
    for (const link of close) dismiss(link);
    warnings.teams = saveRoom(room) ? '' : TV_TEXTS.saveFailed;
    updateCorner();
    setup.showLobby(room.mode, seatsView(room));
    if (state.phase !== 'setup' && state.phase !== 'gameOver' && queued === 0)
      render(viewOf(state));
    sendView(
      [],
      host.links().filter((link) => !close.includes(link)),
    );
  }

  /** Changes to the room, only between games. */
  function roomChange(message: RoomMessage, link: LinkId): RoomChange | null {
    if (state.phase !== 'setup') return null;
    if (message.type === 'chooseMode') return chooseMode(room, link, message.mode);
    const next =
      message.type === 'joinTeam'
        ? joinTeam(room, link, message.name)
        : removeTeam(room, link, message.team);
    return next === null ? null : { room: next, close: [] };
  }

  function receiveAction(action: GameAction, link: LinkId): void {
    // A refused phone still gets an answer, so that it stops waiting.
    if (!resumed || queued > 0 || !mayAct(room, state, link, action)) {
      sendView([], [link]);
      return;
    }
    const named = withSeatNames(room, action);
    if (named.type === 'startGame') startGame(named);
    else dispatch(named);
  }

  function receive(message: PhoneMessage, link: LinkId): void {
    switch (message.type) {
      case 'hello': {
        const change = greet(room, link, message.clientId);
        updateRoom(change.room, change.close);
        return;
      }
      case 'chooseMode':
      case 'joinTeam':
      case 'removeTeam': {
        const change = roomChange(message, link);
        if (change === null) sendView([], [link]);
        else updateRoom(change.room, change.close);
        return;
      }
      case 'action':
        receiveAction(message.action, link);
        return;
      case 'heartbeat':
        return;
    }
  }

  /** Countdown on screen, ticks for the last seconds, and the end of the time for the reducer. */
  function refreshTimer(): void {
    if (!resumed) return;
    const now = Date.now();
    const view = toPublicView(state, { events: [], busy: false, now }).game;
    if (isInGame(view) && now - lastAliveSave >= ALIVE_SAVE_MS) {
      lastAliveSave = now;
      saveAliveAt(now);
    }
    const timer = isInGame(view) ? view.timer : null;
    if (timer === null) {
      game.showTimer(null, false);
      return;
    }
    const seconds = secondsLeft(timer.remainingMs);
    const urgent = timer.running && seconds <= URGENT_SECONDS;
    game.showTimer(formatClock(timer.remainingMs), urgent);
    if (urgent && seconds > 0 && seconds !== lastTickSecond) sound?.tick();
    lastTickSecond = seconds;
    if (timer.running && timer.remainingMs === 0 && timeUpSentFor !== state) {
      timeUpSentFor = state;
      dispatch({ type: 'timeUp' });
    }
  }

  const host = startHost<PhoneMessage, TvMessage>({
    code,
    createCode: () => generateRoomCode(Math.random),
    onCodeChange: (newCode) => {
      code = newCode;
      showRoom();
    },
    onStatus: (status) => {
      connection = status;
      setup.showConnection(statusLabel(status), status.kind);
      updateCorner();
      if (status.kind !== 'connected') return;
      warnings.controller = '';
      sendView([]);
    },
    decode: parsePhoneMessage,
    heartbeat: HEARTBEAT,
    onLinkLost: (link) => {
      updateRoom(dropLink(room, link));
    },
    onMessage: receive,
    onInvalid: (reason) => {
      if (reason !== 'version') return;
      warnings.controller = TV_TEXTS.updateController;
      updateCorner();
    },
  });

  setupSound(sound, updateCorner);
  keepScreenOn();
  watchOnline((online) => {
    warnings.offline = online ? '' : TV_TEXTS.offline;
    updateCorner();
  });
  root.replaceChildren(
    createElement('main', { className: 'game-tv' }, [
      setup.element,
      game.element,
      final.element,
      corner,
    ]),
  );
  showRoom();
  setup.showConnection(statusLabel(connection), connection.kind);
  setup.showLobby(room.mode, seatsView(room));
  render(viewOf(state));
  setInterval(refreshTimer, TIMER_REFRESH_MS);
  setup.soundButton.focus();
  resume();

  /**
   * After a reload in the middle of a game: load its word lists, give back the
   * time the TV was gone, and finish an animation that was cut short.
   */
  function resume(): void {
    if (state.phase === 'setup' || state.phase === 'gameOver') {
      resumed = true;
      return;
    }
    const length = state.settings.wordLength;
    warnings.words = TV_TEXTS.loadingWords;
    updateCorner();
    loadWordSource(length)
      .then((source) => {
        words = source;
        warnings.words = '';
        resumed = true;
        const aliveAt = loadAliveAt();
        if (aliveAt !== null) dispatch({ type: 'resumeClock', pausedMs: Date.now() - aliveAt });
        game.showMessage(TV_TEXTS.gameResumed);
        if (waitsForReveal(state)) dispatch({ type: 'revealDone' });
        else sendView([]);
      })
      .catch(() => {
        warnings.words = TV_TEXTS.loadingFailed;
      })
      .finally(updateCorner);
  }
}
