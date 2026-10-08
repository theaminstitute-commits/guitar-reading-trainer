import { EXPLAINER_ORDER, EXPLAINERS } from '../explainers/content';
import type { ExplainerId } from '../grading/explain';
import { MAIN_STAGE_COUNT, type Stage } from '../melody/stages';
import type { ExerciseMode, Handedness, Progress, Theme, Track } from '../session/progression';
import { BookIcon, CheckIcon, EarIcon, EyeIcon, GuitarIcon, LockIcon, MicIcon, PlayIcon, RefreshIcon, SparkIcon } from './icons';
import Ring from './Ring';

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
  onStage: (index: number) => void;
  onGuide: () => void;
  onMode: (mode: ExerciseMode) => void;
  onHandedness: (handedness: Handedness) => void;
  onTheme: (theme: Theme) => void;
  onMicCheck: () => void;
  onExplainer: (id: ExplainerId) => void;
  onReset: () => void;
}

const pct = (sum: number, n: number) => (n === 0 ? null : `${Math.round((sum / n) * 100)}%`);

const MODES: { id: ExerciseMode; label: string; icon: typeof EyeIcon; note: string }[] = [
  { id: 'watch', label: 'Watch & write', icon: EyeIcon, note: 'The fretboard lights up each note as it plays. You write it on the staff.' },
  { id: 'listen', label: 'Listen only', icon: EarIcon, note: 'Dictation by ear, no fretboard. The key note still sounds first from stage 3.' },
  { id: 'play', label: 'Read & play', icon: GuitarIcon, note: 'Read the melody and play it on your guitar. The microphone hears the tones; notes and count are graded, not timing.' },
];

/** The ladder in parts, for the stage path. */
const PARTS: { title: string; from: number; to: number }[] = [
  { title: 'Part A · Major keys', from: 1, to: 11 },
  { title: 'Part B · Up the neck', from: 12, to: 13 },
  { title: 'Part C · Minor keys', from: 14, to: 17 },
  { title: 'Free reading', from: MAIN_STAGE_COUNT, to: MAIN_STAGE_COUNT },
  { title: 'Bonus · Longer melodies', from: MAIN_STAGE_COUNT + 1, to: 999 },
];

