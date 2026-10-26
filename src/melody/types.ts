import type { DurationId } from '../music/duration';
import type { Key } from '../music/key';
import type { Midi, SpelledNote } from '../music/pitch';

/**
 * One note of a target melody. `midi` is the SOUNDING pitch. `string`/`fret`
 * is the position chosen for display; the same pitch could be played elsewhere.
 */
export interface MelodyNote {
  midi: Midi;
  duration: DurationId;
  string: number;
  fret: number;
  /** Notes with the same id sound together as one chord, share its duration, and are listed low to high. */
  chord?: number;
  /** The WRITTEN spelling (an octave above sounding) when it follows the chord's root rather than the key. */
  spelled?: SpelledNote;
}

export interface Melody {
  seed: number;
  levelId: string;
  /** The key this melody is written in, chosen from the level's keys. */
  key: Key;
  tempo: number;
  /** Beats in each bar, e.g. [4, 5] for a bar of 4/4 then a bar of 5/4 (see melody/meter). */
  barBeats: number[];
  /** Time signature of the first bar; the count-in is one bar of it. */
  timeSignature: readonly [number, number];
  /** Number of bars (barBeats.length). */
  bars: number;
  /** Total beats. */
  counts: number;
  notes: MelodyNote[];
}
