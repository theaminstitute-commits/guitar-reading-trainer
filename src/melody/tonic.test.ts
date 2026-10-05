import { describe, expect, it } from 'vitest';
import { keyFromId } from '../music/key';
import { generateMelody } from './generator';
import { STAGES } from './stages';
import { tonicReference } from './tonic';
import type { Melody } from './types';

describe('tonicReference', () => {
  it('is the tonic at or just below the lowest note', () => {
    const inG: Melody = {
      seed: 0,
      levelId: 't',
      key: keyFromId('G')!,
      tempo: 72,
      barBeats: [4],
      timeSignature: [4, 4],
      bars: 1,
      counts: 4,
      notes: [
        { midi: 59, duration: 'q', string: 2, fret: 0 }, // B3
        { midi: 62, duration: 'q', string: 2, fret: 3 }, // D4
      ],
    };
    expect(tonicReference(inG)).toBe(55); // G3
    const lowG = { ...inG, notes: [{ midi: 55, duration: 'q' as const, string: 3, fret: 0 }] };
    expect(tonicReference(lowG)).toBe(55);
  });

  it('is in the melody key for every stage 3 melody', () => {
    const stage3 = STAGES[2]!;
    for (let seed = 1; seed < 60; seed++) {
      const melody = generateMelody(stage3, seed);
      const tonic = tonicReference(melody);
      const lowest = Math.min(...melody.notes.map((n) => n.midi));
      expect(tonic).toBeLessThanOrEqual(lowest);
      expect(tonic).toBeGreaterThan(lowest - 12);
    }
  });
});
