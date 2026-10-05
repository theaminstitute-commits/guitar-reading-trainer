/**
 * Render bars of notes to SVG with VexFlow and report where everything landed,
 * so the staff can be tapped (StaffInput) or overlaid (feedback).
 *
 * Coordinates in the returned layout are CSS pixels relative to the container.
 */
import { Accidental, Annotation, BarlineType, Dot, Formatter, Renderer, Stave, StaveNote, type RenderContext } from 'vexflow/core';
import { DURATIONS, type DurationId } from '../music/duration';
import { spelledFromStaffStep } from '../music/pitch';
import type { Sign } from './accidentals';
import type { NoteGeometry, StaveGeometry } from './hitTest';

export interface RenderNoteStyle {
  fill: string;
  stroke: string;
}

export interface RenderNote {
  id: number;
  step: number;
  /** The sign drawn in front of the note. */
  sign: Sign;
  duration: DurationId;
  style?: RenderNoteStyle;
  /** Text drawn under the note (explainer cards). */
  label?: string;
}

export interface RenderBar {
  notes: RenderNote[];
  /** Background tint behind the stave, e.g. for a full or rejected bar. */
  fill?: string;
}

export interface RenderOptions {
  timeSignature: readonly [number, number];
  /** Time signature of each bar; drawn on the first bar and wherever it changes. Defaults to `timeSignature`. */
  barTimeSignatures?: readonly (readonly [number, number])[];
  /** Container width in CSS pixels. */
  width: number;
  barsPerRow: number;
  /** Zoom factor: 1 = VexFlow's default 10px line spacing. */
  scale: number;
  /** Colour for staff lines, clef and unstyled notes. */
  ink: string;
  showClef?: boolean;
  showTimeSignature?: boolean;
  /** VexFlow key spec such as 'G', 'Bb', 'F#m'; omitted or 'C' draws none. */
  keySignature?: string;
  /** How many sharps or flats that signature has, for the stave width it needs. */
  keySignatureAccidentals?: number;
}

export interface StaffLayout {
  staves: StaveGeometry[];
  notes: NoteGeometry[];
  /** Total height in CSS pixels. */
  height: number;
}

/* VexFlow places the top staff line 40 units below a stave's y. With the stave
   at 4 the top line sits at 44, leaving room for three ledger lines above (fret
   12 on the first string is written E6); the row height leaves room for three
   below (the open low E is written E3). */
const ROW_HEIGHT = 128;
const STAVE_TOP = 4;
const CLEF_EXTRA = 42;
const TIME_SIG_EXTRA = 24;
const SIDE_PAD = 2;

const SIGN_GLYPH: Record<Exclude<Sign, 'none'>, string> = { sharp: '#', flat: 'b', natural: 'n' };

/** VexFlow key for a staff position; the pitch comes from letter and octave only, signs are modifiers. */
function vexKey(step: number): string {
  const spelled = spelledFromStaffStep(step);
  return `${spelled.letter.toLowerCase()}/${spelled.octave}`;
}

