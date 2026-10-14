import {
  ATTEMPT_SECONDS_CHOICES,
  DEFAULT_ATTEMPT_SECONDS,
  MAX_TEAM_NAME_LENGTH,
  MAX_TEAMS,
  MIN_TEAMS,
  WORD_COUNT_CHOICES,
  WORD_LENGTHS,
  type AttemptSeconds,
} from '../game/config';
import type { PhoneAction } from '../protocol/actions';
import type { PlayMode } from '../protocol/room';
import { createElement } from '../shared/dom';
import { teamNamesFor } from './controls';
import { PHONE_TEXTS } from './texts';
import { button, choices, headline, note, type ScreenContext, type SetupDraft } from './ui';

const texts = PHONE_TEXTS;

/** The time chosen by the master, or the default of the mode: longer when the phone is passed. */
export function attemptSecondsFor(setup: SetupDraft, mode: PlayMode): AttemptSeconds {
  return setup.attemptSeconds === undefined ? DEFAULT_ATTEMPT_SECONDS[mode] : setup.attemptSeconds;
}

export function startAction(
  setup: SetupDraft,
  teamNames: string[],
  mode: PlayMode,
): Extract<PhoneAction, { type: 'startGame' }> {
  return {
    type: 'startGame',
    teamNames,
    wordLength: setup.wordLength,
    attemptSeconds: attemptSecondsFor(setup, mode),
    wordCount: setup.wordCount,
  };
}

function settings(context: ScreenContext, mode: PlayMode): HTMLElement[] {
  const { setup } = context;
  const choose =
    <T>(apply: (value: T) => void) =>
    (value: T): void => {
      apply(value);
      context.refresh();
    };
  return [
    ...choices(
      texts.wordLength,
      WORD_LENGTHS,
      setup.wordLength,
      texts.letters,
      choose((value) => {
        setup.wordLength = value;
      }),
    ),
    ...choices(
      texts.attemptTime,
      ATTEMPT_SECONDS_CHOICES,
      attemptSecondsFor(setup, mode),
      (value) => (value === null ? texts.noLimit : texts.seconds(value)),
      choose((value) => {
        setup.attemptSeconds = value;
      }),
    ),
    ...choices(
      texts.wordCount,
      WORD_COUNT_CHOICES,
      setup.wordCount,
      texts.words,
      choose((value) => {
        setup.wordCount = value;
      }),
    ),
  ];
}

/** Start buttons: the normal one, plus the Super partie shortcut in test mode. */
function startButtons(
  context: ScreenContext,
  teamNames: () => string[],
  mode: PlayMode,
  disabled: boolean,
): HTMLElement[] {
  const start = (): void => {
    context.send(startAction(context.setup, teamNames(), mode));
  };
  const startSuper = (): void => {
    context.send({ ...startAction(context.setup, teamNames(), mode), startAtSuperPartie: true });
  };
  return [
    button(texts.start, start, { disabled }),
    ...(context.setup.testMode
      ? [button(texts.startSuper, startSuper, { className: 'secondary-button', disabled })]
      : []),
  ];
}

function changeModeButton(context: ScreenContext): HTMLElement[] {
  const { room } = context;
  if (!room.isMaster || room.mode === null) return [];
  return [
    button(
      texts.mode.change,
      () => {
        context.sendRoom({ type: 'chooseMode', mode: room.mode === 'single' ? 'multi' : 'single' });
      },
      { className: 'secondary-button', disabled: !context.ready },
    ),
  ];
}

function modeScreen(context: ScreenContext): HTMLElement {
  if (!context.room.isMaster) {
    return createElement('div', { className: 'screen' }, [note(texts.mode.waitMaster)]);
  }
  const choose = (mode: PlayMode) => () => {
    context.sendRoom({ type: 'chooseMode', mode });
  };
  return createElement('div', { className: 'screen' }, [
    headline(texts.mode.title),
    button(texts.mode.single, choose('single'), { disabled: !context.ready }),
    note(texts.mode.singleHint),
    button(texts.mode.multi, choose('multi'), { disabled: !context.ready }),
    note(texts.mode.multiHint),
  ]);
}

