import { describe, expect, it } from 'vitest';
import type { Melody } from '../melody/types';
import { C_MAJOR } from '../music/key';
import { midiFromSpelled, parseSpelled, staffStep } from '../music/pitch';
import type { AnswerNote } from '../notation/answer';
import { describeStaffPosition, explainMistake } from './explain';
import { gradeAnswer } from './grade';

/** Target melody from written note names (guitar staff), stored as sounding pitches. */
function melody(...written: string[]): Melody {
  return {
    seed: 0,
    levelId: 'test',
    tempo: 72,
    timeSignature: [4, 4],
    bars: 1,
    notes: written.map((w) => {
      const [name, dur = 'q'] = w.split(':');
      return { midi: midiFromSpelled(parseSpelled(name!)) - 12, duration: dur as 'q' | 'h', string: 1, fret: 0 };
    }),
  };
}

let nextId = 1;
/** Answer notes from written names like "C5", "F#4", "E5:h". */
function answer(...written: string[]): AnswerNote[] {
  return written.map((w) => {
    const [name, dur = 'q'] = w.split(':');
    const spelled = parseSpelled(name!);
    return {
      id: nextId++,
      step: staffStep(spelled),
      accidental: spelled.accidental as -1 | 0 | 1,
      showNatural: false,
      duration: dur as 'q' | 'h',
    };
  });
}

const kinds = (r: ReturnType<typeof gradeAnswer>) => r.mistakes.map((m) => m.kind);

describe('gradeAnswer', () => {
  it('gives full marks for a perfect answer', () => {
    const r = gradeAnswer(melody('C5', 'D5', 'E5:h'), [answer('C5', 'D5', 'E5:h')], C_MAJOR);
    expect(r.pitchScore).toBe(1);
    expect(r.rhythmScore).toBe(1);
    expect(r.mistakes).toEqual([]);
  });

  it('classifies a wrong letter name', () => {
    const r = gradeAnswer(melody('C5', 'D5', 'E5:h'), [answer('C5', 'F5', 'E5:h')], C_MAJOR);
    expect(kinds(r)).toEqual(['wrong-letter']);
    expect(r.pitchScore).toBeCloseTo(2 / 3);
    expect(r.rhythmScore).toBe(1);
  });

  it('classifies a wrong accidental', () => {
    const r = gradeAnswer(melody('C5', 'D5'), [answer('C5', 'D#5')], C_MAJOR);
    expect(kinds(r)).toEqual(['wrong-accidental']);
  });

  it('classifies an octave error', () => {
    const r = gradeAnswer(melody('G5', 'E5'), [answer('G4', 'E5')], C_MAJOR);
    expect(kinds(r)).toEqual(['octave']);
    expect(r.pitchScore).toBe(0.5);
  });

  it('is strict about spelling: E# for F is a mistake', () => {
    const r = gradeAnswer(melody('F5', 'G5'), [answer('E#5', 'G5')], C_MAJOR);
    expect(kinds(r)).toEqual(['enharmonic']);
    expect(r.pitchScore).toBe(0.5);
  });

  it('scores rhythm separately from pitch', () => {
    const r = gradeAnswer(melody('C5:h', 'D5', 'E5'), [answer('C5', 'D5', 'E5')], C_MAJOR);
    expect(kinds(r)).toEqual(['wrong-duration']);
    expect(r.pitchScore).toBe(1);
    expect(r.rhythmScore).toBeCloseTo(2 / 3);
  });

  it('reports pitch and duration mistakes on the same note', () => {
    const r = gradeAnswer(melody('C5:h', 'D5'), [answer('B4', 'D5')], C_MAJOR);
    expect(kinds(r)).toEqual(['wrong-letter', 'wrong-duration']);
    expect(r.pairs[0]!.mistakes).toHaveLength(2);
  });

  it('aligns around an extra note instead of marking everything after it wrong', () => {
    const r = gradeAnswer(melody('C5', 'D5', 'E5', 'F5'), [answer('C5', 'G5', 'D5', 'E5', 'F5')], C_MAJOR);
    expect(kinds(r)).toEqual(['extra']);
    expect(r.extraCount).toBe(1);
    // 4 targets + 1 extra in the denominator.
    expect(r.pitchScore).toBeCloseTo(4 / 5);
    expect(r.rhythmScore).toBeCloseTo(4 / 5);
  });

  it('aligns around a missing note', () => {
    const r = gradeAnswer(melody('C5', 'D5', 'E5', 'F5'), [answer('C5', 'E5', 'F5')], C_MAJOR);
    expect(kinds(r)).toEqual(['missing']);
    expect(r.missingCount).toBe(1);
    expect(r.pitchScore).toBe(0.75);
  });

  it('grades an empty answer as all missing without dividing by zero', () => {
    const r = gradeAnswer(melody('C5', 'D5'), [[]], C_MAJOR);
    expect(kinds(r)).toEqual(['missing', 'missing']);
    expect(r.pitchScore).toBe(0);
    expect(r.rhythmScore).toBe(0);
  });

  it('numbers mistakes in melody order across bars', () => {
    const m: Melody = { ...melody('C5', 'D5', 'E5', 'F5', 'G5:h', 'E5:h'), bars: 2 };
    const r = gradeAnswer(m, [answer('C5', 'D5', 'E5', 'F5'), answer('A5:h', 'E5')], C_MAJOR);
    expect(r.mistakes.map((x) => [x.number, x.kind])).toEqual([
      [1, 'wrong-letter'],
      [2, 'wrong-duration'],
    ]);
    expect(r.pairs.find((p) => p.mistakes.length > 0)!.target!.bar).toBe(1);
  });
});

