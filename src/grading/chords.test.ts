import { describe, expect, it } from 'vitest';
import type { Melody, MelodyNote } from '../melody/types';
import { C_MAJOR } from '../music/key';
import { midiFromSpelled, parseSpelled, staffStep } from '../music/pitch';
import type { AnswerNote } from '../notation/answer';
import { gradeAnswer } from './grade';

/**
 * A one-bar melody from events: "C5" is a quarter note, "C5+E5+G5:h" a half-note
 * chord. Chord tones carry their written spelling, as the chord generator gives them.
 */
function melody(...events: string[]): Melody {
  const notes: MelodyNote[] = [];
  events.forEach((e, i) => {
    const [names, dur = 'q'] = e.split(':');
    const parts = names!.split('+');
    for (const name of parts) {
      const spelled = parseSpelled(name);
      notes.push({ midi: midiFromSpelled(spelled) - 12, duration: dur as 'q' | 'h', string: 1, fret: 0, chord: parts.length > 1 ? i + 1 : undefined, spelled: parts.length > 1 ? spelled : undefined });
    }
  });
  return { seed: 0, levelId: 'test', key: C_MAJOR, tempo: 72, barBeats: [4], timeSignature: [4, 4], bars: 1, counts: 4, notes };
}

let nextId = 1;
/** Answer events in the same syntax; a sign is what the learner drew. */
function answer(...events: string[]): AnswerNote[] {
  const out: AnswerNote[] = [];
  events.forEach((e, i) => {
    const [names, dur = 'q'] = e.split(':');
    const parts = names!.split('+');
    for (const name of parts) {
      const m = /^([A-G])(#|b|n|)(\d)$/.exec(name)!;
      const sign = ({ '': 'none', '#': 'sharp', b: 'flat', n: 'natural' } as const)[m[2] as '' | '#' | 'b' | 'n'];
      out.push({ id: nextId++, step: staffStep(parseSpelled(`${m[1]}${m[3]}`)), sign, duration: dur as 'q' | 'h', chord: parts.length > 1 ? i + 1 : undefined });
    }
  });
  return out;
}

const kinds = (r: ReturnType<typeof gradeAnswer>) => r.mistakes.map((m) => m.kind);

describe('grading chords', () => {
  it('gives full marks when every note of every chord is right', () => {
    const r = gradeAnswer(melody('C5+E5+G5:h', 'D5', 'E5'), [answer('C5+E5+G5:h', 'D5', 'E5')], C_MAJOR);
    expect(r.mistakes).toEqual([]);
    expect(r.pitchScore).toBe(1);
    expect(r.rhythmScore).toBe(1);
  });

  it('marks a left-out chord tone missing and a wrong one wrong, without disturbing the rest of the chord', () => {
    const missing = gradeAnswer(melody('C5+E5+G5:h', 'D5:h'), [answer('C5+G5:h', 'D5:h')], C_MAJOR);
    expect(kinds(missing)).toEqual(['missing']);
    expect(missing.pairs.filter((p) => p.pitchOk)).toHaveLength(3);
    const wrong = gradeAnswer(melody('C5+E5+G5:h', 'D5:h'), [answer('C5+F5+G5:h', 'D5:h')], C_MAJOR);
    expect(kinds(wrong)).toEqual(['wrong-letter']);
  });

  it('reports a wrong chord length once, not once per note', () => {
    const r = gradeAnswer(melody('C5+E5+G5:h', 'D5:h'), [answer('C5+E5+G5', 'D5:h', 'E5')], C_MAJOR);
    expect(kinds(r).filter((k) => k === 'wrong-duration')).toHaveLength(1);
    expect(r.rhythmScore).toBeLessThan(1);
  });

  it('keeps the chord spelling of an altered tone: E flat for the D sharp of C7 sharp nine is an enharmonic slip', () => {
    const target = melody('C5+E5+Bb5+D#6:h', 'C5:h');
    const r = gradeAnswer(target, [answer('C5+E5+Bb5+Eb6:h', 'C5:h')], C_MAJOR);
    expect(kinds(r)).toEqual(['enharmonic']);
    const right = gradeAnswer(target, [answer('C5+E5+Bb5+D#6:h', 'C5:h')], C_MAJOR);
    expect(right.mistakes).toEqual([]);
  });
});
