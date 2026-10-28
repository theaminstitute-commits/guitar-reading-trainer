import { useEffect, useMemo, useRef, useState } from 'react';
import { sharedPlayer } from '../audio/player';
import { gradeAnswer, type GradeResult } from '../grading/grade';
import type { ExplainerId } from '../grading/explain';
import { generateMelody } from '../melody/generator';
import { STAGES } from '../melody/stages';
import type { Melody } from '../melody/types';
import { C_MAJOR } from '../music/key';
import { parseSpelled } from '../music/pitch';
import type { AnswerNote } from '../notation/answer';
import { hearWrittenAnswer, yoursFromAnswer, type HearMine } from '../session/yours';
import { createRng } from '../melody/random';
import type { ExplainStep, Lesson } from '../tutorial/lessons';
import type { Question } from '../tutorial/questions';
import ExerciseScreen from './ExerciseScreen';
import FeedbackScreen from './FeedbackScreen';
import type { YoursStaff } from './FeedbackStaff';
import Fretboard from './Fretboard';
import { CheckIcon, ChevronLeftIcon, PlayIcon, StopIcon } from './icons';
import { PAPER } from '../notation/paper';
import { LESSON_TEMPO } from '../tutorial/lessons';
import MiniStaff, { miniNotes } from './MiniStaff';
import QuestionCard from './QuestionCard';

interface LessonRunnerProps {
  lesson: Lesson;
  leftHanded: boolean;
  metronome: boolean;
  onMetronome: (on: boolean) => void;
  /** The lesson is finished: the learner reached the last screen. */
  onComplete: () => void;
  /** What the main button on the last screen does, and says. */
  onContinue: () => void;
  continueLabel: string;
  onExit: () => void;
  onExplainer: (id: ExplainerId) => void;
}

/** Notes of the coached melody: stage 1, so beginners meet exactly what stage 1 asks. */
function coachedMelody(): Melody {
  return generateMelody(STAGES[0]!, Math.floor(Math.random() * 1_000_000_000));
}

/**
 * Runs a lesson screen by screen: explanations with an example staff,
 * fretboard and sound, drills of questions with instant verdicts, and the
 * coached first melody. Nothing here touches the ladder.
 */
export default function LessonRunner({ lesson, leftHanded, metronome, onMetronome, onComplete, onContinue, continueLabel, onExit, onExplainer }: LessonRunnerProps) {
  const [index, setIndex] = useState(0);
  const done = index >= lesson.steps.length;
  /** Report completion once per lesson, however often the parent re-renders. */
  const reported = useRef(false);

  useEffect(() => {
    setIndex(0);
    reported.current = false;
  }, [lesson]);

  useEffect(() => {
    if (done && !reported.current) {
      reported.current = true;
      onComplete();
    }
  }, [done, onComplete]);

  useEffect(() => {
    sharedPlayer().stop();
    window.scrollTo(0, 0);
  }, [index]);

  const step = lesson.steps[index];
  const next = () => setIndex((i) => i + 1);
  /** Back one screen; on the first screen the app bar's arrow leads home instead. */
  const back = index > 0 ? () => setIndex((i) => Math.min(i, lesson.steps.length) - 1) : undefined;

  return (
    <section className="lesson">
      <div className="lesson-progress" aria-label={`Screen ${Math.min(index + 1, lesson.steps.length)} of ${lesson.steps.length}`}>
        {lesson.steps.map((_, i) => (
          <span key={i} className={i < index ? 'done' : i === index ? 'now' : ''} />
        ))}
      </div>
      <div className="lesson-head">
        <span className="eyebrow">{lesson.title}</span>
        {back && (
          <button className="link subtle lesson-back" onClick={back}>
            <ChevronLeftIcon size={14} /> Previous screen
          </button>
        )}
      </div>

      {done && (
        <div className="panel lesson-done">
          <CheckIcon size={28} />
          <h2>Lesson complete</h2>
          <p className="muted">{lesson.summary}</p>
          <div className="controls">
            <button className="primary big" onClick={onContinue}>
              {continueLabel}
            </button>
            <button onClick={onExit}>Back to start</button>
          </div>
        </div>
      )}

      {step?.kind === 'explain' && <ExplainScreen key={`${lesson.id}-${index}`} step={step} leftHanded={leftHanded} onNext={next} onBack={back} />}
      {step?.kind === 'drill' && <DrillScreen key={`${lesson.id}-${index}`} title={step.title} intro={step.intro} make={step.make} leftHanded={leftHanded} onDone={next} />}
      {step?.kind === 'coached' && (
        <CoachedScreen key={`${lesson.id}-${index}`} intro={step.intro} leftHanded={leftHanded} metronome={metronome} onMetronome={onMetronome} onExplainer={onExplainer} onDone={next} />
      )}
    </section>
  );
}

