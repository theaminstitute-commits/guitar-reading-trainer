import { describe, expect, it } from 'vitest';
import { parseSpelled, spelledToString, staffStep } from '../music/pitch';
import {
  addRejection,
  answerNoteToSounding,
  answerNoteToSpelled,
  answerReducer,
  createAnswer,
  durationRejection,
  flattenAnswer,
  isBarFull,
  type AnswerLimits,
  type AnswerState,
} from './answer';

const limits: AnswerLimits = {
  timeSignature: [4, 4],
  minStep: staffStep(parseSpelled('C4')),
  maxStep: staffStep(parseSpelled('A5')),
};
const C5 = staffStep(parseSpelled('C5'));
const reduce = (s: AnswerState, a: Parameters<typeof answerReducer>[1]) => answerReducer(s, a, limits);

describe('answer reducer', () => {
  it('adds notes to the tapped bar and fills it to the time signature', () => {
    let s = createAnswer(4);
    s = reduce(s, { type: 'add', bar: 1, step: C5, duration: 'h' });
    s = reduce(s, { type: 'add', bar: 1, step: C5 + 1, duration: 'q' });
    expect(s.bars[1]!.map((n) => n.duration)).toEqual(['h', 'q']);
    expect(s.bars[0]).toEqual([]);
    expect(isBarFull(s.bars[1]!, [4, 4])).toBe(false);
    s = reduce(s, { type: 'add', bar: 1, step: C5, duration: 'q' });
    expect(isBarFull(s.bars[1]!, [4, 4])).toBe(true);
  });

  it('rejects notes that do not fit and returns the same state object', () => {
    let s = createAnswer(1);
    s = reduce(s, { type: 'add', bar: 0, step: C5, duration: 'h' });
    s = reduce(s, { type: 'add', bar: 0, step: C5, duration: 'q' });
    expect(addRejection(s.bars[0]!, 'h', [4, 4])).toBe('does-not-fit');
    const rejected = reduce(s, { type: 'add', bar: 0, step: C5, duration: 'h' });
    expect(rejected).toBe(s);
    s = reduce(s, { type: 'add', bar: 0, step: C5, duration: 'q' });
    expect(addRejection(s.bars[0]!, 'q', [4, 4])).toBe('bar-full');
    expect(reduce(s, { type: 'add', bar: 0, step: C5, duration: 'q' })).toBe(s);
  });

  it('rejects steps outside the allowed range', () => {
    const s = createAnswer(1);
    expect(reduce(s, { type: 'add', bar: 0, step: limits.maxStep + 1, duration: 'q' })).toBe(s);
    expect(reduce(s, { type: 'add', bar: 0, step: limits.minStep - 1, duration: 'q' })).toBe(s);
  });

  it('nudges a note by steps and clamps at the range', () => {
    let s = createAnswer(1);
    s = reduce(s, { type: 'add', bar: 0, step: C5, duration: 'q' });
    const id = s.bars[0]![0]!.id;
    s = reduce(s, { type: 'nudge', id, delta: 2 });
    expect(spelledToString(answerNoteToSpelled(s.bars[0]![0]!))).toBe('E5');
    s = reduce(s, { type: 'nudge', id, delta: -9 });
    expect(spelledToString(answerNoteToSpelled(s.bars[0]![0]!))).toBe('C4');
    expect(reduce(s, { type: 'nudge', id, delta: -1 })).toBe(s);
  });

  it('changes the length of an existing note when it still fits', () => {
    let s = createAnswer(1);
    s = reduce(s, { type: 'add', bar: 0, step: C5, duration: 'q' });
    s = reduce(s, { type: 'add', bar: 0, step: C5, duration: 'q' });
    s = reduce(s, { type: 'add', bar: 0, step: C5, duration: 'q' });
    // 3 beats used: the first note may grow to a half (4 beats total)...
    s = reduce(s, { type: 'setDuration', id: 1, duration: 'h' });
    expect(s.bars[0]!.map((n) => n.duration)).toEqual(['h', 'q', 'q']);
    // ...but a second one may not (5 beats).
    expect(durationRejection(s.bars[0]!, s.bars[0]![1]!, 'h', [4, 4])).toBe('does-not-fit');
    expect(reduce(s, { type: 'setDuration', id: 2, duration: 'h' })).toBe(s);
    // Shrinking always fits, and undo reverts the edit.
    s = reduce(s, { type: 'setDuration', id: 1, duration: 'q' });
    expect(s.bars[0]![0]!.duration).toBe('q');
    s = reduce(s, { type: 'undo' });
    expect(s.bars[0]![0]!.duration).toBe('h');
    expect(reduce(s, { type: 'setDuration', id: 1, duration: 'h' })).toBe(s);
  });

  it('sets accidentals and toggles the explicit natural', () => {
    let s = createAnswer(1);
    s = reduce(s, { type: 'add', bar: 0, step: C5, duration: 'q' });
    const id = 1;
    s = reduce(s, { type: 'setAccidental', id, accidental: 1 });
    expect(spelledToString(answerNoteToSpelled(s.bars[0]![0]!))).toBe('C#5');
    expect(s.bars[0]![0]!.showNatural).toBe(false);
    s = reduce(s, { type: 'setAccidental', id, accidental: 0 });
    expect(spelledToString(answerNoteToSpelled(s.bars[0]![0]!))).toBe('C5');
    expect(s.bars[0]![0]!.showNatural).toBe(true);
    s = reduce(s, { type: 'setAccidental', id, accidental: 0 });
    expect(s.bars[0]![0]!.showNatural).toBe(false);
    s = reduce(s, { type: 'setAccidental', id, accidental: -1 });
    expect(spelledToString(answerNoteToSpelled(s.bars[0]![0]!))).toBe('Cb5');
  });

  it('undo steps back through every change, delete removes one note, clear empties all', () => {
    let s = createAnswer(2);
    s = reduce(s, { type: 'add', bar: 0, step: C5, duration: 'q' });
    s = reduce(s, { type: 'add', bar: 1, step: C5, duration: 'h' });
    s = reduce(s, { type: 'nudge', id: 2, delta: 1 });
    expect(flattenAnswer(s)).toHaveLength(2);
    s = reduce(s, { type: 'undo' });
    expect(s.bars[1]![0]!.step).toBe(C5);
    s = reduce(s, { type: 'delete', id: 1 });
    expect(s.bars[0]).toEqual([]);
    expect(flattenAnswer(s)).toHaveLength(1);
    s = reduce(s, { type: 'undo' });
    expect(flattenAnswer(s)).toHaveLength(2);
    s = reduce(s, { type: 'clear' });
    expect(flattenAnswer(s)).toHaveLength(0);
    s = reduce(s, { type: 'undo' });
    expect(flattenAnswer(s)).toHaveLength(2);
    const empty = createAnswer(1);
    expect(reduce(empty, { type: 'undo' })).toBe(empty);
    expect(reduce(empty, { type: 'clear' })).toBe(empty);
  });

  it('ids keep increasing after undo so old and new notes never collide', () => {
    let s = createAnswer(1);
    s = reduce(s, { type: 'add', bar: 0, step: C5, duration: 'q' });
    s = reduce(s, { type: 'undo' });
    s = reduce(s, { type: 'add', bar: 0, step: C5, duration: 'q' });
    expect(s.bars[0]![0]!.id).toBe(2);
  });

  it('converts a written note to its sounding pitch one octave down', () => {
    // Written C5 on a guitar staff sounds C4 (60).
    expect(answerNoteToSounding({ id: 1, step: C5, accidental: 0, showNatural: false, duration: 'q' })).toBe(60);
    expect(answerNoteToSounding({ id: 1, step: C5, accidental: 1, showNatural: false, duration: 'q' })).toBe(61);
  });
});
