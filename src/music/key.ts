/**
 * Keys, modes and key-aware spelling.
 *
 * Major keys and the three minor forms share one model. The key signature is
 * always the natural form (a major scale, or the natural minor that shares it);
 * the raised degrees of harmonic and melodic minor are written with signs.
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

export type Mode = 'major' | 'natural-minor' | 'harmonic-minor' | 'melodic-minor';

export interface Key {
  tonic: Letter;
  tonicAccidental: Accidental;
  mode: Mode;
}

export const C_MAJOR: Key = { tonic: 'C', tonicAccidental: 0, mode: 'major' };

/** Letter + accidental without an octave: one degree of a scale. */
export interface ScaleDegree {
  letter: Letter;
  accidental: Accidental;
  pitchClass: number;
}

/** A degree that may occur in the key, with its number and whether it is a raised minor degree. */
export interface KeyDegree extends ScaleDegree {
  degree: number;
  raised: boolean;
}

/** Semitone steps between successive degrees. Melodic minor is its ascending form. */
const INTERVALS: Record<Mode, readonly number[]> = {
  major: [2, 2, 1, 2, 2, 2, 1],
  'natural-minor': [2, 1, 2, 2, 1, 2, 2],
  'harmonic-minor': [2, 1, 2, 2, 1, 3, 1],
  'melodic-minor': [2, 1, 2, 2, 2, 2, 1],
};

function buildScale(key: Key, intervals: readonly number[]): ScaleDegree[] {
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
    pc = pitchClass(pc + intervals[i]!);
  }
  return degrees;
}

/** The seven spelled degrees of the key's scale (melodic minor: ascending form). */
export function scaleDegrees(key: Key): ScaleDegree[] {
  return buildScale(key, INTERVALS[key.mode]);
}

/** The scale the key signature is built from: major, or the natural minor for every minor form. */
export function naturalScaleDegrees(key: Key): ScaleDegree[] {
  return buildScale(key, INTERVALS[key.mode === 'major' ? 'major' : 'natural-minor']);
}

/** Every degree that may appear in the key, including both forms of 6 and 7 in melodic minor. */
export function keyDegrees(key: Key): KeyDegree[] {
  const natural = naturalScaleDegrees(key);
  const scale = scaleDegrees(key);
  const out: KeyDegree[] = scale.map((d, i) => ({
    ...d,
    degree: i + 1,
    raised: d.pitchClass !== natural[i]!.pitchClass,
  }));
  if (key.mode === 'melodic-minor') {
    for (const i of [5, 6]) out.push({ ...natural[i]!, degree: i + 1, raised: false });
  }
  return out;
}

export function isDiatonic(midi: Midi, key: Key): boolean {
  const pc = pitchClass(midi);
  return keyDegrees(key).some((d) => d.pitchClass === pc);
}

/** Number of sharps (positive) or flats (negative) in the key signature. */
export function keySignatureCount(key: Key): number {
  return naturalScaleDegrees(key).reduce((sum, d) => sum + d.accidental, 0);
}

/** The accidental the key signature gives a letter: 0 for a natural, 1 for a sharp, -1 for a flat. */
export function keySignatureAccidental(letter: Letter, key: Key): Accidental {
  return naturalScaleDegrees(key).find((d) => d.letter === letter)!.accidental;
}

/** Pitch classes of the tonic triad (degrees 1, 3, 5). */
export function chordTonePitchClasses(key: Key): number[] {
  const degrees = scaleDegrees(key);
  return [degrees[0]!, degrees[2]!, degrees[4]!].map((d) => d.pitchClass);
}

/** The key degree a pitch is, or null if it is not in the key. Prefers the scale form over a melodic-minor natural 6/7. */
export function degreeInfoOf(midi: Midi, key: Key): KeyDegree | null {
  const pc = pitchClass(midi);
  return keyDegrees(key).find((d) => d.pitchClass === pc) ?? null;
}

/** 1-based scale degree of a pitch, or null if it is not in the key. */
export function degreeOf(midi: Midi, key: Key): number | null {
  return degreeInfoOf(midi, key)?.degree ?? null;
}

