import { scaleDegrees } from '../music/key';
import { pitchClass, type Midi } from '../music/pitch';
import type { Melody } from './types';

/**
 * The sounding tonic to play as a tonal reference before a melody: the tonic
 * at or just below the melody's lowest note, so it anchors the key without
 * sitting above the tune.
 */
export function tonicReference(melody: Melody): Midi {
  const tonicPc = scaleDegrees(melody.key)[0]!.pitchClass;
  const lowest = Math.min(...melody.notes.map((n) => n.midi));
  let midi = lowest;
  while (pitchClass(midi) !== tonicPc) midi--;
  return midi;
}
