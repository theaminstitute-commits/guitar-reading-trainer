import type { Melody } from '../melody/types';
import { spellInKey } from '../music/key';
import { staffStep, writtenFromSounding } from '../music/pitch';
import { displaySignsForBars } from './accidentals';
import { PAPER } from './paper';
import type { RenderBar } from './renderStaff';

/**
 * The first note of a melody as one bar to draw: its place on the staff and
 * nothing else (R21). It is drawn as a whole note so no stem or flag suggests
 * a length, and in the active colour so it reads as a given, not an answer.
 * The sign follows the key: a note the signature already covers takes none.
 */
export function startNoteBar(melody: Melody): RenderBar {
  const written = spellInKey(writtenFromSounding(melody.notes[0]!.midi), melody.key);
  const sign = displaySignsForBars([[written]], melody.key)[0]![0]!;
  return {
    notes: [{ id: 0, step: staffStep(written), sign, duration: 'w', style: { fill: PAPER.active, stroke: PAPER.active } }],
  };
}
