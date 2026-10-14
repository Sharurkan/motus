import './phone.css';
import { DEFAULT_WORD_COUNT, DEFAULT_WORD_LENGTH } from '../game/config';
import { startClient } from '../net/client';
import type { ConnectionStatus } from '../net/connection-status';
import { isValidRoomCode, normalizeRoomCode, ROOM_CODE_LENGTH } from '../net/room-code';
import type { PhoneAction } from '../protocol/actions';
import {
  actionMessage,
  chooseModeMessage,
  HEARTBEAT,
  helloMessage,
  joinTeamMessage,
  parseTvMessage,
  removeTeamMessage,
  type PhoneMessage,
  type TvMessage,
} from '../protocol/messages';
import type { RoomView } from '../protocol/room';
import type { PhaseView, PublicView } from '../protocol/view';
import { createElement } from '../shared/dom';
import { isTestMode } from '../shared/mode';
import { watchOnline } from '../shared/network';
import { loadClientId } from '../storage/client-id-store';
import { clearRoomCode, loadRoomCode, saveRoomCode } from '../storage/room-code-store';
import { describeScreen, phoneRole, remainingNow } from './controls';
import { renderScreen } from './game-screens';
import { readCodeFromUrl, writeCodeToUrl } from './room-url';
import { messageFor, PHONE_TEXTS, statusLabel, type BannerMessage } from './texts';
import type { ConfirmableAction, RoomRequest, SetupDraft } from './ui';
import { newDraft, type WordDraft } from './word-draft';

/** If the TV never answers an action, buttons come back after this delay. */
const PENDING_TIMEOUT_MS = 5000;
const COUNTDOWN_REFRESH_MS = 250;
/** The countdown turns red for the last seconds. */
const URGENT_SECONDS = 5;

const texts = PHONE_TEXTS;

const PHONE_ROOM_CODE_KEY = 'motus.phoneRoomCode';

/** Until the TV tells otherwise: no mode chosen, no team. */
const UNKNOWN_ROOM: RoomView = { mode: null, isMaster: false, team: null, seats: [] };

type InGameView = Extract<PhaseView, { word: unknown }>;

function roomMessage(request: RoomRequest): PhoneMessage {
  switch (request.type) {
    case 'chooseMode':
      return chooseModeMessage(request.mode);
    case 'joinTeam':
      return joinTeamMessage(request.name);
    case 'removeTeam':
      return removeTeamMessage(request.team);
  }
}

function inGame(game: PhaseView): InGameView | null {
  return 'word' in game ? game : null;
}

/**
 * Another phone joining or leaving rebuilds the screen: what is being typed and
 * the keyboard focus must survive it.
 */
function replaceKeepingInputs(
  container: HTMLElement,
  next: HTMLElement,
  sameScreen: boolean,
): void {
  const before = Array.from(container.querySelectorAll('input'));
  const focused = before.findIndex((input) => input === document.activeElement);
  container.replaceChildren(next);
  if (!sameScreen) return;
  const after = Array.from(container.querySelectorAll('input'));
  before.forEach((input, index) => {
    const target = after[index];
    if (target === undefined || target.value !== '' || input.value === '') return;
    target.value = input.value;
    target.dispatchEvent(new Event('input'));
  });
  if (focused >= 0) after[focused]?.focus();
}

/** With one phone per team, the team this phone plays for. */
function ownTeamName(game: PhaseView, room: RoomView): string | null {
  if (room.mode !== 'multi' || room.team === null) return null;
  const inGameName = 'teams' in game ? game.teams[room.team]?.name : undefined;
  const joined = room.seats[room.team]?.name ?? '';
  return inGameName ?? (joined === '' ? texts.teamPlaceholder(room.team) : joined);
}

function headerText(game: PhaseView): string {
  switch (game.phase) {
    case 'setup':
      return texts.setupTitle;
    case 'gameOver':
      return texts.rankingTitle;
    case 'playing':
      return game.isLastWord
        ? texts.lastWord
        : texts.wordOf(game.wordNumber, game.settings.wordCount);
    case 'tieBreak':
      return texts.tieBreak;
    case 'superPartie':
      return game.wordIndex > 10 ? texts.bonusWord : texts.superPartie(game.found);
  }
}

function scoresText(game: PhaseView): string {
  if (game.phase !== 'playing' && game.phase !== 'tieBreak') return '';
  return game.teams.map((team) => texts.score(team.name, team.score)).join(' · ');
}

/** A new line, a new word or a new team: the word being typed starts again. */
function draftKey(game: InGameView): string {
  const number =
    game.phase === 'playing' ? game.wordNumber : game.phase === 'superPartie' ? game.wordIndex : 0;
  return [game.phase, number, game.word.lines.length, game.activeTeam, game.word.hints[0]].join(
    '|',
  );
}

