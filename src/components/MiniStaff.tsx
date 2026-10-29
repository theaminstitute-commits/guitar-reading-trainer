import { useEffect, useLayoutEffect, useRef, useState, type PointerEvent } from 'react';
import type { DurationId } from '../music/duration';
import { keySignatureCount, keySignatureSpec, type Key } from '../music/key';
import { parseSpelled, staffStep, type SpelledNote } from '../music/pitch';
import { displaySignsForBars, type Sign } from '../notation/accidentals';
import { ensureNotationFonts } from '../notation/fonts';
import { staveAt, stepFromY, yFromStep } from '../notation/hitTest';
import { PAPER } from '../notation/paper';
import { renderStaff, type RenderBar, type StaffLayout } from '../notation/renderStaff';

/** The lower octave band: a cool slate, never a warm tint on the cream paper. */
const OCTAVE_4 = '#5b6b80';
/** Staff steps of the notes the octave bands are measured from. */
const OCTAVE_STEP = { D4: 4 * 7 + 1, B4: 4 * 7 + 6, G5: 5 * 7 + 4 } as const;

export interface MiniNote {
  step: number;
  sign: Sign;
  duration: DurationId;
  chord?: number;
  color?: string;
  /** Text under the note, on one baseline below the staff. */
  label?: string;
  /** The note sounds now: its label grows (R39). */
  on?: boolean;
  rest?: boolean;
}

/** A rest for `measure` to complete a bar with. */
export const miniRest = (duration: DurationId): MiniNote => ({ step: 34, sign: 'none', duration, rest: true });

interface MiniStaffProps {
  bars: MiniNote[][];
  musicKey: Key;
  timeSignature?: boolean;
  barsPerRow?: number;
  /** Makes the staff tappable: called with the line or space tapped. */
  onTapStep?: (step: number) => void;
  /** A column of letters before the clef naming every line (one colour) and space (another) of the staff. */
  legend?: boolean;
  /** The legend letter to emphasise (the step of the note sounding now). */
  legendHighlight?: number | null;
  /**
   * The notes drop onto the staff each time this value changes (a new question); redraws
   * with the same value (a tap, a resize) leave them still.
   */
  dropKey?: unknown;
  /**
   * The octave number shown on the staff (R38): everything from the C5 space up is tinted blue
   * and marked "C5 and up", everything from the middle line (B4) down is tinted grey and marked
   * "B4 and down", so the learner sees the number change at C.
   */
  octaveSplit?: boolean;
}

/**
 * Bars per row so every row is full (no bar left alone on the last row): as many
 * as fit, then evened out. Sparse bars (one or two notes) fit six to a row on a
 * wide screen and three on a phone; busier bars three and two.
 */
export function balancedPerRow(bars: readonly MiniNote[][], width: number, legend = false): number {
  const count = Math.max(1, bars.length);
  const busiest = Math.max(0, ...bars.map((b) => new Set(b.map((n, i) => (n.chord === undefined ? `n${i}` : `c${n.chord}`))).size));
  const sparse = busiest <= 2;
  const most = legend ? 2 : width < 480 ? (sparse ? 3 : 2) : sparse ? 6 : 3;
  const rows = Math.ceil(count / most);
  return Math.ceil(count / rows);
}

/** Staff steps of the five lines and four spaces, E4 to F5. */
const STAFF_STEPS = Array.from({ length: 9 }, (_, i) => staffStep(parseSpelled('E4')) + i);
const LETTERS = 'CDEFGAB';

/** Lowest and highest steps a tap may land on: the open low E to fret 12 on the first string. */
const MIN_STEP = staffStep(parseSpelled('E3'));
const MAX_STEP = staffStep(parseSpelled('E6'));

/** Notes written in a key, as mini-staff notes with the signs the key needs; a forced sign wins. */
export function miniNotes(
  notes: readonly { note: SpelledNote; duration?: DurationId; chord?: number; color?: string; label?: string; on?: boolean; sign?: Exclude<Sign, 'none'> }[],
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
    on: n.on,
  }));
}

