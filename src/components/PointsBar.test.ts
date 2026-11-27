import { describe, expect, it } from 'vitest';
import { energyOf, pointKinds } from './PointsBar';

describe('points bar (R47)', () => {
  it('lays out each melody as a written point and, when played, two played points', () => {
    expect(pointKinds(5, [1, 3, 1], 8)).toEqual(['w', 'w', 'p', 'p', 'w', '', '', '']);
  });

  it('shows points carried over from before R47 as written, first', () => {
    expect(pointKinds(5, [3], 6)).toEqual(['w', 'w', 'w', 'p', 'p', '']);
  });

  it('comes alive in steps: a third, two thirds, nine tenths', () => {
    expect([0, 9, 10, 19, 20, 26, 27, 30].map((t) => energyOf(t, 30))).toEqual([0, 0, 1, 1, 2, 2, 3, 3]);
  });
});
