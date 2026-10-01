import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { GradeResult, GradedPair } from '../grading/grade';
import { splitIntoBars } from '../melody/bars';
import { timeSignaturesFor } from '../melody/meter';
import type { Melody } from '../melody/types';
import { keySignatureCount, keySignatureSpec, spellInKey, type Key } from '../music/key';
import { spelledName, staffStep, writtenFromSounding, type SpelledNote } from '../music/pitch';
import { displaySignsForBars } from '../notation/accidentals';
import { resolveAnswerBar, type AnswerNote } from '../notation/answer';
import { ensureNotationFonts } from '../notation/fonts';
import { renderStaff, type RenderBar, type StaffLayout } from '../notation/renderStaff';

interface FeedbackStaffProps {
  melody: Melody;
  musicKey: Key;
  result: GradeResult;
  answerBars: readonly (readonly AnswerNote[])[];
  /** Target note sounding now ("Hear correct"), highlighted on the top staff. */
  activeTarget: number | null;
  /** Answer note sounding now ("Hear mine"), highlighted on the bottom staff. */
  activeAnswer: number | null;
}

const COLORS = {
  ink: '#f1ece4',
  good: '#6cc38b',
  bad: '#e5674f',
  missing: '#8a8178',
  active: '#e0a84a',
};

interface Badge {
  x: number;
  y: number;
  numbers: string;
}

interface NoteLabel {
  x: number;
  y: number;
  text: string;
  color: string;
}

interface Overlay {
  layout: StaffLayout;
  labels: NoteLabel[];
  badges: Badge[];
}

const pitchLabel = (n: SpelledNote) => `${spelledName(n)}${n.octave}`;

function overlayFor(layout: StaffLayout, bars: RenderBar[], names: Map<number, string>, badgesById: Map<number, string>): Overlay {
  const colorOf = new Map(bars.flatMap((b) => b.notes).map((n) => [n.id, n.style?.fill ?? COLORS.ink]));
  const labels: NoteLabel[] = layout.notes.map((n) => ({
    x: n.x,
    y: n.y,
    text: names.get(n.id) ?? '',
    color: colorOf.get(n.id) ?? COLORS.ink,
  }));
  const badges: Badge[] = [];
  for (const n of layout.notes) {
    const numbers = badgesById.get(n.id);
    if (!numbers) continue;
    const stave = layout.staves[n.barIndex] ?? layout.staves[layout.staves.length - 1]!;
    badges.push({ x: n.x, y: stave.topLineY - stave.lineSpacing * 2.6, numbers });
  }
  return { layout, labels, badges };
}

/**
 * Two staffs, one above the other: the correct melody, then what the learner
 * wrote. On both, green notes agree, red notes differ; grey notes on the top
 * staff were missed, red notes on the bottom staff with no partner are extra.
 * Numbered badges point to the explanations. While a version plays, its own
 * staff follows the sounding note in amber.
 */
