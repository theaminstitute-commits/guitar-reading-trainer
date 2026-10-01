import { describe, expect, it } from 'vitest';
import { barBeatsForCounts, describeMeter, timeSignaturesFor, totalCounts } from './meter';

describe('meter from counts', () => {
  it('grows one count at a time as a short bar at the end', () => {
    expect(barBeatsForCounts(4)).toEqual([4]);
    expect(barBeatsForCounts(5)).toEqual([4, 1]);
    expect(barBeatsForCounts(6)).toEqual([4, 2]);
    expect(barBeatsForCounts(7)).toEqual([4, 3]);
    expect(barBeatsForCounts(8)).toEqual([4, 4]);
    expect(barBeatsForCounts(9)).toEqual([4, 4, 1]);
    expect(barBeatsForCounts(11)).toEqual([4, 4, 3]);
    expect(barBeatsForCounts(12)).toEqual([4, 4, 4]);
    expect(barBeatsForCounts(13)).toEqual([4, 4, 4, 1]);
    expect(barBeatsForCounts(15)).toEqual([4, 4, 4, 3]);
    expect(barBeatsForCounts(16)).toEqual([4, 4, 4, 4]);
  });

  it('always adds up to the counts', () => {
    for (let c = 4; c <= 16; c++) expect(totalCounts(barBeatsForCounts(c))).toBe(c);
  });

  it('describes the meter and lists time signatures', () => {
    expect(describeMeter(barBeatsForCounts(9))).toBe('4/4 + 4/4 + 1/4');
    expect(describeMeter(barBeatsForCounts(4))).toBe('4/4');
    expect(timeSignaturesFor([4, 1])).toEqual([
      [4, 4],
      [1, 4],
    ]);
  });
});
