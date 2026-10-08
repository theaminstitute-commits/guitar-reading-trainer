import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { sharedPlayer } from '../audio/player';
import type { LevelConfig } from '../melody/levelConfig';
import type { Melody } from '../melody/types';
import { beatsPerBar } from '../music/duration';
import type { FretPosition } from '../music/fretboard';
import { keyName } from '../music/key';
import { tonicReference } from '../melody/tonic';
import { spellInKey } from '../music/key';
import { spelledName } from '../music/pitch';
import { parseSpelled, staffStep } from '../music/pitch';
import {
  answerReducer,
  createAnswer,
  noteCount,
  type AnswerAction,
  type AnswerLimits,
  type AnswerNote,
  type AnswerState,
} from '../notation/answer';
import Fretboard from './Fretboard';
import { CheckIcon, PlayIcon, SlowIcon, StopIcon } from './icons';
import StaffInput from './StaffInput';

export const SLOW_RATE = 0.7;

/** Notes may be written from three ledger lines below the staff (the open low E) to three above (fret 12 on the first string). */
const INPUT_MIN_STEP = staffStep(parseSpelled('E3'));
const INPUT_MAX_STEP = staffStep(parseSpelled('E6'));

interface ExerciseScreenProps {
  melody: Melody;
  level: LevelConfig;
  /** Listen-only dictation hides the fretboard: the ear does all the work. */
  showFretboard: boolean;
  /** Click on every beat during playback. */
  metronome: boolean;
  onMetronome: (on: boolean) => void;
  /** Mirror the fretboard for left-handed players. */
  leftHanded: boolean;
  onCheck: (answerBars: AnswerNote[][]) => void;
}

type Status = 'idle' | 'loading' | 'reference' | 'counting' | 'playing';

/**
 * One exercise: hear the melody on the fretboard, write it on the staff, check.
 */
