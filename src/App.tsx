import { useCallback, useState } from 'react';
import { SAMPLE_CREDIT } from './audio/sampleMap';
import ExerciseScreen from './components/ExerciseScreen';
import ExplainerCard from './components/ExplainerCard';
import FeedbackScreen from './components/FeedbackScreen';
import StartScreen, { type SessionStats } from './components/StartScreen';
import type { ExplainerId } from './grading/explain';
import { gradeAnswer, type GradeResult } from './grading/grade';
import { generateMelody } from './melody/generator';
import { LEVEL_1 } from './melody/levelConfig';
import type { AnswerNote } from './notation/answer';
import { accuracyOf, applyResult, initialProgress, withBars, type LengthChange, type Progress } from './session/progression';
import { localProgressStore } from './storage/progress';

function randomSeed(): number {
  return Math.floor(Math.random() * 1_000_000_000);
}

type Screen = 'start' | 'exercise' | 'feedback';

interface Checked {
  answerBars: AnswerNote[][];
  result: GradeResult;
  lengthChange: LengthChange;
}

const level = LEVEL_1;
const store = localProgressStore;

/**
 * Session flow: start -> exercise -> feedback -> next exercise.
 * Progress (melody length, lifetime counts) persists through the storage module;
 * session counts live only while the page is open.
 */
export default function App() {
  const [screen, setScreen] = useState<Screen>('start');
  const [progress, setProgress] = useState<Progress>(() => store.load(level));
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
    const result = gradeAnswer(melody, answerBars, level.key);
    const { progress: next, change } = applyResult(progress, result, level);
    updateProgress(next);
    setSession((s) => ({ exercises: s.exercises + 1, accuracySum: s.accuracySum + accuracyOf(result) }));
    setChecked({ answerBars, result, lengthChange: change });
    setScreen('feedback');
  };

  const onLength = (n: number) => updateProgress(withBars(progress, n, level));

  const onReset = () => {
    store.clear();
    setProgress(initialProgress(level));
    setSession({ exercises: 0, accuracySum: 0 });
  };

  return (
    <main className="app">
      <header className="app-header">
        <h1>Guitar Reading Trainer</h1>
        <p className="muted">
          {screen === 'start'
            ? level.title
            : `Melody ${session.exercises + (screen === 'exercise' ? 1 : 0)} · ${bars} ${bars === 1 ? 'bar' : 'bars'} · ${melody.tempo} bpm`}
        </p>
      </header>

      {screen === 'start' && (
        <StartScreen
          level={level}
          progress={progress}
          session={session}
          onStart={() => startExercise(progress.bars)}
          onLength={onLength}
          onExplainer={setExplainer}
          onReset={onReset}
        />
      )}

      {screen === 'exercise' && <ExerciseScreen melody={melody} level={level} onCheck={onCheck} />}

      {screen === 'feedback' && checked && (
        <FeedbackScreen
          melody={melody}
          level={level}
          answerBars={checked.answerBars}
          result={checked.result}
          lengthChange={checked.lengthChange}
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
