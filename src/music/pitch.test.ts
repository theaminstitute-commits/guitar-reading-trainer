import { describe, expect, it } from 'vitest';
import {
  midiFromSpelled,
  parseSpelled,
  soundingFromWritten,
  spelledFromStaffStep,
  spelledToString,
  staffStep,
  writtenFromSounding,
  letterStep,
  octaveOf,
} from './pitch';

describe('guitar octave transposition', () => {
  it('writes the sounding pitch one octave higher', () => {
    // Open high E string sounds E4 (64) and is written E5 (76).
    expect(writtenFromSounding(64)).toBe(76);
    // Open G string sounds G3 (55) and is written G4 (67), bottom of Level 1's range.
    expect(writtenFromSounding(55)).toBe(67);
  });

  it('round-trips', () => {
    for (let midi = 40; midi <= 88; midi++) {
      expect(soundingFromWritten(writtenFromSounding(midi))).toBe(midi);
    }
  });

  it('Level 1 fret window maps to written G4..G5', () => {
    expect(spelledToString(parseSpelled('G4'))).toBe('G4');
    expect(writtenFromSounding(midiFromSpelled(parseSpelled('G3')))).toBe(
      midiFromSpelled(parseSpelled('G4')),
    );
    expect(writtenFromSounding(midiFromSpelled(parseSpelled('G4')))).toBe(
      midiFromSpelled(parseSpelled('G5')),
    );
  });
});

describe('spelled notes and MIDI', () => {
  it('middle C is 60', () => {
    expect(midiFromSpelled({ letter: 'C', accidental: 0, octave: 4 })).toBe(60);
  });

  it('octave belongs to the letter (B#3 = 60, Cb4 = 59)', () => {
    expect(midiFromSpelled(parseSpelled('B#3'))).toBe(60);
    expect(midiFromSpelled(parseSpelled('Cb4'))).toBe(59);
    expect(midiFromSpelled(parseSpelled('E#4'))).toBe(65);
    expect(midiFromSpelled(parseSpelled('Fb4'))).toBe(64);
  });

  it('parses and prints all accidental forms', () => {
    for (const text of ['C4', 'F#4', 'Bb3', 'G##5', 'Abb2', 'E-1']) {
      expect(spelledToString(parseSpelled(text))).toBe(text);
    }
    expect(() => parseSpelled('H4')).toThrow();
    expect(() => parseSpelled('C')).toThrow();
  });

  it('octaveOf follows scientific pitch notation', () => {
    expect(octaveOf(60)).toBe(4);
    expect(octaveOf(59)).toBe(3);
    expect(octaveOf(0)).toBe(-1);
  });
});

describe('staff steps', () => {
  it('counts diatonic positions, ignoring accidentals', () => {
    expect(staffStep(parseSpelled('C4'))).toBe(28);
    expect(staffStep(parseSpelled('D4'))).toBe(29);
    expect(staffStep(parseSpelled('B4'))).toBe(34);
    expect(staffStep(parseSpelled('C5'))).toBe(35);
    expect(staffStep(parseSpelled('C#4'))).toBe(staffStep(parseSpelled('C4')));
  });

  it('a third is two steps', () => {
    expect(staffStep(parseSpelled('E4')) - staffStep(parseSpelled('C4'))).toBe(2);
  });

  it('converts back to a spelled note', () => {
    expect(spelledToString(spelledFromStaffStep(28))).toBe('C4');
    expect(spelledToString(spelledFromStaffStep(34, 1))).toBe('B#4');
    expect(spelledToString(spelledFromStaffStep(35))).toBe('C5');
  });

  it('steps letters with wrap-around', () => {
    expect(letterStep('B', 1)).toBe('C');
    expect(letterStep('C', -1)).toBe('B');
    expect(letterStep('E', 3)).toBe('A');
  });
});
