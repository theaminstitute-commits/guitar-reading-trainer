/**
 * Chord qualities as interval formulas from the root, with the spelling each
 * interval implies: a major third above C is E, an augmented ninth is D♯ (not
 * E♭), a diminished seventh above B is A♭. Spelling therefore follows the
 * chord, not the key, which is what altered and extended chords need (R1).
 */
import { LETTER_PITCH_CLASS, letterStep, octaveOf, pitchClass, type Accidental, type Midi, type SpelledNote } from '../music/pitch';

/** An interval above the root: letter steps (a third = 2) and semitones. */
export interface Interval {
  steps: number;
  semitones: number;
  /** Short name for labels: "3", "b7", "#9". */
  label: string;
}

const I = (steps: number, semitones: number, label: string): Interval => ({ steps, semitones, label });

export const INTERVALS = {
  P1: I(0, 0, '1'),
  m2: I(1, 1, 'b2'),
  M2: I(1, 2, '2'),
  m3: I(2, 3, 'b3'),
  M3: I(2, 4, '3'),
  P4: I(3, 5, '4'),
  A4: I(3, 6, '#4'),
  d5: I(4, 6, 'b5'),
  P5: I(4, 7, '5'),
  A5: I(4, 8, '#5'),
  m6: I(5, 8, 'b6'),
  M6: I(5, 9, '6'),
  d7: I(6, 9, 'bb7'),
  m7: I(6, 10, 'b7'),
  M7: I(6, 11, '7'),
  m9: I(8, 13, 'b9'),
  M9: I(8, 14, '9'),
  A9: I(8, 15, '#9'),
  m10: I(9, 15, 'b10'),
  P11: I(10, 17, '11'),
  A11: I(10, 18, '#11'),
  m13: I(12, 20, 'b13'),
  M13: I(12, 21, '13'),
} as const;

const { P1, M2, m3, M3, P4, d5, P5, A5, m6, M6, d7, m7, M7, m9, M9, A9, m10, P11, A11, m13, M13 } = INTERVALS;

export type QualityId =
  | '5'
  | 'dyad-m3' | 'dyad-M3' | 'dyad-P4' | 'dyad-m6' | 'dyad-M6' | 'dyad-P8' | 'dyad-m10' | 'dyad-M10'
  | 'maj' | 'min' | 'dim' | 'aug' | 'sus2' | 'sus4'
  | '7' | 'm7' | 'maj7' | 'm7b5' | 'dim7' | 'mMaj7' | '7#5' | '7sus4'
  | '6' | 'm6' | 'add9' | 'add11' | '6/9'
  | '9' | 'maj9' | 'm9' | 'm11' | '11' | '13' | 'maj13' | 'm13'
  | '7b9' | '7#9' | '7b5' | '7#11' | '7alt'
  | 'quartal3' | 'quartal4' | 'cluster-maj' | 'cluster-min' | 'cluster-phr'
  | 'poly-II' | 'poly-bVI' | 'poly-bVII';

export interface Quality {
  id: QualityId;
  /** Symbol after the root: "m7", "maj7", "7#9"; "" for a major triad. */
  symbol: string;
  /** Name in words, for guides and explanations. */
  name: string;
  /** Tones that must be present. */
  required: readonly Interval[];
  /** Tones that may be added when a voicing has room (the fifth of a seventh chord, the ninth of a thirteenth). */
  optional: readonly Interval[];
}

const Q = (id: QualityId, symbol: string, name: string, required: Interval[], optional: Interval[] = []): Quality => ({ id, symbol, name, required, optional });

