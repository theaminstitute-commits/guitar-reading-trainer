/**
 * Fretboard geometry: which sounding pitch lives at each string/fret.
 * Strings are numbered the guitarist's way: 1 = high E, 6 = low E.
 */
import type { Midi } from './pitch';

export interface FretPosition {
  string: number;
  fret: number;
}

/** Sounding MIDI pitch of each open string, index 1..6 (index 0 unused). */
export const STANDARD_TUNING: readonly Midi[] = [NaN, 64, 59, 55, 50, 45, 40];

export function midiAt(position: FretPosition, tuning: readonly Midi[] = STANDARD_TUNING): Midi {
  const open = tuning[position.string];
  if (open === undefined || Number.isNaN(open)) throw new Error(`No string ${position.string}`);
  return open + position.fret;
}

/** Every position on the given strings and fret range that produces the pitch. */
export function positionsFor(
  midi: Midi,
  strings: readonly number[],
  fretRange: readonly [number, number],
  tuning: readonly Midi[] = STANDARD_TUNING,
): FretPosition[] {
  const [low, high] = fretRange;
  const out: FretPosition[] = [];
  for (const string of strings) {
    const fret = midi - tuning[string]!;
    if (fret >= low && fret <= high) out.push({ string, fret });
  }
  return out;
}
