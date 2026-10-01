import { useCallback, useState } from 'react';
import { SAMPLE_CREDIT } from './audio/sampleMap';
import ExerciseScreen from './components/ExerciseScreen';
import ExplainerCard from './components/ExplainerCard';
import FeedbackScreen from './components/FeedbackScreen';
import StartScreen, { type SessionStats } from './components/StartScreen';
import type { ExplainerId } from './grading/explain';
import { gradeAnswer, type GradeResult } from './grading/grade';
import { generateMelody } from './melody/generator';
import { STAGES, type Stage } from './melody/stages';
import { keyFromId, keyName } from './music/key';
import type { AnswerNote } from './notation/answer';
import { accuracyOf, applyResult, initialProgress, withBars, withStage, type ExerciseMode, type Handedness, type ProgressChange, type Progress } from './session/progression';
import { localProgressStore } from './storage/progress';

function randomSeed(): number {
  return Math.floor(Math.random() * 1_000_000_000);
}

type Screen = 'start' | 'exercise' | 'feedback';

interface Checked {
  answerBars: AnswerNote[][];
  result: GradeResult;
  change: ProgressChange;
  /** Stage the learner is on after this result. */
  stageAfter: Stage;
}

/** `?key=G` (or Bb, F#, ...) forces every melody into that key, for trying key signatures out. */
function withKeyOverride(stage: Stage): Stage {
  const id = new URLSearchParams(window.location.search).get('key');
  const key = id ? keyFromId(id) : null;
  return key ? { ...stage, keys: [key], fretRange: [0, 4] } : stage;
}

const store = localProgressStore;

/**
 * Session flow: start -> exercise -> feedback -> next exercise.
 * Progress (melody length, lifetime counts) persists through the storage module;
 * session counts live only while the page is open.
 */
export default function App() {
  const [screen, setScreen] = useState<Screen>('start');
  const [progress, setProgress] = useState<Progress>(() => store.load(STAGES));
  const level = withKeyOverride(STAGES[progress.stage]!);
  const [session, setSession] = useState<SessionStats>({ exercises: 0, accuracySum: 0 });
  const [seed, setSeed] = useState(randomSeed);
  const [bars, setBars] = useState(progress.bars);
  const [checked, setChecked] = useState<Checked | null>(null);
  const [explainer, setExplainer] = useState<ExplainerId | null>(null);

  const melody = generateMelody(level, seed, bars);

  const updateProgress = useCallback((next: Progress) => {
    setProgress(next);
    store.save(next);
  }, []);

  const startExercise = useCallback(
    (length: number) => {
      setBars(length);
      setSeed(randomSeed());
      setChecked(null);
      setScreen('exercise');
    },
    [],
  );

  const onCheck = (answerBars: AnswerNote[][]) => {
    const result = gradeAnswer(melody, answerBars, melody.key);
    const { progress: next, change } = applyResult(progress, result, STAGES);
    updateProgress(next);
    setSession((s) => ({ exercises: s.exercises + 1, accuracySum: s.accuracySum + accuracyOf(result) }));
    setChecked({ answerBars, result, change, stageAfter: STAGES[next.stage]! });
    setScreen('feedback');
  };

  const onLength = (n: number) => updateProgress(withBars(progress, n, STAGES));
  const onStage = (i: number) => updateProgress(withStage(progress, i, STAGES));
  const onIncludeOptional = (include: boolean) => updateProgress({ ...progress, includeOptional: include });
  const onMode = (mode: ExerciseMode) => updateProgress({ ...progress, mode });
  const onHandedness = (handedness: Handedness) => updateProgress({ ...progress, handedness });

  const onReset = () => {
    store.clear();
    setProgress(initialProgress(STAGES));
    setSession({ exercises: 0, accuracySum: 0 });
  };

  return (
    <main className="app">
      <header className="app-header">
        <h1>Guitar Reading Trainer</h1>
        <p className="muted">
          {screen === 'start'
            ? level.title
            : `Stage ${level.number} · Melody ${session.exercises + (screen === 'exercise' ? 1 : 0)} · ${keyName(melody.key)} · ${bars} ${bars === 1 ? 'bar' : 'bars'}${progress.mode === 'listen' ? ' · listen only' : ''}`}
        </p>
      </header>

      {screen === 'start' && (
        <StartScreen
          stages={STAGES}
          level={level}
          progress={progress}
          session={session}
          onStart={() => startExercise(progress.bars)}
          onLength={onLength}
          onStage={onStage}
          onIncludeOptional={onIncludeOptional}
          onMode={onMode}
          onHandedness={onHandedness}
          onExplainer={setExplainer}
          onReset={onReset}
        />
      )}

      {screen === 'exercise' && (
        <ExerciseScreen melody={melody} level={level} showFretboard={progress.mode === 'watch'} leftHanded={progress.handedness === 'left'} onCheck={onCheck} />
      )}

      {screen === 'feedback' && checked && (
        <FeedbackScreen
          melody={melody}
          level={level}
          answerBars={checked.answerBars}
          result={checked.result}
          change={checked.change}
          nextStage={checked.stageAfter}
          nextBars={progress.bars}
          onNext={() => startExercise(progress.bars)}
          onExplainer={setExplainer}
        />
      )}

      {screen !== 'start' && (
        <p className="muted small-note">
          <button className="link subtle" onClick={() => setScreen('start')}>
            Back to start
          </button>
        </p>
      )}

      {explainer && <ExplainerCard id={explainer} onClose={() => setExplainer(null)} />}

      <footer className="muted small">{SAMPLE_CREDIT}</footer>
    </main>
  );
}
