import { describe, expect, it } from 'vitest';
import { gradePlaying, playTargets, TIMING_WINDOW, verdictText, type PlayTarget } from './playTiming';
import type { MelodyNote } from '../melody/types';

const SPB = 0.75; // 80 bpm
const START = 10;
const at = (beat: number, offsetBeats = 0) => START + (beat + offsetBeats) * SPB;

// C4 E4 G4 as quarters, then a half-note C5.
const LINE: PlayTarget[] = [
  { beat: 0, midis: [48] },
  { beat: 1, midis: [52] },
  { beat: 2, midis: [55] },
  { beat: 3, midis: [60] },
];

describe('play round timing (R46)', () => {
  it('turns a melody into events with their beats, chords as one event', () => {
    const notes: MelodyNote[] = [
      { midi: 48, duration: 'q', string: 5, fret: 3 },
      { midi: 52, duration: 'e', string: 4, fret: 2 },
      { midi: 55, duration: 'e', string: 3, fret: 0 },
      { midi: 48, duration: 'h', string: 5, fret: 3, chord: 1 },
      { midi: 52, duration: 'h', string: 4, fret: 2, chord: 1 },
    ];
    expect(playTargets({ notes })).toEqual([
      { beat: 0, midis: [48] },
      { beat: 1, midis: [52] },
      { beat: 1.5, midis: [55] },
      { beat: 2, midis: [48, 52] },
    ]);
  });

  it('passes every right note within 20% of a beat, on any string', () => {
    const taps = [
      { time: at(0, 0.19), midi: 48 },
      { time: at(1, -0.2), midi: 52 },
      { time: at(2), midi: 55 },
      { time: at(3, 0.05), midi: 60 },
    ];
    const g = gradePlaying(LINE, taps, START, SPB, 2);
    expect(g.passed).toBe(true);
    expect(g.good).toBe(4);
  });

  it('marks a tap just past the window early or late, with how far', () => {
    const taps = [
      { time: at(0, -0.25), midi: 48 },
      { time: at(1, 0.22), midi: 52 },
      { time: at(2), midi: 55 },
      { time: at(3), midi: 60 },
    ];
    const g = gradePlaying(LINE, taps, START, SPB, 2);
    expect(g.passed).toBe(false);
    expect(g.events.map((e) => e.verdict)).toEqual(['early', 'late', 'good', 'good']);
    expect(verdictText(g.events[0]!, false)).toBe('early by 25% of a beat');
    expect(TIMING_WINDOW).toBe(0.2);
  });

  it('a wrong pitch, a missing note and a doubled note all fail', () => {
    const taps = [
      { time: at(0), midi: 49 },
      { time: at(2), midi: 55 },
      { time: at(2, 0.3), midi: 55 },
      { time: at(3), midi: 60 },
    ];
    const g = gradePlaying(LINE, taps, START, SPB, 2);
    expect(g.events.map((e) => e.verdict)).toEqual(['wrong', 'missed', 'extra', 'good']);
  });

  it('a tap before the count-in ends or long after the last note is stray', () => {
    const taps = [{ time: at(-2), midi: 48 }, ...LINE.map((t) => ({ time: at(t.beat), midi: t.midis[0]! })), { time: at(8), midi: 60 }];
    const g = gradePlaying(LINE, taps, START, SPB, 2);
    expect(g.good).toBe(4);
    expect(g.stray).toBe(2);
    expect(g.passed).toBe(false);
  });

  it('a chord counts when its first tap is in time and every chord note follows before the next note', () => {
    const chord: PlayTarget[] = [{ beat: 0, midis: [40, 47, 52] }, { beat: 2, midis: [52] }];
    const strum = [
      { time: at(0, 0.02), midi: 40 },
      { time: at(0, 0.2), midi: 47 },
      { time: at(0, 0.4), midi: 52 },
      { time: at(2), midi: 52 },
    ];
    expect(gradePlaying(chord, strum, START, SPB, 2).passed).toBe(true);
    const partial = strum.filter((t) => t.midi !== 47);
    expect(gradePlaying(chord, partial, START, SPB, 2).events[0]!.verdict).toBe('incomplete');
  });
});