export const QUALITIES: Record<QualityId, Quality> = {
  '5': Q('5', '5', 'power chord', [P1, P5]),
  'dyad-m3': Q('dyad-m3', '', 'minor third', [P1, m3]),
  'dyad-M3': Q('dyad-M3', '', 'major third', [P1, M3]),
  'dyad-P4': Q('dyad-P4', '', 'perfect fourth', [P1, P4]),
  'dyad-m6': Q('dyad-m6', '', 'minor sixth', [P1, m6]),
  'dyad-M6': Q('dyad-M6', '', 'major sixth', [P1, M6]),
  'dyad-P8': Q('dyad-P8', '', 'octave', [P1, I(7, 12, '8')]),
  'dyad-m10': Q('dyad-m10', '', 'minor tenth', [P1, m10]),
  'dyad-M10': Q('dyad-M10', '', 'major tenth', [P1, I(9, 16, '10')]),
  maj: Q('maj', '', 'major triad', [P1, M3, P5]),
  min: Q('min', 'm', 'minor triad', [P1, m3, P5]),
  dim: Q('dim', 'dim', 'diminished triad', [P1, m3, d5]),
  aug: Q('aug', 'aug', 'augmented triad', [P1, M3, A5]),
  sus2: Q('sus2', 'sus2', 'suspended second', [P1, M2, P5]),
  sus4: Q('sus4', 'sus4', 'suspended fourth', [P1, P4, P5]),
  '7': Q('7', '7', 'dominant seventh', [P1, M3, m7], [P5]),
  m7: Q('m7', 'm7', 'minor seventh', [P1, m3, m7], [P5]),
  maj7: Q('maj7', 'maj7', 'major seventh', [P1, M3, M7], [P5]),
  m7b5: Q('m7b5', 'm7b5', 'half-diminished seventh', [P1, m3, d5, m7]),
  dim7: Q('dim7', 'dim7', 'diminished seventh', [P1, m3, d5, d7]),
  mMaj7: Q('mMaj7', 'm(maj7)', 'minor-major seventh', [P1, m3, M7], [P5]),
  '7#5': Q('7#5', '7#5', 'augmented seventh', [P1, M3, A5, m7]),
  '7sus4': Q('7sus4', '7sus4', 'seventh suspended fourth', [P1, P4, m7], [P5]),
  '6': Q('6', '6', 'major sixth chord', [P1, M3, M6], [P5]),
  m6: Q('m6', 'm6', 'minor sixth chord', [P1, m3, M6], [P5]),
  add9: Q('add9', 'add9', 'added ninth', [P1, M3, P5, M9]),
  add11: Q('add11', 'add11', 'added eleventh', [P1, M3, P5, P11]),
  '6/9': Q('6/9', '6/9', 'six-nine chord', [P1, M3, M6, M9], [P5]),
  '9': Q('9', '9', 'dominant ninth', [P1, M3, m7, M9], [P5]),
  maj9: Q('maj9', 'maj9', 'major ninth', [P1, M3, M7, M9], [P5]),
  m9: Q('m9', 'm9', 'minor ninth', [P1, m3, m7, M9], [P5]),
  m11: Q('m11', 'm11', 'minor eleventh', [P1, m3, m7, P11], [P5, M9]),
  '11': Q('11', '11', 'dominant eleventh', [P1, m7, M9, P11], [P5]),
  '13': Q('13', '13', 'dominant thirteenth', [P1, M3, m7, M13], [P5, M9]),
  maj13: Q('maj13', 'maj13', 'major thirteenth', [P1, M3, M7, M13], [P5, M9]),
  m13: Q('m13', 'm13', 'minor thirteenth', [P1, m3, m7, M13], [P5, M9]),
  '7b9': Q('7b9', '7b9', 'dominant seventh flat nine', [P1, M3, m7, m9], [P5]),
  '7#9': Q('7#9', '7#9', 'dominant seventh sharp nine', [P1, M3, m7, A9], [P5]),
  '7b5': Q('7b5', '7b5', 'dominant seventh flat five', [P1, M3, d5, m7]),
  '7#11': Q('7#11', '7#11', 'dominant seventh sharp eleven', [P1, M3, m7, A11], [P5]),
  '7alt': Q('7alt', '7alt', 'altered dominant', [P1, M3, m7, m13], [A9]),
  quartal3: Q('quartal3', 'quartal', 'quartal voicing (three notes)', [P1, P4, m7]),
  quartal4: Q('quartal4', 'quartal', 'quartal voicing (four notes)', [P1, P4, m7, m10]),
  'cluster-maj': Q('cluster-maj', 'cluster', 'tone cluster', [P1, M2, M3]),
  'cluster-min': Q('cluster-min', 'cluster', 'tone cluster', [P1, M2, m3]),
  'cluster-phr': Q('cluster-phr', 'cluster', 'tone cluster', [P1, I(1, 1, 'b2'), m3]),
  'poly-II': Q('poly-II', '', 'major triad on the second over the root', [P1, M9, A11, M13]),
  'poly-bVI': Q('poly-bVI', '', 'major triad on the flat sixth over the root', [P1, m3, m6]),
  'poly-bVII': Q('poly-bVII', '', 'major triad on the flat seventh over the root', [P1, m7, M9, P11]),
};

/** Every tone a quality may use, required first. */
export function tonesOf(quality: Quality): readonly Interval[] {
  return [...quality.required, ...quality.optional];
}

/** A root without octave: letter and accidental. */
export interface RootSpelling {
  letter: SpelledNote['letter'];
  accidental: Accidental;
}

export function rootPitchClass(root: RootSpelling): number {
  return pitchClass(LETTER_PITCH_CLASS[root.letter] + root.accidental);
}

/**
 * The spelled note an interval above a root, at the octave of a MIDI pitch.
 * The letter comes from the interval's steps; the accidental is whatever makes
 * that letter sound right, so a sharp nine over C is D♯ and over E♭ is F♯.
 */
export function spellInterval(root: RootSpelling, interval: Interval, midi: Midi): SpelledNote {
  const letter = letterStep(root.letter, interval.steps);
  const want = pitchClass(rootPitchClass(root) + interval.semitones);
  let accidental = want - LETTER_PITCH_CLASS[letter];
  if (accidental > 6) accidental -= 12;
  if (accidental < -6) accidental += 12;
  if (accidental < -2 || accidental > 2) throw new Error(`Cannot spell ${interval.label} above ${root.letter}${root.accidental}`);
  return { letter, accidental: accidental as Accidental, octave: octaveOf(midi - accidental) };
}

const ACC_GLYPH = { [-2]: '𝄫', [-1]: '♭', 0: '', 1: '♯', 2: '𝄪' } as const;

/** "E♭m7", "G", "C7♯9". The quality symbol is shown with real glyphs. */
export function chordSymbol(root: RootSpelling, quality: Quality): string {
  return `${root.letter}${ACC_GLYPH[root.accidental]}${quality.symbol.replace(/#/g, '♯').replace(/b(?=[0-9])/g, '♭')}`;
}
