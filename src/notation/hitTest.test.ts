import { describe, expect, it } from 'vitest';
import { parseSpelled, spelledFromStaffStep, spelledToString, staffStep } from '../music/pitch';
import { noteAt, staveAt, stepFromY, yFromStep, type NoteGeometry, type StaveGeometry } from './hitTest';

const stave: StaveGeometry = { barIndex: 0, x: 10, width: 200, topLineY: 100, lineSpacing: 14, noteStartX: 60 };

describe('stepFromY', () => {
  it('maps the five lines to F5 D5 B4 G4 E4', () => {
    const names = [0, 1, 2, 3, 4].map((line) =>
      spelledToString(spelledFromStaffStep(stepFromY(100 + line * 14, stave))),
    );
    expect(names).toEqual(['F5', 'D5', 'B4', 'G4', 'E4']);
  });

  it('maps the spaces to E5 C5 A4 F4', () => {
    const names = [0, 1, 2, 3].map((space) =>
      spelledToString(spelledFromStaffStep(stepFromY(107 + space * 14, stave))),
    );
    expect(names).toEqual(['E5', 'C5', 'A4', 'F4']);
  });

  it('snaps to the nearest half-space and handles ledger lines', () => {
    expect(stepFromY(103, stave)).toBe(staffStep(parseSpelled('F5'))); // 3px below the line still F5
    expect(stepFromY(104, stave)).toBe(staffStep(parseSpelled('E5'))); // past halfway -> the space
    expect(stepFromY(100 + 5 * 14, stave)).toBe(staffStep(parseSpelled('C4'))); // first ledger line below
    expect(stepFromY(100 - 14, stave)).toBe(staffStep(parseSpelled('A5'))); // first ledger line above
  });

  it('yFromStep is the inverse', () => {
    for (let step = 26; step <= 42; step++) {
      expect(stepFromY(yFromStep(step, stave), stave)).toBe(step);
    }
  });
});

describe('staveAt', () => {
  const staves: StaveGeometry[] = [stave, { ...stave, barIndex: 1, x: 210 }, { ...stave, barIndex: 2, topLineY: 260 }];

  it('finds the stave by x range and a band around the lines', () => {
    expect(staveAt(staves, 50, 120)?.barIndex).toBe(0);
    expect(staveAt(staves, 250, 120)?.barIndex).toBe(1);
    expect(staveAt(staves, 50, 280)?.barIndex).toBe(2);
    expect(staveAt(staves, 50, 100 - 14 * 3)?.barIndex).toBe(0); // ledger space above
    expect(staveAt(staves, 50, 100 - 14 * 4)).toBeNull(); // too far above
    expect(staveAt(staves, 500, 120)).toBeNull();
  });
});

describe('noteAt', () => {
  const notes: NoteGeometry[] = [
    { barIndex: 0, noteIndex: 0, id: 1, x: 80, y: 114 },
    { barIndex: 0, noteIndex: 1, id: 2, x: 120, y: 128 },
  ];
  const tolerance = { x: 14, y: 12 };

  it('returns the closest note inside the tolerance box', () => {
    expect(noteAt(notes, 82, 110, tolerance)?.id).toBe(1);
    expect(noteAt(notes, 110, 130, tolerance)?.id).toBe(2);
    expect(noteAt(notes, 90, 118, tolerance)?.id).toBe(1);
  });

  it('returns null when nothing is close enough', () => {
    expect(noteAt(notes, 80, 140, tolerance)).toBeNull();
    expect(noteAt(notes, 160, 128, tolerance)).toBeNull();
  });
});
