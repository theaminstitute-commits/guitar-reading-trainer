import { useEffect, useRef } from 'react';

interface ConfirmDialogProps {
  title: string;
  message: string;
  onYes: () => void;
  onNo: () => void;
}

/** An "are you sure?" sheet with Yes and No. No has the focus, and Escape or a tap outside means No. */
export default function ConfirmDialog({ title, message, onYes, onNo }: ConfirmDialogProps) {
  const noRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    noRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onNo();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onNo]);

  return (
    <div className="card-backdrop" onClick={onNo}>
      <div className="card confirm-card" role="alertdialog" aria-modal="true" aria-labelledby="confirm-title" aria-describedby="confirm-message" onClick={(e) => e.stopPropagation()}>
        <h2 id="confirm-title">{title}</h2>
        <p id="confirm-message" className="muted">
          {message}
        </p>
        <div className="confirm-actions">
          <button ref={noRef} className="btn" onClick={onNo}>
            No
          </button>
          <button className="btn danger" onClick={onYes}>
            Yes
          </button>
        </div>
      </div>
    </div>
  );
}
