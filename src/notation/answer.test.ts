import { describe, expect, it } from 'vitest';
import { C_MAJOR, keyFromId } from '../music/key';
import { parseSpelled, spelledToString, staffStep } from '../music/pitch';
import {
  addRejection,
  answerBarToSounding,
  answerReducer,
  barBeats,
  createAnswer,
  durationRejection,
  flattenAnswer,
  isBarFull,
  resolveAnswerBar,
  type AnswerLimits,
  type AnswerState,
} from './answer';

const limits: AnswerLimits = {
  barBeats: [4, 4, 4, 4],
  minStep: staffStep(parseSpelled('C4')),
  maxStep: staffStep(parseSpelled('A5')),
};
const C5 = staffStep(parseSpelled('C5'));
const F5 = staffStep(parseSpelled('F5'));
const reduce = (s: AnswerState, a: Parameters<typeof answerReducer>[1]) => answerReducer(s, a, limits);
const names = (s: AnswerState, bar = 0, key = C_MAJOR) => resolveAnswerBar(s.bars[bar]!, key).map(spelledToString);

describe('answer reducer', () => {
  it('adds notes to the tapped bar and fills it to the time signature', () => {
    let s = createAnswer(4);
    s = reduce(s, { type: 'add', bar: 1, step: C5, duration: 'h' });
    s = reduce(s, { type: 'add', bar: 1, step: C5 + 1, duration: 'q' });
    expect(s.bars[1]!.map((n) => n.duration)).toEqual(['h', 'q']);
    expect(s.bars[0]).toEqual([]);
    expect(isBarFull(s.bars[1]!, 4)).toBe(false);
    s = reduce(s, { type: 'add', bar: 1, step: C5, duration: 'q' });
    expect(isBarFull(s.bars[1]!, 4)).toBe(true);
  });

  it('rejects notes that do not fit and returns the same state object', () => {
    let s = createAnswer(1);
    s = reduce(s, { type: 'add', bar: 0, step: C5, duration: 'h' });
    s = reduce(s, { type: 'add', bar: 0, step: C5, duration: 'q' });
    expect(addRejection(s.bars[0]!, 'h', 4)).toBe('does-not-fit');
    const rejected = reduce(s, { type: 'add', bar: 0, step: C5, duration: 'h' });
    expect(rejected).toBe(s);
    s = reduce(s, { type: 'add', bar: 0, step: C5, duration: 'q' });
    expect(addRejection(s.bars[0]!, 'q', 4)).toBe('bar-full');
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
    expect(names(s)).toEqual(['E5']);
    s = reduce(s, { type: 'nudge', id, delta: -9 });
    expect(names(s)).toEqual(['C4']);
    expect(reduce(s, { type: 'nudge', id, delta: -1 })).toBe(s);
  });

  it('changes the length of an existing note when it still fits', () => {
    let s = createAnswer(1);
    s = reduce(s, { type: 'add', bar: 0, step: C5, duration: 'q' });
    s = reduce(s, { type: 'add', bar: 0, step: C5, duration: 'q' });
    s = reduce(s, { type: 'add', bar: 0, step: C5, duration: 'q' });
    s = reduce(s, { type: 'setDuration', id: 1, duration: 'h' });
    expect(s.bars[0]!.map((n) => n.duration)).toEqual(['h', 'q', 'q']);
    expect(durationRejection(s.bars[0]!, s.bars[0]![1]!, 'h', 4)).toBe('does-not-fit');
    expect(reduce(s, { type: 'setDuration', id: 2, duration: 'h' })).toBe(s);
    s = reduce(s, { type: 'setDuration', id: 1, duration: 'q' });
    expect(s.bars[0]![0]!.duration).toBe('q');
    s = reduce(s, { type: 'undo' });
    expect(s.bars[0]![0]!.duration).toBe('h');
    expect(reduce(s, { type: 'setDuration', id: 1, duration: 'h' })).toBe(s);
  });

  it('draws a sign in front of a note and removes it when tapped again', () => {
    let s = createAnswer(1);
    s = reduce(s, { type: 'add', bar: 0, step: C5, duration: 'q' });
    s = reduce(s, { type: 'setSign', id: 1, sign: 'sharp' });
    expect(s.bars[0]![0]!.sign).toBe('sharp');
    expect(names(s)).toEqual(['C#5']);
    s = reduce(s, { type: 'setSign', id: 1, sign: 'flat' });
    expect(names(s)).toEqual(['Cb5']);
    s = reduce(s, { type: 'setSign', id: 1, sign: 'natural' });
    expect(s.bars[0]![0]!.sign).toBe('natural');
    expect(names(s)).toEqual(['C5']);
    s = reduce(s, { type: 'setSign', id: 1, sign: 'natural' });
    expect(s.bars[0]![0]!.sign).toBe('none');
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
});

describe('reading an answer under a key signature', () => {
  const G = keyFromId('G')!;

  it('a plain F in G major is F sharp; a natural sign makes it F', () => {
    let s = createAnswer(1);
    s = reduce(s, { type: 'add', bar: 0, step: F5, duration: 'q' });
    s = reduce(s, { type: 'add', bar: 0, step: F5, duration: 'q' });
    expect(names(s, 0, G)).toEqual(['F#5', 'F#5']);
    s = reduce(s, { type: 'setSign', id: 1, sign: 'natural' });
    // The natural carries to the second F in the same bar.
    expect(names(s, 0, G)).toEqual(['F5', 'F5']);
  });

  it('a courtesy sharp on an F in G major is still F sharp', () => {
    let s = createAnswer(1);
    s = reduce(s, { type: 'add', bar: 0, step: F5, duration: 'q' });
    s = reduce(s, { type: 'setSign', id: 1, sign: 'sharp' });
    expect(names(s, 0, G)).toEqual(['F#5']);
  });

  it('signs do not cross the bar line', () => {
    let s = createAnswer(2);
    s = reduce(s, { type: 'add', bar: 0, step: F5, duration: 'q' });
    s = reduce(s, { type: 'setSign', id: 1, sign: 'sharp' });
    s = reduce(s, { type: 'add', bar: 1, step: F5, duration: 'q' });
    expect(names(s, 0)).toEqual(['F#5']);
    expect(names(s, 1)).toEqual(['F5']);
  });

  it('converts to sounding pitch an octave down', () => {
    let s = createAnswer(1);
    s = reduce(s, { type: 'add', bar: 0, step: C5, duration: 'q' });
    expect(answerBarToSounding(s.bars[0]!, C_MAJOR)).toEqual([60]);
    s = reduce(s, { type: 'setSign', id: 1, sign: 'sharp' });
    expect(answerBarToSounding(s.bars[0]!, C_MAJOR)).toEqual([61]);
  });
});

describe('chords in the answer', () => {
  it('stacks notes onto a note to make a chord: sorted low to high, one length, counted once', () => {
    let s = createAnswer(1);
    s = reduce(s, { type: 'add', bar: 0, step: C5, duration: 'h' });
    s = reduce(s, { type: 'stack', id: 1, step: C5 + 4 }); // G5
    s = reduce(s, { type: 'stack', id: 1, step: C5 + 2 }); // E5
    expect(s.bars[0]!.map((n) => n.step)).toEqual([C5, C5 + 2, C5 + 4]);
    expect(s.bars[0]!.every((n) => n.chord === 1 && n.duration === 'h')).toBe(true);
    expect(barBeats(s.bars[0]!)).toBe(2);
    expect(reduce(s, { type: 'stack', id: 1, step: C5 + 2 })).toBe(s);
    s = reduce(s, { type: 'setDuration', id: 2, duration: 'q' });
    expect(s.bars[0]!.every((n) => n.duration === 'q')).toBe(true);
    s = reduce(s, { type: 'add', bar: 0, step: C5, duration: 'h' });
    expect(barBeats(s.bars[0]!)).toBe(3);
    expect(s.bars[0]![3]!.chord).toBeUndefined();
  });

  it('nudging a chord note keeps the chord sorted and refuses to land on another chord note', () => {
    let s = createAnswer(1);
    s = reduce(s, { type: 'add', bar: 0, step: C5, duration: 'h' });
    s = reduce(s, { type: 'stack', id: 1, step: C5 + 2 });
    expect(reduce(s, { type: 'nudge', id: 1, delta: 2 })).toBe(s);
    s = reduce(s, { type: 'nudge', id: 1, delta: 4 }); // C5 -> G5, now above the E5
    expect(s.bars[0]!.map((n) => n.step)).toEqual([C5 + 2, C5 + 4]);
    expect(s.bars[0]!.map((n) => n.id)).toEqual([2, 1]);
  });

  it('deleting down to one note makes it a single note again; a second chord gets its own id', () => {
    let s = createAnswer(1);
    s = reduce(s, { type: 'add', bar: 0, step: C5, duration: 'q' });
    s = reduce(s, { type: 'stack', id: 1, step: C5 + 2 });
    s = reduce(s, { type: 'add', bar: 0, step: F5, duration: 'q' });
    s = reduce(s, { type: 'stack', id: 3, step: F5 + 2 });
    expect(s.bars[0]!.map((n) => n.chord)).toEqual([1, 1, 2, 2]);
    s = reduce(s, { type: 'delete', id: 2 });
    expect(s.bars[0]![0]!.chord).toBeUndefined();
    expect(barBeats(s.bars[0]!)).toBe(2);
  });
});
