/**
 * Accidental rules, as in standard engraving practice (Alfred's Essential
 * Dictionary of Music Notation, "Accidentals" and "Key signatures"):
 *
 *  - A note with no sign takes the accidental of the key signature.
 *  - A written sign affects that note and every later note of the SAME pitch
 *    (same letter and octave) in the same bar, until a new sign on that pitch.
 *  - At the bar line the key signature applies again; the sign must be rewritten.
 *  - Notes of the same letter in another octave are separate.
 *  - A courtesy accidental is a reminder: a sign that restates what already
 *    applies. It is legal and changes nothing.
 */
import { keySignatureAccidental, type Key } from '../music/key';
import type { Accidental, Letter, SpelledNote } from '../music/pitch';

/** What is drawn in front of a note. */
export type Sign = 'none' | 'sharp' | 'flat' | 'natural';

export const SIGN_VALUE: Record<Exclude<Sign, 'none'>, Accidental> = { sharp: 1, flat: -1, natural: 0 };

export function signForAccidental(accidental: Accidental): Exclude<Sign, 'none'> {
  if (accidental > 0) return 'sharp';
  if (accidental < 0) return 'flat';
  return 'natural';
}

export interface WrittenNote {
  letter: Letter;
  octave: number;
  sign: Sign;
}

const pitchKey = (letter: Letter, octave: number) => `${letter}${octave}`;

/**
 * The accidental each note in a bar actually carries, reading signs the way a
 * musician does: key signature first, then signs carried through the bar.
 */
export function resolveBar(notes: readonly WrittenNote[], key: Key): Accidental[] {
  const state = new Map<string, Accidental>();
  return notes.map((n) => {
    const id = pitchKey(n.letter, n.octave);
    if (n.sign !== 'none') state.set(id, SIGN_VALUE[n.sign]);
    return state.get(id) ?? keySignatureAccidental(n.letter, key);
  });
}

export interface DisplayOptions {
  /** Pitches (letter+octave) altered away from the key signature in the previous bar. */
  alteredInPreviousBar?: ReadonlySet<string>;
}

/**
 * The signs needed to notate correctly spelled notes in one bar: a sign where
 * the note differs from what currently applies, nothing otherwise. Adds courtesy
 * signs where the guide recommends them: the first return to the key signature
 * after that pitch was altered in the previous bar, and a note whose letter was
 * altered in another octave earlier in the same bar.
 * Returns the signs and the set of pitches left altered at the end of the bar.
 */
export function displaySigns(
  notes: readonly SpelledNote[],
  key: Key,
  options: DisplayOptions = {},
): { signs: Sign[]; alteredAtEnd: Set<string> } {
  const state = new Map<string, Accidental>();
  const alteredLettersThisBar = new Map<Letter, Set<number>>();
  const reminded = new Set<string>();
  const previous = options.alteredInPreviousBar ?? new Set<string>();

  const signs = notes.map((n) => {
    const id = pitchKey(n.letter, n.octave);
    const current = state.get(id) ?? keySignatureAccidental(n.letter, key);
    let sign: Sign = 'none';
    if (n.accidental !== current) {
      sign = signForAccidental(n.accidental);
    } else if (previous.has(id) && !state.has(id) && !reminded.has(id)) {
      // Courtesy: this pitch was altered last bar and now returns to the key signature.
      sign = signForAccidental(n.accidental);
      reminded.add(id);
    } else {
      // Courtesy for an octave shift: the same letter was altered in another octave this bar.
      const octaves = alteredLettersThisBar.get(n.letter);
      if (octaves && !state.has(id) && [...octaves].some((o) => o !== n.octave)) {
        sign = signForAccidental(n.accidental);
        reminded.add(id);
      }
    }
    state.set(id, n.accidental);
    if (n.accidental !== keySignatureAccidental(n.letter, key)) {
      const set = alteredLettersThisBar.get(n.letter) ?? new Set<number>();
      set.add(n.octave);
      alteredLettersThisBar.set(n.letter, set);
    }
    return sign;
  });

  const alteredAtEnd = new Set<string>();
  for (const [id, accidental] of state) {
    const letter = id[0] as Letter;
    if (accidental !== keySignatureAccidental(letter, key)) alteredAtEnd.add(id);
  }
  return { signs, alteredAtEnd };
}

/** Display signs for a whole melody, bar by bar, carrying courtesy information across bar lines. */
export function displaySignsForBars(bars: readonly (readonly SpelledNote[])[], key: Key): Sign[][] {
  let altered = new Set<string>();
  return bars.map((bar) => {
    const result = displaySigns(bar, key, { alteredInPreviousBar: altered });
    altered = result.alteredAtEnd;
    return result.signs;
  });
}
