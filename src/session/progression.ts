/**
 * How the learner moves along the stage ladder (docs/stage-ladder.md).
 *
 * Both modes (watch and write, listen only) share one track: they are the
 * same skill, reading and writing notation, with and without the fretboard.
 *
 * A stage unlocks after ten flawless melodies: every note and every length
 * right. Melodies with any mistake do not count, and do not take anything
 * away. Two weak rounds in a row drop back a stage. Melody length is fixed per
 * stage: one bar of 4/4 on the main ladder, one count more per bonus stage.
 */
import type { GradeResult } from '../grading/grade';
import type { Melody } from '../melody/types';
import { keyId } from '../music/key';
import type { InstrumentId } from '../music/instrument';
import { stagesFor, type Stage } from '../melody/stages';

export type ExerciseMode = 'watch' | 'listen';
export type Handedness = 'right' | 'left';
/** Colour theme: follow the device, or a fixed choice. */
export type Theme = 'system' | 'light' | 'dark' | 'midnight' | 'plum' | 'frost' | 'contrast';

export interface Track {
  /** Index into the stage list. */
  stage: number;
  /** Highest stage index ever reached; stages above it are locked until earned. */
  unlocked: number;
  /** Melody length in counts (beats); fixed by the stage. */
  counts: number;
  /** Flawless melodies on the current stage so far. */
  tally: number;
  weakStreak: number;
  /** Lifetime counters. */
  exercises: number;
  /** Sum of per-exercise accuracy (0..1) for the lifetime average. */
  accuracySum: number;
  /** Fingerprints of the melodies already given on each stage (by stage number), so none repeats there (R16). */
  melodies: Record<string, string[]>;
}

/** Most fingerprints kept per stage; beyond that the oldest are forgotten. */
export const MELODIES_KEPT = 400;

/** What makes two melodies the same for R16: key, pitches and lengths. Positions do not count. */
export function fingerprint(melody: Melody): string {
  return `${keyId(melody.key)}|${melody.notes.map((n) => `${n.midi}${n.duration}`).join(' ')}`;
}

export function hasHeard(track: Track, stageNumber: number, melody: Melody): boolean {
  return (track.melodies[String(stageNumber)] ?? []).includes(fingerprint(melody));
}

export function withMelodyHeard(track: Track, stageNumber: number, melody: Melody): Track {
  const key = String(stageNumber);
  const list = [...(track.melodies[key] ?? []), fingerprint(melody)].slice(-MELODIES_KEPT);
  return { ...track, melodies: { ...track.melodies, [key]: list } };
}

/**
 * One instrument's own progress (R41): its ladder, the stage guides it has shown, and
 * whether its tutorial was skipped. The instrument in use keeps its lane in the top-level
 * fields of Progress; the other instrument's lane waits in `other` until it is chosen.
 */
export interface Lane {
  write: Track;
  seenGuides: number[];
  tutorialSkipped: boolean;
}

export interface Progress {
  version: 8;
  /** The instrument being learnt: guitar (treble staff, six strings) or bass (bass staff, four strings). */
  instrument: InstrumentId;
  /** The lane of the instrument not in use, kept for when it is chosen again; null until it has been used. */
  other: Lane | null;
  mode: ExerciseMode;
  handedness: Handedness;
  theme: Theme;
  /** Click on every beat during playback. */
  metronome: boolean;
  /** Stage numbers whose guide page has been shown; the guide opens by itself before any other stage. */
  seenGuides: number[];
  write: Track;
  /** Ids of the tutorial lessons finished (Part 0 and stage lessons; the bass lessons have their own ids). */
  tutorial: string[];
  /** The learner chose not to take the tutorial (skipped it, or took the placement test). */
  tutorialSkipped: boolean;
  /** Beginner hints on stage 1: note names on the fretboard, a slower first play (R26). */
  hints: boolean;
  /** A soft felt-key sound on button presses (R34). */
  buttonSounds: boolean;
}

export const CLEAN_THRESHOLD = 0.9;
export const WEAK_THRESHOLD = 0.6;

/** Every note and every length right: the only kind of round that counts towards unlocking. */
export function isPerfect(result: Pick<GradeResult, 'pitchScore' | 'rhythmScore'>): boolean {
  return result.pitchScore >= 1 && result.rhythmScore >= 1;
}

export function isClean(result: Pick<GradeResult, 'pitchScore' | 'rhythmScore'>): boolean {
  return result.pitchScore >= CLEAN_THRESHOLD && result.rhythmScore >= CLEAN_THRESHOLD;
}

export function initialTrack(stages: readonly Stage[]): Track {
  return { stage: 0, unlocked: 0, counts: stages[0]!.startCounts, tally: 0, weakStreak: 0, exercises: 0, accuracySum: 0, melodies: {} };
}

export function initialProgress(stages: readonly Stage[]): Progress {
  return { version: 8, instrument: 'guitar', other: null, mode: 'watch', handedness: 'right', theme: 'system', metronome: false, seenGuides: [], write: initialTrack(stages), tutorial: [], tutorialSkipped: false, hints: true, buttonSounds: true };
}

