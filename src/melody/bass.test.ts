import { describe, expect, it } from 'vitest';
import { midiAt } from '../music/fretboard';
import { BASS } from '../music/instrument';
import { staffStep, writtenFromSounding } from '../music/pitch';
import { spellInKey } from '../music/key';
import { generateMelody } from './generator';
import { BASS_STAGES, STAGES, stagesFor } from './stages';

const SEEDS = Array.from({ length: 40 }, (_, i) => i * 7919 + 13);

describe('the bass ladder (R41)', () => {
  it('is the guitar ladder up to stage 17, where chords begin on the guitar', () => {
    expect(BASS_STAGES.map((s) => s.number)).toEqual(Array.from({ length: 17 }, (_, i) => i + 1));
    expect(STAGES[17]!.chords).toBeDefined();
    expect(BASS_STAGES.every((s) => s.instrument === 'bass' && !s.chords)).toBe(true);
    expect(stagesFor('bass')).toBe(BASS_STAGES);
    expect(stagesFor('guitar')).toBe(STAGES);
  });

  it('keeps the keys, rhythms, frets and listens of the guitar stage with the same number', () => {
    BASS_STAGES.forEach((b, i) => {
      const g = STAGES[i]!;
      expect(b.keys).toEqual(g.keys);
      expect(b.durations).toEqual(g.durations);
      expect(b.fretRange).toEqual(g.fretRange);
      expect(b.maxListens).toBe(g.maxListens);
    });
  });

  it('uses the G, D and A strings up to stage 5 and all four strings from stage 6', () => {
    for (const s of BASS_STAGES) expect(s.strings).toEqual(s.number < 6 ? [1, 2, 3] : [1, 2, 3, 4]);
  });

  it('writes stage 1 between A2 and A3, on the bass staff with no ledger lines', () => {
    for (const seed of SEEDS) {
      const m = generateMelody(BASS_STAGES[0]!, seed);
      expect(m.instrument).toBe('bass');
      for (const n of m.notes) {
        const step = staffStep(spellInKey(writtenFromSounding(n.midi), m.key));
        expect(step).toBeGreaterThanOrEqual(BASS.bottomLine + 1);
        expect(step).toBeLessThanOrEqual(BASS.topLine);
      }
    }
  });

  it('draws every stage on bass positions that sound the melody, within the bass staff range', () => {
    for (const stage of BASS_STAGES) {
      for (const seed of SEEDS.slice(0, 12)) {
        const m = generateMelody(stage, seed);
        for (const n of m.notes) {
          expect(midiAt(n, BASS.tuning), `${stage.id}`).toBe(n.midi);
          expect(stage.strings).toContain(n.string);
          expect(n.fret).toBeGreaterThanOrEqual(stage.fretRange[0]);
          expect(n.fret).toBeLessThanOrEqual(stage.fretRange[1]);
          const step = staffStep(spellInKey(writtenFromSounding(n.midi), m.key));
          expect(step).toBeGreaterThanOrEqual(BASS.inputRange[0]);
          expect(step).toBeLessThanOrEqual(BASS.inputRange[1]);
        }
      }
    }
  });

  it('brings the low E string in at stage 6', () => {
    const six = BASS_STAGES[5]!;
    expect(six.introduces?.every((p) => p.string === 4)).toBe(true);
    expect(SEEDS.some((seed) => generateMelody(six, seed).notes.some((n) => n.string === 4))).toBe(true);
  });
});
