/**
 * Keys and key-aware spelling.
 *
 * v1 only uses C major, but the spelling logic is written for any major key so
 * later levels are a config change, not a rewrite.
 */
import {
  LETTERS,
  LETTER_PITCH_CLASS,
  letterStep,
  octaveOf,
  pitchClass,
  type Accidental,
  type Letter,
  type Midi,
  type SpelledNote,
} from './pitch';

export interface Key {
  tonic: Letter;
  tonicAccidental: Accidental;
  mode: 'major';
}

export const C_MAJOR: Key = { tonic: 'C', tonicAccidental: 0, mode: 'major' };

/** Letter + accidental without an octave: one degree of a scale. */
export interface ScaleDegree {
  letter: Letter;
  accidental: Accidental;
  pitchClass: number;
}

const MAJOR_STEPS = [2, 2, 1, 2, 2, 2, 1];

/**
 * The seven spelled degrees of a major scale, each on the next letter, with the
 * accidental needed to make the interval pattern W W H W W W H.
 */
export function scaleDegrees(key: Key): ScaleDegree[] {
  const degrees: ScaleDegree[] = [];
  let letter = key.tonic;
  let pc = pitchClass(LETTER_PITCH_CLASS[key.tonic] + key.tonicAccidental);
  for (let i = 0; i < 7; i++) {
    const natural = LETTER_PITCH_CLASS[letter];
    let accidental = pc - natural;
    if (accidental > 6) accidental -= 12;
    if (accidental < -6) accidental += 12;
    degrees.push({ letter, accidental: accidental as Accidental, pitchClass: pc });
    letter = letterStep(letter, 1);
    pc = pitchClass(pc + MAJOR_STEPS[i]!);
  }
  return degrees;
}

export function isDiatonic(midi: Midi, key: Key): boolean {
  const pc = pitchClass(midi);
  return scaleDegrees(key).some((d) => d.pitchClass === pc);
}

/** Number of sharps (positive) or flats (negative) in the key signature. */
export function keySignatureCount(key: Key): number {
  return scaleDegrees(key).reduce((sum, d) => sum + d.accidental, 0);
}

/** Pitch classes of the tonic triad (degrees 1, 3, 5). */
export function chordTonePitchClasses(key: Key): number[] {
  const degrees = scaleDegrees(key);
  return [degrees[0]!, degrees[2]!, degrees[4]!].map((d) => d.pitchClass);
}

/** 1-based scale degree of a pitch, or null if it is not in the key. */
export function degreeOf(midi: Midi, key: Key): number | null {
  const pc = pitchClass(midi);
  const index = scaleDegrees(key).findIndex((d) => d.pitchClass === pc);
  return index === -1 ? null : index + 1;
}

/**
 * Spell a MIDI pitch the way a musician reading in this key would write it.
 * Diatonic notes use the key's own spelling. Chromatic notes are spelled as a
 * raised lower neighbour in sharp keys (and C major), or a lowered upper
 * neighbour in flat keys. The octave follows the letter (B#3 sounds as C4).
 */
export function spellInKey(midi: Midi, key: Key): SpelledNote {
  const pc = pitchClass(midi);
  const degrees = scaleDegrees(key);
  let degree = degrees.find((d) => d.pitchClass === pc);
  if (!degree) {
    // A chromatic note that is simply the natural of a letter the key signature
    // alters is written with a natural sign (F natural in G major, B natural in
    // F major), never as an enharmonic of another letter.
    const cancelled = degrees.find((d) => d.accidental !== 0 && LETTER_PITCH_CLASS[d.letter] === pc);
    if (cancelled) {
      degree = { letter: cancelled.letter, accidental: 0, pitchClass: pc };
    } else {
      const useSharps = keySignatureCount(key) >= 0;
      const neighbourPc = pitchClass(useSharps ? pc - 1 : pc + 1);
      const neighbour = degrees.find((d) => d.pitchClass === neighbourPc)!;
      const accidental = (neighbour.accidental + (useSharps ? 1 : -1)) as Accidental;
      degree = { letter: neighbour.letter, accidental, pitchClass: pc };
    }
  }
  // The octave belongs to the letter, so take the octave of the natural note the
  // accidental is applied to (B#3 = 60, Cb4 = 59).
  const octave = octaveOf(midi - degree.accidental);
  return { letter: degree.letter, accidental: degree.accidental, octave };
}

/** All letters, for iteration in UI palettes. */
export const ALL_LETTERS = LETTERS;

/**
 * The fifteen major keys of the circle of fifths: C, then the sharp keys
 * clockwise, then the flat keys counter-clockwise. B/Cb, F#/Gb and C#/Db are
 * enharmonic equivalents and all appear.
 */
export const MAJOR_KEYS: readonly Key[] = [
  { tonic: 'C', tonicAccidental: 0, mode: 'major' },
  { tonic: 'G', tonicAccidental: 0, mode: 'major' },
  { tonic: 'D', tonicAccidental: 0, mode: 'major' },
  { tonic: 'A', tonicAccidental: 0, mode: 'major' },
  { tonic: 'E', tonicAccidental: 0, mode: 'major' },
  { tonic: 'B', tonicAccidental: 0, mode: 'major' },
  { tonic: 'F', tonicAccidental: 1, mode: 'major' },
  { tonic: 'C', tonicAccidental: 1, mode: 'major' },
  { tonic: 'F', tonicAccidental: 0, mode: 'major' },
  { tonic: 'B', tonicAccidental: -1, mode: 'major' },
  { tonic: 'E', tonicAccidental: -1, mode: 'major' },
  { tonic: 'A', tonicAccidental: -1, mode: 'major' },
  { tonic: 'D', tonicAccidental: -1, mode: 'major' },
  { tonic: 'G', tonicAccidental: -1, mode: 'major' },
  { tonic: 'C', tonicAccidental: -1, mode: 'major' },
];

/** Short id such as "Bb" or "F#", also the VexFlow key signature spec. */
export function keyId(key: Key): string {
  return `${key.tonic}${{ [-2]: 'bb', [-1]: 'b', 0: '', 1: '#', 2: '##' }[key.tonicAccidental]}`;
}

/** Display name such as "B♭ major". */
export function keyName(key: Key): string {
  const glyph = { [-2]: '𝄫', [-1]: '♭', 0: '', 1: '♯', 2: '𝄪' }[key.tonicAccidental];
  return `${key.tonic}${glyph} ${key.mode}`;
}

export function keyFromId(id: string): Key | null {
  return MAJOR_KEYS.find((k) => keyId(k) === id) ?? null;
}

/** The accidental the key signature gives a letter: 0 for a natural, 1 for a sharp, -1 for a flat. */
export function keySignatureAccidental(letter: Letter, key: Key): Accidental {
  return scaleDegrees(key).find((d) => d.letter === letter)!.accidental;
}
