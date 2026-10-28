import { useEffect, useRef, useState, type ReactNode } from 'react';
import { sharedPlayer } from '../audio/player';
import type { FretPosition } from '../music/fretboard';
import { C_MAJOR } from '../music/key';
import { parseSpelled, spelledName, spelledFromStaffStep, staffStep } from '../music/pitch';
import { PAPER } from '../notation/paper';
import { isRightFret, isRightStep, nameWithOctave, type Question } from '../tutorial/questions';
import { gradeTaps, tapPassed, tapVerdict, type TapResult } from '../tutorial/tap';
import Fretboard from './Fretboard';
import { PlayIcon, StopIcon } from './icons';
import MiniStaff, { miniNotes, type MiniNote } from './MiniStaff';

interface QuestionCardProps {
  question: Question;
  leftHanded: boolean;
  /** Called when the learner moves on, with whether they got it right. */
  onNext: (correct: boolean) => void;
  /** Label of the button that moves on. */
  nextLabel?: string;
}

/** Sounding pitch of the rhythm questions: written B4, the middle line. */
const RHYTHM_MIDI = 59;
const RHYTHM_STEP = staffStep(parseSpelled('B4'));

type Outcome = { correct: boolean; text: string } | null;

/**
 * One tutorial or placement question: what to show, how the learner answers,
 * and an immediate verdict with the right answer before moving on.
 */
export default function QuestionCard({ question: q, leftHanded, onNext, nextLabel = 'Next' }: QuestionCardProps) {
  const [outcome, setOutcome] = useState<Outcome>(null);
  const [picked, setPicked] = useState<string | number | null>(null);
  const [tappedStep, setTappedStep] = useState<number | null>(null);
  const [tappedFret, setTappedFret] = useState<FretPosition | null>(null);

  useEffect(() => {
    setOutcome(null);
    setPicked(null);
    setTappedStep(null);
    setTappedFret(null);
  }, [q]);

  useEffect(() => () => sharedPlayer().stop(), []);

  const answer = (correct: boolean, text: string) => setOutcome({ correct, text });

  let body: ReactNode;
  switch (q.kind) {
    case 'name': {
      const notes = miniNotes(
        q.notes.map((note) => ({ note, duration: 'w' as const, chord: q.notes.length > 1 ? 1 : undefined })),
        q.key,
      );
      body = (
        <>
          <MiniStaff bars={[notes]} musicKey={q.key} barsPerRow={1} />
          <div className="choice-grid">
            {q.choices.map((c) => {
              const state = picked === null ? '' : c === q.answer ? ' right' : c === picked ? ' wrong' : '';
              return (
                <button
                  key={c}
                  className={`choice${state}`}
                  disabled={picked !== null}
                  onClick={() => {
                    setPicked(c);
                    answer(c === q.answer, c === q.answer ? `${q.answer} is correct!` : `It is ${q.answer}.`);
                  }}
                >
                  {c}
                </button>
              );
            })}
          </div>
        </>
      );
      break;
    }
    case 'place':
    case 'fret-to-staff': {
      const target = q.target;
      const shown: MiniNote[] = [];
      if (tappedStep !== null) {
        const right = isRightStep(q, tappedStep);
        // A wrong tap shows both notes stacked as one whole-note chord, so the bar still holds four beats.
        shown.push({ step: tappedStep, sign: 'none', duration: 'w', color: right ? PAPER.good : PAPER.bad, chord: right ? undefined : 1 });
        if (!right) shown.push({ step: staffStep(target), sign: 'none', duration: 'w', color: PAPER.good, chord: 1 });
        shown.sort((a, b) => a.step - b.step);
      }
      body = (
        <>
          {q.kind === 'fret-to-staff' && <Fretboard frets={q.frets} active={[q.position]} mirrored={leftHanded} />}
          <MiniStaff
            bars={[shown]}
            musicKey={q.key}
            barsPerRow={1}
            onTapStep={
              outcome
                ? undefined
                : (step) => {
                    setTappedStep(step);
                    const right = isRightStep(q, step);
                    const tapped = nameWithOctave(spelledFromStaffStep(step));
                    answer(right, right ? `${nameWithOctave(target)} is correct!` : `That line or space is ${tapped}. ${nameWithOctave(target)} is the green note.`);
                  }
            }
          />
          {!outcome && <p className="muted small-note">Tap the staff.</p>}
        </>
      );
      break;
    }
    case 'staff-to-fret': {
      const marks: { position: FretPosition; tone: 'good' | 'bad' }[] = [];
      if (tappedFret) {
        const right = isRightFret(q, tappedFret);
        marks.push({ position: tappedFret, tone: right ? 'good' : 'bad' });
        if (!right) q.answers.forEach((p) => marks.push({ position: p, tone: 'good' }));
      }
      body = (
        <>
          <MiniStaff bars={[miniNotes([{ note: q.note, duration: 'w' }], q.key)]} musicKey={q.key} barsPerRow={1} />
          <Fretboard
            frets={q.frets}
            active={null}
            mirrored={leftHanded}
            marks={marks}
            onPick={
              outcome
                ? undefined
                : (p) => {
                    setTappedFret(p);
                    const right = isRightFret(q, p);
                    const where = q.answers.map((a) => (a.fret === 0 ? `the open ${a.string}${ordinal(a.string)} string` : `string ${a.string}, fret ${a.fret}`)).join(' or ');
                    answer(right, right ? `${spelledName(q.note)} on ${where} is correct!` : `${spelledName(q.note)} is ${where}, marked in green.`);
                  }
            }
          />
        </>
      );
      break;
    }
    case 'rhythm':
      body = <RhythmBody q={q} picked={picked} onPick={(i) => { setPicked(i); answer(i === q.answer, i === q.answer ? 'That rhythm is correct!' : 'Not that one: the right bar is marked in green.'); }} />;
      break;
    case 'tap':
      body = <TapBody tempo={q.tempo} beats={q.beats} onResult={(r) => answer(tapPassed(r), tapVerdict(r))} done={outcome !== null} />;
      break;
  }

  return (
    <div className="panel question">
      <p className="question-prompt">{q.prompt}</p>
      {q.memoryAid && (
        <p className="memory-aid">
          <span className="aid-lines">Lines E G B D F: Every Good Boy Deserves Fruit</span>
          <span className="aid-spaces">Spaces: F A C E</span>
        </p>
      )}
      {body}
      {outcome && (
        <div className={`verdict-line ${outcome.correct ? 'good' : 'bad'}`} aria-live="polite">
          {outcome.text}
        </div>
      )}
      {outcome && (
        <div className="controls">
          {q.kind === 'tap' && !outcome.correct && (
            <button onClick={() => setOutcome(null)}>Try again</button>
          )}
          <button className="primary" onClick={() => onNext(outcome.correct)}>
            {nextLabel}
          </button>
        </div>
      )}
    </div>
  );
}

