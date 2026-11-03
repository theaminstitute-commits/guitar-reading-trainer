import { describe, expect, it } from 'vitest';
import { totalBeats } from '../melody/bars';
import { BASS, GUITAR } from '../music/instrument';
import { introFor } from './instrumentIntro';

describe('instrument intros (R42)', () => {
  for (const instrument of [GUITAR, BASS]) {
    it(`${instrument.name}: short, and every note playable in first position on the instrument`, () => {
      const intro = introFor(instrument.id);
      const seconds = (totalBeats(intro.notes) * 60) / intro.tempo;
      expect(seconds).toBeLessThanOrEqual(2.5);
      for (const n of intro.notes) {
        const reachable = instrument.tuning.some((open, s) => s > 0 && n.midi - open >= 0 && n.midi - open <= 5);
        expect(reachable, `${instrument.id} ${n.midi}`).toBe(true);
      }
    });
  }
});