export default function ExerciseScreen({ melody, level, showFretboard, leftHanded, metronome, onMetronome, onCheck }: ExerciseScreenProps) {
  const [status, setStatus] = useState<Status>('idle');
  const [countBeat, setCountBeat] = useState<number | null>(null);
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const [plays, setPlays] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const limits = useMemo<AnswerLimits>(
    () => ({ barBeats: melody.barBeats, minStep: INPUT_MIN_STEP, maxStep: INPUT_MAX_STEP }),
    [melody.barBeats],
  );
  const [answer, dispatchAnswer] = useReducer(
    (state: AnswerState, action: AnswerAction) => answerReducer(state, action, limits),
    melody.bars,
    createAnswer,
  );

  // A new melody resets playback and the answer.
  const melodyRef = useRef(melody);
  useEffect(() => {
    sharedPlayer().stop();
    setActiveIndex(null);
    setCountBeat(null);
    setStatus('idle');
    setPlays(0);
    if (melodyRef.current !== melody) {
      melodyRef.current = melody;
      dispatchAnswer({ type: 'reset', bars: melody.bars });
    }
  }, [melody]);

  useEffect(() => () => sharedPlayer().stop(), []);

  // Leaving the page mid-playback (phone lock, tab switch) stops the melody
  // rather than letting it run on unheard.
  useEffect(() => {
    const onVisibility = () => {
      if (document.hidden) sharedPlayer().stop();
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, []);

  const play = useCallback(
    async (rate: number) => {
      setError(null);
      const p = sharedPlayer();
      if (!p.isLoaded) setStatus('loading');
      try {
        await p.load();
      } catch (e) {
        setStatus('idle');
        setError(`Could not start audio: ${(e as Error).message}`);
        return;
      }
      setActiveIndex(null);
      setCountBeat(null);
      setStatus(level.tonicReference ? 'reference' : 'counting');
      setPlays((n) => n + 1);
      await p.play(
        melody.notes,
        {
          tempo: melody.tempo,
          rate,
          timeSignature: melody.timeSignature,
          countIn: true,
          metronome,
          barBeats: melody.barBeats,
          reference: level.tonicReference ? { midi: tonicReference(melody), times: 2 } : undefined,
        },
        {
          onReference: () => setStatus('reference'),
          onCountIn: (beat) => {
            setStatus('counting');
            setCountBeat(beat);
          },
          onNote: (index) => {
            setStatus('playing');
            setCountBeat(null);
            setActiveIndex(index);
          },
          onEnd: () => {
            setStatus('idle');
            setCountBeat(null);
            setActiveIndex(null);
          },
        },
      );
    },
    [melody, level.tonicReference],
  );

  const stop = () => sharedPlayer().stop();

  const busy = status === 'counting' || status === 'playing' || status === 'loading' || status === 'reference';
  const tonicName = spelledName(spellInKey(tonicReference(melody), melody.key));
  const active: FretPosition | null =
    activeIndex === null ? null : { string: melody.notes[activeIndex]!.string, fret: melody.notes[activeIndex]!.fret };
  const played = activeIndex === null ? [] : melody.notes.slice(0, activeIndex + 1);
  const beatsInBar = beatsPerBar(melody.timeSignature);
  const written = noteCount(answer);
  const listensLeft = Math.max(0, level.maxListens - plays);

  return (
    <section className="exercise">
      <div className="panel tight status-card">
      <div className="status-line" aria-live="polite">
        {status === 'loading' && 'Loading guitar sounds…'}
        {status === 'reference' && `Key note: ${tonicName}. The melody is in ${keyName(melody.key)}.`}
        {status === 'counting' && countBeat !== null && (
          <span className="count-in">
            Count-in{' '}
            {Array.from({ length: beatsInBar }, (_, i) => (
              <span key={i} className={i === countBeat ? 'beat on' : 'beat'}>
                {i + 1}
              </span>
            ))}
          </span>
        )}
        {status === 'playing' && activeIndex !== null && `Note ${activeIndex + 1} of ${melody.notes.length}`}
        {status === 'idle' && plays === 0 && `Tap Play to hear the melody. ${showFretboard ? 'Watch the fretboard. ' : 'Listen only, no fretboard. '}You get ${level.maxListens} listens.`}
        {status === 'idle' && plays > 0 && listensLeft > 0 && `Heard ${plays} ${plays === 1 ? 'time' : 'times'}. ${listensLeft} ${listensLeft === 1 ? 'listen' : 'listens'} left.`}
        {status === 'idle' && plays > 0 && listensLeft === 0 && 'No listens left. Write what you remember, then check.'}
      </div>
      <div className="listens" aria-label={`${listensLeft} of ${level.maxListens} listens left`}>
        {Array.from({ length: level.maxListens }, (_, i) => (
          <span key={i} className={`dot${i < plays ? ' used' : ''}`} />
        ))}
      </div>
      </div>

      {showFretboard ? (
        <div className="panel board">
          <Fretboard active={active} played={played} frets={level.fretRange} mirrored={leftHanded} />
        </div>
      ) : (
        <div className="listen-only" aria-hidden="true">
          <span className={`ear${status === 'playing' ? ' on' : ''}`}>
            {Array.from({ length: melody.notes.length }, (_, i) => (
              <span key={i} className={`pip${activeIndex !== null && i <= activeIndex ? ' on' : ''}`} />
            ))}
          </span>
        </div>
      )}

      {error && <p className="error">{error}</p>}

      <div className="controls">
        {!busy ? (
          <>
            <button className="primary" onClick={() => play(1)} disabled={listensLeft === 0}>
              <PlayIcon size={18} /> {plays === 0 ? 'Play' : 'Replay'}
            </button>
            <button onClick={() => play(SLOW_RATE)} disabled={listensLeft === 0}>
              <SlowIcon size={18} /> Slow
            </button>
          </>
        ) : (
          <button onClick={stop} disabled={status === 'loading'}>
            <StopIcon size={18} /> Stop
          </button>
        )}
      </div>
      <label className="toggle muted">
        <input type="checkbox" checked={metronome} onChange={(e) => onMetronome(e.target.checked)} /> Metronome during playback
      </label>

      <div className="panel">
        <span className="eyebrow">{showFretboard ? 'Write what you see' : 'Write what you heard'} · {keyName(melody.key)}</span>
        <StaffInput answer={answer} dispatch={dispatchAnswer} limits={limits} durations={level.durations} musicKey={melody.key} />
      </div>

      <div className="sticky-cta">
        <button
          className="btn primary big"
          onClick={() => {
            stop();
            onCheck(answer.bars.map((b) => [...b]));
          }}
          disabled={written === 0}
        >
          <CheckIcon size={22} /> Check my answer
        </button>
      </div>
    </section>
  );
}
