import { createElement } from '../shared/dom';
import type { PhoneScreen } from './controls';
import { setupScreen } from './setup-screens';
import { PHONE_TEXTS } from './texts';
import { button, headline, note, type ScreenContext } from './ui';
import { AZERTY_ROWS, draftWord, eraseLetter, isComplete, typeLetter } from './word-draft';

const texts = PHONE_TEXTS;

function teamName(context: ScreenContext, team: number): string {
  const game = context.view.game;
  return 'teams' in game ? (game.teams[team]?.name ?? '') : '';
}

/** One big cell per letter: typed letters, or the known letter shown faintly as a hint. */
function wordCells(context: ScreenContext): HTMLElement {
  const game = context.view.game;
  const hints = 'word' in game ? game.word.hints : [];
  const letters = context.draft?.letters ?? [];
  const length = context.draft?.length ?? hints.length;
  return createElement(
    'div',
    { className: 'word-cells' },
    Array.from({ length }, (_, i) => {
      const typed = letters[i];
      if (typed !== undefined) {
        return createElement('div', {
          className: i === 0 ? 'word-cell locked' : 'word-cell',
          text: typed,
        });
      }
      return createElement('div', { className: 'word-cell hint', text: hints[i] ?? '' });
    }),
  );
}

function keyboard(context: ScreenContext): HTMLElement {
  return createElement(
    'div',
    { className: 'keyboard' },
    AZERTY_ROWS.map((row) =>
      createElement(
        'div',
        { className: 'key-row' },
        Array.from(row).map((letter) =>
          button(
            letter,
            () => {
              context.editDraft((draft) => typeLetter(draft, letter));
            },
            { className: 'key', disabled: !context.enabled },
          ),
        ),
      ),
    ),
  );
}

function guessingScreen(context: ScreenContext, superPartie: boolean): HTMLElement {
  const draft = context.draft;
  const complete = draft !== null && isComplete(draft);
  const actions = [
    button(
      texts.erase,
      () => {
        context.editDraft(eraseLetter);
      },
      {
        className: 'secondary-button',
        disabled: !context.enabled || draft === null || draft.letters.length <= 1,
      },
    ),
    button(
      texts.validate,
      () => {
        if (draft !== null) context.send({ type: 'proposeWord', word: draftWord(draft) });
      },
      { disabled: !context.enabled || !complete },
    ),
  ];
  return createElement('div', { className: 'screen' }, [
    wordCells(context),
    keyboard(context),
    createElement('div', { className: 'word-actions' }, actions),
    ...(superPartie
      ? [
          button(
            texts.skip,
            () => {
              context.send({ type: 'skipWord' });
            },
            { className: 'secondary-button', disabled: !context.enabled },
          ),
        ]
      : []),
  ]);
}

function masterOrWait(
  context: ScreenContext,
  label: string,
  onClick: () => void,
  waitText: string,
): HTMLElement {
  return context.role.canManage
    ? button(label, onClick, { disabled: !context.manageEnabled })
    : note(waitText);
}

function wordOverScreen(context: ScreenContext, isLastWord: boolean): HTMLElement {
  const next = (): void => {
    context.send({ type: 'nextWord' });
  };
  return createElement('div', { className: 'screen' }, [
    masterOrWait(context, isLastWord ? texts.toFinal : texts.nextWord, next, texts.waitMasterNext),
  ]);
}

function bonusChoiceScreen(context: ScreenContext): HTMLElement {
  return createElement('div', { className: 'screen' }, [
    button(
      texts.playBonus,
      () => {
        context.send({ type: 'playBonusWord' });
      },
      { disabled: !context.enabled },
    ),
    button(
      texts.finish,
      () => {
        context.send({ type: 'finishSuperPartie' });
      },
      { className: 'secondary-button', disabled: !context.enabled },
    ),
  ]);
}

function gameOverScreen(context: ScreenContext): HTMLElement {
  const game = context.view.game;
  const ranking =
    game.phase === 'gameOver'
      ? game.ranking.map((team, rank) =>
          createElement('li', {
            className: `team-${String(team)}`,
            text: `${String(rank + 1)}. ${texts.score(game.teams[team]?.name ?? '', game.teams[team]?.score ?? 0)}`,
          }),
        )
      : [];
  const newGame = (): void => {
    context.send({ type: 'newGame' });
  };
  return createElement('div', { className: 'screen' }, [
    createElement('ol', { className: 'ranking-list' }, ranking),
    masterOrWait(context, texts.newGame, newGame, texts.waitNewGame),
  ]);
}

