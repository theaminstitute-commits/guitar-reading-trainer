/**
 * Render bars of notes to SVG with VexFlow and report where everything landed,
 * so the staff can be tapped (StaffInput) or overlaid (feedback).
 *
 * Coordinates in the returned layout are CSS pixels relative to the container.
 */
import { Accidental, Annotation, BarlineType, Formatter, Renderer, Stave, StaveNote, type RenderContext } from 'vexflow/core';
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
  /** Container width in CSS pixels. */
  width: number;
  barsPerRow: number;
  /** Zoom factor: 1 = VexFlow's default 10px line spacing. */
  scale: number;
  /** Colour for staff lines, clef and unstyled notes. */
  ink: string;
  showClef?: boolean;
  showTimeSignature?: boolean;
  /** VexFlow key spec such as 'G', 'Bb', 'F#'; omitted or 'C' draws none. */
  keySignature?: string;
}

export interface StaffLayout {
  staves: StaveGeometry[];
  notes: NoteGeometry[];
  /** Total height in CSS pixels. */
  height: number;
}

/* VexFlow places the top staff line 40 units below a stave's y, which leaves
   room for two ledger lines above; the row height leaves room for two below. */
const ROW_HEIGHT = 104;
const STAVE_TOP = -8;
const CLEF_EXTRA = 42;
const TIME_SIG_EXTRA = 24;
const SIDE_PAD = 2;

const SIGN_GLYPH: Record<Exclude<Sign, 'none'>, string> = { sharp: '#', flat: 'b', natural: 'n' };

/** Count of sharps or flats in a key spec, for the extra stave width it needs. */
function keySignatureSize(spec: string | undefined): number {
  const sizes: Record<string, number> = { C: 0, G: 1, D: 2, A: 3, E: 4, B: 5, 'F#': 6, 'C#': 7, F: 1, Bb: 2, Eb: 3, Ab: 4, Db: 5, Gb: 6, Cb: 7 };
  return spec ? (sizes[spec] ?? 0) : 0;
}

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
  const keySpec = options.keySignature && options.keySignature !== 'C' ? options.keySignature : undefined;
  const keyExtra = keySpec ? 8 + keySignatureSize(keySpec) * 10 : 0;
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
  const [beats, beatValue] = timeSignature;

  for (let row = 0; row < rows; row++) {
    const rowBars = bars.slice(row * perRow, (row + 1) * perRow);
    const firstInRow = row * perRow;
    const extra = (showClef ? CLEF_EXTRA : 0) + keyExtra + (showTimeSignature && row === 0 ? TIME_SIG_EXTRA : 0);
    const baseWidth = (logicalWidth - SIDE_PAD * 2 - extra) / perRow;
    let x = SIDE_PAD;
    const y = row * ROW_HEIGHT + STAVE_TOP;

    rowBars.forEach((bar, i) => {
      const barIndex = firstInRow + i;
      const isFirst = i === 0;
      const width = baseWidth + (isFirst ? extra : 0);
      const stave = new Stave(x, y, width);
      // Order on the stave: clef, key signature, time signature.
      if (isFirst && showClef) stave.addClef('treble');
      if (isFirst && keySpec) stave.addKeySignature(keySpec);
      if (isFirst && row === 0 && showTimeSignature) stave.addTimeSignature(`${beats}/${beatValue}`);
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
        if (n.style) note.setStyle({ fillStyle: n.style.fill, strokeStyle: n.style.stroke });
        if (n.label) {
          const annotation = new Annotation(n.label).setVerticalJustification(Annotation.VerticalJustify.BOTTOM);
          annotation.setStyle({ fillStyle: ink, strokeStyle: ink });
          note.addModifier(annotation, 0);
        }
        return note;
      });

      if (staveNotes.length > 0) {
        Formatter.FormatAndDraw(ctx, stave, staveNotes, { autoBeam: false, alignRests: false });
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
