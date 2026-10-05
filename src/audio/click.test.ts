import { describe, expect, it } from 'vitest';
import { CLICK_SECONDS, seikoClick } from './click';

describe('Seiko-style click', () => {
  it('is 60 ms long, starts from silence and decays away', () => {
    const c = seikoClick(44100);
    expect(c.length).toBe(Math.round(44100 * CLICK_SECONDS));
    expect(c[0]).toBe(0);
    const peak = Math.max(...Array.from(c).map(Math.abs));
    expect(peak).toBeGreaterThan(0.6);
    expect(peak).toBeLessThanOrEqual(0.9 * 1.1);
    const tail = Math.max(...Array.from(c.slice(-200)).map(Math.abs));
    expect(tail).toBeLessThan(0.03);
  });

  it('has its fundamental at 1000 Hz, an octave up with tone 12', () => {
    const period = (c: Float32Array) => {
      // Zero crossings (rising) in the first 10 ms give the period.
      let crossings: number[] = [];
      for (let i = 1; i < 441; i++) if (c[i - 1]! < 0 && c[i]! >= 0) crossings.push(i);
      return (crossings[crossings.length - 1]! - crossings[0]!) / (crossings.length - 1);
    };
    expect(44100 / period(seikoClick(44100))).toBeCloseTo(1000, -1);
    expect(44100 / period(seikoClick(44100, 12))).toBeCloseTo(2000, -1);
  });
});
