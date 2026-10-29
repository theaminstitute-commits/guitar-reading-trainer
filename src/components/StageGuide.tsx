import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { sharedPlayer, type PlayableNote } from '../audio/player';
import { eventAt } from '../melody/bars';
import { stageGuide } from '../melody/stageGuide';
import type { Stage } from '../melody/stages';
import { keyName, keySignatureCount, keySignatureSpec, spellInKey } from '../music/key';
import { writtenFromSounding } from '../music/pitch';
import { displaySignsForBars } from '../notation/accidentals';
import { ensureNotationFonts } from '../notation/fonts';
import { PAPER } from '../notation/paper';
import { measure } from '../notation/measure';
import { renderStaff, type RenderBar, type StaffLayout } from '../notation/renderStaff';
import Fretboard from './Fretboard';

interface StageGuideProps {
  stage: Stage;
  previous: Stage | null;
  leftHanded: boolean;
  /** Called with the stage number when the learner goes on to play it. */
  onStart: () => void;
  onBack: () => void;
}

const INK = PAPER.ink;
const NEW = PAPER.active;
const NOTES_PER_BAR = 4;

/**
 * A page shown before a stage starts: every pitch the stage can draw on,
 * named and placed on the staff, with the new ones in blue, and where those
 * pitches sit on the fretboard. A chord stage shows example chords instead,
 * one per bar, named underneath. Tapping Hear plays them in order.
 */
