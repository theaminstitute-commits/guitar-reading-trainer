import { useCallback, useEffect, useLayoutEffect, useRef, useState, type Dispatch, type PointerEvent } from 'react';
import { beatsOf, DURATIONS, type DurationId } from '../music/duration';
import { keySignatureCount, keySignatureSpec, type Key } from '../music/key';
import type { Sign } from '../notation/accidentals';
import {
  addRejection,
  capacityOf,
  durationRejection,
  findNote,
  isBarFull,
  type AnswerAction,
  type AnswerLimits,
  type AnswerState,
} from '../notation/answer';
import { ensureNotationFonts } from '../notation/fonts';
import { noteAt, staveAt, stepFromY } from '../notation/hitTest';
import { renderStaff, type RenderBar, type StaffLayout } from '../notation/renderStaff';

interface StaffInputProps {
  answer: AnswerState;
  dispatch: Dispatch<AnswerAction>;
  limits: AnswerLimits;
  /** Durations offered in the palette, in the order shown. */
  durations: readonly DurationId[];
  /** Key whose signature is drawn on the staff. */
  musicKey: Key;
  disabled?: boolean;
}

type Selection = { kind: 'note'; id: number } | { kind: 'slot'; bar: number };

interface SlotRect {
  bar: number;
  x: number;
  y: number;
  width: number;
  height: number;
}

const COLORS = {
  ink: '#f1ece4',
  selected: '#e0a84a',
  fullBar: 'rgba(108, 195, 139, 0.10)',
  rejectedBar: 'rgba(229, 103, 79, 0.28)',
};

function NoteIcon({ duration }: { duration: DurationId }) {
  const info = DURATIONS[duration];
  const hollow = info.beats >= 2;
  const stem = duration !== 'w';
  const flag = duration === 'e';
  return (
    <svg className="note-icon" viewBox="0 0 20 26" aria-hidden="true">
      <ellipse cx="6.5" cy="20" rx="5.5" ry="3.8" transform="rotate(-20 6.5 20)" fill={hollow ? 'none' : 'currentColor'} stroke="currentColor" strokeWidth={hollow ? 1.8 : 0} />
      {stem && <line x1="11.6" y1="19" x2="11.6" y2="2" stroke="currentColor" strokeWidth="1.6" />}
      {flag && <path d="M11.6 2 C 15 5, 17 8, 14 14" fill="none" stroke="currentColor" strokeWidth="1.8" />}
      {info.dots > 0 && <circle cx="15.5" cy="21" r="1.6" fill="currentColor" />}
    </svg>
  );
}

/**
 * Treble staff the learner writes on. Tap a bar to add a note at that line or
 * space with the selected duration; tap a note to select it, then use the
 * accidental and nudge buttons. Undo, delete and clear as usual.
 */