/**
 * A small staff on cream paper for lessons and questions: example notes with
 * names underneath, or an empty bar the learner taps a line or space on.
 */
/** Length of the drop-in animation (`.drop-in` in styles.css). */
const DROP_MS = 600;
/** Length of the head-shake a wrong note gives after it lands (`.wrong-note`). */
const SHAKE_MS = 420;

export default function MiniStaff({ bars, musicKey, timeSignature = false, barsPerRow, onTapStep, legend = false, legendHighlight = null, dropKey, octaveSplit = false }: MiniStaffProps) {
  const dropped = useRef<{ key: unknown; at: number } | null>(null);
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

  // The letter column needs the staff a little larger, so each letter has room beside its line or space.
  const scale = legend ? (width < 480 ? 1.45 : 1.6) : width < 480 ? 1.2 : 1.4;
  /** Room before the clef for the letter columns. */
  const gutter = legend ? Math.round(30 * scale) : 0;
  const staffWidth = Math.max(0, width - gutter);

  useLayoutEffect(() => {
    const el = canvasRef.current;
    if (!el || !fontsReady || staffWidth === 0) return;
    let id = 0;
    const renderBars: RenderBar[] = bars.map((bar) => ({
      notes: bar.map((n) => ({
        id: id++,
        step: n.step,
        sign: n.sign,
        duration: n.duration,
        chord: n.chord,
        rest: n.rest,
        style: n.color ? { fill: n.color, stroke: n.color } : undefined,
      })),
    }));
    setLayout(
      renderStaff(el, renderBars.length > 0 ? renderBars : [{ notes: [] }], {
        timeSignature: [4, 4],
        width: staffWidth,
        barsPerRow: barsPerRow ?? balancedPerRow(bars, width, legend),
        scale,
        ink: PAPER.ink,
        showTimeSignature: timeSignature,
        keySignature: keySignatureSpec(musicKey),
        keySignatureAccidentals: Math.abs(keySignatureCount(musicKey)),
      }),
    );
    if (dropKey !== undefined && dropKey !== dropped.current?.key) dropped.current = { key: dropKey, at: performance.now() };
    // A redraw while the note is still falling (the first layout pass redraws at once) picks the fall up where it was.
    const elapsed = dropped.current && dropKey === dropped.current.key ? performance.now() - dropped.current.at : Infinity;
    if (elapsed < DROP_MS + SHAKE_MS) {
      // One drawn note per event (a chord's notes share one); a wrong (red) note shakes its head once it lands.
      const isWrong = (bar: MiniNote[], n: MiniNote) => n.color === PAPER.bad || (n.chord !== undefined && bar.some((m) => m.chord === n.chord && m.color === PAPER.bad));
      const wrong = bars.flatMap((bar) => bar.filter((n, i) => n.chord === undefined || n.chord !== bar[i - 1]?.chord).map((n) => isWrong(bar, n)));
      const e = Math.round(elapsed);
      el.querySelectorAll<SVGElement>('.vf-stavenote').forEach((g, i) => {
        g.classList.add('drop-in');
        if (wrong[i]) g.classList.add('wrong-note');
        g.style.animationDelay = wrong[i] ? `${-e}ms, ${DROP_MS - e}ms` : `${-e}ms`;
      });
    }
  }, [bars, musicKey, timeSignature, barsPerRow, width, staffWidth, scale, fontsReady, legend, dropKey]);

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
        // Centre the name under the notehead: the layout gives its left edge, and a whole note is wider than the others.
        const half = (note.duration === 'w' ? 8 : 5.5) * scale;
        return [{ x: g.x + half + gutter, y: stave.topLineY + stave.lineSpacing * 8.4, text: note.label, color: note.color ?? PAPER.ink, on: note.on === true }];
      })
    : [];

  // The letter column: on every staff row, before its clef, each letter level with its line or space.
  const rows = layout ? layout.staves.filter((s, i, all) => i === 0 || s.topLineY !== all[i - 1]!.topLineY) : [];
  const legendItems = legend
    ? rows.flatMap((stave) =>
        STAFF_STEPS.map((step) => {
          const isLine = (step - STAFF_STEPS[0]!) % 2 === 0;
          // Two staggered columns, lines nearer the clef and spaces outside, so neighbouring letters never touch.
          return { x: gutter * (isLine ? 0.72 : 0.28), y: yFromStep(step, stave), text: LETTERS[step % 7]!, color: isLine ? PAPER.lineLetter : PAPER.spaceLetter, on: legendHighlight === step };
        }),
      )
    : [];

  // The two octave bands meet just above the middle line: the B4 line is in the 4s, the whole C5 space in the 5s.
  // Their names sit just outside the staff, above and below, clear of the lines.
  const bands = octaveSplit
    ? rows.map((stave) => {
        const half = stave.lineSpacing / 2;
        const split = yFromStep(OCTAVE_STEP.B4, stave) - 1.5;
        const left = gutter + stave.x;
        const right = left + stave.width;
        return { left, right, top: yFromStep(OCTAVE_STEP.G5, stave) - half, split, bottom: yFromStep(OCTAVE_STEP.D4, stave) + half };
      })
    : [];
  const bandSize = 8.6 * scale;

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if (!onTapStep || !layout || !wrapRef.current) return;
    const rect = wrapRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left - gutter;
    const y = e.clientY - rect.top;
    const stave = staveAt(layout.staves, x, y);
    if (!stave) return;
    onTapStep(Math.min(MAX_STEP, Math.max(MIN_STEP, stepFromY(y, stave))));
  };

  return (
    <div ref={wrapRef} className={`mini-staff guide-staff${onTapStep ? ' tappable' : ''}`} onPointerDown={onPointerDown}>
      <div ref={canvasRef} className="staff-canvas static" style={gutter ? { marginLeft: gutter, width: staffWidth } : undefined} />
      {layout && (labels.length > 0 || legendItems.length > 0 || bands.length > 0) && (
        <svg className="feedback-overlay" width={width} height={layout.height + labelSize} aria-hidden="true">
          {bands.map((b, i) => (
            <g key={`o${i}`}>
              <rect x={b.left} y={b.top} width={b.right - b.left} height={b.split - b.top} fill={PAPER.active} opacity={0.17} />
              <rect x={b.left} y={b.split} width={b.right - b.left} height={b.bottom - b.split} fill={OCTAVE_4} opacity={0.14} />
              <text x={b.right - 4} y={b.top - bandSize * 0.85} textAnchor="end" dominantBaseline="central" className="octave-band" fill={PAPER.active} fontSize={bandSize}>
                C5 and up: 5
              </text>
              <text x={b.right - 4} y={b.bottom + bandSize * 0.85} textAnchor="end" dominantBaseline="central" className="octave-band" fill={OCTAVE_4} fontSize={bandSize}>
                B4 and down: 4
              </text>
            </g>
          ))}
          {labels.map((l, i) => (
            <text
              key={i}
              x={l.x}
              y={l.y}
              textAnchor="middle"
              dominantBaseline="central"
              className={`pitch-label${l.on ? ' on' : ''}`}
              fill={l.color}
              style={{ fontSize: (l.on ? 1.5 : 1) * labelSize }}
            >
              {l.text}
            </text>
          ))}
          {legendItems.map((l, i) => (
            <text
              key={`g${i}`}
              x={l.x}
              y={l.y}
              textAnchor="middle"
              dominantBaseline="central"
              className="staff-legend"
              fill={l.color}
              fontSize={(l.on ? 11 : 8.6) * scale}
              fontWeight={l.on ? 900 : 700}
            >
              {l.text}
            </text>
          ))}
        </svg>
      )}
    </div>
  );
}
