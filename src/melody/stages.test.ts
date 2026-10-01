import { describe, expect, it } from 'vitest';
import { midiAt } from '../music/fretboard';
import { degreeOf, isDiatonic, keyId, spellInKey } from '../music/key';
import { midiFromSpelled, parseSpelled, staffStep, writtenFromSounding } from '../music/pitch';
import { splitIntoBars, totalBeats } from './bars';
import { generateMelody, pitchPool } from './generator';
import { MAX_COUNTS, MIN_COUNTS } from './meter';
import { STAGES } from './stages';

const SEEDS = Array.from({ length: 40 }, (_, i) => i * 104729 + 7);
const LOWEST_WRITTEN = staffStep(parseSpelled('C4'));
const HIGHEST_WRITTEN = staffStep(parseSpelled('D6'));

describe('stage ladder configs', () => {
  it('is numbered in order; stage 1 starts at one bar, later stages at two', () => {
    STAGES.forEach((s, i) => expect(s.number).toBe(i + 1));
    expect(STAGES[0]!.startCounts).toBe(MIN_COUNTS);
    expect(STAGES.slice(1).every((s) => s.startCounts === 8)).toBe(true);
    expect(STAGES.every((s) => s.maxCounts === MAX_COUNTS)).toBe(true);
  });

  it('gives every key of every stage a complete scale in its fret window', () => {
    for (const stage of STAGES) {
      for (const key of stage.keys) {
        const degrees = new Set(pitchPool(stage, key).map((p) => p.degree));
        expect(degrees.size, `${stage.id} ${keyId(key)}`).toBe(7);
      }
    }
  });

  it('generates valid melodies at the start, an odd length and the maximum for every stage', () => {
    for (const stage of STAGES) {
      for (const seed of SEEDS) {
        for (const counts of [stage.startCounts, stage.startCounts + 1, stage.maxCounts]) {
          const melody = generateMelody(stage, seed, counts);
          expect(stage.keys).toContain(melody.key);
          expect(melody.counts).toBe(counts);
          expect(totalBeats(melody.notes)).toBe(counts);
          const bars = splitIntoBars(melody.notes, melody.barBeats);
          expect(bars).toHaveLength(melody.barBeats.length);
          bars.forEach((bar, i) => expect(bar.beats).toBe(melody.barBeats[i]));
          for (const note of melody.notes) {
            expect(stage.durations).toContain(note.duration);
            expect(isDiatonic(note.midi, melody.key)).toBe(true);
            expect(stage.strings).toContain(note.string);
            expect(note.fret).toBeGreaterThanOrEqual(stage.fretRange[0]);
            expect(note.fret).toBeLessThanOrEqual(stage.fretRange[1]);
            expect(midiAt({ string: note.string, fret: note.fret })).toBe(note.midi);
            const step = staffStep(spellInKey(writtenFromSounding(note.midi), melody.key));
            expect(step).toBeGreaterThanOrEqual(LOWEST_WRITTEN);
            expect(step).toBeLessThanOrEqual(HIGHEST_WRITTEN);
          }
          expect(stage.startDegrees).toContain(degreeOf(melody.notes[0]!.midi, melody.key));
          expect(stage.endDegrees).toContain(degreeOf(melody.notes[melody.notes.length - 1]!.midi, melody.key));
        }
      }
    }
  });

  it('uses every key of a stage over enough seeds', () => {
    const stage = STAGES[9]!;
    const seen = new Set<string>();
    for (let seed = 1; seed < 400; seed++) seen.add(keyId(generateMelody(stage, seed, 8).key));
    expect(seen.size).toBe(stage.keys.length);
  });

  it('marks only the seven-accidental stage optional and drops listens to two in Part B', () => {
    expect(STAGES.filter((s) => s.optional).map((s) => s.number)).toEqual([11]);
    expect(STAGES.filter((s) => s.number >= 14).every((s) => s.maxListens === 2)).toBe(true);
    expect(STAGES.filter((s) => s.number < 14).every((s) => s.maxListens === 3)).toBe(true);
  });

  it('low-string and fifth-position stages reach below and above the staff', () => {
    const low = STAGES[11]!;
    const high = STAGES[12]!;
    const lowest = Math.min(...SEEDS.flatMap((s) => generateMelody(low, s, 16).notes.map((n) => n.midi)));
    const highest = Math.max(...SEEDS.flatMap((s) => generateMelody(high, s, 16).notes.map((n) => n.midi)));
    expect(spellInKey(writtenFromSounding(lowest), low.keys[0]!).octave).toBe(4);
    expect(writtenFromSounding(lowest)).toBeLessThan(midiFromSpelled(parseSpelled('E4')));
    expect(writtenFromSounding(highest)).toBeGreaterThan(midiFromSpelled(parseSpelled('A5')));
  });
});
