/**
 * The learner's answer: notes placed on the staff, bar by bar.
 *
 * Notes are stored by WRITTEN staff position (see `staffStep` in music/pitch),
 * because that is what the learner sees and taps. Converting to sounding pitch
 * for playback or grading goes through `answerNoteToSounding`.
 */
import { beatsOf, beatsPerBar, type DurationId } from '../music/duration';
import { midiFromSpelled, soundingFromWritten, spelledFromStaffStep, type Midi, type SpelledNote } from '../music/pitch';

export type InputAccidental = -1 | 0 | 1;

export interface AnswerNote {
  id: number;
  /** Written staff step (C4 = 28, F5 = 38). */
  step: number;
  accidental: InputAccidental;
  /** Draw an explicit natural sign (the learner tapped ♮). */
  showNatural: boolean;
  duration: DurationId;
}

export interface AnswerState {
  bars: AnswerNote[][];
  /** Previous `bars` snapshots for undo, oldest first. */
  history: AnswerNote[][][];
  nextId: number;
}

export interface AnswerLimits {
  timeSignature: readonly [number, number];
  /** Lowest and highest staff steps a note may sit on. */
  minStep: number;
  maxStep: number;
}

export type AnswerAction =
  | { type: 'add'; bar: number; step: number; duration: DurationId }
  | { type: 'setAccidental'; id: number; accidental: InputAccidental }
  | { type: 'nudge'; id: number; delta: number }
  | { type: 'setDuration'; id: number; duration: DurationId }
  | { type: 'delete'; id: number }
  | { type: 'undo' }
  | { type: 'clear' }
  /** Start a fresh answer with no undo history (new exercise), optionally with a new bar count. */
  | { type: 'reset'; bars?: number };

export function createAnswer(barCount: number): AnswerState {
  return { bars: Array.from({ length: barCount }, () => []), history: [], nextId: 1 };
}

export function barBeats(bar: readonly AnswerNote[]): number {
  return bar.reduce((sum, n) => sum + beatsOf(n.duration), 0);
}

export function barRemaining(bar: readonly AnswerNote[], timeSignature: readonly [number, number]): number {
  return beatsPerBar(timeSignature) - barBeats(bar);
}

export function isBarFull(bar: readonly AnswerNote[], timeSignature: readonly [number, number]): boolean {
  return barRemaining(bar, timeSignature) <= 1e-9;
}

/** Why a note cannot be added, or null if it can. */
export function addRejection(
  bar: readonly AnswerNote[],
  duration: DurationId,
  timeSignature: readonly [number, number],
): 'bar-full' | 'does-not-fit' | null {
  const remaining = barRemaining(bar, timeSignature);
  if (remaining <= 1e-9) return 'bar-full';
  if (beatsOf(duration) > remaining + 1e-9) return 'does-not-fit';
  return null;
}

/** Why an existing note cannot take a new duration, or null if it can. */
export function durationRejection(
  bar: readonly AnswerNote[],
  note: AnswerNote,
  duration: DurationId,
  timeSignature: readonly [number, number],
): 'does-not-fit' | null {
  const others = barBeats(bar) - beatsOf(note.duration);
  return others + beatsOf(duration) > beatsPerBar(timeSignature) + 1e-9 ? 'does-not-fit' : null;
}

export function findNote(state: AnswerState, id: number): { bar: number; index: number; note: AnswerNote } | null {
  for (let bar = 0; bar < state.bars.length; bar++) {
    const index = state.bars[bar]!.findIndex((n) => n.id === id);
    if (index !== -1) return { bar, index, note: state.bars[bar]![index]! };
  }
  return null;
}

function withBars(state: AnswerState, bars: AnswerNote[][], nextId = state.nextId): AnswerState {
  return { bars, history: [...state.history, state.bars], nextId };
}

function replaceNote(state: AnswerState, id: number, update: (n: AnswerNote) => AnswerNote): AnswerState {
  const found = findNote(state, id);
  if (!found) return state;
  const bars = state.bars.map((bar, b) => (b === found.bar ? bar.map((n) => (n.id === id ? update(n) : n)) : bar));
  return withBars(state, bars);
}

/** Returns the same state object when an action is rejected, so callers can detect it. */
export function answerReducer(state: AnswerState, action: AnswerAction, limits: AnswerLimits): AnswerState {
  switch (action.type) {
    case 'add': {
      const bar = state.bars[action.bar];
      if (!bar) return state;
      if (addRejection(bar, action.duration, limits.timeSignature)) return state;
      if (action.step < limits.minStep || action.step > limits.maxStep) return state;
      const note: AnswerNote = {
        id: state.nextId,
        step: action.step,
        accidental: 0,
        showNatural: false,
        duration: action.duration,
      };
      const bars = state.bars.map((b, i) => (i === action.bar ? [...b, note] : b));
      return withBars(state, bars, state.nextId + 1);
    }
    case 'setAccidental':
      return replaceNote(state, action.id, (n) => ({
        ...n,
        accidental: action.accidental,
        // Tapping ♮ on a plain note shows the sign; tapping ♯/♭ hides it.
        showNatural: action.accidental === 0 ? !(n.accidental === 0 && n.showNatural) : false,
      }));
    case 'nudge': {
      const found = findNote(state, action.id);
      if (!found) return state;
      const step = found.note.step + action.delta;
      if (step < limits.minStep || step > limits.maxStep) return state;
      return replaceNote(state, action.id, (n) => ({ ...n, step }));
    }
    case 'setDuration': {
      const found = findNote(state, action.id);
      if (!found) return state;
      if (found.note.duration === action.duration) return state;
      if (durationRejection(state.bars[found.bar]!, found.note, action.duration, limits.timeSignature)) return state;
      return replaceNote(state, action.id, (n) => ({ ...n, duration: action.duration }));
    }
    case 'delete': {
      const found = findNote(state, action.id);
      if (!found) return state;
      const bars = state.bars.map((bar, b) => (b === found.bar ? bar.filter((n) => n.id !== action.id) : bar));
      return withBars(state, bars);
    }
    case 'undo': {
      if (state.history.length === 0) return state;
      const bars = state.history[state.history.length - 1]!;
      return { bars, history: state.history.slice(0, -1), nextId: state.nextId };
    }
    case 'clear': {
      if (state.bars.every((b) => b.length === 0)) return state;
      return withBars(
        state,
        state.bars.map(() => []),
      );
    }
    case 'reset':
      return { ...createAnswer(action.bars ?? state.bars.length), nextId: state.nextId };
  }
}

export function flattenAnswer(state: AnswerState): AnswerNote[] {
  return state.bars.flat();
}

export function noteCount(state: AnswerState): number {
  return state.bars.reduce((n, b) => n + b.length, 0);
}

/** The written pitch the learner wrote. */
export function answerNoteToSpelled(note: AnswerNote): SpelledNote {
  return spelledFromStaffStep(note.step, note.accidental);
}

/** Sounding MIDI of what the learner wrote (guitar sounds an octave below the page). */
export function answerNoteToSounding(note: AnswerNote): Midi {
  return soundingFromWritten(midiFromSpelled(answerNoteToSpelled(note)));
}
