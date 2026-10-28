import { useEffect, useLayoutEffect, useRef, useState, type PointerEvent } from 'react';
import type { DurationId } from '../music/duration';
import { keySignatureCount, keySignatureSpec, type Key } from '../music/key';
import { parseSpelled, staffStep, type SpelledNote } from '../music/pitch';
import { displaySignsForBars, type Sign } from '../notation/accidentals';
import { ensureNotationFonts } from '../notation/fonts';
import { staveAt, stepFromY } from '../notation/hitTest';
import { PAPER } from '../notation/paper';
import { renderStaff, type RenderBar, type StaffLayout } from '../notation/renderStaff';

export interface MiniNote {
  step: number;
  sign: Sign;
  duration: DurationId;
  chord?: number;
  color?: string;
  /** Text under the note, on one baseline below the staff. */
  label?: string;
}

interface MiniStaffProps {
  bars: MiniNote[][];
  musicKey: Key;
  timeSignature?: boolean;
  barsPerRow?: number;
  /** Makes the staff tappable: called with the line or space tapped. */
  onTapStep?: (step: number) => void;
}

/** Lowest and highest steps a tap may land on: the open low E to fret 12 on the first string. */
const MIN_STEP = staffStep(parseSpelled('E3'));
const MAX_STEP = staffStep(parseSpelled('E6'));

/** Notes written in a key, as mini-staff notes with the signs the key needs; a forced sign wins. */
export function miniNotes(
  notes: readonly { note: SpelledNote; duration?: DurationId; chord?: number; color?: string; label?: string; sign?: Exclude<Sign, 'none'> }[],
  key: Key,
): MiniNote[] {
  const signs = displaySignsForBars([notes.map((n) => n.note)], key)[0]!;
  return notes.map((n, i) => ({
    step: staffStep(n.note),
    sign: n.sign ?? signs[i]!,
    duration: n.duration ?? 'q',
    chord: n.chord,
    color: n.color,
    label: n.label,
  }));
}

/**
 * A small staff on cream paper for lessons and questions: example notes with
 * names underneath, or an empty bar the learner taps a line or space on.
 */
export default function MiniStaff({ bars, musicKey, timeSignature = false, barsPerRow, onTapStep }: MiniStaffProps) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const [fontsReady, setFontsReady] = useState(false);
  const [layout, setLayout] = useState<StaffLayout | null>(null);

  useEffect(() => {
    ensureNotationFonts().then(() => setFontsReady(true));
  }, []);

  useLayoutEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const update = () => setWidth(el.clientWidth);
    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    const later = setTimeout(update, 300);
    return () => {
      observer.disconnect();
      clearTimeout(later);
    };
  }, []);

  const scale = width < 480 ? 1.2 : 1.4;

  useLayoutEffect(() => {
    const el = canvasRef.current;
    if (!el || !fontsReady || width === 0) return;
    let id = 0;
    const renderBars: RenderBar[] = bars.map((bar) => ({
      notes: bar.map((n) => ({
        id: id++,
        step: n.step,
        sign: n.sign,
        duration: n.duration,
        chord: n.chord,
        style: n.color ? { fill: n.color, stroke: n.color } : undefined,
      })),
    }));
    setLayout(
      renderStaff(el, renderBars.length > 0 ? renderBars : [{ notes: [] }], {
        timeSignature: [4, 4],
        width,
        barsPerRow: barsPerRow ?? (width < 480 ? 2 : 3),
        scale,
        ink: PAPER.ink,
        showTimeSignature: timeSignature,
        keySignature: keySignatureSpec(musicKey),
        keySignatureAccidentals: Math.abs(keySignatureCount(musicKey)),
      }),
    );
  }, [bars, musicKey, timeSignature, barsPerRow, width, scale, fontsReady]);

  const flat = bars.flat();
  const labelSize = 9 * scale;
  const labels = layout
    ? layout.notes.flatMap((g) => {
        const note = flat[g.id];
        if (!note?.label) return [];
        // A chord carries its label once, on its lowest note.
        const first = flat.findIndex((m) => m.chord !== undefined && m.chord === note.chord);
        if (note.chord !== undefined && first !== g.id) return [];
        const stave = layout.staves[g.barIndex] ?? layout.staves[layout.staves.length - 1]!;
        return [{ x: g.x, y: stave.topLineY + stave.lineSpacing * 8.4, text: note.label, color: note.color ?? PAPER.ink }];
      })
    : [];

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if (!onTapStep || !layout || !wrapRef.current) return;
    const rect = wrapRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const stave = staveAt(layout.staves, x, y);
    if (!stave) return;
    onTapStep(Math.min(MAX_STEP, Math.max(MIN_STEP, stepFromY(y, stave))));
  };

  return (
    <div ref={wrapRef} className={`mini-staff guide-staff${onTapStep ? ' tappable' : ''}`} onPointerDown={onPointerDown}>
      <div ref={canvasRef} className="staff-canvas static" />
      {layout && labels.length > 0 && (
        <svg className="feedback-overlay" width={width} height={layout.height + labelSize} aria-hidden="true">
          {labels.map((l, i) => (
            <text key={i} x={l.x} y={l.y} textAnchor="middle" dominantBaseline="central" className="pitch-label" fill={l.color} fontSize={labelSize}>
              {l.text}
            </text>
          ))}
        </svg>
      )}
    </div>
  );
}
