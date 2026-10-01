import { beatsOf, type DurationId } from '../music/duration';

/** Anything with a duration can be laid out into bars: target notes and answer notes alike. */
export interface Timed {
  duration: DurationId;
}

export interface BarLayout<T extends Timed> {
  index: number;
  notes: T[];
  beats: number;
  capacity: number;
}

/**
 * Split a note list into bars with the given capacities (beats per bar). A
 * note that would overflow a bar starts the next bar; past the last listed
 * capacity, bars repeat the last one. Empty bars are added up to the number
 * of capacities so every bar of the meter is present.
 */
export function splitIntoBars<T extends Timed>(notes: readonly T[], barBeats: readonly number[]): BarLayout<T>[] {
  const capacityAt = (i: number) => barBeats[Math.min(i, barBeats.length - 1)] ?? 4;
  const bars: BarLayout<T>[] = [];
  let current: BarLayout<T> = { index: 0, notes: [], beats: 0, capacity: capacityAt(0) };
  for (const note of notes) {
    const beats = beatsOf(note.duration);
    if (current.beats + beats > current.capacity + 1e-9 && current.notes.length > 0) {
      bars.push(current);
      current = { index: bars.length, notes: [], beats: 0, capacity: capacityAt(bars.length) };
    }
    current.notes.push(note);
    current.beats += beats;
  }
  bars.push(current);
  while (bars.length < barBeats.length) {
    bars.push({ index: bars.length, notes: [], beats: 0, capacity: capacityAt(bars.length) });
  }
  return bars;
}

export function totalBeats(notes: readonly Timed[]): number {
  return notes.reduce((sum, n) => sum + beatsOf(n.duration), 0);
}
