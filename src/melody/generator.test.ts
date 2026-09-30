import { describe, expect, it } from 'vitest';
import { beatsOf, beatsPerBar } from '../music/duration';
import { midiAt } from '../music/fretboard';
import { degreeOf, isDiatonic, spellInKey } from '../music/key';
import { staffStep } from '../music/pitch';
import { splitIntoBars, totalBeats } from './bars';
import { generateMelody, generateRhythm, pitchPool } from './generator';
import { LEVEL_1, type LevelConfig } from './levelConfig';
import { createRng } from './random';

const SEEDS = Array.from({ length: 200 }, (_, i) => i * 7919 + 1);

describe('pitchPool', () => {
  it('Level 1 gives the eight naturals G3..G4, one position each', () => {
    const pool = pitchPool(LEVEL_1);
    expect(pool.map((p) => p.midi)).toEqual([55, 57, 59, 60, 62, 64, 65, 67]);
    expect(pool.every((p) => p.positions.length === 1)).toBe(true);
    expect(pool.find((p) => p.midi === 59)!.positions).toEqual([{ string: 2, fret: 0 }]);
  });

  it('is sorted and consecutive entries are one diatonic step apart', () => {
    const pool = pitchPool(LEVEL_1);
    for (let i = 1; i < pool.length; i++) {
      expect(pool[i]!.step - pool[i - 1]!.step).toBe(1);
    }
  });
});

describe('generateRhythm', () => {
  it('every bar sums exactly to the time signature', () => {
    for (const seed of SEEDS) {
      const rhythm = generateRhythm(LEVEL_1, createRng(seed));
      const bars = splitIntoBars(rhythm.map((duration) => ({ duration })), LEVEL_1.timeSignature);
      expect(bars).toHaveLength(LEVEL_1.bars);
      for (const bar of bars) expect(bar.beats).toBe(beatsPerBar(LEVEL_1.timeSignature));
    }
  });

  it('uses only allowed durations', () => {
    const rhythm = generateRhythm(LEVEL_1, createRng(42));
    expect(rhythm.every((d) => LEVEL_1.durations.includes(d))).toBe(true);
  });

  it('throws a clear error when nothing fits', () => {
    const bad: LevelConfig = { ...LEVEL_1, timeSignature: [3, 4], durations: ['h'] };
    expect(() => generateRhythm(bad, createRng(1))).toThrow(/no allowed duration fits/);
  });
});

describe('generateMelody', () => {
  it('is deterministic for a seed and varies across seeds', () => {
    expect(generateMelody(LEVEL_1, 123)).toEqual(generateMelody(LEVEL_1, 123));
    const distinct = new Set(SEEDS.map((s) => JSON.stringify(generateMelody(LEVEL_1, s).notes)));
    expect(distinct.size).toBeGreaterThan(SEEDS.length * 0.95);
  });

  it('obeys every Level 1 constraint over many seeds', () => {
    const [lowFret, highFret] = LEVEL_1.fretRange;
    for (const seed of SEEDS) {
      const melody = generateMelody(LEVEL_1, seed);
      expect(melody.seed).toBe(seed);
      expect(melody.levelId).toBe('level-1');
      expect(melody.tempo).toBe(72);

      // Bars add up.
      expect(totalBeats(melody.notes)).toBe(LEVEL_1.bars * beatsPerBar(LEVEL_1.timeSignature));
      const bars = splitIntoBars(melody.notes, melody.timeSignature);
      expect(bars).toHaveLength(4);
      bars.forEach((bar) => expect(bar.beats).toBe(4));

      for (const note of melody.notes) {
        expect(LEVEL_1.durations).toContain(note.duration);
        expect(beatsOf(note.duration)).toBeGreaterThan(0);
        // In range, in key, on the allowed strings and frets.
        expect(note.midi).toBeGreaterThanOrEqual(55);
        expect(note.midi).toBeLessThanOrEqual(67);
        expect(isDiatonic(note.midi, LEVEL_1.key)).toBe(true);
        expect(LEVEL_1.strings).toContain(note.string);
        expect(note.fret).toBeGreaterThanOrEqual(lowFret);
        expect(note.fret).toBeLessThanOrEqual(highFret);
        // The display position really produces the pitch.
        expect(midiAt({ string: note.string, fret: note.fret })).toBe(note.midi);
      }

      // Leaps no bigger than a third.
      for (let i = 1; i < melody.notes.length; i++) {
        const a = staffStep(spellInKey(melody.notes[i - 1]!.midi, LEVEL_1.key));
        const b = staffStep(spellInKey(melody.notes[i]!.midi, LEVEL_1.key));
        expect(Math.abs(a - b)).toBeLessThanOrEqual(LEVEL_1.maxLeapSteps);
      }

      // Starts and ends on a chord tone.
      const first = melody.notes[0]!;
      const last = melody.notes[melody.notes.length - 1]!;
      expect(LEVEL_1.startDegrees).toContain(degreeOf(first.midi, LEVEL_1.key));
      expect(LEVEL_1.endDegrees).toContain(degreeOf(last.midi, LEVEL_1.key));
    }
  });

  it('has between 8 and 16 notes in four bars of quarters and halves', () => {
    for (const seed of SEEDS) {
      const n = generateMelody(LEVEL_1, seed).notes.length;
      expect(n).toBeGreaterThanOrEqual(8);
      expect(n).toBeLessThanOrEqual(16);
    }
  });

  it('does not repeat the same pitch for the whole melody', () => {
    const boring = SEEDS.filter((s) => new Set(generateMelody(LEVEL_1, s).notes.map((n) => n.midi)).size < 3);
    expect(boring.length).toBeLessThan(SEEDS.length * 0.02);
  });

  it('generates shorter melodies when asked, still obeying the rules', () => {
    for (const bars of [1, 2, 3]) {
      for (const seed of SEEDS.slice(0, 40)) {
        const melody = generateMelody(LEVEL_1, seed, bars);
        expect(melody.bars).toBe(bars);
        expect(totalBeats(melody.notes)).toBe(bars * 4);
        expect(splitIntoBars(melody.notes, melody.timeSignature)).toHaveLength(bars);
        expect(LEVEL_1.startDegrees).toContain(degreeOf(melody.notes[0]!.midi, LEVEL_1.key));
        expect(LEVEL_1.endDegrees).toContain(degreeOf(melody.notes[melody.notes.length - 1]!.midi, LEVEL_1.key));
      }
    }
    expect(generateMelody(LEVEL_1, 5).bars).toBe(LEVEL_1.bars);
    expect(() => generateMelody(LEVEL_1, 5, 0)).toThrow();
    expect(() => generateMelody(LEVEL_1, 5, LEVEL_1.bars + 1)).toThrow();
  });

  it('honours a wider fret window with alternative positions', () => {
    const wide: LevelConfig = { ...LEVEL_1, id: 'test-wide', fretRange: [0, 5] };
    const pool = pitchPool(wide);
    // B3 and E4 now have two positions each.
    expect(pool.find((p) => p.midi === 59)!.positions).toHaveLength(2);
    expect(pool.find((p) => p.midi === 64)!.positions).toHaveLength(2);
    for (const seed of SEEDS.slice(0, 50)) {
      const melody = generateMelody(wide, seed);
      for (const note of melody.notes) {
        expect(midiAt({ string: note.string, fret: note.fret })).toBe(note.midi);
        expect(note.fret).toBeLessThanOrEqual(5);
      }
    }
  });
});
