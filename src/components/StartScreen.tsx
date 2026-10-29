import { EXPLAINER_ORDER, EXPLAINERS } from '../explainers/content';
import type { ExplainerId } from '../grading/explain';
import { MAIN_STAGE_COUNT, type Stage } from '../melody/stages';
import type { ExerciseMode, Handedness, Progress, Theme, Track } from '../session/progression';
import { BookIcon, CheckIcon, EarIcon, EyeIcon, LockIcon, PlayIcon, RefreshIcon, SparkIcon } from './icons';
import Ring from './Ring';
import { THEMES } from '../session/themes';
import { PART_0, STAGE_LESSONS, type Lesson } from '../tutorial/lessons';

export interface SessionStats {
  exercises: number;
  accuracySum: number;
}

interface StartScreenProps {
  stages: readonly Stage[];
  level: Stage;
  progress: Progress;
  /** The learner's progress on the ladder. */
  track: Track;
  session: SessionStats;
  onStart: () => void;
  onStage: (index: number) => void;
  onGuide: () => void;
  onMode: (mode: ExerciseMode) => void;
  onHandedness: (handedness: Handedness) => void;
  onTheme: (theme: Theme) => void;
  onExplainer: (id: ExplainerId) => void;
  onReset: () => void;
  onAbout: () => void;
  onLesson: (lesson: Lesson) => void;
  onPlacement: () => void;
  onHints: (on: boolean) => void;
  onDismissWelcome: () => void;
}

const pct = (sum: number, n: number) => (n === 0 ? null : `${Math.round((sum / n) * 100)}%`);

const MODES: { id: ExerciseMode; label: string; icon: typeof EyeIcon; note: string }[] = [
  { id: 'watch', label: 'Watch & write', icon: EyeIcon, note: 'The fretboard lights up each note as it plays. You write it on the staff.' },
  { id: 'listen', label: 'Listen only', icon: EarIcon, note: 'Dictation by ear, no fretboard. The starting note is shown on the staff; the key note still sounds first from stage 3.' },
];