function nameInput(
  placeholder: string,
  value: string,
  onInput: (value: string) => void,
): HTMLInputElement {
  const input = createElement('input', { className: 'text-input' });
  input.maxLength = MAX_TEAM_NAME_LENGTH;
  input.placeholder = placeholder;
  input.value = value;
  input.addEventListener('input', () => {
    onInput(input.value);
  });
  return input;
}

/** One phone: the master types every team name. */
function singleSetupScreen(context: ScreenContext): HTMLElement {
  const { setup } = context;
  const counts = Array.from({ length: MAX_TEAMS - MIN_TEAMS + 1 }, (_, i) => MIN_TEAMS + i);
  const inputs = Array.from({ length: setup.teamCount }, (_, index) =>
    nameInput(texts.teamPlaceholder(index), setup.names[index] ?? '', (value) => {
      setup.names[index] = value;
    }),
  );
  return createElement('div', { className: 'screen' }, [
    ...choices(texts.teams, counts, setup.teamCount, texts.teamCount, (count) => {
      setup.teamCount = count;
      context.refresh();
    }),
    ...inputs,
    ...settings(context, 'single'),
    ...startButtons(
      context,
      () => teamNamesFor(setup.names, setup.teamCount),
      'single',
      !context.manageEnabled,
    ),
    ...changeModeButton(context),
  ]);
}

/** Joins a team, or renames the one already joined. */
function teamNameForm(context: ScreenContext): HTMLElement {
  const { room, setup } = context;
  const full = room.team === null && room.seats.length >= MAX_TEAMS;
  const input = nameInput(
    texts.teamPlaceholder(room.team ?? room.seats.length),
    setup.ownName,
    (value) => {
      setup.ownName = value;
    },
  );
  const submit = createElement('button', {
    className: room.team === null ? 'big-button' : 'secondary-button',
    text: room.team === null ? texts.join : texts.rename,
  });
  submit.disabled = !context.ready || full;
  const form = createElement('form', { className: 'screen' }, [
    createElement('label', { className: 'label', text: texts.ownTeamName }, [input]),
    submit,
  ]);
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    context.sendRoom({ type: 'joinTeam', name: input.value });
  });
  return form;
}

function seatList(context: ScreenContext): HTMLElement {
  const { room } = context;
  return createElement(
    'ul',
    { className: 'seat-list' },
    room.seats.map((seat, index) => {
      const name = seat.name === '' ? texts.teamPlaceholder(index) : seat.name;
      const remove =
        room.isMaster && index !== room.team
          ? [
              button(
                texts.remove,
                () => {
                  context.sendRoom({ type: 'removeTeam', team: index });
                },
                { className: 'link-button', disabled: !context.ready },
              ),
            ]
          : [];
      return createElement(
        'li',
        { className: `team-${String(index)}${seat.connected ? '' : ' offline'}`, text: name },
        remove,
      );
    }),
  );
}

/** One phone per team: each phone joins, then the master sets up and starts the game. */
function lobbyScreen(context: ScreenContext): HTMLElement {
  const { room } = context;
  const canStart = room.seats.length >= MIN_TEAMS && room.team !== null;
  const masterPart = room.isMaster
    ? [
        ...settings(context, 'multi'),
        ...startButtons(
          context,
          () => room.seats.map((seat) => seat.name),
          'multi',
          !context.manageEnabled || !canStart,
        ),
        ...(canStart ? [] : [note(texts.needTeams)]),
        ...changeModeButton(context),
      ]
    : [note(texts.waitStart)];
  return createElement('div', { className: 'screen' }, [
    teamNameForm(context),
    createElement('p', { className: 'label', text: texts.joinedTeams }),
    room.seats.length === 0 ? note(texts.noTeam) : seatList(context),
    ...masterPart,
  ]);
}

export function setupScreen(context: ScreenContext): HTMLElement {
  switch (context.room.mode) {
    case null:
      return modeScreen(context);
    case 'single':
      return singleSetupScreen(context);
    case 'multi':
      return lobbyScreen(context);
  }
}
