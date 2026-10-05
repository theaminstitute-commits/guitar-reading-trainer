import { describe, expect, it } from 'vitest';
import { keyId } from '../music/key';
import { stageGuide } from './stageGuide';
import { STAGES } from './stages';

const byNumber = (n: number) => STAGES.find((s) => s.number === n)!;

describe('stage guide', () => {
  it('names every pitch of stage 1 in C major, lowest to highest, all new', () => {
    const g = stageGuide(byNumber(1), null);
    expect(keyId(g.key)).toBe('C');
    expect(g.pitches.map((p) => p.name)).toEqual(['G4', 'A4', 'B4', 'C5', 'D5', 'E5', 'F5', 'G5']);
    expect(g.pitches.every((p) => p.isNew)).toBe(true);
    expect(g.keys).toBe('C major');
    expect(g.lengths).toBe('quarter and half notes');
    expect(g.range).toBe('strings 1 to 3, frets 0 to 3');
  });

  it('marks only the added pitches new when the window grows', () => {
    const g = stageGuide(byNumber(2), byNumber(1));
    // Fret 4 adds no new in-key pitch in C on strings 1-3 (G#, C#, F#), so nothing is new.
    expect(g.pitches.filter((p) => p.isNew)).toHaveLength(0);
    const low = stageGuide(byNumber(13), byNumber(12));
    expect(low.pitches[0]!.name).toBe('E3');
    expect(low.pitches.filter((p) => p.isNew).map((p) => p.name)).toEqual(['E3', 'F3', 'G3', 'A3', 'B3', 'C4']);
  });

  it('shows minor stages in their first key and lists the keys in words', () => {
    const g = stageGuide(byNumber(17), byNumber(16));
    expect(keyId(g.key)).toBe('Am');
    expect(g.keys).toBe('A minor, E minor and D minor, chosen at random');
    const h = stageGuide(byNumber(19), byNumber(18));
    expect(h.pitches.some((p) => p.name.startsWith('G♯'))).toBe(true);
  });

  it('gives every stage at least one pitch with a position inside the stage window', () => {
    STAGES.forEach((s, i) => {
      const g = stageGuide(s, i > 0 ? STAGES[i - 1]! : null);
      expect(g.pitches.length).toBeGreaterThan(5);
      for (const p of g.pitches) {
        expect(p.positions.length).toBeGreaterThan(0);
        for (const pos of p.positions) {
          expect(s.strings).toContain(pos.string);
          expect(pos.fret).toBeGreaterThanOrEqual(s.fretRange[0]);
          expect(pos.fret).toBeLessThanOrEqual(s.fretRange[1]);
        }
      }
      for (let k = 1; k < g.pitches.length; k++) expect(g.pitches[k]!.midi).toBeGreaterThan(g.pitches[k - 1]!.midi);
    });
  });
});