export default function FeedbackStaff({ melody, musicKey, result, answerBars, activeTarget, activeAnswer }: FeedbackStaffProps) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const targetRef = useRef<HTMLDivElement>(null);
  const answerRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const [fontsReady, setFontsReady] = useState(false);
  const [targetOverlay, setTargetOverlay] = useState<Overlay | null>(null);
  const [answerOverlay, setAnswerOverlay] = useState<Overlay | null>(null);

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
    const targetEl = targetRef.current;
    const answerEl = answerRef.current;
    if (!targetEl || !answerEl || !fontsReady || width === 0) return;

    const pairByTarget = new Map<number, GradedPair>();
    const pairByAnswer = new Map<number, GradedPair>();
    for (const p of result.pairs) {
      if (p.target) pairByTarget.set(p.target.index, p);
      if (p.answer) pairByAnswer.set(p.answer.index, p);
    }
    const numbersOf = (p: GradedPair | undefined) => (p && p.mistakes.length > 0 ? p.mistakes.map((m) => m.number).join(',') : null);

    const options = {
      timeSignature: melody.timeSignature,
      barTimeSignatures: timeSignaturesFor(melody.barBeats),
      width,
      barsPerRow: 2,
      scale,
      ink: COLORS.ink,
      keySignature: keySignatureSpec(musicKey),
      keySignatureAccidentals: Math.abs(keySignatureCount(musicKey)),
    };

    // --- Top staff: the correct melody, coloured by how the learner did on each note.
    const targetBars = splitIntoBars(melody.notes, melody.barBeats);
    const writtenBars = targetBars.map((bar) => bar.notes.map((n) => spellInKey(writtenFromSounding(n.midi), musicKey)));
    const signs = displaySignsForBars(writtenBars, musicKey);
    const targetNames = new Map<number, string>();
    const targetBadges = new Map<number, string>();
    let targetIndex = 0;
    const targetRender: RenderBar[] = targetBars.map((bar, barIndex) => ({
      notes: bar.notes.map((n, noteIndex) => {
        const index = targetIndex++;
        const pair = pairByTarget.get(index);
        const written = writtenBars[barIndex]![noteIndex]!;
        let color = COLORS.good;
        if (!pair || !pair.answer) color = COLORS.missing;
        else if (pair.mistakes.length > 0) color = COLORS.bad;
        if (index === activeTarget) color = COLORS.active;
        targetNames.set(index, pitchLabel(written));
        const numbers = numbersOf(pair);
        if (numbers) targetBadges.set(index, numbers);
        return { id: index, step: staffStep(written), sign: signs[barIndex]![noteIndex]!, duration: n.duration, style: { fill: color, stroke: color } };
      }),
    }));
    const targetLayout = renderStaff(targetEl, targetRender, options);
    setTargetOverlay(overlayFor(targetLayout, targetRender, targetNames, targetBadges));

    // --- Bottom staff: what the learner wrote, exactly as written.
    const answerNames = new Map<number, string>();
    const answerBadges = new Map<number, string>();
    let answerIndex = 0;
    const answerRender: RenderBar[] = answerBars.map((bar) => {
      const resolved = resolveAnswerBar(bar, musicKey);
      return {
        notes: bar.map((n, i) => {
          const index = answerIndex++;
          const pair = pairByAnswer.get(index);
          let color = COLORS.good;
          if (!pair || !pair.target || pair.mistakes.length > 0) color = COLORS.bad;
          if (index === activeAnswer) color = COLORS.active;
          answerNames.set(index, pitchLabel(resolved[i]!));
          const numbers = numbersOf(pair);
          if (numbers) answerBadges.set(index, numbers);
          return { id: index, step: n.step, sign: n.sign, duration: n.duration, style: { fill: color, stroke: color } };
        }),
      };
    });
    // Keep the same number of bars as the melody so the two staffs line up.
    while (answerRender.length < targetBars.length) answerRender.push({ notes: [] });
    const answerLayout = renderStaff(answerEl, answerRender, options);
    setAnswerOverlay(overlayFor(answerLayout, answerRender, answerNames, answerBadges));
  }, [melody, musicKey, result, answerBars, activeTarget, activeAnswer, width, scale, fontsReady]);

  const labelGap = 9 * scale;
  const labelSize = 8.5 * scale;

  const renderOverlay = (overlay: Overlay | null) =>
    overlay && (
      <svg className="feedback-overlay" width={width} height={overlay.layout.height} aria-hidden="true">
        {overlay.labels.map((l, i) => (
          <text key={`l${i}`} x={l.x - labelGap} y={l.y} textAnchor="end" dominantBaseline="central" className="pitch-label" fill={l.color} fontSize={labelSize}>
            {l.text}
          </text>
        ))}
        {overlay.badges.map((b, i) => (
          <g key={`b${i}`} className="badge">
            <circle cx={b.x} cy={b.y} r={9 * Math.min(scale, 1.4)} />
            <text x={b.x} y={b.y} textAnchor="middle" dominantBaseline="central">
              {b.numbers}
            </text>
          </g>
        ))}
      </svg>
    );

  return (
    <div ref={wrapRef} className="feedback-staffs">
      <div className={`staff-block${activeTarget !== null ? ' playing' : ''}`}>
        <div className="staff-caption muted">Correct</div>
        <div className="staff-wrap">
          <div ref={targetRef} className="staff-canvas static" />
          {renderOverlay(targetOverlay)}
        </div>
      </div>
      <div className={`staff-block${activeAnswer !== null ? ' playing' : ''}`}>
        <div className="staff-caption muted">Yours</div>
        <div className="staff-wrap">
          <div ref={answerRef} className="staff-canvas static" />
          {renderOverlay(answerOverlay)}
        </div>
      </div>
      <div className="legend muted">
        <span className="swatch good" /> agrees <span className="swatch bad" /> differs or extra <span className="swatch missing" /> missed{' '}
        <span className="swatch active" /> playing now
      </div>
    </div>
  );
}
