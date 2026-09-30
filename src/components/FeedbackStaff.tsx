import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { GradeResult, GradedPair } from '../grading/grade';
import { splitIntoBars } from '../melody/bars';
import type { Melody } from '../melody/types';
import { spellInKey, type Key } from '../music/key';
import { spelledName, staffStep, writtenFromSounding, type SpelledNote } from '../music/pitch';
import { ensureNotationFonts } from '../notation/fonts';
import { yFromStep } from '../notation/hitTest';
import { renderStaff, type RenderBar, type StaffLayout } from '../notation/renderStaff';

interface FeedbackStaffProps {
  melody: Melody;
  musicKey: Key;
  result: GradeResult;
  /** Target note index currently sounding, for the "hear the correct melody" button. */
  activeIndex: number | null;
}

const COLORS = {
  ink: '#f1ece4',
  good: '#6cc38b',
  bad: '#e5674f',
  missing: '#8a8178',
  active: '#e0a84a',
};

interface Marker {
  x: number;
  badgeY: number;
  numbers: string;
  ghostY: number | null;
  /** What the learner wrote, shown beside the ghost head. */
  ghostLabel: string | null;
}

interface NoteLabel {
  x: number;
  y: number;
  text: string;
  color: string;
}

const pitchLabel = (n: SpelledNote) => `${spelledName(n)}${n.octave}`;

/**
 * The correct melody with the learner's answer laid over it: green notes were
 * right, red notes were wrong, grey notes were missed. A red ghost head shows
 * where a wrong note was written, and numbered badges point to the explanations.
 */
export default function FeedbackStaff({ melody, musicKey, result, activeIndex }: FeedbackStaffProps) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const [fontsReady, setFontsReady] = useState(false);
  const [layout, setLayout] = useState<StaffLayout | null>(null);
  const [markers, setMarkers] = useState<Marker[]>([]);
  const [labels, setLabels] = useState<NoteLabel[]>([]);

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
    return () => observer.disconnect();
  }, []);

  const scale = width < 480 ? 1.35 : 1.6;

  useLayoutEffect(() => {
    const el = canvasRef.current;
    if (!el || !fontsReady || width === 0) return;

    const pairByTarget = new Map<number, GradedPair>();
    for (const p of result.pairs) if (p.target) pairByTarget.set(p.target.index, p);

    let targetIndex = 0;
    const bars: RenderBar[] = splitIntoBars(melody.notes, melody.timeSignature).map((bar) => ({
      notes: bar.notes.map((n) => {
        const index = targetIndex++;
        const pair = pairByTarget.get(index);
        const written = spellInKey(writtenFromSounding(n.midi), musicKey);
        let color = COLORS.good;
        if (!pair || !pair.answer) color = COLORS.missing;
        else if (pair.mistakes.length > 0) color = COLORS.bad;
        if (index === activeIndex) color = COLORS.active;
        return {
          id: index,
          step: staffStep(written),
          accidental: written.accidental,
          duration: n.duration,
          style: { fill: color, stroke: color },
        };
      }),
    }));

    const next = renderStaff(el, bars, {
      timeSignature: melody.timeSignature,
      width,
      barsPerRow: 2,
      scale,
      ink: COLORS.ink,
    });
    setLayout(next);

    // Pitch names to the left of every target note, in the note's colour.
    const colorOfTarget = new Map(bars.flatMap((b) => b.notes).map((n) => [n.id, n.style!.fill]));
    setLabels(
      next.notes.map((n) => {
        const target = melody.notes[n.id]!;
        return {
          x: n.x,
          y: n.y,
          text: pitchLabel(spellInKey(writtenFromSounding(target.midi), musicKey)),
          color: colorOfTarget.get(n.id) ?? COLORS.ink,
        };
      }),
    );

    // Work out where each mistake marker goes.
    const xOfTarget = new Map(next.notes.map((n) => [n.id, n.x]));
    const list: Marker[] = [];
    result.pairs.forEach((pair, i) => {
      if (pair.mistakes.length === 0) return;
      const bar = pair.target?.bar ?? pair.answer?.bar ?? 0;
      const stave = next.staves[bar] ?? next.staves[next.staves.length - 1]!;
      let x: number;
      if (pair.target) {
        x = xOfTarget.get(pair.target.index) ?? stave.noteStartX;
      } else {
        // Extra note: spread a run of extras evenly between the neighbouring target notes.
        let runStart = i;
        while (runStart > 0 && !result.pairs[runStart - 1]!.target) runStart--;
        let runEnd = i;
        while (runEnd < result.pairs.length - 1 && !result.pairs[runEnd + 1]!.target) runEnd++;
        const before = runStart > 0 ? result.pairs[runStart - 1]!.target : null;
        const after = runEnd < result.pairs.length - 1 ? result.pairs[runEnd + 1]!.target : null;
        const xBefore = before ? (xOfTarget.get(before.index) ?? stave.noteStartX) : stave.noteStartX - 6 * scale;
        const xAfter = after ? (xOfTarget.get(after.index) ?? stave.x + stave.width) : stave.x + stave.width - 8 * scale;
        const slots = runEnd - runStart + 2;
        x = xBefore + ((xAfter - xBefore) * (i - runStart + 1)) / slots;
      }
      const ghostY = pair.answer && !pair.pitchOk ? yFromStep(staffStep(pair.answer.written), stave) : null;
      list.push({
        x,
        badgeY: stave.topLineY - stave.lineSpacing * 2.6,
        numbers: pair.mistakes.map((m) => m.number).join(','),
        ghostY,
        ghostLabel: ghostY === null ? null : pitchLabel(pair.answer!.written),
      });
    });
    setMarkers(list);
  }, [melody, musicKey, result, activeIndex, width, scale, fontsReady]);

  const headRx = 5.2 * scale;
  const headRy = 3.6 * scale;
  const labelGap = 9 * scale;
  const labelSize = 8.5 * scale;

  return (
    <div ref={wrapRef} className="feedback-staff">
      <div ref={canvasRef} className="staff-canvas static" />
      {layout && (
        <svg className="feedback-overlay" width={width} height={layout.height} aria-hidden="true">
          {labels.map((l, i) => (
            <text key={`l${i}`} x={l.x - labelGap} y={l.y} textAnchor="end" dominantBaseline="central" className="pitch-label" fill={l.color} fontSize={labelSize}>
              {l.text}
            </text>
          ))}
          {markers.map((m, i) => (
            <g key={i}>
              {m.ghostY !== null && (
                <>
                  <ellipse cx={m.x} cy={m.ghostY} rx={headRx} ry={headRy} transform={`rotate(-20 ${m.x} ${m.ghostY})`} className="ghost-head" />
                  <text x={m.x - labelGap} y={m.ghostY} textAnchor="end" dominantBaseline="central" className="pitch-label ghost" fontSize={labelSize}>
                    {m.ghostLabel}
                  </text>
                </>
              )}
              <g className="badge">
                <circle cx={m.x} cy={m.badgeY} r={9 * Math.min(scale, 1.4)} />
                <text x={m.x} y={m.badgeY} textAnchor="middle" dominantBaseline="central">
                  {m.numbers}
                </text>
              </g>
            </g>
          ))}
        </svg>
      )}
      <div className="legend muted">
        <span className="swatch good" /> right <span className="swatch bad" /> wrong <span className="swatch missing" /> missed{' '}
        <span className="swatch ghost" /> what you wrote
      </div>
    </div>
  );
}
