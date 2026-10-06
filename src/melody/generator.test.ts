import { describe, expect, it } from 'vitest';
import { beatsOf } from '../music/duration';
import { midiAt } from '../music/fretboard';
import { chordTonePitchClasses, degreeInfoOf, degreeOf, isDiatonic, keyFromId, keyId, MAJOR_KEYS, spellInKey } from '../music/key';
import { pitchClass, staffStep } from '../music/pitch';
import { splitIntoBars, totalBeats } from './bars';
import { generateMelody, generateRhythm, pitchPool } from './generator';
import { LEVEL_1 as LEVEL_1_CONFIG, type LevelConfig } from './levelConfig';
import { barBeatsForCounts, MAX_COUNTS } from './meter';
import { createRng } from './random';

/** Level 1 opened up to four bars, so the generator is exercised at every length the bonus stages use. */
const LEVEL_1: LevelConfig = { ...LEVEL_1_CONFIG, maxCounts: MAX_COUNTS };
const SEEDS = Array.from({ length: 200 }, (_, i) => i * 7919 + 1);
const FOUR_BARS = [4, 4, 4, 4];

describe('pitchPool', () => {
  it('Level 1 gives the eleven naturals D3..G4, one position each', () => {
    const pool = pitchPool(LEVEL_1, LEVEL_1.keys[0]!);
    expect(pool.map((p) => p.midi)).toEqual([50, 52, 53, 55, 57, 59, 60, 62, 64, 65, 67]);
    expect(pool.every((p) => p.positions.length === 1)).toBe(true);
    expect(pool.find((p) => p.midi === 59)!.positions).toEqual([{ string: 2, fret: 0 }]);
  });

  it('is sorted and consecutive entries are one diatonic step apart', () => {
    const pool = pitchPool(LEVEL_1, LEVEL_1.keys[0]!);
    for (let i = 1; i < pool.length; i++) {
      expect(pool[i]!.step - pool[i - 1]!.step).toBe(1);
    }
  });
});

