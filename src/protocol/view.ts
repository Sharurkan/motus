import * as z from 'zod/mini';
import {
  ATTEMPT_SECONDS_CHOICES,
  GRID_SIZE,
  MAX_ATTEMPTS,
  MAX_TEAM_NAME_LENGTH,
  MAX_TEAMS,
  SUPER_WORD_COUNT,
  WORD_COUNT_CHOICES,
  WORD_LENGTHS,
  type AttemptSeconds,
} from '../game/config';
import type { GameEvent } from '../game/events';
import { hintLine } from '../game/letters';
import { rankTeams } from '../game/ranking';
import type {
  GameOverState,
  GameState,
  PlayingState,
  PlayingStep,
  Settings,
  SuperPartieState,
  Team,
  TieBreakState,
  TieBreakStep,
  WordRound,
} from '../game/state';
import { superDuration, superTimeLeft } from '../game/super-partie';
import { knownLetters } from '../game/word-round';

/** Enough for one action: a few events each. */
const MAX_EVENTS = 20;
/** 6 lines, plus the single bonus attempt. */
const MAX_LINES = MAX_ATTEMPTS + 1;
const MAX_WORD_LENGTH = WORD_LENGTHS[WORD_LENGTHS.length - 1] ?? 10;
const CELLS = GRID_SIZE * GRID_SIZE;
/** 10 words, plus the bonus word. */
const MAX_SUPER_WORDS = SUPER_WORD_COUNT + 1;

const index = z.int().check(z.minimum(0));
const teamIndex = index.check(z.maximum(MAX_TEAMS - 1));
const word = z.string().check(z.regex(/^[A-Z]*$/), z.maxLength(MAX_WORD_LENGTH));
const markSchema = z.enum(['placed', 'misplaced', 'absent']);
const marks = z.array(markSchema).check(z.maxLength(MAX_WORD_LENGTH));
const refusalSchema = z.enum(['wrongLength', 'wrongFirstLetter', 'alreadyProposed', 'unknownWord']);
const attemptSeconds = ATTEMPT_SECONDS_CHOICES.filter(
  (choice): choice is Exclude<AttemptSeconds, null> => choice !== null,
);

const gameEventSchema: z.ZodMiniType<GameEvent> = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('wordStarted'),
    wordNumber: index,
    isLastWord: z.boolean(),
    team: teamIndex,
  }),
  z.object({ type: z.literal('tieBreakStarted'), teams: z.array(teamIndex) }),
  z.object({ type: z.literal('tieBreakWordStarted'), team: teamIndex }),
  z.object({ type: z.literal('superPartieStarted'), team: teamIndex, durationMs: index }),
  z.object({ type: z.literal('superWordStarted'), index, isBonus: z.boolean() }),
  z.object({ type: z.literal('attemptMade'), team: teamIndex, word, marks }),
  z.object({
    type: z.literal('proposalRefused'),
    team: teamIndex,
    // A refused word may be anything the player typed, after normalization.
    word: z.string().check(z.maxLength(30)),
    refusal: refusalSchema,
  }),
  z.object({ type: z.literal('attemptTimedOut'), team: teamIndex }),
  z.object({
    type: z.literal('handPassed'),
    team: teamIndex,
    bonusPosition: z.nullable(index),
    lastChance: z.boolean(),
  }),
  z.object({ type: z.literal('wordFound'), team: teamIndex, word, points: index }),
  z.object({ type: z.literal('wordMissed'), word }),
  z.object({ type: z.literal('ballDrawn'), team: teamIndex, value: index }),
  z.object({ type: z.literal('blackBall'), team: teamIndex }),
  z.object({ type: z.literal('motus'), team: teamIndex, points: index }),
  z.object({ type: z.literal('gridsReset') }),
  z.object({ type: z.literal('superWordFound'), word, found: index }),
  z.object({ type: z.literal('superWordMissed'), word, skipped: z.boolean() }),
  z.object({ type: z.literal('bonusWordOffered') }),
  z.object({ type: z.literal('superTimeUp') }),
  z.object({ type: z.literal('gameOver') }),
]);

