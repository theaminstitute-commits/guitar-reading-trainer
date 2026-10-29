import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { sharedPlayer } from '../audio/player';
import type { LevelConfig } from '../melody/levelConfig';
import type { Melody } from '../melody/types';
import { eventAt, groupEvents } from '../melody/bars';
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
import StartNote from './StartNote';
import { coachVerdict, isRightPitch, type CoachVerdict } from '../tutorial/coach';
import { writtenFromSounding } from '../music/pitch';

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
  /** Beginner help (R26): a coach checks each note as it is written and names it after this many wrong tries. */
  coach?: { revealAfter: number };
  /** No listen limit (the coached lesson). */
  unlimitedListens?: boolean;
  /** Letter names inside the lit fretboard dots. */
  noteNames?: boolean;
  /** Playback rate of the first Play (beginner hints slow it a little). */
  firstPlayRate?: number;
}

type Status = 'idle' | 'loading' | 'reference' | 'counting' | 'playing';

/**
 * One exercise: hear the melody on the fretboard, write it on the staff, check.
 */
export default function ExerciseScreen({ melody, level, showFretboard, leftHanded, metronome, onMetronome, onCheck, coach, unlimitedListens = false, noteNames = false, firstPlayRate }: ExerciseScreenProps) {
  const [coachSays, setCoachSays] = useState<CoachVerdict | null>(null);
  /** Wrong tries per note position, for when the coach names a note. */
  const wrongTries = useRef(new Map<number, number>());
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
      wrongTries.current = new Map();
      setCoachSays(null);
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
          rate: plays === 0 && firstPlayRate ? rate * firstPlayRate : rate,
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
    [melody, level.tonicReference, metronome, plays, firstPlayRate],
  );

  const stop = () => sharedPlayer().stop();

  const busy = status === 'counting' || status === 'playing' || status === 'loading' || status === 'reference';
  const tonicName = spelledName(spellInKey(tonicReference(melody), melody.key));
  // The event sounding now: one note, or every note of a chord, lit together on the fretboard.
  const activeEvent = activeIndex === null ? [] : eventAt(melody.notes, activeIndex);
  const active: FretPosition[] = activeEvent.map((n) => ({ string: n.string, fret: n.fret }));
  const played = activeIndex === null ? [] : melody.notes.slice(0, activeIndex + activeEvent.length);
  const events = groupEvents(melody.notes);
  const eventNumber = activeIndex === null ? 0 : events.findIndex((e) => e.includes(melody.notes[activeIndex]!)) + 1;
  const beatsInBar = beatsPerBar(melody.timeSignature);
  const written = noteCount(answer);
  const listensLeft = unlimitedListens ? Infinity : Math.max(0, level.maxListens - plays);
  const dotLabels = noteNames ? activeEvent.map((n) => spelledName(n.spelled ?? spellInKey(writtenFromSounding(n.midi), melody.key))) : undefined;

  /** The staff's dispatch, with the coach listening in: it judges the note each action touched. */
  const coachedDispatch = (action: AnswerAction) => {
    dispatchAnswer(action);
    if (!coach) return;
    const next = answerReducer(answer, action, limits);
    if (next === answer) return;
    const id = action.type === 'add' || action.type === 'stack' ? next.nextId - 1 : action.type === 'setSign' || action.type === 'nudge' || action.type === 'setDuration' ? action.id : null;
    if (id === null) {
      setCoachSays(null);
      return;
    }
    const index = next.bars.flat().findIndex((n) => n.id === id);
    if (isRightPitch(melody, next.bars, id) === false) wrongTries.current.set(index, (wrongTries.current.get(index) ?? 0) + 1);
    setCoachSays(coachVerdict(melody, next.bars, id, wrongTries.current.get(index) ?? 0, coach.revealAfter));
  };

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
        {status === 'playing' && activeIndex !== null && `${activeEvent.length > 1 ? 'Chord' : 'Note'} ${eventNumber} of ${events.length}`}
        {status === 'idle' && plays === 0 && `Tap Play to hear the melody. ${showFretboard ? 'Watch the fretboard. ' : 'Listen only: the starting note is on the staff above, the rest is yours to hear. '}${unlimitedListens ? 'Listen as often as you like.' : `You get ${level.maxListens} listens.`}`}
        {status === 'idle' && plays > 0 && listensLeft > 0 && `Heard ${plays} ${plays === 1 ? 'time' : 'times'}.${unlimitedListens ? '' : ` ${listensLeft} ${listensLeft === 1 ? 'listen' : 'listens'} left.`}`}
        {status === 'idle' && plays > 0 && listensLeft === 0 && 'No listens left. Write what you remember, then check.'}
      </div>
      {!unlimitedListens && (
        <div className="listens" aria-label={`${listensLeft} of ${level.maxListens} listens left`}>
          {Array.from({ length: level.maxListens }, (_, i) => (
            <span key={i} className={`dot${i < plays ? ' used' : ''}`} />
          ))}
        </div>
      )}
      </div>

      {showFretboard ? (
        <div className="panel board">
          <Fretboard active={active} played={played} frets={level.fretRange} mirrored={leftHanded} labels={dotLabels} ringing={active} ringKey={activeIndex ?? undefined} />
        </div>
      ) : (
        <div className="listen-only">
          <span className="eyebrow">Starting note · the melody begins here</span>
          <StartNote melody={melody} />
          <span className={`ear${status === 'playing' ? ' on' : ''}`} aria-hidden="true">
            {events.map((_, i) => (
              <span key={i} className={`pip${eventNumber > i ? ' on' : ''}`} />
            ))}
          </span>
        </div>
      )}

      {error && <p className="error">{error}</p>}

      <div className="controls">
        {!busy ? (
          <>
            <button className="primary" data-sound="none" onClick={() => play(1)} disabled={listensLeft === 0}>
              <PlayIcon size={18} /> {plays === 0 ? 'Play' : 'Replay'}
            </button>
            <button data-sound="none" onClick={() => play(SLOW_RATE)} disabled={listensLeft === 0}>
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
        {coach && (
          <div className={`coach-line ${coachSays?.tone ?? 'idle'}`} aria-live="polite">
            {coachSays?.text ?? 'Coach: write a note and I will tell you if it is right.'}
          </div>
        )}
        <StaffInput answer={answer} dispatch={coach ? coachedDispatch : dispatchAnswer} limits={limits} durations={level.durations} musicKey={melody.key} />
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
