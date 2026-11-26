import { describe, expect, it } from 'vitest';
import { beatLabel, describePlay, gradePlaying, playTargets, TIMING_WINDOW, type PlayTarget } from './playTiming';
import type { MelodyNote } from '../melody/types';
import { C_MAJOR } from '../music/key';

const SPB = 0.75; // 80 bpm
const START = 10;
const at = (beat: number, offsetBeats = 0) => START + (beat + offsetBeats) * SPB;

// C4 E4 G4 as quarters, then a half-note C5 (sounding).
const LINE: PlayTarget[] = [
  { beat: 0, midis: [48], duration: 'q' },
  { beat: 1, midis: [52], duration: 'q' },
  { beat: 2, midis: [55], duration: 'q' },
  { beat: 3, midis: [60], duration: 'q' },
];

// The melody of the user's screenshot (2026-11-26): written E5 quarter, D5 half, E5 quarter.
const E5 = 64;
const D5 = 62;
const SHOT: MelodyNote[] = [
  { midi: E5, duration: 'q', string: 1, fret: 0 },
  { midi: D5, duration: 'h', string: 2, fret: 3 },
  { midi: E5, duration: 'q', string: 1, fret: 0 },
];
const shot = { notes: SHOT, key: C_MAJOR, barBeats: [4] };

describe('play round timing (R46)', () => {
  it('turns a melody into events with their beats, chords as one event', () => {
    const notes: MelodyNote[] = [
      { midi: 48, duration: 'q', string: 5, fret: 3 },
      { midi: 52, duration: 'e', string: 4, fret: 2 },
      { midi: 55, duration: 'e', string: 3, fret: 0 },
      { midi: 48, duration: 'h', string: 5, fret: 3, chord: 1 },
      { midi: 52, duration: 'h', string: 4, fret: 2, chord: 1 },
    ];
    expect(playTargets({ notes }).map(({ beat, midis }) => ({ beat, midis }))).toEqual([
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
    const g = gradePlaying(LINE, taps, START, SPB);
    expect(g.passed).toBe(true);
    expect(g.good).toBe(4);
    expect(TIMING_WINDOW).toBe(0.2);
  });

  it('a note played well off the beat is early or late, not a wrong note', () => {
    const taps = [
      { time: at(0, -0.25), midi: 48 },
      { time: at(1, 0.6), midi: 52 },
      { time: at(2, 0.6), midi: 55 },
      { time: at(3), midi: 60 },
    ];
    const g = gradePlaying(LINE, taps, START, SPB);
    expect(g.events.map((e) => e.verdict)).toEqual(['early', 'late', 'late', 'good']);
    expect(g.extras).toEqual([]);
    const lines = describePlay(g, { notes: LINE.map((t) => ({ midi: t.midis[0]!, duration: t.duration, string: 1, fret: 0 })), key: C_MAJOR, barBeats: [4] });
    expect(lines.every((l) => l.kind === 'timing')).toBe(true);
    expect(lines[0]!.text).toBe('Early by 25% of a beat. It comes on beat 1.');
  });

  it('a half note tapped again where the next note comes is timing, and says to hold it', () => {
    // E5 in time, D5 in time, then D5 again on beat 4 instead of E5.
    const g = gradePlaying(playTargets(shot), [{ time: at(0), midi: E5 }, { time: at(1), midi: D5 }, { time: at(3), midi: D5 }], START, SPB);
    expect(g.events.map((e) => e.verdict)).toEqual(['good', 'good', 'wrong']);
    const [line] = describePlay(g, shot);
    expect(line).toEqual({
      title: 'Note 3, E5',
      kind: 'timing',
      text: 'D5 was played again here instead. D5 is a half note (2 beats): play it once and hold it, then E5 comes in on beat 4.',
    });
  });

  it('a half note tapped twice, with the next note still in time, is a repeat on that note', () => {
    const g = gradePlaying(playTargets(shot), [{ time: at(0), midi: E5 }, { time: at(1), midi: D5 }, { time: at(2), midi: D5 }, { time: at(3), midi: E5 }], START, SPB);
    expect(g.good).toBe(3);
    expect(g.passed).toBe(false);
    expect(describePlay(g, shot)).toEqual([
      { title: 'Note 2, D5', kind: 'timing', text: 'Played again on beat 3. It is a half note (2 beats): play it once and hold it until E5 on beat 4.' },
    ]);
  });

  it('only a pitch that is not in the melody there is a wrong note', () => {
    const g = gradePlaying(LINE, [{ time: at(0), midi: 49 }, { time: at(2), midi: 55 }, { time: at(3), midi: 60 }], START, SPB);
    expect(g.events.map((e) => e.verdict)).toEqual(['wrong', 'missed', 'good', 'good']);
    const lines = describePlay(g, { notes: LINE.map((t) => ({ midi: t.midis[0]!, duration: t.duration, string: 1, fret: 0 })), key: C_MAJOR, barBeats: [4] });
    expect(lines.map((l) => l.kind)).toEqual(['pitch', 'missing']);
  });

  it('taps in the count-in or after the end are timing extras', () => {
    const taps = [{ time: at(-2), midi: 48 }, ...LINE.map((t) => ({ time: at(t.beat), midi: t.midis[0]! })), { time: at(8), midi: 60 }];
    const g = gradePlaying(LINE, taps, START, SPB);
    expect(g.good).toBe(4);
    expect(g.extras.map((x) => x.kind)).toEqual(['before', 'after']);
    expect(g.passed).toBe(false);
  });

  it('a chord counts when its first tap is in time and every chord note is played', () => {
    const chord: PlayTarget[] = [
      { beat: 0, midis: [40, 47, 52], duration: 'h' },
      { beat: 2, midis: [52], duration: 'h' },
    ];
    const strum = [
      { time: at(0, 0.02), midi: 40 },
      { time: at(0, 0.2), midi: 47 },
      { time: at(0, 0.4), midi: 52 },
      { time: at(2), midi: 52 },
    ];
    expect(gradePlaying(chord, strum, START, SPB).passed).toBe(true);
    const partial = strum.filter((t) => t.midi !== 47);
    expect(gradePlaying(chord, partial, START, SPB).events[0]!.verdict).toBe('incomplete');
  });

  it('names beats in the bar, and the bar when there are several', () => {
    expect(beatLabel(3, [4])).toBe('beat 4');
    expect(beatLabel(1.5, [4])).toBe('between beats 2 and 3');
    expect(beatLabel(4, [4, 4])).toBe('bar 2, beat 1');
  });
});