const settingsSchema = z.object({
  wordLength: z.literal(WORD_LENGTHS),
  attemptSeconds: z.nullable(z.literal(attemptSeconds)),
  wordCount: z.literal(WORD_COUNT_CHOICES),
});

const teamSchema = z.object({
  name: z.string().check(z.maxLength(MAX_TEAM_NAME_LENGTH)),
  score: index,
  grid: z.object({
    numbers: z.array(index).check(z.length(CELLS)),
    covered: z.array(z.boolean()).check(z.length(CELLS)),
  }),
  /** Balls left in the urn: numbers, then black ones. */
  urnNumbers: index,
  blackBalls: index,
});

const lineSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('attempt'), word, marks }),
  z.object({
    kind: z.literal('refused'),
    word: z.string().check(z.maxLength(30)),
    refusal: refusalSchema,
  }),
  z.object({ kind: z.literal('timeUp') }),
]);

const wordViewSchema = z.object({
  length: z.literal(WORD_LENGTHS),
  /** Known letters at their place, null elsewhere: never the hidden letters. */
  hints: z
    .array(z.nullable(z.string().check(z.regex(/^[A-Z]$/))))
    .check(z.maxLength(MAX_WORD_LENGTH)),
  lines: z.array(lineSchema).check(z.maxLength(MAX_LINES)),
  /** Null until the word is revealed on the TV. */
  secret: z.nullable(word),
});

/** Time left when the state was sent: the phone counts down by itself. */
const timerSchema = z.object({ remainingMs: index, running: z.boolean() });

const inGameShape = {
  settings: settingsSchema,
  teams: z.array(teamSchema).check(z.maxLength(MAX_TEAMS)),
  activeTeam: teamIndex,
  word: wordViewSchema,
  timer: z.nullable(timerSchema),
};

const phaseViewSchema = z.discriminatedUnion('phase', [
  z.object({ phase: z.literal('setup') }),
  z.object({
    phase: z.literal('playing'),
    ...inGameShape,
    step: z.enum(['revealing', 'guessing', 'drawing', 'wordOver']),
    wordNumber: index,
    isLastWord: z.boolean(),
    lastChance: z.boolean(),
    ballsLeft: index,
  }),
  z.object({
    phase: z.literal('tieBreak'),
    ...inGameShape,
    step: z.enum(['revealing', 'guessing', 'won']),
    contenders: z.array(teamIndex).check(z.maxLength(MAX_TEAMS)),
  }),
  z.object({
    phase: z.literal('superPartie'),
    ...inGameShape,
    step: z.enum(['ready', 'guessing', 'bonusChoice']),
    wordIndex: index,
    found: index,
    results: z.array(z.object({ word, found: z.boolean() })).check(z.maxLength(MAX_SUPER_WORDS)),
  }),
  z.object({
    phase: z.literal('gameOver'),
    teams: z
      .array(z.object({ name: teamSchema.shape.name, score: index }))
      .check(z.maxLength(MAX_TEAMS)),
    ranking: z.array(teamIndex).check(z.maxLength(MAX_TEAMS)),
    result: z.nullable(
      z.object({
        finalist: teamIndex,
        found: index,
        bonus: z.enum(['notPlayed', 'found', 'missed']),
      }),
    ),
  }),
]);

export const publicViewSchema = z.object({
  game: phaseViewSchema,
  /** The TV is animating: buttons stay greyed until it is done. */
  busy: z.boolean(),
  /** What the last action did, for the phone's message. */
  events: z.array(gameEventSchema).check(z.maxLength(MAX_EVENTS)),
});

export type PublicView = z.infer<typeof publicViewSchema>;
export type PhaseView = PublicView['game'];
type InGameView = Extract<PhaseView, { word: unknown }>;
type TeamView = InGameView['teams'][number];
type WordView = InGameView['word'];
type TimerView = NonNullable<InGameView['timer']>;

