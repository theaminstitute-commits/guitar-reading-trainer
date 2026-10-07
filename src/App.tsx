import { useCallback, useState } from 'react';
import type { Take } from './audio/mic';
import { SAMPLE_CREDIT } from './audio/sampleMap';
import ExerciseScreen from './components/ExerciseScreen';
import ExplainerCard from './components/ExplainerCard';
import FeedbackScreen from './components/FeedbackScreen';
import type { YoursStaff } from './components/FeedbackStaff';
import MicCheck from './components/MicCheck';
import PlayScreen from './components/PlayScreen';
import { ChevronLeftIcon } from './components/icons';
import StageGuide from './components/StageGuide';
import StartScreen, { type SessionStats } from './components/StartScreen';
import type { ExplainerId } from './grading/explain';
import { gradeAnswer, gradePlayed, type GradeResult } from './grading/grade';
import { generateMelody } from './melody/generator';
import { describeMeter } from './melody/meter';
import { STAGES, type Stage } from './melody/stages';
import type { Melody } from './melody/types';
import { keyFromId, keyName } from './music/key';
import type { AnswerNote } from './notation/answer';
import {
  accuracyOf,
  applyResult,
  initialProgress,
  trackOf,
  withStage,
  withTrack,
  withUnlocked,
  type ExerciseMode,
  type Handedness,
  type Progress,
  type ProgressChange,
  hasHeard,
  withMelodyHeard,
  type Track,
} from './session/progression';
import { hearRecording, hearWrittenAnswer, yoursFromAnswer, yoursFromTake, type HearMine } from './session/yours';
import { localProgressStore } from './storage/progress';

function randomSeed(): number {
  return Math.floor(Math.random() * 1_000_000_000);
}

type Screen = 'start' | 'guide' | 'exercise' | 'feedback';

/** One exercise: the stage it was drawn for and its melody, fixed when it starts. */
interface Exercise {
  level: Stage;
  melody: Melody;
}

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
  return key ? { ...stage, keys: [key], fretRange: [0, 4], introduces: undefined } : stage;
}

/** Tries with fresh seeds before a melody already heard on this stage is accepted (R16: the space can run out). */
const FRESH_TRIES = 60;

/** A melody for the track's stage that has not been given on that stage before, and the track that remembers it. */
function makeExercise(track: Track): { exercise: Exercise; track: Track } {
  const level = withKeyOverride(STAGES[track.stage]!);
  let melody = generateMelody(level, randomSeed(), track.counts);
  for (let i = 0; i < FRESH_TRIES && hasHeard(track, level.number, melody); i++) melody = generateMelody(level, randomSeed(), track.counts);
  return { exercise: { level, melody }, track: withMelodyHeard(track, level.number, melody) };
}

const params = new URLSearchParams(window.location.search);
/** `?selfplay=1`: in read-and-play, the app plays the melody into its own detector instead of listening to the microphone. */
const SELF_PLAY = params.get('selfplay') === '1';
const store = localProgressStore;

const MODE_LABEL: Record<ExerciseMode, string> = { watch: '', listen: ' · listen only', play: ' · read and play' };

/**
 * Session flow: start -> (guide) -> exercise -> feedback -> next exercise.
 * Progress (two tracks: writing and playing, each with a stage) persists
 * through the storage module; session counts live only while the page is open.
 */