/** The code from the QR code wins; otherwise the phone reconnects to the last TV. */
function initialCode(): string | null {
  const fromUrl = readCodeFromUrl();
  if (fromUrl !== null) return fromUrl;
  const saved = loadRoomCode(PHONE_ROOM_CODE_KEY);
  if (saved === null || !isValidRoomCode(saved)) return null;
  writeCodeToUrl(saved);
  return saved;
}

export function startPhone(root: HTMLElement): void {
  const code = initialCode();
  if (code === null) showCodeForm(root);
  else showController(root, code);
}

function showCodeForm(root: HTMLElement): void {
  const input = createElement('input', { className: 'code-input' });
  input.maxLength = ROOM_CODE_LENGTH;
  input.placeholder = texts.codePlaceholder;
  input.autocomplete = 'off';
  input.setAttribute('autocapitalize', 'characters');
  const error = createElement('p', { className: 'note error' });
  const form = createElement('form', { className: 'screen' }, [
    createElement('label', { className: 'label', text: texts.codeLabel }, [input]),
    createElement('button', { className: 'big-button', text: texts.connect }),
    error,
  ]);
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const code = normalizeRoomCode(input.value);
    if (!isValidRoomCode(code)) {
      error.textContent = texts.invalidCode;
      return;
    }
    writeCodeToUrl(code);
    showController(root, code);
  });
  root.replaceChildren(
    createElement('main', { className: 'controller' }, [
      createElement('h1', { className: 'logo', text: texts.title }),
      form,
    ]),
  );
  input.focus();
}

/** With one phone, another phone took over: this one waits until asked to take over again. */
function showReplaced(root: HTMLElement, code: string): void {
  const takeOver = createElement('button', { className: 'big-button', text: texts.takeOver });
  takeOver.addEventListener('click', () => {
    showController(root, code);
  });
  root.replaceChildren(
    createElement('main', { className: 'controller' }, [
      createElement('div', { className: 'room', text: texts.room(code) }),
      createElement('p', { className: 'headline', text: texts.replaced }),
      takeOver,
    ]),
  );
}

