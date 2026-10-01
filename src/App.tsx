import { useCallback, useState } from 'react';
import type { Take } from './audio/mic';
import { SAMPLE_CREDIT } from './audio/sampleMap';
import ExerciseScreen from './components/ExerciseScreen';
import ExplainerCard from './components/ExplainerCard';
import FeedbackScreen from './components/FeedbackScreen';
import type { YoursStaff } from './components/FeedbackStaff';
import MicCheck from './components/MicCheck';
import PlayScreen from './components/PlayScreen';
import StartScreen, { type SessionStats } from './components/StartScreen';
import type { ExplainerId } from './grading/explain';
import { gradeAnswer, gradePlayed, type GradeResult } from './grading/grade';
import { generateMelody } from './melody/generator';
import { describeMeter } from './melody/meter';
import { STAGES, type Stage } from './melody/stages';
import { keyFromId, keyName } from './music/key';
import type { AnswerNote } from './notation/answer';
import {
  accuracyOf,
  applyResult,
  initialProgress,
  trackOf,
  withCounts,
  withStage,
  withTrack,
  withUnlocked,
  type ExerciseMode,
  type Handedness,
  type Progress,
  type ProgressChange,
} from './session/progression';
import { hearRecording, hearWrittenAnswer, yoursFromAnswer, yoursFromTake, type HearMine } from './session/yours';
import { localProgressStore } from './storage/progress';

function randomSeed(): number {
  return Math.floor(Math.random() * 1_000_000_000);
}

type Screen = 'start' | 'exercise' | 'feedback';

interface Checked {
  result: GradeResult;
  change: ProgressChange;
  /** Stage the learner is on after this result. */
  stageAfter: Stage;
  yours: YoursStaff;
  hearMine: HearMine | null;
}

/** `?key=G` (or Bb, F#, Am-h, ...) forces every melody into that key, for trying key signatures out. */
function withKeyOverride(stage: Stage): Stage {
  const id = new URLSearchParams(window.location.search).get('key');
  const key = id ? keyFromId(id) : null;
  return key ? { ...stage, keys: [key], fretRange: [0, 4] } : stage;
}

const params = new URLSearchParams(window.location.search);
/** `?selfplay=1`: in read-and-play, the app plays the melody into its own detector instead of listening to the microphone. */
const SELF_PLAY = params.get('selfplay') === '1';
const store = localProgressStore;

const MODE_LABEL: Record<ExerciseMode, string> = { watch: '', listen: ' · listen only', play: ' · read and play' };

/**
 * Session flow: start -> exercise -> feedback -> next exercise.
 * Progress (two tracks: writing and playing, each with a stage and length)
 * persists through the storage module; session counts live only while the
 * page is open.
 */
export default function App() {
  const [screen, setScreen] = useState<Screen>('start');
  const [progress, setProgress] = useState<Progress>(() => {
    const loaded = store.load(STAGES);
    // `?unlock=18` opens every stage up to that number on both tracks, for trying stages out.
    const unlock = Number(params.get('unlock'));
    if (!(unlock >= 1)) return loaded;
    return { ...loaded, write: withUnlocked(loaded.write, unlock - 1, STAGES), play: withUnlocked(loaded.play, unlock - 1, STAGES) };
  });
  const [session, setSession] = useState<SessionStats>({ exercises: 0, accuracySum: 0 });
  const [seed, setSeed] = useState(randomSeed);
  const track = trackOf(progress);
  const [counts, setCounts] = useState(track.counts);
  const [checked, setChecked] = useState<Checked | null>(null);
  const [explainer, setExplainer] = useState<ExplainerId | null>(null);
  const [micCheck, setMicCheck] = useState(false);

  const level = withKeyOverride(STAGES[track.stage]!);
  const melody = generateMelody(level, seed, counts);

  const updateProgress = useCallback((next: Progress) => {
    setProgress(next);
    store.save(next);
  }, []);

  const startExercise = useCallback((length: number) => {
    setCounts(length);
    setSeed(randomSeed());
    setChecked(null);
    setScreen('exercise');
  }, []);

  const record = (result: GradeResult, yours: YoursStaff, hearMine: HearMine | null) => {
    const { track: nextTrack, change } = applyResult(track, result, STAGES, progress.includeOptional);
    updateProgress(withTrack(progress, nextTrack));
    setSession((s) => ({ exercises: s.exercises + 1, accuracySum: s.accuracySum + accuracyOf(result) }));
    setChecked({ result, change, stageAfter: STAGES[nextTrack.stage]!, yours, hearMine });
    setScreen('feedback');
  };

  const onCheck = (answerBars: AnswerNote[][]) => {
    const result = gradeAnswer(melody, answerBars, melody.key);
    record(result, yoursFromAnswer(answerBars, melody, melody.key), hearWrittenAnswer(answerBars, melody, melody.key));
  };

  const onPlayed = (take: Take) => {
    const result = gradePlayed(
      melody,
      take.notes.map((n) => n.midi),
      melody.key,
    );
    record(result, yoursFromTake(take, melody.key), hearRecording(take));
  };

  const onCounts = (n: number) => updateProgress(withTrack(progress, withCounts(track, n, STAGES)));
  const onStage = (i: number) => updateProgress(withTrack(progress, withStage(track, i, STAGES)));
  const onIncludeOptional = (include: boolean) => updateProgress({ ...progress, includeOptional: include });
  const onMode = (mode: ExerciseMode) => updateProgress({ ...progress, mode });
  const onHandedness = (handedness: Handedness) => updateProgress({ ...progress, handedness });

  const onReset = () => {
    store.clear();
    setProgress(initialProgress(STAGES));
    setSession({ exercises: 0, accuracySum: 0 });
  };

  const nextTrack = trackOf(progress);

  return (
    <main className="app">
      <header className="app-header">
        <h1>Guitar Reading Trainer</h1>
        <p className="muted">
          {screen === 'start'
            ? level.title
            : `Stage ${level.number} · Melody ${session.exercises + (screen === 'exercise' ? 1 : 0)} · ${keyName(melody.key)} · ${counts} counts (${describeMeter(melody.barBeats)})${MODE_LABEL[progress.mode]}`}
        </p>
      </header>

      {screen === 'start' && (
        <StartScreen
          stages={STAGES}
          level={level}
          progress={progress}
          track={track}
          session={session}
          onStart={() => startExercise(track.counts)}
          onCounts={onCounts}
          onStage={onStage}
          onIncludeOptional={onIncludeOptional}
          onMode={onMode}
          onHandedness={onHandedness}
          onMicCheck={() => setMicCheck(true)}
          onExplainer={setExplainer}
          onReset={onReset}
        />
      )}

      {screen === 'exercise' &&
        (progress.mode === 'play' ? (
          <PlayScreen melody={melody} level={level} selfPlay={SELF_PLAY} onDone={onPlayed} />
        ) : (
          <ExerciseScreen melody={melody} level={level} showFretboard={progress.mode === 'watch'} leftHanded={progress.handedness === 'left'} onCheck={onCheck} />
        ))}

      {screen === 'feedback' && checked && (
        <FeedbackScreen
          melody={melody}
          result={checked.result}
          change={checked.change}
          nextStage={checked.stageAfter}
          nextCounts={nextTrack.counts}
          yours={checked.yours}
          hearMine={checked.hearMine}
          onNext={() => startExercise(nextTrack.counts)}
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
      {micCheck && <MicCheck musicKey={melody.key} onClose={() => setMicCheck(false)} />}

      <footer className="muted small">{SAMPLE_CREDIT}</footer>
    </main>
  );
}