/**
 * Spell a MIDI pitch the way a musician reading in this key would write it.
 * Notes of the key take the key's spelling (raised minor degrees included).
 * A chromatic note that merely cancels the key signature is written with a
 * natural (F natural in G major), never as an enharmonic of another letter.
 * Other chromatic notes are a raised lower neighbour in sharp keys (and C),
 * a lowered upper neighbour in flat keys. The octave follows the letter.
 */
export function spellInKey(midi: Midi, key: Key): SpelledNote {
  const pc = pitchClass(midi);
  const natural = naturalScaleDegrees(key);
  let degree: ScaleDegree | undefined = degreeInfoOf(midi, key) ?? undefined;
  if (!degree) {
    const cancelled = natural.find((d) => d.accidental !== 0 && LETTER_PITCH_CLASS[d.letter] === pc);
    if (cancelled) {
      degree = { letter: cancelled.letter, accidental: 0, pitchClass: pc };
    } else {
      const useSharps = keySignatureCount(key) >= 0;
      const neighbourPc = pitchClass(useSharps ? pc - 1 : pc + 1);
      const neighbour = natural.find((d) => d.pitchClass === neighbourPc)!;
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

const major = (tonic: Letter, tonicAccidental: Accidental = 0): Key => ({ tonic, tonicAccidental, mode: 'major' });
const minor = (tonic: Letter, tonicAccidental: Accidental = 0): Key => ({ tonic, tonicAccidental, mode: 'natural-minor' });

/**
 * The fifteen major keys of the circle of fifths: C, then the sharp keys
 * clockwise, then the flat keys counter-clockwise. B/Cb, F#/Gb and C#/Db are
 * enharmonic equivalents and all appear.
 */
export const MAJOR_KEYS: readonly Key[] = [
  major('C'), major('G'), major('D'), major('A'), major('E'), major('B'), major('F', 1), major('C', 1),
  major('F'), major('B', -1), major('E', -1), major('A', -1), major('D', -1), major('G', -1), major('C', -1),
];

/** The relative (natural) minor of each major key, in the same order. */
export const MINOR_KEYS: readonly Key[] = [
  minor('A'), minor('E'), minor('B'), minor('F', 1), minor('C', 1), minor('G', 1), minor('D', 1), minor('A', 1),
  minor('D'), minor('G'), minor('C'), minor('F'), minor('B', -1), minor('E', -1), minor('A', -1),
];

export function withMode(key: Key, mode: Mode): Key {
  return { ...key, mode };
}

const ACC_TEXT = { [-2]: 'bb', [-1]: 'b', 0: '', 1: '#', 2: '##' } as const;
const ACC_GLYPH = { [-2]: '𝄫', [-1]: '♭', 0: '', 1: '♯', 2: '𝄪' } as const;
const MODE_SUFFIX: Record<Mode, string> = { major: '', 'natural-minor': 'm', 'harmonic-minor': 'm-h', 'melodic-minor': 'm-m' };
const MODE_NAME: Record<Mode, string> = { major: 'major', 'natural-minor': 'minor', 'harmonic-minor': 'harmonic minor', 'melodic-minor': 'melodic minor' };

/** Short id such as "Bb", "F#m" or "Am-h" (harmonic), "Am-m" (melodic). */
export function keyId(key: Key): string {
  return `${key.tonic}${ACC_TEXT[key.tonicAccidental]}${MODE_SUFFIX[key.mode]}`;
}

/** VexFlow key signature spec: "Bb" for majors, "Gm" for every minor form. */
export function keySignatureSpec(key: Key): string {
  return `${key.tonic}${ACC_TEXT[key.tonicAccidental]}${key.mode === 'major' ? '' : 'm'}`;
}

/** Display name such as "B♭ major" or "A harmonic minor". */
export function keyName(key: Key): string {
  return `${key.tonic}${ACC_GLYPH[key.tonicAccidental]} ${MODE_NAME[key.mode]}`;
}

export function keyFromId(id: string): Key | null {
  const m = /^([A-G])(#|b|)(m(?:-h|-m)?)?$/.exec(id);
  if (!m) return null;
  const tonic = m[1] as Letter;
  const tonicAccidental = ({ '': 0, '#': 1, b: -1 } as const)[m[2] as '' | '#' | 'b'];
  const mode: Mode = m[3] === undefined ? 'major' : m[3] === 'm' ? 'natural-minor' : m[3] === 'm-h' ? 'harmonic-minor' : 'melodic-minor';
  return { tonic, tonicAccidental, mode };
}
