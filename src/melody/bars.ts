import { beatsOf, type DurationId } from '../music/duration';

/**
 * Anything with a duration can be laid out into bars: target notes and answer
 * notes alike. Notes that share a `chord` id sound together: they are one
 * event, take the chord's beats once, and never split across a bar line.
 */
export interface Timed {
  duration: DurationId;
  chord?: number;
}

export interface BarLayout<T extends Timed> {
  index: number;
  notes: T[];
  beats: number;
  capacity: number;
}

/** Whether note `i` begins a new event (a single note, or the lowest note of a chord). */
export function startsEvent(notes: readonly Timed[], i: number): boolean {
  const note = notes[i]!;
  if (note.chord === undefined || i === 0) return true;
  return notes[i - 1]!.chord !== note.chord;
}

/** Beats a note adds to its bar: its duration if it starts an event, nothing if it continues a chord. */
export function beatsAdded(notes: readonly Timed[], i: number): number {
  return startsEvent(notes, i) ? beatsOf(notes[i]!.duration) : 0;
}

/** Consecutive notes grouped into events: chords as one group, single notes alone. */
export function groupEvents<T extends Timed>(notes: readonly T[]): T[][] {
  const out: T[][] = [];
  notes.forEach((n, i) => {
    if (startsEvent(notes, i)) out.push([n]);
    else out[out.length - 1]!.push(n);
  });
  return out;
}

/**
 * Split a note list into bars with the given capacities (beats per bar). An
 * event that would overflow a bar starts the next bar; past the last listed
 * capacity, bars repeat the last one. Empty bars are added up to the number
 * of capacities so every bar of the meter is present.
 */
export function splitIntoBars<T extends Timed>(notes: readonly T[], barBeats: readonly number[]): BarLayout<T>[] {
  const capacityAt = (i: number) => barBeats[Math.min(i, barBeats.length - 1)] ?? 4;
  const bars: BarLayout<T>[] = [];
  let current: BarLayout<T> = { index: 0, notes: [], beats: 0, capacity: capacityAt(0) };
  for (const event of groupEvents(notes)) {
    const beats = beatsOf(event[0]!.duration);
    if (current.beats + beats > current.capacity + 1e-9 && current.notes.length > 0) {
      bars.push(current);
      current = { index: bars.length, notes: [], beats: 0, capacity: capacityAt(bars.length) };
    }
    current.notes.push(...event);
    current.beats += beats;
  }
  bars.push(current);
  while (bars.length < barBeats.length) {
    bars.push({ index: bars.length, notes: [], beats: 0, capacity: capacityAt(bars.length) });
  }
  return bars;
}

/** The event (single note or whole chord) that contains note `index`. */
export function eventAt<T extends Timed>(notes: readonly T[], index: number): T[] {
  let start = 0;
  for (const event of groupEvents(notes)) {
    if (index < start + event.length) return event;
    start += event.length;
  }
  return [];
}

export function totalBeats(notes: readonly Timed[]): number {
  return notes.reduce((sum, _, i) => sum + beatsAdded(notes, i), 0);
}
