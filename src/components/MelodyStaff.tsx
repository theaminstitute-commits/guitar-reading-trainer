import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { splitIntoBars } from '../melody/bars';
import { timeSignaturesFor } from '../melody/meter';
import type { Melody } from '../melody/types';
import { keySignatureCount, keySignatureSpec, spellInKey, type Key } from '../music/key';
import { staffStep, writtenFromSounding } from '../music/pitch';
import { displaySignsForBars } from '../notation/accidentals';
import { ensureNotationFonts } from '../notation/fonts';
import { PAPER } from '../notation/paper';
import { renderStaff, type RenderBar } from '../notation/renderStaff';

interface MelodyStaffProps {
  melody: Melody;
  musicKey: Key;
  /** Note sounding now, highlighted in amber. */
  activeIndex?: number | null;
}

const INK = PAPER.ink;
const ACTIVE = PAPER.active;

/** The melody as a plain score to read from: key signature, time signatures, no labels. */
export default function MelodyStaff({ melody, musicKey, activeIndex = null }: MelodyStaffProps) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const [fontsReady, setFontsReady] = useState(false);

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
    window.addEventListener('resize', update);
    const later = setTimeout(update, 300);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', update);
      clearTimeout(later);
    };
  }, []);

  const scale = width < 480 ? 1.35 : 1.6;

  useLayoutEffect(() => {
    const el = canvasRef.current;
    if (!el || !fontsReady || width === 0) return;
    const targetBars = splitIntoBars(melody.notes, melody.barBeats);
    const writtenBars = targetBars.map((bar) => bar.notes.map((n) => spellInKey(writtenFromSounding(n.midi), musicKey)));
    const signs = displaySignsForBars(writtenBars, musicKey);
    let index = 0;
    const bars: RenderBar[] = targetBars.map((bar, barIndex) => ({
      notes: bar.notes.map((n, noteIndex) => {
        const id = index++;
        const written = writtenBars[barIndex]![noteIndex]!;
        return {
          id,
          step: staffStep(written),
          sign: signs[barIndex]![noteIndex]!,
          duration: n.duration,
          style: id === activeIndex ? { fill: ACTIVE, stroke: ACTIVE } : undefined,
        };
      }),
    }));
    renderStaff(el, bars, {
      timeSignature: melody.timeSignature,
      barTimeSignatures: timeSignaturesFor(melody.barBeats),
      width,
      barsPerRow: 2,
      scale,
      ink: INK,
      keySignature: keySignatureSpec(musicKey),
      keySignatureAccidentals: Math.abs(keySignatureCount(musicKey)),
    });
  }, [melody, musicKey, activeIndex, width, scale, fontsReady]);

  return (
    <div ref={wrapRef} className="melody-staff">
      <div ref={canvasRef} className="staff-canvas static" />
    </div>
  );
}