export default function StartScreen({
  stages,
  level,
  progress,
  track,
  session,
  onStart,
  onStage,
  onGuide,
  onMode,
  onHandedness,
  onTheme,
  onMicCheck,
  onExplainer,
  onReset,
}: StartScreenProps) {
  const sessionAccuracy = pct(session.accuracySum, session.exercises);
  const lifetimeAccuracy = pct(track.accuracySum, track.exercises);
  const next = track.unlocked < stages.length - 1 ? stages[track.unlocked + 1]! : null;
  const onTop = track.stage === track.unlocked;
  const mode = MODES.find((m) => m.id === progress.mode)!;
  const stateOf = (i: number) => (i === track.stage ? 'current' : i <= track.unlocked ? 'reached' : 'locked');

  return (
    <section className="start">
      {/* Current stage */}
      <div className="panel hero">
        <div className="hero-main">
          <span className="eyebrow">{onTop ? 'Current stage' : 'Revisiting'}</span>
          <h2 className="hero-title">
            <span className="hero-number">{level.number}</span> {level.name}
          </h2>
          <p className="hero-summary">{level.summary}</p>
        </div>
        <Ring value={onTop ? track.tally / level.unlockAfter : 1} label={onTop ? `${track.tally}/${level.unlockAfter}` : '✓'} sub={onTop ? 'flawless' : 'reached'} />
      </div>
      {next ? (
        <p className="muted small-note hint">
          <LockIcon size={14} /> Stage {next.number} unlocks after {stages[track.unlocked]!.unlockAfter} flawless melodies on stage {stages[track.unlocked]!.number}: every note and every length right.
        </p>
      ) : (
        <p className="muted small-note hint">
          <SparkIcon size={14} /> Every stage is open. Keep reading.
        </p>
      )}

      <div className="cta">
        <button className="btn primary big" onClick={onStart}>
          <PlayIcon size={22} /> Start stage {level.number}
        </button>
        <div className="cta-row">
          <button className="btn" onClick={onGuide}>
            <BookIcon size={18} /> Stage guide
          </button>
          {progress.mode === 'play' && (
            <button className="btn" onClick={onMicCheck}>
              <MicIcon size={18} /> Mic check
            </button>
          )}
        </div>
      </div>

      {/* Mode */}
      <div className="panel">
        <span className="eyebrow">Mode</span>
        <div className="segmented" role="group" aria-label="Mode">
          {MODES.map((m) => (
            <button key={m.id} className={`seg${progress.mode === m.id ? ' on' : ''}`} aria-pressed={progress.mode === m.id} onClick={() => onMode(m.id)}>
              <m.icon size={18} />
              <span>{m.label}</span>
            </button>
          ))}
        </div>
        <p className="muted small-note">{mode.note}</p>
        <div className="row-between">
          <span className="muted">Guitar</span>
          <div className="segmented compact" role="group" aria-label="Handedness">
            <button className={`seg${progress.handedness === 'right' ? ' on' : ''}`} aria-pressed={progress.handedness === 'right'} onClick={() => onHandedness('right')}>
              Right-handed
            </button>
            <button className={`seg${progress.handedness === 'left' ? ' on' : ''}`} aria-pressed={progress.handedness === 'left'} onClick={() => onHandedness('left')}>
              Left-handed
            </button>
          </div>
        </div>
        <div className="row-between">
          <span className="muted">Theme</span>
          <div className="segmented compact" role="group" aria-label="Theme">
            {(['system', 'light', 'dark'] as const).map((t) => (
              <button key={t} className={`seg${progress.theme === t ? ' on' : ''}`} aria-pressed={progress.theme === t} onClick={() => onTheme(t)}>
                {t === 'system' ? 'Auto' : t === 'light' ? 'Light' : 'Dark'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="stats">
        <div className="panel stat">
          <span className="stat-label">This session</span>
          <span className="stat-value">{session.exercises}</span>
          <span className="stat-sub">{session.exercises === 1 ? 'melody' : 'melodies'}{sessionAccuracy ? ` · ${sessionAccuracy}` : ''}</span>
        </div>
        <div className="panel stat">
          <span className="stat-label">All time, {progress.mode === 'play' ? 'playing' : 'writing'}</span>
          <span className="stat-value">{track.exercises}</span>
          <span className="stat-sub">{track.exercises === 1 ? 'melody' : 'melodies'}{lifetimeAccuracy ? ` · ${lifetimeAccuracy}` : ''}</span>
        </div>
      </div>

      {/* Path */}
      <h2 className="section-title">Your path</h2>
      <p className="muted small-note">Tap any stage you have reached to practise it again.</p>
      <div className="path">
        {PARTS.map((part) => {
          const items = stages.map((s, i) => ({ s, i })).filter(({ s }) => s.number >= part.from && s.number <= part.to);
          if (items.length === 0) return null;
          return (
            <div key={part.title} className="path-part">
              <div className="path-part-title">{part.title}</div>
              <ol className="path-list">
                {items.map(({ s, i }) => {
                  const state = stateOf(i);
                  return (
                    <li key={s.id} className={`path-item ${state}`}>
                      <button className="path-node" onClick={() => onStage(i)} disabled={state === 'locked'} aria-current={state === 'current' ? 'step' : undefined} aria-label={`Stage ${s.number}: ${s.name}`}>
                        <span className="node">{state === 'locked' ? <LockIcon size={14} /> : state === 'reached' ? <CheckIcon size={16} /> : s.number}</span>
                        <span className="node-text">
                          <span className="node-name">
                            {s.number}. {s.name}
                          </span>
                          <span className="node-sub">{state === 'current' ? (onTop ? `${track.tally} of ${s.unlockAfter} flawless` : 'practising') : state === 'reached' ? 'reached' : 'locked'}</span>
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ol>
            </div>
          );
        })}
      </div>

      {/* Explainers */}
      <h2 className="section-title">Quick explainers</h2>
      <div className="explainer-row">
        {EXPLAINER_ORDER.map((id) => (
          <button key={id} className="explainer-card" onClick={() => onExplainer(id)}>
            <BookIcon size={18} />
            <span>{EXPLAINERS[id].title}</span>
          </button>
        ))}
      </div>

      {(progress.write.exercises > 0 || progress.play.exercises > 0) && (
        <p className="muted small-note reset-row">
          <button className="link subtle" onClick={onReset}>
            <RefreshIcon size={14} /> Reset progress
          </button>
        </p>
      )}
    </section>
  );
}