/** First tap asks, second tap sends: abandoning cannot be undone. */
function abandonButtons(context: ScreenContext): HTMLElement[] {
  if (!context.role.canManage) return [];
  if (context.confirming !== 'abandonGame') {
    return [
      button(
        texts.abandon,
        () => {
          context.askConfirmation('abandonGame');
        },
        { className: 'link-button', disabled: !context.manageEnabled },
      ),
    ];
  }
  return [
    button(
      texts.confirmAbandon,
      () => {
        context.send({ type: 'abandonGame' });
      },
      { className: 'danger-button', disabled: !context.manageEnabled },
    ),
    button(
      texts.cancel,
      () => {
        context.askConfirmation(null);
      },
      { className: 'secondary-button' },
    ),
  ];
}

/** Only with `&test` in the address: force the secret word or the next ball. */
function testPanel(context: ScreenContext): HTMLElement[] {
  const { setup } = context;
  if (!setup.testMode || !context.role.canManage) return [];
  const secret = createElement('input', { className: 'text-input' });
  secret.placeholder = texts.test.secret;
  secret.value = setup.forcedSecret;
  secret.addEventListener('input', () => {
    setup.forcedSecret = secret.value;
  });
  const ball = createElement('input', { className: 'text-input' });
  ball.type = 'number';
  ball.placeholder = texts.test.ball;
  ball.value = setup.forcedBall;
  ball.addEventListener('input', () => {
    setup.forcedBall = ball.value;
  });
  const disabled = !context.manageEnabled;
  return [
    createElement('div', { className: 'test-panel' }, [
      createElement('p', { className: 'label', text: texts.test.title }),
      secret,
      button(
        texts.test.forceSecret,
        () => {
          context.send({ type: 'forceSecret', word: setup.forcedSecret });
        },
        { className: 'secondary-button', disabled },
      ),
      ball,
      button(
        texts.test.forceBall,
        () => {
          const value = Number(setup.forcedBall);
          if (Number.isInteger(value) && value > 0)
            context.send({ type: 'forceBall', ball: { kind: 'number', value } });
        },
        { className: 'secondary-button', disabled },
      ),
      button(
        texts.test.blackBall,
        () => {
          context.send({ type: 'forceBall', ball: { kind: 'black' } });
        },
        { className: 'secondary-button', disabled },
      ),
    ]),
  ];
}

/** With one phone per team: whose turn it is, when it is not this phone's. */
function turnNotice(context: ScreenContext): HTMLElement[] {
  const { role } = context;
  if (role.waitingFor === null) return [];
  const name = teamName(context, role.waitingFor);
  return [
    headline(texts.notYourTurn(name)),
    ...(role.canStandIn
      ? [
          button(texts.standIn(name), context.standIn, {
            className: 'secondary-button',
            disabled: !context.ready,
          }),
        ]
      : []),
  ];
}

function turnContent(screen: PhoneScreen, context: ScreenContext): HTMLElement {
  switch (screen.kind) {
    case 'setup':
      return setupScreen(context);
    case 'watching':
      return note(texts.watchTv);
    case 'guessing':
      return guessingScreen(context, screen.superPartie);
    case 'drawing':
      return button(
        texts.drawBall(screen.ball),
        () => {
          context.send({ type: 'drawBall' });
        },
        { disabled: !context.enabled },
      );
    case 'wordOver':
      return wordOverScreen(context, screen.isLastWord);
    case 'tieBreakWon':
      return masterOrWait(
        context,
        texts.toSuperPartie,
        () => {
          context.send({ type: 'nextWord' });
        },
        texts.waitMasterNext,
      );
    case 'bonusChoice':
      return bonusChoiceScreen(context);
    case 'gameOver':
      return gameOverScreen(context);
  }
}

export function renderScreen(screen: PhoneScreen, context: ScreenContext): HTMLElement {
  if (screen.kind === 'setup') return setupScreen(context);
  if (screen.kind === 'gameOver') return gameOverScreen(context);
  return createElement('div', { className: 'screen' }, [
    ...turnNotice(context),
    turnContent(screen, context),
    ...testPanel(context),
    ...abandonButtons(context),
  ]);
}
