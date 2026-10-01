/**
 * The learner's answer: notes placed on the staff, bar by bar.
 *
 * Notes are stored by WRITTEN staff position (see `staffStep` in music/pitch)
 * plus the sign drawn in front of them, exactly as on the page. What pitch a
 * note means depends on the key signature and the signs earlier in its bar;
 * `resolveAnswerBar` works that out with the rules in notation/accidentals.
 */
import { beatsOf, type DurationId } from '../music/duration';
import type { Key } from '../music/key';
import { midiFromSpelled, soundingFromWritten, spelledFromStaffStep, type Midi, type SpelledNote } from '../music/pitch';
import { resolveBar, type Sign } from './accidentals';

export interface AnswerNote {
  id: number;
  /** Written staff step (C4 = 28, F5 = 38). */
  step: number;
  /** The sign drawn in front of the note, if any. */
  sign: Sign;
  duration: DurationId;
}

export interface AnswerState {
  bars: AnswerNote[][];
  /** Previous `bars` snapshots for undo, oldest first. */
  history: AnswerNote[][][];
  nextId: number;
}

export interface AnswerLimits {
  /** Beats each bar holds, e.g. [4, 4, 1] for 4/4 + 4/4 + 1/4. */
  barBeats: readonly number[];
  /** Lowest and highest staff steps a note may sit on. */
  minStep: number;
  maxStep: number;
}

export type AnswerAction =
  | { type: 'add'; bar: number; step: number; duration: DurationId }
  /** Draw a sign in front of a note; the same sign again removes it. */
  | { type: 'setSign'; id: number; sign: Exclude<Sign, 'none'> }
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

/** Beats still free in a bar that holds `capacity` beats. */
export function barRemaining(bar: readonly AnswerNote[], capacity: number): number {
  return capacity - barBeats(bar);
}

export function isBarFull(bar: readonly AnswerNote[], capacity: number): boolean {
  return barRemaining(bar, capacity) <= 1e-9;
}

/** Why a note cannot be added, or null if it can. */
export function addRejection(
  bar: readonly AnswerNote[],
  duration: DurationId,
  capacity: number,
): 'bar-full' | 'does-not-fit' | null {
  const remaining = barRemaining(bar, capacity);
  if (remaining <= 1e-9) return 'bar-full';
  if (beatsOf(duration) > remaining + 1e-9) return 'does-not-fit';
  return null;
}

/** Why an existing note cannot take a new duration, or null if it can. */
export function durationRejection(
  bar: readonly AnswerNote[],
  note: AnswerNote,
  duration: DurationId,
  capacity: number,
): 'does-not-fit' | null {
  const others = barBeats(bar) - beatsOf(note.duration);
  return others + beatsOf(duration) > capacity + 1e-9 ? 'does-not-fit' : null;
}

/** Beats a bar may hold; bars past the list repeat the last capacity. */
export function capacityOf(limits: AnswerLimits, bar: number): number {
  return limits.barBeats[Math.min(bar, limits.barBeats.length - 1)] ?? 4;
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
      if (addRejection(bar, action.duration, capacityOf(limits, action.bar))) return state;
      if (action.step < limits.minStep || action.step > limits.maxStep) return state;
      const note: AnswerNote = { id: state.nextId, step: action.step, sign: 'none', duration: action.duration };
      const bars = state.bars.map((b, i) => (i === action.bar ? [...b, note] : b));
      return withBars(state, bars, state.nextId + 1);
    }
    case 'setSign':
      return replaceNote(state, action.id, (n) => ({ ...n, sign: n.sign === action.sign ? 'none' : action.sign }));
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
      if (durationRejection(state.bars[found.bar]!, found.note, action.duration, capacityOf(limits, found.bar))) return state;
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

/** The written pitches a bar of answer notes means, under the key signature and bar rules. */
export function resolveAnswerBar(bar: readonly AnswerNote[], key: Key): SpelledNote[] {
  const written = bar.map((n) => {
    const s = spelledFromStaffStep(n.step);
    return { letter: s.letter, octave: s.octave, sign: n.sign };
  });
  const accidentals = resolveBar(written, key);
  return written.map((w, i) => ({ letter: w.letter, octave: w.octave, accidental: accidentals[i]! }));
}

/** Sounding MIDI of each note in a bar (guitar sounds an octave below the page). */
export function answerBarToSounding(bar: readonly AnswerNote[], key: Key): Midi[] {
  return resolveAnswerBar(bar, key).map((s) => soundingFromWritten(midiFromSpelled(s)));
}
