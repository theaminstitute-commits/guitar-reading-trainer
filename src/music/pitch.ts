/**
 * Pitch model.
 *
 * Internally every pitch is a MIDI number of the SOUNDING pitch (middle C = 60).
 * Guitar is a transposing instrument: it is written one octave higher than it
 * sounds. The only place that octave shift happens is in this file
 * (`writtenFromSounding` / `soundingFromWritten`). Everything that draws or
 * reads a staff works in written pitch; everything that plays audio or maps to
 * the fretboard works in sounding pitch.
 */

export type Midi = number;

export type Letter = 'C' | 'D' | 'E' | 'F' | 'G' | 'A' | 'B';

/** -2 = double flat, -1 = flat, 0 = natural, 1 = sharp, 2 = double sharp. */
export type Accidental = -2 | -1 | 0 | 1 | 2;

/** A pitch as it is spelled on a staff. Octave uses scientific pitch notation (C4 = middle C). */
export interface SpelledNote {
  letter: Letter;
  accidental: Accidental;
  octave: number;
}

export const LETTERS: readonly Letter[] = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];

/** Pitch class of each natural letter. */
export const LETTER_PITCH_CLASS: Record<Letter, number> = {
  C: 0,
  D: 2,
  E: 4,
  F: 5,
  G: 7,
  A: 9,
  B: 11,
};

/** Guitar notation sounds one octave lower than written. */
export const GUITAR_WRITTEN_OFFSET = 12;

export function writtenFromSounding(sounding: Midi): Midi {
  return sounding + GUITAR_WRITTEN_OFFSET;
}

export function soundingFromWritten(written: Midi): Midi {
  return written - GUITAR_WRITTEN_OFFSET;
}

export function pitchClass(midi: Midi): number {
  return ((midi % 12) + 12) % 12;
}

/** Octave in scientific pitch notation for a MIDI number (60 -> 4). */
export function octaveOf(midi: Midi): number {
  return Math.floor(midi / 12) - 1;
}

/**
 * MIDI number for a spelled note. The octave belongs to the letter, so B#3 is
 * 60 (same sound as C4) and Cb4 is 59 (same sound as B3), as in standard practice.
 */
export function midiFromSpelled(note: SpelledNote): Midi {
  return (note.octave + 1) * 12 + LETTER_PITCH_CLASS[note.letter] + note.accidental;
}

export function spelledEquals(a: SpelledNote, b: SpelledNote): boolean {
  return a.letter === b.letter && a.accidental === b.accidental && a.octave === b.octave;
}

export function letterIndex(letter: Letter): number {
  return LETTERS.indexOf(letter);
}

/** Letter n steps above (or below, if negative) the given letter, wrapping A..G. */
export function letterStep(letter: Letter, steps: number): Letter {
  const i = (((letterIndex(letter) + steps) % 7) + 7) % 7;
  return LETTERS[i]!;
}

/**
 * Diatonic step count of a spelled note, i.e. its position on the staff
 * (C4 = 28, D4 = 29 ... C5 = 35). Two notes a third apart differ by 2.
 * Accidentals do not move a note on the staff, so they are ignored.
 */
export function staffStep(note: SpelledNote): number {
  return note.octave * 7 + letterIndex(note.letter);
}

export function spelledFromStaffStep(step: number, accidental: Accidental = 0): SpelledNote {
  const octave = Math.floor(step / 7);
  const letter = LETTERS[((step % 7) + 7) % 7]!;
  return { letter, accidental, octave };
}

const ACCIDENTAL_TEXT: Record<Accidental, string> = {
  [-2]: 'bb',
  [-1]: 'b',
  0: '',
  1: '#',
  2: '##',
};

/** "F#4", "Bb3", "C4". */
export function spelledToString(note: SpelledNote): string {
  return `${note.letter}${ACCIDENTAL_TEXT[note.accidental]}${note.octave}`;
}

/** Human-friendly name with real accidental glyphs: "F♯", "B♭", "C". */
export function spelledName(note: SpelledNote): string {
  const glyph = { [-2]: '𝄫', [-1]: '♭', 0: '', 1: '♯', 2: '𝄪' }[note.accidental];
  return `${note.letter}${glyph}`;
}

/** Parse "F#4", "Bb3", "C4", "E##5", "Abb2". Throws on bad input. */
export function parseSpelled(text: string): SpelledNote {
  const match = /^([A-Ga-g])(##|bb|#|b|)(-?\d+)$/.exec(text.trim());
  if (!match) throw new Error(`Cannot parse note "${text}"`);
  const letter = match[1]!.toUpperCase() as Letter;
  const accidentalText = match[2]!;
  const accidental = ({ '': 0, '#': 1, '##': 2, b: -1, bb: -2 } as Record<string, Accidental>)[
    accidentalText
  ]!;
  return { letter, accidental, octave: Number(match[3]) };
}