export default function StageGuide({ stage, previous, leftHanded, onStart, onBack }: StageGuideProps) {
  const guide = useMemo(() => stageGuide(stage, previous), [stage, previous]);
  const chords = guide.chords;
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const [fontsReady, setFontsReady] = useState(false);
  /** The pitch (melodic stages) or chord index (chord stages) sounding now. */
  const [sounding, setSounding] = useState<number | null>(null);
  const [layout, setLayout] = useState<StaffLayout | null>(null);

  useEffect(() => {
    ensureNotationFonts().then(() => setFontsReady(true));
    return () => sharedPlayer().stop();
  }, []);

  useLayoutEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const update = () => setWidth(el.clientWidth);
    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    window.addEventListener('resize', update);
    const later = setTimeout(update, 300);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', update);
      clearTimeout(later);
    };
  }, []);

  const scale = width < 480 ? 1.2 : 1.4;

  useLayoutEffect(() => {
    const el = canvasRef.current;
    if (!el || !fontsReady || width === 0) return;
    let bars: RenderBar[];
    if (chords) {
      bars = chords.map((chord, c) => ({
        notes: chord.notes.map((n, k) => ({
          id: c * 16 + k,
          step: n.step,
          sign: n.sign,
          duration: 'w' as const,
          chord: c + 1,
          style: sounding === c ? { fill: NEW, stroke: NEW } : undefined,
        })),
      }));
    } else {
      const chunks: typeof guide.pitches[] = [];
      for (let i = 0; i < guide.pitches.length; i += NOTES_PER_BAR) chunks.push(guide.pitches.slice(i, i + NOTES_PER_BAR));
      const writtenBars = chunks.map((bar) => bar.map((p) => spellInKey(writtenFromSounding(p.midi), guide.key)));
      const signs = displaySignsForBars(writtenBars, guide.key);
      bars = chunks.map((bar, b) => ({
        notes: bar.map((p, i) => ({
          id: b * NOTES_PER_BAR + i,
          step: p.step,
          sign: signs[b]![i]!,
          duration: 'q' as const,
          style: p.isNew || sounding === p.midi ? { fill: NEW, stroke: NEW } : undefined,
        })),
      }));
      // The last bar of the list is usually short: complete it so every bar holds four beats (notation/measure).
      let restId = -1;
      bars = bars.map((bar) => ({ notes: measure(bar.notes, (duration) => ({ id: restId--, step: 34, sign: 'none' as const, duration, rest: true }))[0]! }));
    }
    setLayout(
      renderStaff(el, bars, {
        timeSignature: [4, 4],
        width,
        barsPerRow: chords ? (width < 480 ? 2 : 4) : width < 480 ? 2 : 3,
        scale,
        ink: INK,
        showTimeSignature: false,
        keySignature: keySignatureSpec(guide.key),
        keySignatureAccidentals: Math.abs(keySignatureCount(guide.key)),
      }),
    );
  }, [guide, chords, width, scale, fontsReady, sounding]);

  // Names on one baseline under each staff row, clear of three ledger lines, instead of
  // VexFlow's per-note annotations that follow the stems up and down.
  const labelSize = 9 * scale;
  const labels = layout
    ? chords
      ? layout.staves.map((stave) => ({
          x: stave.x + (stave.noteStartX - stave.x + stave.width) / 2,
          y: stave.topLineY + stave.lineSpacing * 8.4,
          text: chords[stave.barIndex]?.name ?? '',
          isNew: sounding === stave.barIndex,
        }))
      : layout.notes.map((n) => {
          const stave = layout.staves[n.barIndex] ?? layout.staves[layout.staves.length - 1]!;
          const pitch = guide.pitches[n.id];
          return { x: n.x, y: stave.topLineY + stave.lineSpacing * 8.4, text: pitch?.name ?? '', isNew: pitch?.isNew ?? false };
        })
    : [];

  const playAll = async () => {
    const player = sharedPlayer();
    if (chords) {
      const notes: PlayableNote[] = chords.flatMap((chord, c) => chord.notes.map((n) => ({ midi: n.midi, duration: 'h' as const, chord: c + 1 })));
      await player.play(
        notes,
        { tempo: 72, timeSignature: [4, 4], countIn: false },
        { onNote: (i) => setSounding(chords.findIndex((chord) => chord.notes.some((n) => n.midi === eventAt(notes, i)[0]!.midi) && notes.indexOf(eventAt(notes, i)[0]!) === i)), onEnd: () => setSounding(null) },
      );
      return;
    }
    await player.play(
      // As written: four quarters to a bar, and a pitch alone in the last bar is drawn, so played, as a whole note.
      guide.pitches.map((p, i, all) => ({ midi: p.midi, duration: i === all.length - 1 && all.length % 4 === 1 ? ('w' as const) : ('q' as const) })),
      { tempo: 96, timeSignature: [4, 4], countIn: false },
      { onNote: (i) => setSounding(guide.pitches[i]!.midi), onEnd: () => setSounding(null) },
    );
  };

  const newCount = guide.pitches.filter((p) => p.isNew).length;
  const positions = chords ? (chords[sounding ?? -1]?.positions ?? chords[0]?.positions ?? []) : guide.pitches.flatMap((p) => p.positions);
  const active = chords ? (sounding === null ? null : (chords[sounding]?.positions ?? null)) : (guide.pitches.find((p) => p.midi === sounding)?.positions[0] ?? null);

  return (
    <section className="guide">
      <h2>
        Stage {stage.number}: {stage.name}
      </h2>
      <p>{stage.summary}</p>
      <ul className="guide-facts">
        <li>
          <strong>Keys:</strong> {guide.keys}.
        </li>
        <li>
          <strong>Note lengths:</strong> {guide.lengths}.
        </li>
        <li>
          <strong>On the guitar:</strong> {guide.range}.
        </li>
        <li>
          <strong>Listens:</strong> {guide.listens}.
        </li>
      </ul>

      <h3 className="section-title">
        {chords ? 'Chords of this stage' : 'The notes of this stage'} <span className="muted key-name">· shown in {keyName(guide.key)}</span>
      </h3>
      <p className="muted small-note">
        {chords
          ? `${chords.length} example chords, named underneath. Write every note of a chord on the staff, lowest to highest; the stage draws its chords from any root.`
          : `${guide.pitches.length} pitches, lowest to highest, named as written for guitar (an octave above where they sound).${newCount > 0 && previous ? ` The ${newCount} in blue are new in this stage.` : ''}`}
      </p>
      <div ref={wrapRef} className="guide-staff">
        <div ref={canvasRef} className="staff-canvas static" />
        {layout && (
          <svg className="feedback-overlay" width={width} height={layout.height + labelSize} aria-hidden="true">
            {labels.map((l, i) => (
              <text key={i} x={l.x} y={l.y} textAnchor="middle" dominantBaseline="central" className="pitch-label" fill={l.isNew ? NEW : INK} fontSize={labelSize}>
                {l.text}
              </text>
            ))}
          </svg>
        )}
      </div>
      <div className="controls">
        {sounding === null ? (
          <button data-sound="none" onClick={() => void playAll()}>Hear them in order</button>
        ) : (
          <button onClick={() => sharedPlayer().stop()}>Stop</button>
        )}
      </div>

      <h3 className="section-title">{chords ? 'The first chord on the fretboard' : 'Where they are on the fretboard'}</h3>
      {chords && <p className="muted small-note">While the chords play, the fretboard follows the one sounding.</p>}
      <Fretboard frets={stage.fretRange} active={active} played={positions} mirrored={leftHanded} ringing={sounding === null || active === null ? [] : Array.isArray(active) ? active : [active]} />

      <div className="controls">
        <button className="primary big" onClick={onStart}>
          Start stage {stage.number}
        </button>
        <button onClick={onBack}>Back</button>
      </div>
    </section>
  );
}