export default function StaffInput({ answer, dispatch, limits, durations, musicKey, disabled = false }: StaffInputProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const layoutRef = useRef<StaffLayout | null>(null);
  const [width, setWidth] = useState(0);
  const [fontsReady, setFontsReady] = useState(false);
  const [duration, setDuration] = useState<DurationId>(durations[0] ?? 'q');
  /** Either a note (to adjust it) or the insertion cursor of a bar (the next note goes there). */
  const [selection, setSelection] = useState<Selection | null>(null);
  const [slots, setSlots] = useState<SlotRect[]>([]);
  const selectedId = selection?.kind === 'note' ? selection.id : null;
  const [message, setMessage] = useState<string | null>(null);
  const [rejectedBar, setRejectedBar] = useState<number | null>(null);

  useEffect(() => {
    ensureNotationFonts()
      .then(() => setFontsReady(true))
      .catch((e: Error) => setMessage(`Could not load the music font: ${e.message}`));
  }, []);

  // Track the container width so the staff fills it at any screen size.
  useLayoutEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const update = () => setWidth(el.clientWidth);
    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Forget the selection if that note disappears (undo, delete, clear).
  useEffect(() => {
    if (selectedId !== null && !answer.bars.some((b) => b.some((n) => n.id === selectedId))) {
      setSelection(null);
    }
  }, [answer, selectedId]);

  // Clear a rejection flash shortly after it appears.
  useEffect(() => {
    if (rejectedBar === null) return;
    const t = setTimeout(() => setRejectedBar(null), 450);
    return () => clearTimeout(t);
  }, [rejectedBar]);

  const scale = width < 480 ? 1.35 : 1.6;

  useLayoutEffect(() => {
    const el = canvasRef.current;
    if (!el || !fontsReady || width === 0) return;
    const bars: RenderBar[] = answer.bars.map((bar, i) => ({
      fill: rejectedBar === i ? COLORS.rejectedBar : isBarFull(bar, capacityOf(limits, i)) ? COLORS.fullBar : undefined,
      notes: bar.map((n) => ({
        id: n.id,
        step: n.step,
        sign: n.sign,
        duration: n.duration,
        style: n.id === selectedId ? { fill: COLORS.selected, stroke: COLORS.selected } : undefined,
      })),
    }));
    layoutRef.current = renderStaff(el, bars, {
      timeSignature: [capacityOf(limits, 0), 4],
      barTimeSignatures: limits.barBeats.map((b) => [b, 4] as const),
      width,
      barsPerRow: 2,
      scale,
      ink: COLORS.ink,
      keySignature: keySignatureSpec(musicKey),
      keySignatureAccidentals: Math.abs(keySignatureCount(musicKey)),
    });
    const layout = layoutRef.current;
    // An insertion cursor after the last note of every bar that still has room.
    setSlots(
      layout.staves.flatMap((stave) => {
        const bar = answer.bars[stave.barIndex]!;
        if (isBarFull(bar, capacityOf(limits, stave.barIndex))) return [];
        const last = layout.notes.filter((n) => n.barIndex === stave.barIndex).pop();
        const w = 20 * scale;
        const x = Math.min(last ? last.x + 24 * scale : stave.noteStartX + 6 * scale, stave.x + stave.width - w - 4 * scale);
        return [{ bar: stave.barIndex, x, y: stave.topLineY - stave.lineSpacing * 1.5, width: w, height: stave.lineSpacing * 7 }];
      }),
    );
  }, [answer, selectedId, rejectedBar, width, scale, fontsReady, limits.barBeats, musicKey]);

  const onPointerDown = useCallback(
    (e: PointerEvent<HTMLDivElement>) => {
      if (disabled) return;
      const el = containerRef.current;
      const layout = layoutRef.current;
      if (!el || !layout) return;
      const rect = el.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      const hit = noteAt(layout.notes, x, y, { x: 11 * scale, y: 9 * scale });
      if (hit) {
        setSelection({ kind: 'note', id: hit.id });
        setMessage(null);
        return;
      }

      // With a note selected, tapping the dashed cursor hands control back to it without adding
      // a note. Otherwise a tap inside the cursor adds a note there like any other tap.
      const slot = slots.find((s) => x >= s.x - 4 && x <= s.x + s.width + 4 && y >= s.y && y <= s.y + s.height);
      if (slot && selection?.kind === 'note') {
        setSelection({ kind: 'slot', bar: slot.bar });
        setMessage(`Next note goes in bar ${slot.bar + 1}. Pick a length, then tap a line or space.`);
        return;
      }

      const stave = staveAt(layout.staves, x, y);
      if (!stave) {
        setSelection(null);
        return;
      }
      const bar = answer.bars[stave.barIndex]!;
      const rejection = addRejection(bar, duration, capacityOf(limits, stave.barIndex));
      if (rejection) {
        setRejectedBar(stave.barIndex);
        setMessage(
          rejection === 'bar-full'
            ? `Bar ${stave.barIndex + 1} is full.`
            : `A ${DURATIONS[duration].label.toLowerCase()} does not fit: bar ${stave.barIndex + 1} has ${
                capacityOf(limits, stave.barIndex) - bar.reduce((s, n) => s + beatsOf(n.duration), 0)
              } beat left.`,
        );
        return;
      }
      const step = Math.min(limits.maxStep, Math.max(limits.minStep, stepFromY(y, stave)));
      dispatch({ type: 'add', bar: stave.barIndex, step, duration });
      // The cursor moves on past the new note, like a caret; tap the note to adjust it.
      setSelection({ kind: 'slot', bar: stave.barIndex });
      setMessage(null);
    },
    [answer, disabled, dispatch, duration, limits, scale, slots, selection],
  );

  const hasSelection = selectedId !== null;
  const hasNotes = answer.bars.some((b) => b.length > 0);
  const slotSelected = selection?.kind === 'slot' && slots.some((s) => s.bar === selection.bar);
  /** Duration palette: sets the length for the next note; with a note selected, changes that note instead. */
  const chooseDuration = (d: DurationId) => {
    setDuration(d);
    if (selectedId === null) return;
    const found = findNote(answer, selectedId);
    if (!found || found.note.duration === d) return;
    const rejection = durationRejection(answer.bars[found.bar]!, found.note, d, capacityOf(limits, found.bar));
    if (rejection) {
      setRejectedBar(found.bar);
      setMessage(`A ${DURATIONS[d].label.toLowerCase()} does not fit there: bar ${found.bar + 1} would go over ${capacityOf(limits, found.bar)} beats.`);
      return;
    }
    dispatch({ type: 'setDuration', id: selectedId, duration: d });
    setMessage(`Changed the selected note to a ${DURATIONS[d].label.toLowerCase()}.`);
  };
  const selectedSign: Sign | null = selectedId === null ? null : (findNote(answer, selectedId)?.note.sign ?? null);
  const setSign = (sign: Exclude<Sign, 'none'>) => {
    if (selectedId !== null) dispatch({ type: 'setSign', id: selectedId, sign });
  };
  const nudge = (delta: number) => {
    if (selectedId !== null) dispatch({ type: 'nudge', id: selectedId, delta });
  };

  return (
    <div className={`staff-input${disabled ? ' disabled' : ''}`}>
      <div
        ref={containerRef}
        className="staff-canvas"
        onPointerDown={onPointerDown}
        role="application"
        aria-label="Treble staff. Tap a line or space to add a note at the dashed cursor; tap a note to adjust it."
      >
        <div ref={canvasRef} className="staff-paper" />
        {!fontsReady && <div className="staff-loading muted">Loading notation…</div>}
        {slots.map((s) => (
          <div
            key={s.bar}
            className={`slot${selection?.kind === 'slot' && selection.bar === s.bar ? ' selected' : ''}`}
            style={{ left: s.x, top: s.y, width: s.width, height: s.height }}
            aria-hidden="true"
          />
        ))}
      </div>

      <div className="staff-message" aria-live="polite">
        {message ??
          (hasNotes
            ? hasSelection
              ? 'Note selected: the palette, signs and arrows change it. Tap the dashed cursor to add the next note instead.'
              : slotSelected
                ? 'Pick a length, then tap a line or space to add the next note.'
                : ''
            : 'Tap a line or space to write the first note. The dashed box shows where the next note goes.')}
      </div>

      <div className="palette">
        {durations.map((d) => (
          <button
            key={d}
            className={`icon-button${d === duration ? ' selected' : ''}`}
            onClick={() => chooseDuration(d)}
            aria-pressed={d === duration}
            aria-label={DURATIONS[d].label}
            title={DURATIONS[d].label}
            disabled={disabled}
          >
            <NoteIcon duration={d} />
          </button>
        ))}
        <span className="palette-gap" />
        <button className={`icon-button glyph${selectedSign === 'sharp' ? ' selected' : ''}`} onClick={() => setSign('sharp')} disabled={disabled || !hasSelection} aria-label="Sharp" aria-pressed={selectedSign === 'sharp'}>
          ♯
        </button>
        <button className={`icon-button glyph${selectedSign === 'flat' ? ' selected' : ''}`} onClick={() => setSign('flat')} disabled={disabled || !hasSelection} aria-label="Flat" aria-pressed={selectedSign === 'flat'}>
          ♭
        </button>
        <button className={`icon-button glyph${selectedSign === 'natural' ? ' selected' : ''}`} onClick={() => setSign('natural')} disabled={disabled || !hasSelection} aria-label="Natural" aria-pressed={selectedSign === 'natural'}>
          ♮
        </button>
      </div>

      <div className="palette">
        <button className="icon-button" onClick={() => nudge(1)} disabled={disabled || !hasSelection} aria-label="Move note up">
          ▲
        </button>
        <button className="icon-button" onClick={() => nudge(-1)} disabled={disabled || !hasSelection} aria-label="Move note down">
          ▼
        </button>
        <span className="palette-gap" />
        <button onClick={() => { if (selectedId !== null) { setMessage(null); dispatch({ type: 'delete', id: selectedId }); } }} disabled={disabled || !hasSelection}>
          Delete
        </button>
        <button onClick={() => { setMessage(null); dispatch({ type: 'clear' }); }} disabled={disabled || !hasNotes}>
          Clear
        </button>
      </div>

      <div className="palette undo-row">
        <button
          className="undo"
          onClick={() => {
            setMessage(null);
            dispatch({ type: 'undo' });
          }}
          disabled={disabled || answer.history.length === 0}
        >
          <span aria-hidden="true">↶</span> Undo
        </button>
      </div>
    </div>
  );
}
