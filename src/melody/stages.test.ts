import { describe, expect, it } from 'vitest';
import { midiAt } from '../music/fretboard';
import { degreeOf, isDiatonic, keyId, spellInKey } from '../music/key';
import { midiFromSpelled, parseSpelled, staffStep, writtenFromSounding } from '../music/pitch';
import { splitIntoBars, totalBeats } from './bars';
import { generateMelody, pitchPool } from './generator';
import { GROW_COUNTS, MAX_COUNTS, MIN_COUNTS } from './meter';
import { STAGES } from './stages';

const SEEDS = Array.from({ length: 40 }, (_, i) => i * 104729 + 7);
/** Written range of the whole ladder: the open low E (three ledger lines below) to fret 12 on the first string (three above). */
const LOWEST_WRITTEN = staffStep(parseSpelled('E3'));
const HIGHEST_WRITTEN = staffStep(parseSpelled('E6'));

const byNumber = (n: number) => STAGES.find((s) => s.number === n)!;

describe('stage ladder configs', () => {
  it('is numbered in order; every stage but free reading starts at one bar and grows to two', () => {
    STAGES.forEach((s, i) => expect(s.number).toBe(i + 1));
    expect(STAGES).toHaveLength(21);
    const last = STAGES[STAGES.length - 1]!;
    expect(STAGES.slice(0, -1).every((s) => s.startCounts === MIN_COUNTS && s.growCounts === GROW_COUNTS)).toBe(true);
    expect(last.startCounts).toBe(8);
    expect(last.growCounts).toBe(MAX_COUNTS);
    expect(STAGES.every((s) => s.maxCounts === MAX_COUNTS && s.unlockTally === 3)).toBe(true);
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
    const stage = byNumber(10);
    const seen = new Set<string>();
    for (let seed = 1; seed < 400; seed++) seen.add(keyId(generateMelody(stage, seed, 8).key));
    expect(seen.size).toBe(stage.keys.length);
  });

  it('marks only the seven-accidental stage optional and drops listens to two in Part B', () => {
    expect(STAGES.filter((s) => s.optional).map((s) => s.number)).toEqual([11]);
    expect(STAGES.filter((s) => s.number >= 17).every((s) => s.maxListens === 2)).toBe(true);
    expect(STAGES.filter((s) => s.number < 17).every((s) => s.maxListens === 3)).toBe(true);
  });

  it('covers the whole neck: six strings in two positions and up to fret 12', () => {
    expect(byNumber(12).strings).toEqual([1, 2, 3, 4]);
    expect(byNumber(13).strings).toEqual([1, 2, 3, 4, 5, 6]);
    expect(byNumber(13).fretRange).toEqual([0, 4]);
    expect(byNumber(14).fretRange).toEqual([5, 9]);
    expect(byNumber(15).strings).toEqual([1, 2, 3, 4, 5, 6]);
    expect(byNumber(16).fretRange).toEqual([9, 12]);
    expect(byNumber(21).fretRange).toEqual([0, 12]);
    expect(byNumber(21).strings).toHaveLength(6);
  });

  it('low-string stages reach the ledger lines below; the octave stage reaches three above', () => {
    const lowestOf = (n: number) => Math.min(...SEEDS.flatMap((s) => generateMelody(byNumber(n), s, 16).notes.map((x) => x.midi)));
    const highestOf = (n: number) => Math.max(...SEEDS.flatMap((s) => generateMelody(byNumber(n), s, 16).notes.map((x) => x.midi)));
    // Fourth string alone never needs a ledger line: written D4 is the space under the staff.
    expect(writtenFromSounding(lowestOf(12))).toBeGreaterThanOrEqual(midiFromSpelled(parseSpelled('D4')));
    expect(writtenFromSounding(lowestOf(12))).toBeLessThan(midiFromSpelled(parseSpelled('E4')));
    // Six strings in first position go down to the open low E, written E3.
    expect(writtenFromSounding(lowestOf(13))).toBeLessThanOrEqual(midiFromSpelled(parseSpelled('G3')));
    expect(writtenFromSounding(highestOf(14))).toBeGreaterThan(midiFromSpelled(parseSpelled('A5')));
    expect(writtenFromSounding(highestOf(16))).toBeGreaterThanOrEqual(midiFromSpelled(parseSpelled('D6')));
  });
});