/** Anything a reset would clear: melodies, a stage reached or chosen, guides seen, lessons, or the tutorial skipped (R32), on the instrument in use. */
export function hasProgress(progress: Progress): boolean {
  const t = progress.write;
  return (
    t.exercises > 0 ||
    t.stage > 0 ||
    t.unlocked > 0 ||
    t.tally > 0 ||
    Object.keys(t.melodies).length > 0 ||
    progress.seenGuides.length > 0 ||
    lessonsDone(progress).length > 0 ||
    progress.tutorialSkipped
  );
}

/** The finished lessons of the instrument in use (R41): bass lessons on the bass, the others on the guitar. */
export function lessonsDone(progress: Progress): string[] {
  return progress.tutorial.filter((id) => isBassLesson(id) === (progress.instrument === 'bass'));
}

/**
 * Reset progress (R32): the ladder, guides and tutorial start again; the settings (mode, hand, theme, click, hints) stay.
 * Only the instrument in use is reset (R41): the other instrument's ladder and lessons are kept.
 */
export function resetProgress(progress: Progress, stages: readonly Stage[]): Progress {
  const fresh = initialProgress(stages);
  const mine = (id: string) => isBassLesson(id) === (progress.instrument === 'bass');
  return {
    ...fresh,
    instrument: progress.instrument,
    other: progress.other,
    tutorial: progress.tutorial.filter((id) => !mine(id)),
    mode: progress.mode,
    handedness: progress.handedness,
    theme: progress.theme,
    metronome: progress.metronome,
    hints: progress.hints,
    buttonSounds: progress.buttonSounds,
  };
}

/** Bass lessons carry ids starting "bass-" (R41); every other id is a guitar lesson. */
export function isBassLesson(id: string): boolean {
  return id.startsWith('bass-');
}

/** A lane that has not been used yet. */
export function freshLane(stages: readonly Stage[]): Lane {
  return { write: initialTrack(stages), seenGuides: [], tutorialSkipped: false };
}

/**
 * Switch instrument (R41): the lane in use goes into `other`, and the chosen instrument's
 * lane comes out of it (fresh, the first time). Settings and finished lessons stay as they are.
 */
export function withInstrument(progress: Progress, instrument: InstrumentId): Progress {
  if (progress.instrument === instrument) return progress;
  const away: Lane = { write: progress.write, seenGuides: progress.seenGuides, tutorialSkipped: progress.tutorialSkipped };
  const back = progress.other ?? freshLane(stagesFor(instrument));
  return { ...progress, instrument, other: away, write: back.write, seenGuides: back.seenGuides, tutorialSkipped: back.tutorialSkipped };
}

export function trackOf(progress: Progress): Track {
  return progress.write;
}

export function withTrack(progress: Progress, track: Track): Progress {
  return { ...progress, write: track };
}

/** One number for "how did that go": the mean of pitch and rhythm scores. */
export function accuracyOf(result: Pick<GradeResult, 'pitchScore' | 'rhythmScore'>): number {
  return (result.pitchScore + result.rhythmScore) / 2;
}

/** Next stage index in a direction, skipping optional stages unless opted in; null at the end. */
export function neighbourStage(track: Track, stages: readonly Stage[], direction: 1 | -1, includeOptional = false): number | null {
  let i = track.stage + direction;
  while (i >= 0 && i < stages.length) {
    if (!stages[i]!.optional || includeOptional) return i;
    i += direction;
  }
  return null;
}

export type ProgressChange = 'stage-up' | 'stage-down' | null;

export function applyResult(track: Track, result: Pick<GradeResult, 'pitchScore' | 'rhythmScore'>, stages: readonly Stage[]): { track: Track; change: ProgressChange } {
  const stage = stages[track.stage]!;
  const weak = accuracyOf(result) < WEAK_THRESHOLD;
  let { stage: stageIndex, tally, weakStreak } = track;
  let change: ProgressChange = null;

  if (isPerfect(result)) {
    tally += 1;
    weakStreak = 0;
    const next = neighbourStage(track, stages, 1);
    if (tally >= stage.unlockAfter && next !== null) {
      stageIndex = next;
      tally = 0;
      change = 'stage-up';
    }
  } else if (weak) {
    weakStreak += 1;
    const previous = neighbourStage(track, stages, -1);
    if (weakStreak >= stage.demoteAfter && previous !== null) {
      stageIndex = previous;
      tally = 0;
      weakStreak = 0;
      change = 'stage-down';
    }
  } else {
    weakStreak = 0;
  }

  return {
    track: {
      ...track,
      stage: stageIndex,
      unlocked: Math.max(track.unlocked, stageIndex),
      counts: stages[stageIndex]!.startCounts,
      tally,
      weakStreak,
      exercises: track.exercises + 1,
      accuracySum: track.accuracySum + accuracyOf(result),
    },
    change,
  };
}

/** Unlock every stage up to `stageIndex` (testing aid). */
export function withUnlocked(track: Track, stageIndex: number, stages: readonly Stage[]): Track {
  const index = Math.max(track.unlocked, Math.min(stages.length - 1, Math.round(stageIndex)));
  return { ...track, unlocked: index };
}

/** Manually chosen stage, limited to stages already unlocked: that stage's length, with a fresh count of flawless melodies. */
export function withStage(track: Track, stageIndex: number, stages: readonly Stage[]): Track {
  const index = Math.max(0, Math.min(stages.length - 1, track.unlocked, Math.round(stageIndex)));
  return { ...track, stage: index, counts: stages[index]!.startCounts, tally: 0, weakStreak: 0 };
}