export default function App() {
  const [screen, setScreen] = useState<Screen>('start');
  const [progress, setProgress] = useState<Progress>(() => {
    const loaded = store.load(STAGES);
    // `?unlock=33` opens every stage up to that number on both tracks, for trying stages out.
    const unlock = Number(params.get('unlock'));
    if (!(unlock >= 1)) return loaded;
    return { ...loaded, write: withUnlocked(loaded.write, unlock - 1, STAGES), play: withUnlocked(loaded.play, unlock - 1, STAGES) };
  });
  const [session, setSession] = useState<SessionStats>({ exercises: 0, accuracySum: 0 });
  const track = trackOf(progress);
  const [exercise, setExercise] = useState<Exercise>(() => makeExercise(track).exercise);
  const [checked, setChecked] = useState<Checked | null>(null);
  const [explainer, setExplainer] = useState<ExplainerId | null>(null);
  const [micCheck, setMicCheck] = useState(false);

  /** The stage the current track is on, for the start screen and the guide. */
  const level = withKeyOverride(STAGES[track.stage]!);
  const { melody } = exercise;

  const updateProgress = useCallback((next: Progress) => {
    setProgress(next);
    store.save(next);
  }, []);

  /** Draw a fresh melody for the track's current stage and go to it. */
  const startExercise = (current: Progress) => {
    const made = makeExercise(trackOf(current));
    updateProgress(withTrack(current, made.track));
    setExercise(made.exercise);
    setChecked(null);
    setScreen('exercise');
  };

  const record = (result: GradeResult, yours: YoursStaff, hearMine: HearMine | null) => {
    const { track: nextTrack, change } = applyResult(track, result, STAGES);
    // R17: a stage lost through demotion shows its guide again when it is won back.
    const lost = change === 'stage-down' ? STAGES[track.stage]!.number : null;
    const seenGuides = lost === null ? progress.seenGuides : progress.seenGuides.filter((n) => n !== lost);
    updateProgress(withTrack({ ...progress, seenGuides }, nextTrack));
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

  const onStage = (i: number) => updateProgress(withTrack(progress, withStage(track, i, STAGES)));
  const onMetronome = (on: boolean) => updateProgress({ ...progress, metronome: on });

  /** Go to an exercise, by way of the stage guide the first time a stage is met. */
  const begin = () => {
    const number = STAGES[track.stage]!.number;
    if (progress.seenGuides.includes(number)) startExercise(progress);
    else setScreen('guide');
  };

  const onGuideStart = () => {
    const number = level.number;
    const next = progress.seenGuides.includes(number) ? progress : { ...progress, seenGuides: [...progress.seenGuides, number] };
    if (next !== progress) updateProgress(next);
    startExercise(next);
  };
  const onMode = (mode: ExerciseMode) => updateProgress({ ...progress, mode });
  const onHandedness = (handedness: Handedness) => updateProgress({ ...progress, handedness });

  const onReset = () => {
    store.clear();
    setProgress(initialProgress(STAGES));
    setSession({ exercises: 0, accuracySum: 0 });
  };

  return (
    <main className="app">
      <header className="app-bar">
        {screen !== 'start' && (
          <button className="icon-btn" onClick={() => setScreen('start')} aria-label="Back to start">
            <ChevronLeftIcon />
          </button>
        )}
        <div className="brand">
          {screen === 'start' && (
            <span className="brand-mark" aria-hidden="true">
              ♪
            </span>
          )}
          <div>
            <h1>Guitar Reading Trainer</h1>
            <p>
              {screen === 'start' || screen === 'guide'
                ? level.title
                : `Melody ${session.exercises + (screen === 'exercise' ? 1 : 0)} · ${keyName(melody.key)} · ${melody.counts} counts (${describeMeter(melody.barBeats)})${MODE_LABEL[progress.mode]}`}
            </p>
          </div>
        </div>
        {screen !== 'start' && <span className="stage-pill">Stage {screen === 'guide' ? level.number : exercise.level.number}</span>}
      </header>

      {screen === 'start' && (
        <StartScreen
          stages={STAGES}
          level={level}
          progress={progress}
          track={track}
          session={session}
          onStart={begin}
          onGuide={() => setScreen('guide')}
          onStage={onStage}
          onMode={onMode}
          onHandedness={onHandedness}
          onMicCheck={() => setMicCheck(true)}
          onExplainer={setExplainer}
          onReset={onReset}
        />
      )}

      {screen === 'guide' && (
        <StageGuide
          stage={level}
          previous={track.stage > 0 ? STAGES[track.stage - 1]! : null}
          leftHanded={progress.handedness === 'left'}
          onStart={onGuideStart}
          onBack={() => setScreen('start')}
        />
      )}

      {screen === 'exercise' &&
        (progress.mode === 'play' ? (
          <PlayScreen melody={melody} level={exercise.level} selfPlay={SELF_PLAY} metronome={progress.metronome} onMetronome={onMetronome} onDone={onPlayed} />
        ) : (
          <ExerciseScreen
            melody={melody}
            level={exercise.level}
            showFretboard={progress.mode === 'watch'}
            leftHanded={progress.handedness === 'left'}
            metronome={progress.metronome}
            onMetronome={onMetronome}
            onCheck={onCheck}
          />
        ))}

      {screen === 'feedback' && checked && (
        <FeedbackScreen
          melody={melody}
          result={checked.result}
          change={checked.change}
          nextStage={checked.stageAfter}
          nextCounts={track.counts}
          nextTally={track.tally}
          yours={checked.yours}
          hearMine={checked.hearMine}
          onNext={begin}
          onExplainer={setExplainer}
        />
      )}

      {explainer && <ExplainerCard id={explainer} onClose={() => setExplainer(null)} />}
      {micCheck && <MicCheck musicKey={melody.key} onClose={() => setMicCheck(false)} />}

      <footer className="muted small">{SAMPLE_CREDIT}</footer>
    </main>
  );
}
