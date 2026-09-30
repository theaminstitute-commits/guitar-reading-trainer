import { describe, expect, it } from 'vitest';
import {
  C_MAJOR,
  chordTonePitchClasses,
  degreeOf,
  isDiatonic,
  keySignatureCount,
  scaleDegrees,
  spellInKey,
  type Key,
} from './key';
import { midiFromSpelled, parseSpelled, spelledToString } from './pitch';

const G_MAJOR: Key = { tonic: 'G', tonicAccidental: 0, mode: 'major' };
const F_MAJOR: Key = { tonic: 'F', tonicAccidental: 0, mode: 'major' };
const D_MAJOR: Key = { tonic: 'D', tonicAccidental: 0, mode: 'major' };
const Bb_MAJOR: Key = { tonic: 'B', tonicAccidental: -1, mode: 'major' };

const names = (key: Key) =>
  scaleDegrees(key).map((d) => `${d.letter}${{ [-2]: 'bb', [-1]: 'b', 0: '', 1: '#', 2: '##' }[d.accidental]}`);

describe('scale spelling', () => {
  it('C major has no accidentals', () => {
    expect(names(C_MAJOR)).toEqual(['C', 'D', 'E', 'F', 'G', 'A', 'B']);
    expect(keySignatureCount(C_MAJOR)).toBe(0);
  });

  it('G major has F#', () => {
    expect(names(G_MAJOR)).toEqual(['G', 'A', 'B', 'C', 'D', 'E', 'F#']);
    expect(keySignatureCount(G_MAJOR)).toBe(1);
  });

  it('F major has Bb', () => {
    expect(names(F_MAJOR)).toEqual(['F', 'G', 'A', 'Bb', 'C', 'D', 'E']);
    expect(keySignatureCount(F_MAJOR)).toBe(-1);
  });

  it('D major and Bb major', () => {
    expect(names(D_MAJOR)).toEqual(['D', 'E', 'F#', 'G', 'A', 'B', 'C#']);
    expect(names(Bb_MAJOR)).toEqual(['Bb', 'C', 'D', 'Eb', 'F', 'G', 'A']);
  });

  it('chord tones of C major are C, E, G', () => {
    expect(chordTonePitchClasses(C_MAJOR)).toEqual([0, 4, 7]);
  });

  it('degreeOf and isDiatonic', () => {
    expect(degreeOf(60, C_MAJOR)).toBe(1);
    expect(degreeOf(67, C_MAJOR)).toBe(5);
    expect(degreeOf(61, C_MAJOR)).toBeNull();
    expect(isDiatonic(66, G_MAJOR)).toBe(true);
    expect(isDiatonic(65, G_MAJOR)).toBe(false);
  });
});

describe('spellInKey', () => {
  const spell = (text: string, key: Key) => spelledToString(spellInKey(midiFromSpelled(parseSpelled(text)), key));

  it('spells diatonic notes with the key signature', () => {
    expect(spell('F#4', G_MAJOR)).toBe('F#4');
    expect(spell('Bb3', F_MAJOR)).toBe('Bb3');
    expect(spell('E4', C_MAJOR)).toBe('E4');
  });

  it('spells chromatic notes with sharps in C major and sharp keys', () => {
    expect(spell('C#4', C_MAJOR)).toBe('C#4');
    expect(spell('Bb3', C_MAJOR)).toBe('A#3');
    expect(spell('Eb4', G_MAJOR)).toBe('D#4');
  });

  it('spells chromatic notes with flats in flat keys', () => {
    expect(spell('C#4', F_MAJOR)).toBe('Db4');
    expect(spell('G#4', Bb_MAJOR)).toBe('Ab4');
  });

  it('keeps the octave with the letter across the C boundary', () => {
    expect(spell('B3', C_MAJOR)).toBe('B3');
    expect(spell('C4', C_MAJOR)).toBe('C4');
    // Written B#3 sounds as C4 but is never produced for C major.
    expect(spellInKey(60, C_MAJOR).octave).toBe(4);
  });

  it('covers the whole Level 1 sounding range G3..G4 with naturals', () => {
    const expected = ['G3', 'A3', 'B3', 'C4', 'D4', 'E4', 'F4', 'G4'];
    const actual = [55, 57, 59, 60, 62, 64, 65, 67].map((m) => spelledToString(spellInKey(m, C_MAJOR)));
    expect(actual).toEqual(expected);
  });
});
