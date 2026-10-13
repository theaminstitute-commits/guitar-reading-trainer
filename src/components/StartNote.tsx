import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { Melody } from '../melody/types';
import { keySignatureCount, keySignatureSpec } from '../music/key';
import { ensureNotationFonts } from '../notation/fonts';
import { PAPER } from '../notation/paper';
import { renderStaff } from '../notation/renderStaff';
import { startNoteBar } from '../notation/startNote';

interface StartNoteProps {
  melody: Melody;
}

/**
 * The starting note of a listen-only melody: one note on a short staff with the
 * key signature, no name and no length (R21). Relative pitch can be trained,
 * perfect pitch mostly cannot, so the ear gets an anchor to hear from.
 */
export default function StartNote({ melody }: StartNoteProps) {
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
    const later = setTimeout(update, 300);
    return () => {
      observer.disconnect();
      clearTimeout(later);
    };
  }, []);

  useLayoutEffect(() => {
    const el = canvasRef.current;
    if (!el || !fontsReady || width === 0) return;
    renderStaff(el, [startNoteBar(melody)], {
      timeSignature: melody.timeSignature,
      width,
      barsPerRow: 1,
      scale: 1.15,
      ink: PAPER.ink,
      showTimeSignature: false,
      keySignature: keySignatureSpec(melody.key),
      keySignatureAccidentals: Math.abs(keySignatureCount(melody.key)),
    });
  }, [melody, width, fontsReady]);

  return (
    <div ref={wrapRef} className="start-note" aria-label="The starting note, shown on the staff">
      <div ref={canvasRef} className="staff-canvas static" />
    </div>
  );
}
