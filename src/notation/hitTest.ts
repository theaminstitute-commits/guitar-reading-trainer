/**
 * Pure geometry for turning a tap on the rendered staff into a musical action.
 * All coordinates are CSS pixels relative to the staff container.
 */
import { parseSpelled, staffStep } from '../music/pitch';

/** The top line of a treble staff is F5. */
export const TREBLE_TOP_LINE_STEP = staffStep(parseSpelled('F5'));

export interface StaveGeometry {
  barIndex: number;
  x: number;
  width: number;
  /** y of the top staff line. */
  topLineY: number;
  lineSpacing: number;
  /** Where notes may start (after clef / time signature). */
  noteStartX: number;
}

export interface NoteGeometry {
  barIndex: number;
  noteIndex: number;
  id: number;
  x: number;
  y: number;
}

/** Staff step for a y coordinate: lines and spaces snap to the nearest half-space. */
export function stepFromY(y: number, stave: Pick<StaveGeometry, 'topLineY' | 'lineSpacing'>): number {
  const halfSpace = stave.lineSpacing / 2;
  return TREBLE_TOP_LINE_STEP + Math.round((stave.topLineY - y) / halfSpace);
}

/** y coordinate of a staff step on a stave. */
export function yFromStep(step: number, stave: Pick<StaveGeometry, 'topLineY' | 'lineSpacing'>): number {
  return stave.topLineY - (step - TREBLE_TOP_LINE_STEP) * (stave.lineSpacing / 2);
}

/**
 * Which stave a point is on. The tappable band extends 3 spaces above and
 * below the five lines to allow ledger-line notes.
 */
export function staveAt(staves: readonly StaveGeometry[], x: number, y: number): StaveGeometry | null {
  for (const s of staves) {
    const top = s.topLineY - s.lineSpacing * 3.5;
    const bottom = s.topLineY + s.lineSpacing * 7.5;
    if (x >= s.x && x <= s.x + s.width && y >= top && y <= bottom) return s;
  }
  return null;
}

/** Nearest note within the tolerance box, if any. */
export function noteAt(
  notes: readonly NoteGeometry[],
  x: number,
  y: number,
  tolerance: { x: number; y: number },
): NoteGeometry | null {
  let best: NoteGeometry | null = null;
  let bestDistance = Infinity;
  for (const n of notes) {
    const dx = Math.abs(n.x - x);
    const dy = Math.abs(n.y - y);
    if (dx > tolerance.x || dy > tolerance.y) continue;
    const d = dx * dx + dy * dy;
    if (d < bestDistance) {
      best = n;
      bestDistance = d;
    }
  }
  return best;
}