describe('explanations', () => {
  const notesInBar = () => 3;

  it('describes staff positions in words', () => {
    expect(describeStaffPosition(parseSpelled('E4'))).toBe('on the first (bottom) line');
    expect(describeStaffPosition(parseSpelled('F4'))).toBe('in the first (bottom) space');
    expect(describeStaffPosition(parseSpelled('B4'))).toBe('on the third line');
    expect(describeStaffPosition(parseSpelled('F5'))).toBe('on the fifth (top) line');
    expect(describeStaffPosition(parseSpelled('G5'))).toBe('in the space just above the staff');
    expect(describeStaffPosition(parseSpelled('A5'))).toBe('on the first ledger line above the staff');
    expect(describeStaffPosition(parseSpelled('C4'))).toBe('on the first ledger line below the staff');
    expect(describeStaffPosition(parseSpelled('D4'))).toBe('in the space just below the staff');
  });

  it('explains an octave error with the guitar transposition', () => {
    const r = gradeAnswer(melody('G5'), [answer('G4')], C_MAJOR);
    const e = explainMistake(r.mistakes[0]!, r.pairs[0]!, C_MAJOR, notesInBar);
    expect(e.explainer).toBe('guitar-octave');
    expect(e.text).toContain('sounds as G4');
    expect(e.text).toContain('written G5');
  });

  it('explains a strict spelling mistake', () => {
    const r = gradeAnswer(melody('F5'), [answer('E#5')], C_MAJOR);
    const e = explainMistake(r.mistakes[0]!, r.pairs[0]!, C_MAJOR, notesInBar);
    expect(e.title).toContain('Spelling');
    expect(e.text).toContain('E♯5');
    expect(e.text).toContain('written F5');
  });

  it('explains durations in beats and links the durations card', () => {
    const r = gradeAnswer(melody('C5:h'), [answer('C5')], C_MAJOR);
    const e = explainMistake(r.mistakes[0]!, r.pairs[0]!, C_MAJOR, notesInBar);
    expect(e.explainer).toBe('durations');
    expect(e.text).toContain('half note (2 beats)');
    expect(e.text).toContain('quarter note (1 beat)');
  });

  it('explains missing and extra notes with the bar count', () => {
    const r = gradeAnswer(melody('C5', 'D5', 'E5', 'F5'), [answer('C5', 'E5', 'F5', 'A5')], C_MAJOR);
    const texts = r.mistakes.map((m) => explainMistake(m, r.pairs[m.pairIndex]!, C_MAJOR, notesInBar));
    expect(texts.map((t) => t.title)).toEqual(['Missing note: D5', 'Extra note: A5']);
    expect(texts[0]!.text).toContain('Bar 1 has 3 notes');
  });
});