function ordinal(n: number): string {
  return n === 1 ? 'st' : n === 2 ? 'nd' : n === 3 ? 'rd' : 'th';
}

function RhythmBody({ q, picked, onPick }: { q: Extract<Question, { kind: 'rhythm' }>; picked: string | number | null; onPick: (i: number) => void }) {
  const [playing, setPlaying] = useState(false);
  const play = async () => {
    setPlaying(true);
    await sharedPlayer().play(
      q.options[q.answer]!.map((d) => ({ midi: RHYTHM_MIDI, duration: d })),
      { tempo: 76, timeSignature: [4, 4], countIn: true },
      { onEnd: () => setPlaying(false) },
    );
  };
  return (
    <>
      <div className="controls">
        {playing ? (
          <button onClick={() => sharedPlayer().stop()}>
            <StopIcon size={18} /> Stop
          </button>
        ) : (
          <button className="primary" onClick={() => void play()}>
            <PlayIcon size={18} /> Play the bar
          </button>
        )}
      </div>
      <div className="rhythm-options">
        {q.options.map((bar, i) => {
          const state = picked === null ? '' : i === q.answer ? ' right' : i === picked ? ' wrong' : '';
          return (
            <button key={i} className={`rhythm-option${state}`} disabled={picked !== null} onClick={() => onPick(i)} aria-label={`Rhythm ${i + 1}`}>
              <MiniStaff bars={[bar.map((d) => ({ step: RHYTHM_STEP, sign: 'none', duration: d }))]} musicKey={C_MAJOR} timeSignature barsPerRow={1} />
            </button>
          );
        })}
      </div>
    </>
  );
}

function TapBody({ tempo, beats, onResult, done }: { tempo: number; beats: number; onResult: (r: TapResult) => void; done: boolean }) {
  const [phase, setPhase] = useState<'idle' | 'running'>('idle');
  const [count, setCount] = useState<number | null>(null);
  const taps = useRef<number[]>([]);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  const start = async () => {
    taps.current = [];
    setPhase('running');
    const player = sharedPlayer();
    const clicks = await player.clickTrack(tempo, beats, 4, (i) => setCount(i));
    const end = clicks[clicks.length - 1]! + 0.6 - player.now();
    timer.current = setTimeout(() => {
      setPhase('idle');
      setCount(null);
      onResult(gradeTaps(clicks, taps.current));
    }, end * 1000);
  };

  const label = count === null ? '' : count < 4 ? `Count-in ${count + 1}` : `Beat ${count - 3} of ${beats}`;
  return (
    <div className="tap-drill">
      {phase === 'idle' ? (
        <button className="primary" onClick={() => void start()} disabled={done}>
          <PlayIcon size={18} /> Start the clicks
        </button>
      ) : (
        <>
          <div className="muted tap-count" aria-live="polite">
            {label}
          </div>
          <button className="tap-pad" onPointerDown={() => taps.current.push(sharedPlayer().now())}>
            Tap
          </button>
        </>
      )}
    </div>
  );
}