describe('generateRhythm', () => {
  it('every bar sums exactly to its beats, for even and odd meters', () => {
    for (const barBeats of [FOUR_BARS, [4, 1], [4, 2], [4, 4, 3], [4]]) {
      for (const seed of SEEDS.slice(0, 50)) {
        const rhythm = generateRhythm(LEVEL_1, createRng(seed), barBeats);
        const bars = splitIntoBars(rhythm.map((duration) => ({ duration })), barBeats);
        expect(bars).toHaveLength(barBeats.length);
        bars.forEach((bar, i) => expect(bar.beats).toBe(barBeats[i]));
      }
    }
  });

  it('uses only allowed durations', () => {
    const rhythm = generateRhythm(LEVEL_1, createRng(42), FOUR_BARS);
    expect(rhythm.every((d) => LEVEL_1.durations.includes(d))).toBe(true);
  });

  it('writes eighths in pairs on the beat and a dotted quarter with its eighth', () => {
    const rhythmic: LevelConfig = { ...LEVEL_1, durations: ['q', 'h', 'e', 'q.', 'w'] };
    let sawEighths = false;
    let sawDotted = false;
    for (const seed of SEEDS) {
      const rhythm = generateRhythm(rhythmic, createRng(seed), FOUR_BARS);
      let position = 0;
      for (let i = 0; i < rhythm.length; i++) {
        const d = rhythm[i]!;
        if (d === 'e') {
          const afterDotted = rhythm[i - 1] === 'q.';
          if (afterDotted) {
            expect(position % 1).toBeCloseTo(0.5);
          } else {
            expect(position % 1).toBeCloseTo(0);
            expect(rhythm[i + 1]).toBe('e');
            i++;
            position += 0.5;
          }
          sawEighths = true;
        }
        if (d === 'q.') {
          expect(rhythm[i + 1]).toBe('e');
          sawDotted = true;
        }
        position += beatsOf(d);
      }
      const bars = splitIntoBars(rhythm.map((duration) => ({ duration })), FOUR_BARS);
      for (const bar of bars) expect(bar.beats).toBe(4);
    }
    expect(sawEighths).toBe(true);
    expect(sawDotted).toBe(true);
  });

  it('throws a clear error when nothing fits', () => {
    const bad: LevelConfig = { ...LEVEL_1, durations: ['h'] };
    expect(() => generateRhythm(bad, createRng(1), [3])).toThrow(/no allowed duration fits/);
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
      expect(melody.counts).toBe(LEVEL_1.maxCounts);
      expect(melody.barBeats).toEqual(FOUR_BARS);

      expect(totalBeats(melody.notes)).toBe(16);
      const bars = splitIntoBars(melody.notes, melody.barBeats);
      expect(bars).toHaveLength(4);
      bars.forEach((bar) => expect(bar.beats).toBe(4));

      for (const note of melody.notes) {
        expect(LEVEL_1.durations).toContain(note.duration);
        expect(note.midi).toBeGreaterThanOrEqual(50);
        expect(note.midi).toBeLessThanOrEqual(67);
        expect(isDiatonic(note.midi, melody.key)).toBe(true);
        expect(LEVEL_1.strings).toContain(note.string);
        expect(note.fret).toBeGreaterThanOrEqual(lowFret);
        expect(note.fret).toBeLessThanOrEqual(highFret);
        expect(midiAt({ string: note.string, fret: note.fret })).toBe(note.midi);
      }

      for (let i = 1; i < melody.notes.length; i++) {
        const a = staffStep(spellInKey(melody.notes[i - 1]!.midi, melody.key));
        const b = staffStep(spellInKey(melody.notes[i]!.midi, melody.key));
        expect(Math.abs(a - b)).toBeLessThanOrEqual(LEVEL_1.maxLeapSteps);
      }

      const first = melody.notes[0]!;
      const last = melody.notes[melody.notes.length - 1]!;
      expect(LEVEL_1.startDegrees).toContain(degreeOf(first.midi, melody.key));
      expect(LEVEL_1.endDegrees).toContain(degreeOf(last.midi, melody.key));
    }
  });

  it('starts every bar on a chord tone so the melody keeps its footing in the key', () => {
    for (const seed of SEEDS) {
      const melody = generateMelody(LEVEL_1, seed, 13); // 4/4 + 4/4 + 4/4 + 1/4
      const chord = chordTonePitchClasses(melody.key);
      for (const bar of splitIntoBars(melody.notes, melody.barBeats)) {
        expect(chord).toContain(pitchClass(bar.notes[0]!.midi));
      }
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

  it('generates every length in counts, with the short bar at the end', () => {
    for (const counts of [4, 5, 6, 7, 8, 9, 12, 13, 15]) {
      for (const seed of SEEDS.slice(0, 40)) {
        const melody = generateMelody(LEVEL_1, seed, counts);
        expect(melody.counts).toBe(counts);
        expect(melody.barBeats).toEqual(barBeatsForCounts(counts));
        expect(melody.bars).toBe(melody.barBeats.length);
        expect(melody.timeSignature).toEqual([melody.barBeats[0], 4]);
        expect(totalBeats(melody.notes)).toBe(counts);
        const bars = splitIntoBars(melody.notes, melody.barBeats);
        expect(bars).toHaveLength(melody.barBeats.length);
        bars.forEach((bar, i) => expect(bar.beats).toBe(melody.barBeats[i]));
        expect(LEVEL_1.startDegrees).toContain(degreeOf(melody.notes[0]!.midi, melody.key));
        expect(LEVEL_1.endDegrees).toContain(degreeOf(melody.notes[melody.notes.length - 1]!.midi, melody.key));
      }
    }
    expect(generateMelody(LEVEL_1, 5).counts).toBe(LEVEL_1.maxCounts);
    expect(() => generateMelody(LEVEL_1, 5, 3)).toThrow();
    expect(() => generateMelody(LEVEL_1, 5, LEVEL_1.maxCounts + 1)).toThrow();
  });

  it('works in every major key once the fret window covers a full octave', () => {
    const allKeys: LevelConfig = { ...LEVEL_1, id: 'test-keys', fretRange: [0, 4], keys: MAJOR_KEYS };
    const seen = new Set<string>();
    for (const seed of SEEDS) {
      const melody = generateMelody(allKeys, seed, 8);
      seen.add(keyId(melody.key));
      expect(MAJOR_KEYS).toContain(melody.key);
      expect(new Set(pitchPool(allKeys, melody.key).map((p) => p.degree)).size).toBe(7);
      for (const note of melody.notes) {
        expect(isDiatonic(note.midi, melody.key)).toBe(true);
        expect(midiAt({ string: note.string, fret: note.fret })).toBe(note.midi);
      }
      expect(allKeys.startDegrees).toContain(degreeOf(melody.notes[0]!.midi, melody.key));
      expect(allKeys.endDegrees).toContain(degreeOf(melody.notes[melody.notes.length - 1]!.midi, melody.key));
    }
    expect(seen.size).toBe(MAJOR_KEYS.length);
    expect(generateMelody(allKeys, 77, 8).key).toBe(generateMelody(allKeys, 77, 8).key);
  });

  it('melodic minor raises 6 and 7 going up and lowers them coming down', () => {
    const melodic: LevelConfig = { ...LEVEL_1, id: 'test-melodic', fretRange: [0, 4], strings: [1, 2, 3, 4], keys: [keyFromId('Am-m')!] };
    let sawRaised = false;
    let sawNatural = false;
    for (const seed of SEEDS) {
      const melody = generateMelody(melodic, seed, 12);
      for (let i = 1; i < melody.notes.length; i++) {
        const prev = melody.notes[i - 1]!.midi;
        const midi = melody.notes[i]!.midi;
        const info = degreeInfoOf(midi, melody.key)!;
        if ((info.degree === 6 || info.degree === 7) && midi !== prev) {
          if (info.raised) {
            expect(midi).toBeGreaterThan(prev);
            sawRaised = true;
          } else {
            expect(midi).toBeLessThan(prev);
            sawNatural = true;
          }
        }
      }
    }
    expect(sawRaised).toBe(true);
    expect(sawNatural).toBe(true);
  });

  it('honours a wider fret window with alternative positions', () => {
    const wide: LevelConfig = { ...LEVEL_1, id: 'test-wide', fretRange: [0, 5] };
    const pool = pitchPool(wide, wide.keys[0]!);
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
