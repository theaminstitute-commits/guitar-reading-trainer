import { describe, expect, it } from 'vitest';
import { midiAt } from '../music/fretboard';
import { degreeOf, isDiatonic, keyId, keySignatureCount, spellInKey } from '../music/key';
import { midiFromSpelled, parseSpelled, staffStep, writtenFromSounding } from '../music/pitch';
import { splitIntoBars, totalBeats } from './bars';
import { generateMelody, hasSignatureNote, pitchPool, topFretPositions } from './generator';
import { MAX_COUNTS, MIN_COUNTS } from './meter';
import { MAIN_STAGE_COUNT, STAGES } from './stages';

const SEEDS = Array.from({ length: 40 }, (_, i) => i * 104729 + 7);
/** Written range of the whole ladder: the open low E (three ledger lines below) to fret 12 on the first string (three above). */
const LOWEST_WRITTEN = staffStep(parseSpelled('E3'));
const HIGHEST_WRITTEN = staffStep(parseSpelled('E6'));

const byNumber = (n: number) => STAGES.find((s) => s.number === n)!;

describe('stage ladder configs', () => {
  it('is numbered in order; main stages are one bar of 4/4, bonus stages add one count each', () => {
    STAGES.forEach((s, i) => expect(s.number).toBe(i + 1));
    expect(STAGES).toHaveLength(MAIN_STAGE_COUNT + MAX_COUNTS - MIN_COUNTS);
    const main = STAGES.slice(0, MAIN_STAGE_COUNT);
    expect(main.every((s) => s.startCounts === MIN_COUNTS && s.maxCounts === MIN_COUNTS)).toBe(true);
    STAGES.slice(MAIN_STAGE_COUNT).forEach((s, i) => {
      expect(s.startCounts).toBe(MIN_COUNTS + i + 1);
      expect(s.maxCounts).toBe(s.startCounts);
      expect(s.strings).toHaveLength(6);
      expect(s.fretRange).toEqual([0, 12]);
      expect(s.keys.length).toBeGreaterThan(30);
    });
    expect(STAGES[STAGES.length - 1]!.startCounts).toBe(MAX_COUNTS);
    expect(STAGES.every((s) => s.unlockAfter === 10)).toBe(true);
  });

  it('uses newly added frets or strings in every melody of the stage that adds them', () => {
    const introducing = STAGES.filter((s) => s.introduces && s.introduces.length > 0).map((s) => s.number);
    expect(introducing).toEqual([2, 12, 13, 14, 15, 16, 21]);
    expect(byNumber(2).introduces!.map((p) => `${p.string}:${p.fret}`)).toEqual(['1:4', '2:4', '3:4', '4:4']);
    expect(byNumber(12).introduces!.every((p) => p.string === 5)).toBe(true);
    expect(byNumber(13).introduces!.every((p) => p.string === 6)).toBe(true);
    expect(byNumber(16).introduces!.every((p) => p.fret >= 10)).toBe(true);
    for (const stage of STAGES.filter((s) => s.introduces)) {
      for (const seed of SEEDS) {
        const melody = generateMelody(stage, seed);
        expect(
          melody.notes.some((n) => stage.introduces!.some((p) => p.string === n.string && p.fret === n.fret)),
          `${stage.id} seed ${seed}`,
        ).toBe(true);
      }
    }
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
        for (const counts of [stage.startCounts, Math.min(stage.maxCounts, stage.startCounts + 1), stage.maxCounts]) {
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
    const stage = byNumber(10);
    const seen = new Set<string>();
    for (let seed = 1; seed < 400; seed++) seen.add(keyId(generateMelody(stage, seed).key));
    expect(seen.size).toBe(stage.keys.length);
  });

  it('has no optional stage and drops listens to two in Part B', () => {
    expect(STAGES.filter((s) => s.optional)).toEqual([]);
    expect(STAGES.filter((s) => s.number >= 17).every((s) => s.maxListens === 2)).toBe(true);
    expect(STAGES.filter((s) => s.number < 17).every((s) => s.maxListens === 3)).toBe(true);
  });

  it('every main-stage melody uses the top fret of its window and, in a key with a signature, a signature note', () => {
    for (const stage of STAGES) {
      for (const seed of SEEDS) {
        const melody = generateMelody(stage, seed);
        const label = `${stage.id} ${keyId(melody.key)} seed ${seed}`;
        if (stage.featureFret) {
          const top = topFretPositions(stage, melody.key);
          expect(top.length, label).toBeGreaterThan(0);
          expect(melody.notes.some((n) => top.some((p) => p.string === n.string && p.fret === n.fret)), label).toBe(true);
        }
        if (keySignatureCount(melody.key) !== 0) expect(hasSignatureNote(melody), label).toBe(true);
      }
    }
    // F major has no note on fret 4 in first position, so the top usable fret there is 3.
    expect(topFretPositions(byNumber(3), byNumber(3).keys.find((k) => keyId(k) === 'F')!).every((p) => p.fret === 3)).toBe(true);
    expect(topFretPositions(byNumber(3), byNumber(3).keys.find((k) => keyId(k) === 'C')!)).toEqual([{ string: 3, fret: 4 }]);
  });

  it('covers the whole neck: six strings in two positions and up to fret 12', () => {
    expect(byNumber(1).strings).toEqual([1, 2, 3, 4]);
    expect(byNumber(12).strings).toEqual([1, 2, 3, 4, 5]);
    expect(byNumber(13).strings).toEqual([1, 2, 3, 4, 5, 6]);
    expect(byNumber(13).fretRange).toEqual([0, 4]);
    expect(byNumber(14).fretRange).toEqual([5, 9]);
    expect(byNumber(15).strings).toEqual([1, 2, 3, 4, 5, 6]);
    expect(byNumber(16).fretRange).toEqual([9, 12]);
    expect(byNumber(21).fretRange).toEqual([0, 12]);
    expect(byNumber(21).strings).toHaveLength(6);
  });

  it('low-string stages reach the ledger lines below; the octave stage reaches three above', () => {
    const lowestOf = (n: number) => Math.min(...SEEDS.flatMap((s) => generateMelody(byNumber(n), s).notes.map((x) => x.midi)));
    const highestOf = (n: number) => Math.max(...SEEDS.flatMap((s) => generateMelody(byNumber(n), s).notes.map((x) => x.midi)));
    // Stage 1 reads from written D4 (the open D string): the space under the staff, no ledger line yet.
    expect(writtenFromSounding(lowestOf(1))).toBeGreaterThanOrEqual(midiFromSpelled(parseSpelled('D4')));
    expect(writtenFromSounding(lowestOf(1))).toBeLessThanOrEqual(midiFromSpelled(parseSpelled('E4')));
    // The fifth string brings the first ledger lines (written A3 to C4), the sixth the open low E (E3).
    expect(writtenFromSounding(lowestOf(12))).toBeLessThanOrEqual(midiFromSpelled(parseSpelled('C4')));
    expect(writtenFromSounding(lowestOf(12))).toBeGreaterThanOrEqual(midiFromSpelled(parseSpelled('A3')));
    expect(writtenFromSounding(lowestOf(13))).toBeLessThanOrEqual(midiFromSpelled(parseSpelled('G3')));
    expect(writtenFromSounding(highestOf(14))).toBeGreaterThan(midiFromSpelled(parseSpelled('A5')));
    expect(writtenFromSounding(highestOf(16))).toBeGreaterThanOrEqual(midiFromSpelled(parseSpelled('D6')));
  });
});
