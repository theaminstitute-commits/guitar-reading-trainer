import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { EXPLAINERS } from '../explainers/content';
import type { ExplainerId } from '../grading/explain';
import { ensureNotationFonts } from '../notation/fonts';
import { keySignatureCount, keySignatureSpec } from '../music/key';
import { renderStaff } from '../notation/renderStaff';

interface ExplainerCardProps {
  id: ExplainerId;
  onClose: () => void;
}

/** A short teaching card shown over the current screen. */
export default function ExplainerCard({ id, onClose }: ExplainerCardProps) {
  const explainer = EXPLAINERS[id];
  const exampleRef = useRef<HTMLDivElement>(null);
  const [fontsReady, setFontsReady] = useState(false);
  const [width, setWidth] = useState(0);

  useEffect(() => {
    ensureNotationFonts().then(() => setFontsReady(true));
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  useLayoutEffect(() => {
    const el = exampleRef.current;
    if (!el) return;
    const update = () => setWidth(el.clientWidth);
    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, [explainer.example]);

  useLayoutEffect(() => {
    const el = exampleRef.current;
    if (!el || !fontsReady || width === 0 || !explainer.example) return;
    renderStaff(el, [{ notes: explainer.example.notes }], {
      timeSignature: [4, 4],
      width,
      barsPerRow: 1,
      scale: width < 480 ? 1.2 : 1.4,
      ink: '#f1ece4',
      showTimeSignature: false,
      keySignature: explainer.example.key ? keySignatureSpec(explainer.example.key) : undefined,
      keySignatureAccidentals: explainer.example.key ? Math.abs(keySignatureCount(explainer.example.key)) : 0,
    });
  }, [explainer, fontsReady, width]);

  return (
    <div className="card-backdrop" onClick={onClose} role="presentation">
      <section className="card" role="dialog" aria-modal="true" aria-labelledby="card-title" onClick={(e) => e.stopPropagation()}>
        <h2 id="card-title">{explainer.title}</h2>
        {explainer.paragraphs.map((p, i) => (
          <p key={i}>{p}</p>
        ))}
        {explainer.example && (
          <figure className="card-example">
            <div ref={exampleRef} className="staff-canvas static" />
            <figcaption className="muted">{explainer.example.caption}</figcaption>
          </figure>
        )}
        <div className="controls">
          <button className="primary" onClick={onClose}>
            Got it
          </button>
        </div>
      </section>
    </div>
  );
}