function showController(root: HTMLElement, code: string): void {
  const remembered = saveRoomCode(code, PHONE_ROOM_CODE_KEY);
  const clientId = loadClientId(Math.random).id;
  let view: PublicView | null = null;
  let room: RoomView = UNKNOWN_ROOM;
  /** Team the master plays for, while its phone is disconnected. */
  let standingIn: number | null = null;
  let status: ConnectionStatus = { kind: 'waiting' };
  let message: BannerMessage | null = null;
  let versionError = false;
  let online = true;
  let pending = false;
  let pendingTimer: ReturnType<typeof setTimeout> | undefined;
  let confirming: ConfirmableAction | null = null;
  let draft: WordDraft | null = null;
  let draftFor = '';
  let receivedAt = 0;
  let renderedKey = '';
  let renderedScreen = '';
  const setup: SetupDraft = {
    teamCount: 2,
    names: [],
    wordLength: DEFAULT_WORD_LENGTH,
    attemptSeconds: undefined,
    wordCount: DEFAULT_WORD_COUNT,
    ownName: '',
    testMode: isTestMode(window.location.search),
    forcedSecret: '',
    forcedBall: '',
  };

  const statusElement = createElement('div', { className: 'connection' });
  const header = createElement('div', { className: 'header' });
  const countdown = createElement('div', { className: 'countdown' });
  const turnElement = createElement('div', { className: 'turn' });
  const scoresElement = createElement('div', { className: 'scores' });
  const teamElement = createElement('div', { className: 'own-team' });
  const messageElement = createElement('div', { className: 'message' });
  const body = createElement('div', { className: 'body' });
  const changeButton = createElement('button', {
    className: 'link-button',
    text: texts.changeCode,
  });

  function setPending(value: boolean): void {
    pending = value;
    clearTimeout(pendingTimer);
    if (value) {
      pendingTimer = setTimeout(() => {
        setPending(false);
        render();
      }, PENDING_TIMEOUT_MS);
    }
  }

  function sendMessage(outgoing: PhoneMessage): void {
    if (pending || status.kind !== 'connected') return;
    setPending(true);
    client.send(outgoing);
    render();
  }

  function send(action: PhoneAction): void {
    confirming = null;
    sendMessage(actionMessage(action));
  }

  /** The word being typed follows the game: a fresh one for each new line. */
  function syncDraft(game: PhaseView): void {
    const current = inGame(game);
    if (current === null) {
      draft = null;
      draftFor = '';
      return;
    }
    const key = draftKey(current);
    if (key === draftFor) return;
    draftFor = key;
    draft = newDraft(current.word.length, current.word.hints[0] ?? '');
  }

  function renderBody(current: PublicView): void {
    const screen = describeScreen(current.game);
    const role = phoneRole(current.game, room, standingIn);
    const ready = status.kind === 'connected' && !pending && !current.busy;
    const enabled = ready && role.canPlay;
    const manageEnabled = ready && role.canManage;
    // Rebuilding the screen would wipe what is being typed: only do it when something changed.
    const key = JSON.stringify({
      screen,
      ready,
      enabled,
      manageEnabled,
      role,
      room,
      confirming,
      draft,
      setup,
      current,
    });
    if (key === renderedKey) return;
    renderedKey = key;
    const screenKey = JSON.stringify(screen);
    const sameScreen = screenKey === renderedScreen;
    renderedScreen = screenKey;
    replaceKeepingInputs(
      body,
      renderScreen(screen, {
        view: current,
        ready,
        enabled,
        manageEnabled,
        send,
        sendRoom: (request) => {
          sendMessage(roomMessage(request));
        },
        room,
        role,
        standIn: () => {
          standingIn = 'activeTeam' in current.game ? current.game.activeTeam : null;
          render();
        },
        setup,
        draft,
        editDraft: (change) => {
          if (draft === null) return;
          draft = change(draft);
          render();
        },
        confirming,
        askConfirmation: (action) => {
          confirming = action;
          render();
        },
        refresh: render,
      }),
      sameScreen,
    );
  }

  function render(): void {
    const problem = !online ? texts.offline : versionError ? texts.updatePage : null;
    statusElement.textContent = problem ?? statusLabel(status);
    statusElement.dataset['kind'] = problem === null ? status.kind : 'error';
    messageElement.textContent = message?.text ?? '';
    messageElement.classList.toggle('error', message?.isError ?? false);
    if (view === null) return;
    const game = view.game;
    header.textContent = headerText(game);
    const active = inGame(game);
    turnElement.textContent =
      active === null ? '' : texts.turnOf(active.teams[active.activeTeam]?.name ?? '');
    scoresElement.textContent = scoresText(game);
    const ownTeam = ownTeamName(game, room);
    teamElement.textContent = ownTeam === null ? '' : texts.yourTeam(ownTeam);
    renderBody(view);
    refreshCountdown();
  }

  /** The phone counts down by itself between two states from the TV. */
  function refreshCountdown(): void {
    const timer = view === null ? null : (inGame(view.game)?.timer ?? null);
    countdown.hidden = timer === null;
    if (timer === null) return;
    const remaining = remainingNow(timer, receivedAt, Date.now());
    const seconds = Math.ceil(remaining / 1000);
    countdown.textContent = `${String(Math.floor(seconds / 60))}:${String(seconds % 60).padStart(2, '0')}`;
    countdown.classList.toggle('urgent', timer.running && seconds <= URGENT_SECONDS);
  }

  function receiveState(next: PublicView, nextRoom: RoomView): void {
    const nextTurn = 'activeTeam' in next.game ? next.game.activeTeam : null;
    // Standing in lasts for one turn: it stops when the turn moves on.
    if (nextTurn !== standingIn) standingIn = null;
    if (view === null || next.game.phase !== view.game.phase) confirming = null;
    view = next;
    room = nextRoom;
    receivedAt = Date.now();
    versionError = false;
    setPending(false);
    syncDraft(next.game);
    if (next.events.length > 0) {
      message = messageFor(next.events, (team) =>
        'teams' in next.game ? (next.game.teams[team]?.name ?? '') : '',
      );
    }
    render();
  }

  const client = startClient<TvMessage, PhoneMessage>({
    code,
    decode: parseTvMessage,
    heartbeat: HEARTBEAT,
    onMessage: (incoming) => {
      if (incoming.type === 'state') receiveState(incoming.view, incoming.room);
      if (incoming.type === 'replaced') {
        client.stop();
        setPending(false);
        showReplaced(root, code);
      }
    },
    onInvalid: (reason) => {
      if (reason !== 'version') return;
      versionError = true;
      render();
    },
    onStatus: (next) => {
      status = next;
      setPending(false);
      if (next.kind === 'connected') client.send(helloMessage(clientId));
      render();
    },
  });

  changeButton.addEventListener('click', () => {
    client.stop();
    setPending(false);
    writeCodeToUrl(null);
    clearRoomCode(PHONE_ROOM_CODE_KEY);
    showCodeForm(root);
  });

  watchOnline((isOnline) => {
    online = isOnline;
    render();
  });
  root.replaceChildren(
    createElement('main', { className: 'controller' }, [
      createElement('div', { className: 'top-line' }, [
        createElement('div', { className: 'room', text: texts.room(code) }),
        statusElement,
      ]),
      createElement('div', { className: 'header-line' }, [header, countdown]),
      turnElement,
      scoresElement,
      teamElement,
      messageElement,
      body,
      ...(remembered
        ? []
        : [createElement('p', { className: 'note', text: texts.codeNotRemembered })]),
      changeButton,
    ]),
  );
  setInterval(refreshCountdown, COUNTDOWN_REFRESH_MS);
  render();
}