/** The ladder in parts, for the stage path. */
const PARTS: { title: string; from: number; to: number }[] = [
  { title: 'Part A · Major keys', from: 1, to: 11 },
  { title: 'Part B · Up the neck', from: 12, to: 13 },
  { title: 'Part C · Minor keys', from: 14, to: 17 },
  { title: 'Part D · Chords', from: 18, to: MAIN_STAGE_COUNT - 1 },
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
  onExplainer,
  onReset,
  onAbout,
  onLesson,
  onPlacement,
  onHints,
  onDismissWelcome,
}: StartScreenProps) {
  /** A brand-new learner: no melodies, no lessons, and they have not said they can read. */
  const isNew = progress.write.exercises === 0 && progress.tutorial.length === 0 && !progress.tutorialSkipped && track.unlocked === 0;
  const nextPart0 = PART_0.find((l) => !progress.tutorial.includes(l.id));
  const part0Done = PART_0.filter((l) => progress.tutorial.includes(l.id)).length;
  const stageLessons = STAGE_LESSONS.filter((l) => (l.stage ?? 0) - 1 <= track.unlocked);
  const sessionAccuracy = pct(session.accuracySum, session.exercises);
  const lifetimeAccuracy = pct(track.accuracySum, track.exercises);
  const next = track.unlocked < stages.length - 1 ? stages[track.unlocked + 1]! : null;
  const onTop = track.stage === track.unlocked;
  const mode = MODES.find((m) => m.id === progress.mode)!;
  const stateOf = (i: number) => (i === track.stage ? 'current' : i <= track.unlocked ? 'reached' : 'locked');

  return (
    <section className="start">
      {/* Welcome for a brand-new learner: the tutorial, or the placement test (R24, R25) */}
      {isNew && (
        <div className="panel welcome">
          <span className="eyebrow">New here?</span>
          <h2 className="hero-title">Learn to read music from scratch</h2>
          <p className="hero-summary">
            Five short lessons teach the staff, where the notes are on the guitar, and rhythm, then a first melody with a coach. About twenty minutes in all, and you can stop at any point.
          </p>
          <div className="cta">
            <button className="btn primary big" onClick={() => onLesson(PART_0[0]!)}>
              <BookIcon size={20} /> Start the tutorial
            </button>
            <div className="cta-row">
              <button className="btn" onClick={onPlacement}>
                Skip, I can read: placement test
              </button>
            </div>
            <button className="link subtle" onClick={onDismissWelcome}>
              Hide this and start at stage 1
            </button>
          </div>
        </div>
      )}

      {/* A tutorial under way stays at the top until all of Part 0 is done (the welcome above only greets a learner who has not started). */}
      {!isNew && nextPart0 && part0Done > 0 && (
        <div className="panel welcome">
          <span className="eyebrow">Tutorial</span>
          <h2 className="hero-title">{part0Done} of {PART_0.length} lessons done</h2>
          <p className="hero-summary">Next: {nextPart0.title}. {nextPart0.summary}</p>
          <div className="cta">
            <button className="btn primary big" onClick={() => onLesson(nextPart0)}>
              <BookIcon size={20} /> Continue the tutorial
            </button>
          </div>
        </div>
      )}

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
        <label className="toggle muted">
          <input type="checkbox" checked={progress.hints} onChange={(e) => onHints(e.target.checked)} /> Beginner hints on stages 1 and 2: a coach for each note, note names on the fretboard, a slower first play
        </label>
        {/* Listen only shows no fretboard, so handedness has nothing to mirror there. */}
        {progress.mode === 'watch' && (
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
        )}
        {/* Colour themes as swatches: the page colour with a corner of the accent (Auto: half light, half dark). */}
        <div className="theme-picker">
          <span className="muted">Theme</span>
          <div className="theme-grid" role="group" aria-label="Theme">
            {THEMES.map((t) => (
              <button key={t.id} className={`theme-swatch${progress.theme === t.id ? ' on' : ''}`} aria-pressed={progress.theme === t.id} onClick={() => onTheme(t.id)}>
                <span
                  className="theme-dot"
                  aria-hidden="true"
                  style={{ background: t.id === 'system' ? 'linear-gradient(135deg, #efeae2 0 50%, #14181f 50% 100%)' : `linear-gradient(135deg, ${t.bg} 0 58%, ${t.accent} 58% 100%)` }}
                />
                {t.label}
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
          <span className="stat-label">All time</span>
          <span className="stat-value">{track.exercises}</span>
          <span className="stat-sub">{track.exercises === 1 ? 'melody' : 'melodies'}{lifetimeAccuracy ? ` · ${lifetimeAccuracy}` : ''}</span>
        </div>
      </div>

      {/* Tutorial and lessons, above the long stage list so they are easy to find */}
      <h2 className="section-title">Learn</h2>
      <p className="muted small-note">
        {nextPart0 ? `Tutorial: ${part0Done} of ${PART_0.length} lessons done.` : 'Tutorial finished. Replay any lesson whenever you like.'}
      </p>
      <div className="lesson-list">
        {PART_0.map((l) => (
          <button key={l.id} className={`lesson-card${progress.tutorial.includes(l.id) ? ' done' : ''}${l === nextPart0 ? ' next' : ''}`} onClick={() => onLesson(l)}>
            <span className="lesson-mark" aria-hidden="true">{progress.tutorial.includes(l.id) ? <CheckIcon size={16} /> : <BookIcon size={16} />}</span>
            <span className="node-text">
              <span className="node-name">{l.title}</span>
              <span className="node-sub">{l.summary}</span>
            </span>
          </button>
        ))}
        <button className="lesson-card" onClick={onPlacement}>
          <span className="lesson-mark" aria-hidden="true">
            <SparkIcon size={16} />
          </span>
          <span className="node-text">
            <span className="node-name">Placement test</span>
            <span className="node-sub">Already read? Find your starting stage.</span>
          </span>
        </button>
      </div>
      {stageLessons.length > 0 && (
        <>
          <p className="muted small-note">Lessons before the stages you have reached:</p>
          <div className="lesson-list">
            {stageLessons.map((l) => (
              <button key={l.id} className={`lesson-card${progress.tutorial.includes(l.id) ? ' done' : ''}`} onClick={() => onLesson(l)}>
                <span className="lesson-mark" aria-hidden="true">{progress.tutorial.includes(l.id) ? <CheckIcon size={16} /> : <BookIcon size={16} />}</span>
                <span className="node-text">
                  <span className="node-name">{l.title}</span>
                  <span className="node-sub">Before stage {l.stage}</span>
                </span>
              </button>
            ))}
          </div>
        </>
      )}

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

      <p className="muted small-note reset-row">
        <button className="link subtle" onClick={onAbout}>
          <BookIcon size={14} /> About and licences
        </button>
        {progress.write.exercises > 0 && (
          <button className="link subtle" onClick={onReset}>
            <RefreshIcon size={14} /> Reset progress
          </button>
        )}
      </p>
    </section>
  );
}