function ExplainScreen({ step, leftHanded, onNext, onBack }: { step: ExplainStep; leftHanded: boolean; onNext: () => void; onBack?: () => void }) {
  const [playing, setPlaying] = useState(false);
  const [lit, setLit] = useState<number | null>(null);
  const key = step.staff?.key ?? C_MAJOR;
  const bars = useMemo(() => {
    if (!step.staff) return [];
    // The note sounding now is drawn in blue, with its name: the eye follows the ear. A chord lights as a whole.
    const litNote = lit === null ? undefined : step.staff.notes[lit];
    const isLit = (n: (typeof step.staff.notes)[number], i: number) =>
      litNote !== undefined && (i === lit || (litNote.chord !== undefined && n.chord === litNote.chord));
    const notes = miniNotes(
      step.staff.notes.map((n, i) => ({
        note: parseSpelled(n.name),
        duration: n.duration,
        chord: n.chord,
        label: n.label,
        sign: n.sign,
        color: isLit(n, i) ? PAPER.active : undefined,
      })),
      key,
    );
    if (step.staff.timeSignature) return [notes];
    // Without a time signature the examples are just a row of notes. Four to a bar keeps them readable;
    // longer names underneath need more room, so fewer notes share a bar.
    const longest = Math.max(0, ...step.staff.notes.map((x) => x.label?.length ?? 0));
    const perBar = longest >= 5 ? 2 : longest > 2 ? 3 : 4;
    const out: typeof notes[] = [];
    for (let i = 0; i < notes.length; i += perBar) out.push(notes.slice(i, i + perBar));
    return out;
  }, [step, key, lit]);

  const play = async () => {
    if (!step.play) return;
    setPlaying(true);
    await sharedPlayer().play(step.play.notes, { tempo: step.play.tempo ?? LESSON_TEMPO, timeSignature: [4, 4], countIn: false }, { onNote: (i) => setLit(i), onEnd: () => { setPlaying(false); setLit(null); } });
  };

  const dots = step.fretboard?.dots ?? [];
  return (
    <div className="panel lesson-step">
      <h2>{step.title}</h2>
      {step.body.map((p, i) => (
        <p key={i}>{p}</p>
      ))}
      {step.staff && <MiniStaff bars={bars} musicKey={key} timeSignature={step.staff.timeSignature} barsPerRow={step.staff.timeSignature ? 1 : undefined} />}
      {step.fretboard && (
        <Fretboard
          frets={step.fretboard.frets}
          active={lit !== null && dots[lit] ? [dots[lit]!] : dots}
          labels={lit !== null && dots[lit] ? [step.fretboard.labels?.[lit] ?? ''] : step.fretboard.labels}
          mirrored={leftHanded}
        />
      )}
      <div className="controls">
        {onBack && <button onClick={onBack}>Back</button>}
        {step.play &&
          (playing ? (
            <button onClick={() => sharedPlayer().stop()}>
              <StopIcon size={18} /> Stop
            </button>
          ) : (
            <button onClick={() => void play()}>
              <PlayIcon size={18} /> Hear it
            </button>
          ))}
        <button className="primary" onClick={onNext}>
          Next
        </button>
      </div>
    </div>
  );
}

function DrillScreen({ title, intro, make, leftHanded, onDone }: { title: string; intro: string; make: (rng: ReturnType<typeof createRng>) => Question[]; leftHanded: boolean; onDone: () => void }) {
  const [round, setRound] = useState(0);
  const questions = useMemo(() => make(createRng(Math.floor(Math.random() * 1_000_000_000))), [make, round]);
  const [at, setAt] = useState(0);
  const [right, setRight] = useState(0);
  const finished = at >= questions.length;

  return (
    <div className="lesson-step">
      <div className="drill-head">
        <h2>{title}</h2>
        <span className="muted">{finished ? `${right} of ${questions.length}` : `${at + 1} of ${questions.length}`}</span>
      </div>
      {!finished && <p className="muted small-note">{intro}</p>}
      {!finished && (
        <QuestionCard
          question={questions[at]!}
          leftHanded={leftHanded}
          onNext={(correct) => {
            if (correct) setRight((r) => r + 1);
            setAt((a) => a + 1);
          }}
        />
      )}
      {finished && (
        <div className="panel">
          <p>
            {right === questions.length
              ? 'All right. Well read.'
              : right >= questions.length * 0.7
                ? `${right} of ${questions.length} right. Good: one more round makes it stick, or carry on.`
                : `${right} of ${questions.length} right. Another round will help before you go on.`}
          </p>
          <div className="controls">
            <button
              onClick={() => {
                setRound((r) => r + 1);
                setAt(0);
                setRight(0);
              }}
            >
              Another round
            </button>
            <button className="primary" onClick={onDone}>
              Continue
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

interface Checked {
  result: GradeResult;
  yours: YoursStaff;
  hearMine: HearMine;
}

function CoachedScreen({ intro, leftHanded, metronome, onMetronome, onExplainer, onDone }: { intro: string; leftHanded: boolean; metronome: boolean; onMetronome: (on: boolean) => void; onExplainer: (id: ExplainerId) => void; onDone: () => void }) {
  const [melody, setMelody] = useState<Melody>(coachedMelody);
  const [checked, setChecked] = useState<Checked | null>(null);
  const stage = STAGES[0]!;

  if (checked) {
    return (
      <FeedbackScreen
        melody={melody}
        result={checked.result}
        change={null}
        nextStage={stage}
        nextCounts={melody.counts}
        nextTally={0}
        yours={checked.yours}
        hearMine={checked.hearMine}
        onExplainer={onExplainer}
        practice
        onNext={() => {
          if (checked.result.mistakes.length === 0) {
            onDone();
            return;
          }
          setMelody(coachedMelody());
          setChecked(null);
        }}
      />
    );
  }
  return (
    <>
      <p className="muted small-note">{intro} Get one melody flawless to finish the lesson.</p>
      <ExerciseScreen
        melody={melody}
        level={stage}
        showFretboard
        leftHanded={leftHanded}
        metronome={metronome}
        onMetronome={onMetronome}
        coach={{ revealAfter: 2 }}
        unlimitedListens
        noteNames
        onCheck={(bars: AnswerNote[][]) =>
          setChecked({
            result: gradeAnswer(melody, bars, melody.key),
            yours: yoursFromAnswer(bars, melody, melody.key),
            hearMine: hearWrittenAnswer(bars, melody, melody.key),
          })
        }
      />
    </>
  );
}
