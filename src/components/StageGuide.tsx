import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { sharedPlayer } from '../audio/player';
import { stageGuide } from '../melody/stageGuide';
import type { Stage } from '../melody/stages';
import { keyName, keySignatureCount, keySignatureSpec, spellInKey } from '../music/key';
import { writtenFromSounding } from '../music/pitch';
import { displaySignsForBars } from '../notation/accidentals';
import { ensureNotationFonts } from '../notation/fonts';
import { renderStaff, type RenderBar } from '../notation/renderStaff';
import Fretboard from './Fretboard';

interface StageGuideProps {
  stage: Stage;
  previous: Stage | null;
  leftHanded: boolean;
  /** Called with the stage number when the learner goes on to play it. */
  onStart: () => void;
  onBack: () => void;
}

const INK = '#f1ece4';
const NEW = '#e0a84a';
const NOTES_PER_BAR = 4;

/**
 * A page shown before a stage starts: every pitch the stage can draw on,
 * named and placed on the staff, with the new ones in amber, and where those
 * pitches sit on the fretboard. Tapping a note plays it.
 */
export default function StageGuide({ stage, previous, leftHanded, onStart, onBack }: StageGuideProps) {
  const guide = stageGuide(stage, previous);
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const [fontsReady, setFontsReady] = useState(false);
  const [sounding, setSounding] = useState<number | null>(null);

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
    const chunks: typeof guide.pitches[] = [];
    for (let i = 0; i < guide.pitches.length; i += NOTES_PER_BAR) chunks.push(guide.pitches.slice(i, i + NOTES_PER_BAR));
    const writtenBars = chunks.map((bar) => bar.map((p) => spellInKey(writtenFromSounding(p.midi), guide.key)));
    const signs = displaySignsForBars(writtenBars, guide.key);
    const bars: RenderBar[] = chunks.map((bar, b) => ({
      notes: bar.map((p, i) => ({
        id: b * NOTES_PER_BAR + i,
        step: p.step,
        sign: signs[b]![i]!,
        duration: 'q' as const,
        label: p.name,
        style: p.isNew || sounding === p.midi ? { fill: NEW, stroke: NEW } : undefined,
      })),
    }));
    renderStaff(el, bars, {
      timeSignature: [4, 4],
      width,
      barsPerRow: width < 480 ? 2 : 3,
      scale,
      ink: INK,
      showTimeSignature: false,
      keySignature: keySignatureSpec(guide.key),
      keySignatureAccidentals: Math.abs(keySignatureCount(guide.key)),
    });
  }, [guide, width, scale, fontsReady, sounding]);

  const playAll = async () => {
    const player = sharedPlayer();
    await player.play(
      guide.pitches.map((p) => ({ midi: p.midi, duration: 'q' as const, string: p.positions[0]!.string, fret: p.positions[0]!.fret })),
      { tempo: 96, timeSignature: [4, 4], countIn: false },
      { onNote: (i) => setSounding(guide.pitches[i]!.midi), onEnd: () => setSounding(null) },
    );
  };

  const newCount = guide.pitches.filter((p) => p.isNew).length;
  const positions = guide.pitches.flatMap((p) => p.positions);

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
        The notes of this stage <span className="muted key-name">· shown in {keyName(guide.key)}</span>
      </h3>
      <p className="muted small-note">
        {guide.pitches.length} pitches, lowest to highest, named as written for guitar (an octave above where they sound).
        {newCount > 0 && previous ? ` The ${newCount} in amber are new in this stage.` : ''}
      </p>
      <div ref={wrapRef} className="guide-staff">
        <div ref={canvasRef} className="staff-canvas static" />
      </div>
      <div className="controls">
        {sounding === null ? (
          <button onClick={() => void playAll()}>Hear them in order</button>
        ) : (
          <button onClick={() => sharedPlayer().stop()}>Stop</button>
        )}
      </div>

      <h3 className="section-title">Where they are on the fretboard</h3>
      <Fretboard frets={stage.fretRange} active={guide.pitches.find((p) => p.midi === sounding)?.positions[0] ?? null} played={positions} mirrored={leftHanded} />

      <div className="controls">
        <button className="primary big" onClick={onStart}>
          Start stage {stage.number}
        </button>
        <button onClick={onBack}>Back</button>
      </div>
    </section>
  );
}
