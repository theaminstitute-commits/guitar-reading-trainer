import { EXPLAINER_ORDER, EXPLAINERS } from '../explainers/content';
import type { ExplainerId } from '../grading/explain';
import { barBeatsForCounts, describeMeter, MIN_COUNTS } from '../melody/meter';
import type { Stage } from '../melody/stages';
import type { ExerciseMode, Handedness, Progress, Track } from '../session/progression';

export interface SessionStats {
  exercises: number;
  accuracySum: number;
}

interface StartScreenProps {
  stages: readonly Stage[];
  level: Stage;
  progress: Progress;
  /** The track of the current mode. */
  track: Track;
  session: SessionStats;
  onStart: () => void;
  onCounts: (counts: number) => void;
  onStage: (index: number) => void;
  onGuide: () => void;
  onMode: (mode: ExerciseMode) => void;
  onHandedness: (handedness: Handedness) => void;
  onMicCheck: () => void;
  onExplainer: (id: ExplainerId) => void;
  onReset: () => void;
}

const pct = (sum: number, n: number) => (n === 0 ? null : `${Math.round((sum / n) * 100)}%`);

const MODE_NOTE: Record<ExerciseMode, string> = {
  watch: 'The fretboard lights up each note as it plays, and you write it on the staff.',
  listen: 'Dictation by ear: no fretboard. The key note still sounds first from stage 3.',
  play: 'You read the melody and play it on your guitar. The microphone hears the tones; only the notes and how many are graded, not the timing.',
};

export default function StartScreen({
  stages,
  level,
  progress,
  track,
  session,
  onStart,
  onCounts,
  onStage,
  onGuide,
  onMode,
  onHandedness,
  onMicCheck,
  onExplainer,
  onReset,
}: StartScreenProps) {
  const sessionAccuracy = pct(session.accuracySum, session.exercises);
  const lifetimeAccuracy = pct(track.accuracySum, track.exercises);
  const chip = (selected: boolean) => `chip${selected ? ' selected' : ''}`;

  return (
    <section className="start">
      <p className="lead">Hear a short melody, watch it on the fretboard, then write it on the staff. Or read a melody and play it. Every mistake gets explained.</p>

      <div className="stats">
        <div>
          <span className="stat-label">This session</span>
          <span className="stat-value">
            {session.exercises} {session.exercises === 1 ? 'melody' : 'melodies'}
            {sessionAccuracy ? ` · ${sessionAccuracy}` : ''}
          </span>
        </div>
        <div>
          <span className="stat-label">All time, {progress.mode === 'play' ? 'playing' : 'writing'}</span>
          <span className="stat-value">
            {track.exercises} {track.exercises === 1 ? 'melody' : 'melodies'}
            {lifetimeAccuracy ? ` · ${lifetimeAccuracy}` : ''}
          </span>
        </div>
      </div>

      <div className="length-picker" role="group" aria-label="Mode">
        <span className="muted">Mode</span>
        <button className={chip(progress.mode === 'watch')} aria-pressed={progress.mode === 'watch'} onClick={() => onMode('watch')}>
          Watch and write
        </button>
        <button className={chip(progress.mode === 'listen')} aria-pressed={progress.mode === 'listen'} onClick={() => onMode('listen')}>
          Listen only
        </button>
        <button className={chip(progress.mode === 'play')} aria-pressed={progress.mode === 'play'} onClick={() => onMode('play')}>
          Read and play
        </button>
      </div>
      <p className="muted small-note">{MODE_NOTE[progress.mode]}</p>

      <div className="length-picker" role="group" aria-label="Handedness">
        <span className="muted">Guitar</span>
        <button className={chip(progress.handedness === 'right')} aria-pressed={progress.handedness === 'right'} onClick={() => onHandedness('right')}>
          Right-handed
        </button>
        <button className={chip(progress.handedness === 'left')} aria-pressed={progress.handedness === 'left'} onClick={() => onHandedness('left')}>
          Left-handed
        </button>
      </div>

      <div className="length-picker" role="group" aria-label="Stage">
        <span className="muted">Stage</span>
        {stages.slice(0, track.unlocked + 1).map((s, i) => (
          <button key={s.id} className={chip(i === track.stage)} aria-pressed={i === track.stage} onClick={() => onStage(i)} title={s.name}>
            {s.number}
          </button>
        ))}
        {track.unlocked < stages.length - 1 && (
          <span className="chip locked" title={`Stage ${stages[track.unlocked + 1]!.number} unlocks at ${stages[track.unlocked]!.unlockTally} tally points on stage ${stages[track.unlocked]!.number}`} aria-label="Next stage locked">
            {stages[track.unlocked + 1]!.number} 🔒
          </span>
        )}
      </div>
      <p className="stage-summary">
        <strong>{level.name}.</strong> {level.summary}
      </p>
      {track.unlocked < stages.length - 1 && (
        <p className="muted small-note">
          Stage {stages[track.unlocked + 1]!.number} unlocks at {stages[track.unlocked]!.unlockTally} tally points on stage {stages[track.unlocked]!.number}. A clean round is one point, a perfect round two, a weak round takes one off.
          {track.stage === track.unlocked && ` Tally now: ${track.tally} of ${level.unlockTally}.`}
        </p>
      )}

      <div className="length-picker" role="group" aria-label="Melody length">
        <span className="muted">Length</span>
        <button className="chip" onClick={() => onCounts(track.counts - 1)} disabled={track.counts <= MIN_COUNTS} aria-label="One count shorter">
          −
        </button>
        <span className="counts-readout">
          {track.counts} counts <span className="muted">· {describeMeter(barBeatsForCounts(track.counts))}</span>
        </span>
        <button className="chip" onClick={() => onCounts(track.counts + 1)} disabled={track.counts >= level.maxCounts} aria-label="One count longer">
          +
        </button>
      </div>
      <p className="muted small-note">
        Grows by one count after every clean round up to {level.growCounts}, shrinks after a weak one. The extra counts form a short last bar until it fills up. Set it longer by hand for a memory workout; length does not affect unlocking.
      </p>

      <div className="controls">
        <button className="primary big" onClick={onStart}>
          Start
        </button>
        <button onClick={onGuide}>Stage guide</button>
        {progress.mode === 'play' && <button onClick={onMicCheck}>Mic check</button>}
      </div>

      <h2 className="section-title">Quick explainers</h2>
      <ul className="explainer-list">
        {EXPLAINER_ORDER.map((id) => (
          <li key={id}>
            <button className="link" onClick={() => onExplainer(id)}>
              {EXPLAINERS[id].title}
            </button>
          </li>
        ))}
      </ul>

      {(progress.write.exercises > 0 || progress.play.exercises > 0) && (
        <p className="muted small-note">
          <button className="link subtle" onClick={onReset}>
            Reset progress
          </button>
        </p>
      )}
    </section>
  );
}