export function renderStaff(container: HTMLDivElement, bars: RenderBar[], options: RenderOptions): StaffLayout {
  container.innerHTML = '';
  const { scale, barsPerRow, timeSignature, ink } = options;
  const showClef = options.showClef ?? true;
  const showTimeSignature = options.showTimeSignature ?? true;
  const keySpec = options.keySignature && options.keySignature !== 'C' && options.keySignature !== 'Am' ? options.keySignature : undefined;
  const keyExtra = keySpec ? 8 + (options.keySignatureAccidentals ?? 0) * 10 : 0;
  // A melody shorter than one row spreads its bars across the full width.
  const perRow = Math.max(1, Math.min(barsPerRow, bars.length));
  const rows = Math.ceil(bars.length / perRow);
  const logicalWidth = options.width / scale;
  const height = rows * ROW_HEIGHT * scale;

  const renderer = new Renderer(container, Renderer.Backends.SVG);
  renderer.resize(options.width, height);
  const ctx: RenderContext = renderer.getContext();
  ctx.scale(scale, scale);
  ctx.setFillStyle(ink);
  ctx.setStrokeStyle(ink);

  const layout: StaffLayout = { staves: [], notes: [], height };
  const tsAt = (b: number): readonly [number, number] => options.barTimeSignatures?.[b] ?? timeSignature;
  const tsShown = (b: number, firstOfRow: boolean, row: number) =>
    showTimeSignature && ((firstOfRow && row === 0) || (b > 0 && (tsAt(b)[0] !== tsAt(b - 1)[0] || tsAt(b)[1] !== tsAt(b - 1)[1])));

  for (let row = 0; row < rows; row++) {
    const rowBars = bars.slice(row * perRow, (row + 1) * perRow);
    const firstInRow = row * perRow;
    const extra = (showClef ? CLEF_EXTRA : 0) + keyExtra;
    const tsExtraTotal = rowBars.reduce((s, _, i) => s + (tsShown(firstInRow + i, i === 0, row) ? TIME_SIG_EXTRA : 0), 0);
    const baseWidth = (logicalWidth - SIDE_PAD * 2 - extra - tsExtraTotal) / perRow;
    let x = SIDE_PAD;
    const y = row * ROW_HEIGHT + STAVE_TOP;

    rowBars.forEach((bar, i) => {
      const barIndex = firstInRow + i;
      const isFirst = i === 0;
      const showTs = tsShown(barIndex, isFirst, row);
      const width = baseWidth + (isFirst ? extra : 0) + (showTs ? TIME_SIG_EXTRA : 0);
      const stave = new Stave(x, y, width);
      // Order on the stave: clef, key signature, time signature.
      if (isFirst && showClef) stave.addClef('treble');
      if (isFirst && keySpec) stave.addKeySignature(keySpec);
      if (showTs) stave.addTimeSignature(`${tsAt(barIndex)[0]}/${tsAt(barIndex)[1]}`);
      if (barIndex === bars.length - 1) stave.setEndBarType(BarlineType.END);
      stave.setContext(ctx);

      if (bar.fill) {
        const top = stave.getYForLine(0);
        const spacing = stave.getSpacingBetweenLines();
        ctx.save();
        ctx.setFillStyle(bar.fill);
        ctx.fillRect(x, top - spacing * 1.5, width, spacing * 7);
        ctx.restore();
      }
      stave.draw();

      const staveNotes = bar.notes.map((n) => {
        const note = new StaveNote({
          keys: [vexKey(n.step)],
          duration: DURATIONS[n.duration].vexflow,
          clef: 'treble',
          autoStem: true,
        });
        if (n.sign !== 'none') {
          note.addModifier(new Accidental(SIGN_GLYPH[n.sign]), 0);
        }
        if (DURATIONS[n.duration].dots > 0) {
          Dot.buildAndAttach([note], { all: true });
        }
        if (n.style) note.setStyle({ fillStyle: n.style.fill, strokeStyle: n.style.stroke });
        if (n.label) {
          const annotation = new Annotation(n.label).setVerticalJustification(Annotation.VerticalJustify.BOTTOM);
          annotation.setStyle({ fillStyle: ink, strokeStyle: ink });
          note.addModifier(annotation, 0);
        }
        return note;
      });

      if (staveNotes.length > 0) {
        // autoBeam joins eighths into beamed pairs per beat.
        Formatter.FormatAndDraw(ctx, stave, staveNotes, { autoBeam: true, alignRests: false });
        staveNotes.forEach((note, noteIndex) => {
          layout.notes.push({
            barIndex,
            noteIndex,
            id: bar.notes[noteIndex]!.id,
            x: note.getAbsoluteX() * scale,
            y: note.getYs()[0]! * scale,
          });
        });
      }

      layout.staves.push({
        barIndex,
        x: x * scale,
        width: width * scale,
        topLineY: stave.getYForLine(0) * scale,
        lineSpacing: stave.getSpacingBetweenLines() * scale,
        noteStartX: stave.getNoteStartX() * scale,
      });
      x += width;
    });
  }

  return layout;
}
