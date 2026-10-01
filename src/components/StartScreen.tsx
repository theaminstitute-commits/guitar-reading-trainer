import { EXPLAINER_ORDER, EXPLAINERS } from '../explainers/content';
import type { ExplainerId } from '../grading/explain';
import type { Stage } from '../melody/stages';
import type { Progress } from '../session/progression';

export interface SessionStats {
  exercises: number;
  accuracySum: number;
}

interface StartScreenProps {
  stages: readonly Stage[];
  level: Stage;
  progress: Progress;
  session: SessionStats;
  onStart: () => void;
  onLength: (bars: number) => void;
  onStage: (index: number) => void;
  onIncludeOptional: (include: boolean) => void;
  onExplainer: (id: ExplainerId) => void;
  onReset: () => void;
}

const pct = (sum: number, n: number) => (n === 0 ? null : `${Math.round((sum / n) * 100)}%`);

export default function StartScreen({ stages, level, progress, session, onStart, onLength, onStage, onIncludeOptional, onExplainer, onReset }: StartScreenProps) {
  const lengths = Array.from({ length: level.bars }, (_, i) => i + 1);
  const sessionAccuracy = pct(session.accuracySum, session.exercises);
  const lifetimeAccuracy = pct(progress.accuracySum, progress.exercises);

  return (
    <section className="start">
      <p className="lead">
        Hear a short melody, watch it on the fretboard, then write it on the staff. Every mistake gets explained.
      </p>

      <div className="stats">
        <div>
          <span className="stat-label">This session</span>
          <span className="stat-value">
            {session.exercises} {session.exercises === 1 ? 'melody' : 'melodies'}
            {sessionAccuracy ? ` · ${sessionAccuracy}` : ''}
          </span>
        </div>
        <div>
          <span className="stat-label">All time</span>
          <span className="stat-value">
            {progress.exercises} {progress.exercises === 1 ? 'melody' : 'melodies'}
            {lifetimeAccuracy ? ` · ${lifetimeAccuracy}` : ''}
          </span>
        </div>
      </div>

      <div className="length-picker" role="group" aria-label="Stage">
        <span className="muted">Stage</span>
        {stages.map((s, i) => (
          <button key={s.id} className={`chip${i === progress.stage ? ' selected' : ''}`} aria-pressed={i === progress.stage} onClick={() => onStage(i)} title={s.name}>
            {s.number}
          </button>
        ))}
      </div>
      <p className="stage-summary">
        <strong>{level.name}.</strong> {level.summary}
      </p>
      {stages.some((s) => s.optional) && (
        <label className="toggle muted">
          <input type="checkbox" checked={progress.includeOptional} onChange={(e) => onIncludeOptional(e.target.checked)} /> Include the optional
          seven-accidental stage
        </label>
      )}

      <div className="length-picker" role="group" aria-label="Melody length">
        <span className="muted">Length</span>
        {lengths.map((n) => (
          <button key={n} className={`chip${n === progress.bars ? ' selected' : ''}`} aria-pressed={n === progress.bars} onClick={() => onLength(n)}>
            {n} {n === 1 ? 'bar' : 'bars'}
          </button>
        ))}
      </div>
      <p className="muted small-note">
        Grows by a bar after {level.promoteAfter} clean rounds in a row, shrinks after {level.demoteAfter} weak ones. Clean rounds at {level.bars} bars unlock the next stage.
      </p>

      <div className="controls">
        <button className="primary big" onClick={onStart}>
          Start
        </button>
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

      {progress.exercises > 0 && (
        <p className="muted small-note">
          <button className="link subtle" onClick={onReset}>
            Reset progress
          </button>
        </p>
      )}
    </section>
  );
}
