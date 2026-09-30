import { beatsOf, beatsPerBar, type DurationId } from '../music/duration';

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
 * Split a note list into bars by accumulating beats. A note that would overflow
 * a bar starts the next bar (this can only happen for invalid input; the
 * generator and the staff input both prevent it).
 */
export function splitIntoBars<T extends Timed>(
  notes: readonly T[],
  timeSignature: readonly [number, number],
  minBars = 0,
): BarLayout<T>[] {
  const capacity = beatsPerBar(timeSignature);
  const bars: BarLayout<T>[] = [];
  let current: BarLayout<T> = { index: 0, notes: [], beats: 0, capacity };
  for (const note of notes) {
    const beats = beatsOf(note.duration);
    if (current.beats + beats > capacity + 1e-9 && current.notes.length > 0) {
      bars.push(current);
      current = { index: bars.length, notes: [], beats: 0, capacity };
    }
    current.notes.push(note);
    current.beats += beats;
  }
  bars.push(current);
  while (bars.length < minBars) {
    bars.push({ index: bars.length, notes: [], beats: 0, capacity });
  }
  return bars;
}

export function totalBeats(notes: readonly Timed[]): number {
  return notes.reduce((sum, n) => sum + beatsOf(n.duration), 0);
}
