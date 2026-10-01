import { describe, expect, it } from 'vitest';
import { beatsPerBar } from '../music/duration';
import { midiAt } from '../music/fretboard';
import { degreeOf, isDiatonic, keyId } from '../music/key';
import { midiFromSpelled, parseSpelled, staffStep, writtenFromSounding } from '../music/pitch';
import { spellInKey } from '../music/key';
import { splitIntoBars, totalBeats } from './bars';
import { generateMelody, pitchPool } from './generator';
import { STAGES } from './stages';

const SEEDS = Array.from({ length: 40 }, (_, i) => i * 104729 + 7);
const LOWEST_WRITTEN = staffStep(parseSpelled('C4'));
const HIGHEST_WRITTEN = staffStep(parseSpelled('D6'));

describe('stage ladder configs', () => {
  it('is numbered in order and starts at one bar only for stage 1', () => {
    STAGES.forEach((s, i) => expect(s.number).toBe(i + 1));
    expect(STAGES[0]!.startBars).toBe(1);
    expect(STAGES.slice(1).every((s) => s.startBars === 2)).toBe(true);
  });

  it('gives every key of every stage a complete scale in its fret window', () => {
    for (const stage of STAGES) {
      for (const key of stage.keys) {
        const degrees = new Set(pitchPool(stage, key).map((p) => p.degree));
        expect(degrees.size, `${stage.id} ${keyId(key)}`).toBe(7);
      }
    }
  });

  it('generates valid melodies at every length for every stage', () => {
    for (const stage of STAGES) {
      for (const seed of SEEDS) {
        for (const bars of [stage.startBars, stage.bars]) {
          const melody = generateMelody(stage, seed, bars);
          expect(stage.keys).toContain(melody.key);
          expect(totalBeats(melody.notes)).toBe(bars * beatsPerBar(stage.timeSignature));
          for (const bar of splitIntoBars(melody.notes, melody.timeSignature)) {
            expect(bar.beats).toBe(beatsPerBar(stage.timeSignature));
          }
          for (const note of melody.notes) {
            expect(stage.durations).toContain(note.duration);
            expect(isDiatonic(note.midi, melody.key)).toBe(true);
            expect(stage.strings).toContain(note.string);
            expect(note.fret).toBeGreaterThanOrEqual(stage.fretRange[0]);
            expect(note.fret).toBeLessThanOrEqual(stage.fretRange[1]);
            expect(midiAt({ string: note.string, fret: note.fret })).toBe(note.midi);
            // Everything stays inside the staff input range.
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
    const stage = STAGES[9]!; // six accidentals: 13 keys
    const seen = new Set<string>();
    for (let seed = 1; seed < 400; seed++) seen.add(keyId(generateMelody(stage, seed, 2).key));
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
    const lowest = Math.min(...SEEDS.flatMap((s) => generateMelody(low, s, 4).notes.map((n) => n.midi)));
    const highest = Math.max(...SEEDS.flatMap((s) => generateMelody(high, s, 4).notes.map((n) => n.midi)));
    // Written D4 (string 4 open) sits below the staff on a ledger line.
    expect(spellInKey(writtenFromSounding(lowest), low.keys[0]!).octave).toBe(4);
    expect(writtenFromSounding(lowest)).toBeLessThan(midiFromSpelled(parseSpelled('E4')));
    // Fifth position reaches above A5, the first ledger line over the staff.
    expect(writtenFromSounding(highest)).toBeGreaterThan(midiFromSpelled(parseSpelled('A5')));
  });
});
