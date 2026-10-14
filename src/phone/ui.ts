import type { AttemptSeconds, WordCount, WordLength } from '../game/config';
import type { PhoneAction } from '../protocol/actions';
import type { PlayMode, RoomView } from '../protocol/room';
import type { PublicView } from '../protocol/view';
import { createElement } from '../shared/dom';
import type { PhoneRole } from './controls';
import type { WordDraft } from './word-draft';

export type ConfirmableAction = 'abandonGame';

/** What the master is setting up before the game, kept across screen rebuilds. */
export interface SetupDraft {
  teamCount: number;
  names: string[];
  wordLength: WordLength;
  /** Undefined until chosen: the default then depends on the mode. */
  attemptSeconds: AttemptSeconds | undefined;
  wordCount: WordCount;
  /** Name typed to join with one phone per team. */
  ownName: string;
  testMode: boolean;
  /** Test mode inputs. */
  forcedSecret: string;
  forcedBall: string;
}

/** Messages that change the room rather than the game. */
export type RoomRequest =
  | { type: 'chooseMode'; mode: PlayMode }
  | { type: 'joinTeam'; name: string }
  | { type: 'removeTeam'; team: number };

export interface ScreenContext {
  view: PublicView;
  /** False while disconnected or while waiting for the TV to answer or animate. */
  ready: boolean;
  /** Ready, and this phone may play the turn. */
  enabled: boolean;
  /** Ready, and this phone may run the game (start, next word, abandon, new game). */
  manageEnabled: boolean;
  send: (action: PhoneAction) => void;
  sendRoom: (request: RoomRequest) => void;
  room: RoomView;
  role: PhoneRole;
  standIn: () => void;
  setup: SetupDraft;
  draft: WordDraft | null;
  editDraft: (change: (draft: WordDraft) => WordDraft) => void;
  /** Irreversible action waiting for a second tap, if any. */
  confirming: ConfirmableAction | null;
  askConfirmation: (action: ConfirmableAction | null) => void;
  refresh: () => void;
}

export function button(
  text: string,
  onClick: () => void,
  options: { disabled?: boolean; className?: string } = {},
): HTMLButtonElement {
  const element = createElement('button', { className: options.className ?? 'big-button', text });
  element.type = 'button';
  element.disabled = options.disabled ?? false;
  element.addEventListener('click', onClick);
  return element;
}

export function note(text: string): HTMLElement {
  return createElement('p', { className: 'note', text });
}

export function headline(text: string): HTMLElement {
  return createElement('p', { className: 'headline', text });
}

/** A row of choices; the selected one is highlighted. */
export function choices<T>(
  label: string,
  options: readonly T[],
  selected: T,
  text: (option: T) => string,
  onChoose: (option: T) => void,
): HTMLElement[] {
  return [
    createElement('p', { className: 'label', text: label }),
    createElement(
      'div',
      { className: 'choices' },
      options.map((option) =>
        button(
          text(option),
          () => {
            onChoose(option);
          },
          { className: option === selected ? 'choice selected' : 'choice' },
        ),
      ),
    ),
  ];
}
