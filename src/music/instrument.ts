/**
 * The two instruments the app teaches (R41): six-string guitar on the treble
 * staff, and four-string bass on the bass staff. Both are written one octave
 * above where they sound, so `writtenFromSounding` serves both; what differs is
 * the clef, the strings and their tuning, and the range of the staff in use.
 * Strings are numbered the player's way on both: 1 is the thinnest (highest).
 */
import type { Midi } from './pitch';
import { parseSpelled, staffStep } from './pitch';

export type InstrumentId = 'guitar' | 'bass';
export type Clef = 'treble' | 'bass';

export interface Instrument {
  id: InstrumentId;
  /** For buttons and headings: "Guitar", "Bass". */
  name: string;
  /** In running text: "guitar", "bass". */
  noun: string;
  clef: Clef;
  /** Sounding MIDI pitch of each open string, index 1..n (index 0 unused). */
  tuning: readonly Midi[];
  /** Letter of each open string, 1st (thinnest) first. */
  stringNames: readonly string[];
  /** Staff steps (see `staffStep`) of the bottom and top lines of the staff. */
  bottomLine: number;
  topLine: number;
  /** The written range a tap on the staff may reach: the lowest and highest notes the neck plays up to fret 12. */
  inputRange: readonly [number, number];
  /** VexFlow keys for rests: a whole rest hangs from the fourth line, the others sit on the middle line. */
  restKeys: { whole: string; other: string };
}

const step = (name: string) => staffStep(parseSpelled(name));

export const GUITAR: Instrument = {
  id: 'guitar',
  name: 'Guitar',
  noun: 'guitar',
  clef: 'treble',
  tuning: [NaN, 64, 59, 55, 50, 45, 40],
  stringNames: ['E', 'B', 'G', 'D', 'A', 'E'],
  bottomLine: step('E4'),
  topLine: step('F5'),
  inputRange: [step('E3'), step('E6')],
  restKeys: { whole: 'd/5', other: 'b/4' },
};

/** Four-string bass in standard tuning, E1 A1 D2 G2 sounding, written E2 A2 D3 G3 on the bass staff. */
export const BASS: Instrument = {
  id: 'bass',
  name: 'Bass',
  noun: 'bass',
  clef: 'bass',
  tuning: [NaN, 43, 38, 33, 28],
  stringNames: ['G', 'D', 'A', 'E'],
  bottomLine: step('G2'),
  topLine: step('A3'),
  inputRange: [step('E2'), step('G4')],
  restKeys: { whole: 'f/3', other: 'd/3' },
};

export const INSTRUMENTS: readonly Instrument[] = [GUITAR, BASS];

export function instrumentOf(id: InstrumentId | undefined): Instrument {
  return id === 'bass' ? BASS : GUITAR;
}

export function isInstrumentId(value: unknown): value is InstrumentId {
  return value === 'guitar' || value === 'bass';
}

/** The middle line of the staff: B4 on the treble staff, D3 on the bass staff. */
export function middleLine(instrument: Instrument): number {
  return instrument.bottomLine + 4;
}

/** All strings of an instrument, 1 to n. */
export function allStrings(instrument: Instrument): number[] {
  return instrument.stringNames.map((_, i) => i + 1);
}
