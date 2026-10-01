import { describe, expect, it } from 'vitest';
import { C_MAJOR, keyFromId } from '../music/key';
import { parseSpelled } from '../music/pitch';
import { displaySigns, displaySignsForBars, resolveBar, type WrittenNote } from './accidentals';

const G = keyFromId('G')!;
const F = keyFromId('F')!;

/** "F4", "F4#", "F4n", "F4b": letter, octave, then the written sign. */
function w(...items: string[]): WrittenNote[] {
  return items.map((s) => {
    const m = /^([A-G])(\d)([#bn]?)$/.exec(s)!;
    const sign = ({ '': 'none', '#': 'sharp', b: 'flat', n: 'natural' } as const)[m[3] as '' | '#' | 'b' | 'n'];
    return { letter: m[1] as WrittenNote['letter'], octave: Number(m[2]), sign };
  });
}

describe('resolveBar: reading signs the way a musician does', () => {
  it('a plain note takes the key signature', () => {
    expect(resolveBar(w('F5', 'C5'), G)).toEqual([1, 0]);
    expect(resolveBar(w('B4'), F)).toEqual([-1]);
    expect(resolveBar(w('F5'), C_MAJOR)).toEqual([0]);
  });

  it('a sign lasts for the rest of the bar on that pitch', () => {
    expect(resolveBar(w('F5#', 'G5', 'F5'), C_MAJOR)).toEqual([1, 0, 1]);
    expect(resolveBar(w('F5n', 'F5'), G)).toEqual([0, 0]);
  });

  it('a new sign on the same pitch cancels the earlier one', () => {
    expect(resolveBar(w('F5#', 'F5n', 'F5'), C_MAJOR)).toEqual([1, 0, 0]);
    expect(resolveBar(w('B4b', 'B4#', 'B4'), C_MAJOR)).toEqual([-1, 1, 1]);
  });

  it('other octaves are separate pitches', () => {
    expect(resolveBar(w('F5#', 'F4'), C_MAJOR)).toEqual([1, 0]);
  });

  it('a courtesy sign restating the key signature changes nothing', () => {
    expect(resolveBar(w('F5#', 'F5'), G)).toEqual([1, 1]);
    expect(resolveBar(w('F5n'), C_MAJOR)).toEqual([0]);
  });

  it('each bar starts again from the key signature', () => {
    // Bars are resolved separately, so the second bar's F is the key's F.
    expect(resolveBar(w('F5#'), C_MAJOR)).toEqual([1]);
    expect(resolveBar(w('F5'), C_MAJOR)).toEqual([0]);
  });
});

describe('displaySigns: the signs a correct score shows', () => {
  const sp = (...names: string[]) => names.map(parseSpelled);

  it('shows nothing for notes that match the key signature', () => {
    expect(displaySigns(sp('F#5', 'G5', 'C5'), G).signs).toEqual(['none', 'none', 'none']);
    expect(displaySigns(sp('Bb4', 'F5'), F).signs).toEqual(['none', 'none']);
  });

  it('shows a sign when a note leaves the key, once per bar per pitch', () => {
    expect(displaySigns(sp('F#5', 'G5', 'F#5'), C_MAJOR).signs).toEqual(['sharp', 'none', 'none']);
    expect(displaySigns(sp('F5', 'F5'), G).signs).toEqual(['natural', 'none']);
  });

  it('shows the sign that cancels an earlier one', () => {
    expect(displaySigns(sp('F#5', 'F5'), C_MAJOR).signs).toEqual(['sharp', 'natural']);
    expect(displaySigns(sp('Bb4', 'B4', 'Bb4'), C_MAJOR).signs).toEqual(['flat', 'natural', 'flat']);
  });

  it('treats octaves separately and adds a courtesy sign for an octave shift', () => {
    expect(displaySigns(sp('F#5', 'F4'), C_MAJOR).signs).toEqual(['sharp', 'natural']);
    expect(displaySigns(sp('F#5', 'F#4'), C_MAJOR).signs).toEqual(['sharp', 'sharp']);
  });

  it('reports which pitches are left altered at the end of the bar', () => {
    const r = displaySigns(sp('F#5', 'Bb4', 'B4'), C_MAJOR);
    expect([...r.alteredAtEnd]).toEqual(['F5']);
  });

  it('adds a courtesy sign when a pitch altered last bar returns to the key', () => {
    const bars = displaySignsForBars([sp('F#5', 'G5'), sp('F5', 'F5'), sp('F5')], C_MAJOR);
    expect(bars).toEqual([
      ['sharp', 'none'],
      ['natural', 'none'],
      ['none'],
    ]);
  });

  it('rewrites the sign in the next bar when the alteration continues', () => {
    const bars = displaySignsForBars([sp('F#5'), sp('F#5')], C_MAJOR);
    expect(bars).toEqual([['sharp'], ['sharp']]);
  });
});
