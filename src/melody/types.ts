import type { DurationId } from '../music/duration';
import type { Midi } from '../music/pitch';

/**
 * One note of a target melody. `midi` is the SOUNDING pitch. `string`/`fret`
 * is the position chosen for display; the same pitch could be played elsewhere.
 */
export interface MelodyNote {
  midi: Midi;
  duration: DurationId;
  string: number;
  fret: number;
}

export interface Melody {
  seed: number;
  levelId: string;
  tempo: number;
  timeSignature: readonly [number, number];
  bars: number;
  notes: MelodyNote[];
}
