import { describe, expect, it } from 'vitest';
import { STAGES } from '../melody/stages';
import { visibleFrets } from './Fretboard';

describe('fretboard window', () => {
  it('shows at least five frets from the nut for first position', () => {
    expect(visibleFrets([0, 3])).toEqual({ first: 1, last: 5 });
    expect(visibleFrets([0, 4])).toEqual({ first: 1, last: 5 });
  });

  it('shows just the window for fifth position', () => {
    expect(visibleFrets([5, 9])).toEqual({ first: 5, last: 9 });
  });

  it('widens a short window down the neck rather than past fret 12', () => {
    expect(visibleFrets([9, 12])).toEqual({ first: 8, last: 12 });
  });

  it('shows the whole neck to the octave for free reading', () => {
    expect(visibleFrets([0, 12])).toEqual({ first: 1, last: 12 });
  });

  it('never draws more than twelve frets for any stage', () => {
    for (const stage of STAGES) {
      const { first, last } = visibleFrets(stage.fretRange);
      expect(first).toBeLessThanOrEqual(stage.fretRange[0] || 1);
      expect(last).toBeGreaterThanOrEqual(stage.fretRange[1]);
      expect(last - first + 1).toBeLessThanOrEqual(12);
      expect(last - first + 1).toBeGreaterThanOrEqual(5);
    }
  });
});
