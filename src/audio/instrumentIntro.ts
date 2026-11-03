/**
 * A short phrase that plays when an instrument is chosen on the start screen (R42),
 * so each choice is heard as well as seen. Both are written for this app.
 * Pitches are SOUNDING MIDI numbers.
 */
import type { InstrumentId } from '../music/instrument';
import type { PlayableNote } from './player';

export interface Intro {
  notes: PlayableNote[];
  tempo: number;
}

/**
 * Guitar: a rising open-position arpeggio with the bright ring of C add9: C on the 5th string
 * (fret 3), the open G, D on the 2nd string (fret 3), the open high E, and G on the 1st string (fret 3).
 */
const GUITAR_INTRO: Intro = {
  tempo: 150,
  notes: [
    { midi: 48, duration: 'e', ring: true }, // C3
    { midi: 55, duration: 'e', ring: true }, // G3
    { midi: 62, duration: 'e', ring: true }, // D4
    { midi: 64, duration: 'e', ring: true }, // E4
    { midi: 67, duration: 'h' }, // G4
  ],
};

/** Bass: the open low E, its octave, then down the E minor pentatonic and home. */
const BASS_INTRO: Intro = {
  tempo: 132,
  notes: [
    { midi: 28, duration: 'e' }, // E1, open 4th string
    { midi: 40, duration: 'e' }, // E2, octave
    { midi: 38, duration: 'e' }, // D2
    { midi: 35, duration: 'e' }, // B1
    { midi: 33, duration: 'e' }, // A1
    { midi: 35, duration: 'e' }, // B1
    { midi: 28, duration: 'q' }, // E1
  ],
};

export function introFor(instrument: InstrumentId): Intro {
  return instrument === 'bass' ? BASS_INTRO : GUITAR_INTRO;
}
