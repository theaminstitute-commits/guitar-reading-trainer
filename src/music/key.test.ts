import { describe, expect, it } from 'vitest';
import {
  C_MAJOR,
  chordTonePitchClasses,
  degreeOf,
  isDiatonic,
  keySignatureCount,
  scaleDegrees,
  spellInKey,
  MAJOR_KEYS,
  MINOR_KEYS,
  keyDegrees,
  keyId,
  keyName,
  keyFromId,
  keySignatureAccidental,
  keySignatureSpec,
  withMode,
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

  it('writes a cancelled key-signature note with a natural, not an enharmonic', () => {
    expect(spell('F4', G_MAJOR)).toBe('F4'); // not E#4
    expect(spell('B4', F_MAJOR)).toBe('B4'); // not Cb5
    expect(spell('C5', D_MAJOR)).toBe('C5'); // not B#4
    expect(spell('E4', Bb_MAJOR)).toBe('E4'); // not Fb4
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

describe('minor keys and modes', () => {
  const Am = keyFromId('Am')!;
  const AmH = keyFromId('Am-h')!;
  const AmM = keyFromId('Am-m')!;
  const Gm = keyFromId('Gm')!;
  const GmH = keyFromId('Gm-h')!;

  it('lists the relative minors with the same signatures as the majors', () => {
    expect(MINOR_KEYS.map(keyId)).toEqual([
      'Am', 'Em', 'Bm', 'F#m', 'C#m', 'G#m', 'D#m', 'A#m',
      'Dm', 'Gm', 'Cm', 'Fm', 'Bbm', 'Ebm', 'Abm',
    ]);
    expect(MINOR_KEYS.map(keySignatureCount)).toEqual(MAJOR_KEYS.map(keySignatureCount));
  });

  it('spells the three minor forms', () => {
    expect(names(Am)).toEqual(['A', 'B', 'C', 'D', 'E', 'F', 'G']);
    expect(names(AmH)).toEqual(['A', 'B', 'C', 'D', 'E', 'F', 'G#']);
    expect(names(AmM)).toEqual(['A', 'B', 'C', 'D', 'E', 'F#', 'G#']);
    expect(names(GmH)).toEqual(['G', 'A', 'Bb', 'C', 'D', 'Eb', 'F#']);
    expect(names(keyFromId('Cm-m')!)).toEqual(['C', 'D', 'Eb', 'F', 'G', 'A', 'B']);
  });

  it('keeps the key signature in the natural form for harmonic and melodic minor', () => {
    expect(keySignatureCount(AmH)).toBe(0);
    expect(keySignatureCount(keyFromId('Cm-m')!)).toBe(-3);
    expect(keySignatureAccidental('G', AmH)).toBe(0); // G# is written with a sign
    expect(keySignatureAccidental('B', GmH)).toBe(-1);
    expect(keySignatureSpec(AmH)).toBe('Am');
    expect(keySignatureSpec(Gm)).toBe('Gm');
    expect(keySignatureSpec(keyFromId('F#m')!)).toBe('F#m');
  });

  it('melodic minor allows both forms of 6 and 7 and marks the raised ones', () => {
    const degrees = keyDegrees(AmM);
    expect(degrees.map((d) => `${d.letter}${d.accidental === 1 ? '#' : ''}${d.raised ? '^' : ''}`)).toEqual([
      'A', 'B', 'C', 'D', 'E', 'F#^', 'G#^', 'F', 'G',
    ]);
    expect(isDiatonic(midiFromSpelled(parseSpelled('F4')), AmM)).toBe(true);
    expect(isDiatonic(midiFromSpelled(parseSpelled('F#4')), AmM)).toBe(true);
    expect(isDiatonic(midiFromSpelled(parseSpelled('F#4')), Am)).toBe(false);
    expect(degreeOf(midiFromSpelled(parseSpelled('G#4')), AmH)).toBe(7);
    expect(degreeOf(midiFromSpelled(parseSpelled('G4')), AmH)).toBeNull();
  });

  it('spells raised degrees in minor with the right signs', () => {
    const spellM = (text: string, key: Key) => spelledToString(spellInKey(midiFromSpelled(parseSpelled(text)), key));
    expect(spellM('G#4', AmH)).toBe('G#4');
    expect(spellM('F#4', GmH)).toBe('F#4');
    expect(spellM('B4', keyFromId('Cm-h')!)).toBe('B4'); // raised 7th cancels the Bb
    expect(spellM('E4', keyFromId('Gm-m')!)).toBe('E4'); // raised 6th cancels the Eb
  });

  it('names and ids round-trip for every form', () => {
    expect(keyName(Am)).toBe('A minor');
    expect(keyName(AmH)).toBe('A harmonic minor');
    expect(keyName(keyFromId('Bbm-m')!)).toBe('B♭ melodic minor');
    for (const k of [...MAJOR_KEYS, ...MINOR_KEYS]) {
      expect(keyFromId(keyId(k))).toEqual(k);
      expect(keyFromId(keyId(withMode(k, 'harmonic-minor')))).toEqual(withMode(k, 'harmonic-minor'));
    }
    expect(chordTonePitchClasses(Am)).toEqual([9, 0, 4]);
  });
});

describe('major keys', () => {
  it('lists the fifteen keys of the circle of fifths with correct signatures', () => {
    expect(MAJOR_KEYS.map(keyId)).toEqual([
      'C', 'G', 'D', 'A', 'E', 'B', 'F#', 'C#',
      'F', 'Bb', 'Eb', 'Ab', 'Db', 'Gb', 'Cb',
    ]);
    expect(MAJOR_KEYS.map(keySignatureCount)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, -1, -2, -3, -4, -5, -6, -7]);
  });

  it('names keys and looks them up by id', () => {
    expect(keyName(keyFromId('Bb')!)).toBe('B♭ major');
    expect(keyName(keyFromId('F#')!)).toBe('F♯ major');
    expect(keyName(C_MAJOR)).toBe('C major');
    expect(keyFromId('H')).toBeNull();
  });

  it('gives each letter its key signature accidental', () => {
    expect(keySignatureAccidental('F', G_MAJOR)).toBe(1);
    expect(keySignatureAccidental('C', G_MAJOR)).toBe(0);
    expect(keySignatureAccidental('B', F_MAJOR)).toBe(-1);
    expect(keySignatureAccidental('E', keyFromId('C#')!)).toBe(1); // E# in C# major
    expect(keySignatureAccidental('F', keyFromId('Cb')!)).toBe(-1); // Fb in Cb major
  });
});
