/**
 * The learner's answer: notes placed on the staff, bar by bar.
 *
 * Notes are stored by WRITTEN staff position (see `staffStep` in music/pitch)
 * plus the sign drawn in front of them, exactly as on the page. What pitch a
 * note means depends on the key signature and the signs earlier in its bar;
 * `resolveAnswerBar` works that out with the rules in notation/accidentals.
 * Notes that share a `chord` id are stacked: one chord, one length, listed
 * from the lowest note up.
 */
import { totalBeats } from '../melody/bars';
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
  /** Notes with the same id form one chord. */
  chord?: number;
}

export interface AnswerState {
  bars: AnswerNote[][];
  /** Previous `bars` snapshots for undo, oldest first. */
  history: AnswerNote[][][];
  nextId: number;
  nextChord: number;
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
  /** Stack a note on the chord of note `id` (making a chord of it if it is single), at a staff step. */
  | { type: 'stack'; id: number; step: number }
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
  return { bars: Array.from({ length: barCount }, () => []), history: [], nextId: 1, nextChord: 1 };
}

/** Beats a bar holds so far; a chord counts once. */
export function barBeats(bar: readonly AnswerNote[]): number {
  return totalBeats(bar);
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

/** The notes that sound with a note: its chord, or just itself. */
export function chordMates(bar: readonly AnswerNote[], note: AnswerNote): AnswerNote[] {
  return note.chord === undefined ? [note] : bar.filter((n) => n.chord === note.chord);
}

/** Why an existing note (and its chord) cannot take a new duration, or null if it can. */
export function durationRejection(
  bar: readonly AnswerNote[],
  note: AnswerNote,
  duration: DurationId,
  capacity: number,
): 'does-not-fit' | null {
  const mates = chordMates(bar, note);
  const others = totalBeats(bar.filter((n) => !mates.includes(n)));
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

function withBars(state: AnswerState, bars: AnswerNote[][], nextId = state.nextId, nextChord = state.nextChord): AnswerState {
  return { bars, history: [...state.history, state.bars], nextId, nextChord };
}

function replaceNote(state: AnswerState, id: number, update: (n: AnswerNote) => AnswerNote): AnswerState {
  const found = findNote(state, id);
  if (!found) return state;
  const bars = state.bars.map((bar, b) => (b === found.bar ? bar.map((n) => (n.id === id ? update(n) : n)) : bar));
  return withBars(state, bars);
}

/** The chord's notes in ascending order at the place of its first note; a chord of one note becomes a single note. */
function tidyChord(bar: readonly AnswerNote[], chordId: number): AnswerNote[] {
  const first = bar.findIndex((n) => n.chord === chordId);
  if (first === -1) return [...bar];
  const members = bar.filter((n) => n.chord === chordId).sort((a, b) => a.step - b.step);
  const rest = bar.filter((n) => n.chord !== chordId);
  const placed = members.length === 1 ? members.map((n) => ({ ...n, chord: undefined })) : members;
  return [...rest.slice(0, first), ...placed, ...rest.slice(first)];
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
    case 'stack': {
      const found = findNote(state, action.id);
      if (!found) return state;
      if (action.step < limits.minStep || action.step > limits.maxStep) return state;
      const bar = state.bars[found.bar]!;
      const chordId = found.note.chord ?? state.nextChord;
      if (chordMates(bar, found.note).some((n) => n.step === action.step)) return state;
      const note: AnswerNote = { id: state.nextId, step: action.step, sign: 'none', duration: found.note.duration, chord: chordId };
      const joined = bar.map((n) => (n.id === action.id ? { ...n, chord: chordId } : n));
      const tidy = tidyChord([...joined, note], chordId);
      const bars = state.bars.map((b, i) => (i === found.bar ? tidy : b));
      return withBars(state, bars, state.nextId + 1, found.note.chord === undefined ? state.nextChord + 1 : state.nextChord);
    }
    case 'setSign':
      return replaceNote(state, action.id, (n) => ({ ...n, sign: n.sign === action.sign ? 'none' : action.sign }));
    case 'nudge': {
      const found = findNote(state, action.id);
      if (!found) return state;
      const step = found.note.step + action.delta;
      if (step < limits.minStep || step > limits.maxStep) return state;
      const bar = state.bars[found.bar]!;
      if (found.note.chord !== undefined && chordMates(bar, found.note).some((n) => n.id !== action.id && n.step === step)) return state;
      const moved = bar.map((n) => (n.id === action.id ? { ...n, step } : n));
      const tidy = found.note.chord === undefined ? moved : tidyChord(moved, found.note.chord);
      return withBars(state, state.bars.map((b, i) => (i === found.bar ? tidy : b)));
    }
    case 'setDuration': {
      const found = findNote(state, action.id);
      if (!found) return state;
      if (found.note.duration === action.duration) return state;
      const bar = state.bars[found.bar]!;
      if (durationRejection(bar, found.note, action.duration, capacityOf(limits, found.bar))) return state;
      const mates = chordMates(bar, found.note);
      const bars = state.bars.map((b, i) => (i === found.bar ? b.map((n) => (mates.includes(n) ? { ...n, duration: action.duration } : n)) : b));
      return withBars(state, bars);
    }
    case 'delete': {
      const found = findNote(state, action.id);
      if (!found) return state;
      const bar = state.bars[found.bar]!.filter((n) => n.id !== action.id);
      const tidy = found.note.chord === undefined ? bar : tidyChord(bar, found.note.chord);
      return withBars(state, state.bars.map((b, i) => (i === found.bar ? tidy : b)));
    }
    case 'undo': {
      if (state.history.length === 0) return state;
      const bars = state.history[state.history.length - 1]!;
      return { bars, history: state.history.slice(0, -1), nextId: state.nextId, nextChord: state.nextChord };
    }
    case 'clear': {
      if (state.bars.every((b) => b.length === 0)) return state;
      return withBars(
        state,
        state.bars.map(() => []),
      );
    }
    case 'reset':
      return { ...createAnswer(action.bars ?? state.bars.length), nextId: state.nextId, nextChord: state.nextChord };
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
