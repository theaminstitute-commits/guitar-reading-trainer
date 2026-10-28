/**
 * Lay a row of notes out in complete bars. Every bar on a staff with bar lines
 * must hold exactly its beats, even in an example that only shows pitches.
 * Notes run into bars in order (a chord counts once and never splits); a bar
 * that is still short is completed: a note alone in the last bar becomes a
 * whole note, otherwise rests fill the gap, each starting on a beat the way
 * a printed score would place them.
 */
import { groupEvents } from '../melody/bars';
import { beatsOf, type DurationId } from '../music/duration';

export interface Measurable {
  duration: DurationId;
  chord?: number;
  rest?: boolean;
}

/** Rests that complete a bar from `position` beats to `beats`, each on a beat boundary. */
export function restsToFill(position: number, beats = 4): DurationId[] {
  const out: DurationId[] = [];
  let pos = position;
  while (beats - pos > 1e-9) {
    const left = beats - pos;
    let d: DurationId;
    if (pos === 0 && left >= 4) d = 'w';
    else if (Math.abs(pos % 2) < 1e-9 && left >= 2) d = 'h';
    else if (Math.abs(pos % 1) < 1e-9 && left >= 1) d = 'q';
    else d = 'e';
    out.push(d);
    pos += beatsOf(d);
  }
  return out;
}

export function measure<T extends Measurable>(notes: readonly T[], makeRest: (duration: DurationId) => T, beats = 4): T[][] {
  const bars: { items: T[]; beats: number }[] = [];
  let current = { items: [] as T[], beats: 0 };
  for (const event of groupEvents(notes)) {
    const length = beatsOf(event[0]!.duration);
    if (current.beats + length > beats + 1e-9 && current.items.length > 0) {
      bars.push(current);
      current = { items: [], beats: 0 };
    }
    current.items.push(...event);
    current.beats += length;
  }
  if (current.items.length > 0) bars.push(current);

  return bars.map((bar, i) => {
    if (bar.beats >= beats - 1e-9) return bar.items;
    const last = i === bars.length - 1;
    const events = groupEvents(bar.items);
    // A note (or chord) alone in the last bar simply rings for the whole bar.
    if (last && events.length === 1 && beats === 4) return bar.items.map((n) => ({ ...n, duration: 'w' as const }));
    return [...bar.items, ...restsToFill(bar.beats, beats).map(makeRest)];
  });
}

/** Beats in a bar, counting each chord once. */
export function barLength(bar: readonly Measurable[]): number {
  return groupEvents(bar).reduce((sum, e) => sum + beatsOf(e[0]!.duration), 0);
}
