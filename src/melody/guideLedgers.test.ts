import { describe, expect, it } from 'vitest';
import { BASS, GUITAR } from '../music/instrument';
import { parseSpelled, staffStep } from '../music/pitch';
import { writtenStepRange } from './generator';
import { BASS_STAGES, STAGES } from './stages';

const step = (name: string) => staffStep(parseSpelled(name));

describe('guide ledger lines follow the stage range (R43)', () => {
  it('guitar: none for stages 1 to 5, down to the open low E from stage 6, up to F♭6 at the octave', () => {
    for (const s of STAGES.slice(0, 5)) {
      const [low, high] = writtenStepRange(s);
      expect(low).toBeGreaterThanOrEqual(GUITAR.bottomLine - 1);
      expect(high).toBeLessThanOrEqual(GUITAR.topLine + 1);
    }
    expect(writtenStepRange(STAGES[5]!)[0]).toBe(step('E3'));
    // E6 at fret 12 of the first string; F♭6 in C♭ major sits in the space above it, needing no further line.
    expect(writtenStepRange(STAGES[12]!)[1]).toBe(step('F6'));
  });

  it('bass: none for stages 1 to 5, the low E ledger line from stage 6, up to G4 at the octave', () => {
    for (const s of BASS_STAGES.slice(0, 5)) {
      const [low, high] = writtenStepRange(s);
      expect(low).toBeGreaterThanOrEqual(BASS.bottomLine - 1);
      expect(high).toBeLessThanOrEqual(BASS.topLine + 1);
    }
    expect(writtenStepRange(BASS_STAGES[5]!)[0]).toBe(step('E2'));
    expect(writtenStepRange(BASS_STAGES[12]!)[1]).toBe(step('G4'));
  });

  it('keeps every note of every stage within the taps the answer staff accepts', () => {
    for (const [instrument, ladder] of [[GUITAR, STAGES], [BASS, BASS_STAGES]] as const) {
      for (const s of ladder) {
        const [low, high] = writtenStepRange(s);
        expect(low, s.id).toBeGreaterThanOrEqual(instrument.inputRange[0]);
        expect(high, s.id).toBeLessThanOrEqual(instrument.inputRange[1]);
      }
    }
  });
});