export interface ViewContext {
  events: readonly GameEvent[];
  busy: boolean;
  /** The TV clock, to compute the time left. */
  now: number;
}

function teamView(team: Team): TeamView {
  return {
    name: team.name,
    score: team.score,
    grid: { numbers: team.card.grid.numbers, covered: team.card.grid.covered },
    urnNumbers: team.card.urn.numbers.length,
    blackBalls: team.card.urn.blackBalls,
  };
}

function wordView(round: WordRound, settings: Settings, revealed: boolean): WordView {
  return {
    length: settings.wordLength,
    hints: hintLine(round.secret, knownLetters(round)),
    lines: round.lines,
    secret: revealed ? round.secret : null,
  };
}

function attemptTimer(
  settings: Settings,
  step: PlayingStep | TieBreakStep,
  now: number,
): TimerView | null {
  const seconds = settings.attemptSeconds;
  if (seconds === null) return null;
  const durationMs = seconds * 1000;
  switch (step.kind) {
    case 'revealing':
      return { remainingMs: durationMs, running: false };
    case 'guessing':
      return { remainingMs: Math.max(0, durationMs - (now - step.startedAt)), running: true };
    default:
      return null;
  }
}

function playingView(state: PlayingState, now: number): PhaseView {
  const step = state.step;
  const wordOver = step.kind === 'drawing' || step.kind === 'wordOver';
  return {
    phase: 'playing',
    settings: state.settings,
    teams: state.teams.map(teamView),
    activeTeam: state.activeTeam,
    word: wordView(state.word, state.settings, wordOver),
    timer: attemptTimer(state.settings, step, now),
    step: step.kind,
    wordNumber: state.wordNumber,
    isLastWord: state.wordNumber === state.settings.wordCount,
    lastChance: state.lastChance,
    ballsLeft: step.kind === 'drawing' ? step.ballsLeft : 0,
  };
}

function tieBreakView(state: TieBreakState, now: number): PhaseView {
  return {
    phase: 'tieBreak',
    settings: state.settings,
    teams: state.teams.map(teamView),
    activeTeam: state.step.kind === 'won' ? state.step.winner : state.activeTeam,
    word: wordView(state.word, state.settings, state.step.kind === 'won'),
    timer: attemptTimer(state.settings, state.step, now),
    step: state.step.kind,
    contenders: state.contenders,
  };
}

function superPartieView(state: SuperPartieState, now: number): PhaseView {
  return {
    phase: 'superPartie',
    settings: state.settings,
    teams: state.teams.map(teamView),
    activeTeam: state.finalist,
    word: wordView(state.word, state.settings, false),
    timer: {
      remainingMs: state.startedAt === null ? superDuration(state) : superTimeLeft(state, now),
      running: state.startedAt !== null,
    },
    step: state.step.kind,
    wordIndex: state.wordIndex,
    found: state.found,
    results: state.results,
  };
}

function gameOverView(state: GameOverState): PhaseView {
  return {
    phase: 'gameOver',
    teams: state.teams.map((team) => ({ name: team.name, score: team.score })),
    ranking: rankTeams(state.teams),
    result: state.result,
  };
}

function phaseView(state: GameState, now: number): PhaseView {
  switch (state.phase) {
    case 'setup':
      return { phase: 'setup' };
    case 'playing':
      return playingView(state, now);
    case 'tieBreak':
      return tieBreakView(state, now);
    case 'superPartie':
      return superPartieView(state, now);
    case 'gameOver':
      return gameOverView(state);
  }
}

/** What every phone may know. The secret word only appears once it is revealed on the TV. */
export function toPublicView(state: GameState, context: ViewContext): PublicView {
  return {
    game: phaseView(state, context.now),
    busy: context.busy,
    events: context.events.slice(-MAX_EVENTS),
  };
}
