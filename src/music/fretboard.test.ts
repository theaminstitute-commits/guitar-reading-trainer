import { describe, expect, it } from 'vitest';
import { midiAt, positionsFor, STANDARD_TUNING } from './fretboard';

describe('fretboard', () => {
  it('standard tuning open strings sound E4 B3 G3 D3 A2 E2', () => {
    expect([1, 2, 3, 4, 5, 6].map((s) => STANDARD_TUNING[s])).toEqual([64, 59, 55, 50, 45, 40]);
  });

  it('midiAt adds the fret', () => {
    expect(midiAt({ string: 1, fret: 3 })).toBe(67); // G4
    expect(midiAt({ string: 3, fret: 0 })).toBe(55); // G3
    expect(midiAt({ string: 2, fret: 1 })).toBe(60); // C4
    expect(() => midiAt({ string: 7, fret: 0 })).toThrow();
  });

  it('finds every position for a pitch inside a window', () => {
    // B3: string 2 open, or string 3 fret 4.
    expect(positionsFor(59, [1, 2, 3], [0, 3])).toEqual([{ string: 2, fret: 0 }]);
    expect(positionsFor(59, [1, 2, 3], [0, 5])).toEqual([
      { string: 2, fret: 0 },
      { string: 3, fret: 4 },
    ]);
    expect(positionsFor(70, [1, 2, 3], [0, 3])).toEqual([]);
  });
});
