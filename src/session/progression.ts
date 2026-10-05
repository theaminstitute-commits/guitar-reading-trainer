/**
 * How the learner moves along the stage ladder (docs/stage-ladder.md).
 *
 * Progress is kept in two independent tracks, one for writing (watch and
 * listen modes) and one for playing (read-and-play), because they are
 * different skills.
 *
 * Stages unlock by a tally, not by melody length: a clean round adds one
 * point, a perfect round two, a weak round takes one off, and when the tally
 * reaches the stage's target (20: ten perfect melodies) the next stage
 * unlocks. Two weak rounds in a row at the stage's starting length drop back
 * a stage. The app teaches reading, not memory, so length is a side effect:
 * on the main ladder a clean round turns one bar of 4/4 into two and a weak
 * round turns it back; only the bonus stages after free reading add single
 * counts, one per bonus stage, with keys and positions drawn from everything.
 */
import type { GradeResult } from '../grading/grade';
import { MIN_COUNTS } from '../melody/meter';
import type { Stage } from '../melody/stages';

export type ExerciseMode = 'watch' | 'listen' | 'play';
export type Handedness = 'right' | 'left';
export type TrackId = 'write' | 'play';

export interface Track {
  /** Index into the stage list. */
  stage: number;
  /** Highest stage index ever reached; stages above it are locked until earned. */
  unlocked: number;
  /** Current melody length in counts (beats). */
  counts: number;
  /** Points towards unlocking the next stage: +1 clean, +2 perfect, −1 weak. */
  tally: number;
  weakStreak: number;
  /** Lifetime counters. */
  exercises: number;
  /** Sum of per-exercise accuracy (0..1) for the lifetime average. */
  accuracySum: number;
}

export interface Progress {
  version: 4;
  mode: ExerciseMode;
  handedness: Handedness;
  /** Click on every beat during playback in the writing modes. */
  metronome: boolean;
  /** Stage numbers whose guide page has been shown; the guide opens by itself before any other stage. */
  seenGuides: number[];
  write: Track;
  play: Track;
}

export const CLEAN_THRESHOLD = 0.9;
export const WEAK_THRESHOLD = 0.6;

/** Every note and every length right: worth two tally points. */
export function isPerfect(result: Pick<GradeResult, 'pitchScore' | 'rhythmScore'>): boolean {
  return result.pitchScore >= 1 && result.rhythmScore >= 1;
}

export function isClean(result: Pick<GradeResult, 'pitchScore' | 'rhythmScore'>): boolean {
  return result.pitchScore >= CLEAN_THRESHOLD && result.rhythmScore >= CLEAN_THRESHOLD;
}

export function initialTrack(stages: readonly Stage[]): Track {
  return { stage: 0, unlocked: 0, counts: stages[0]!.startCounts, tally: 0, weakStreak: 0, exercises: 0, accuracySum: 0 };
}

export function initialProgress(stages: readonly Stage[]): Progress {
  return { version: 4, mode: 'watch', handedness: 'right', metronome: false, seenGuides: [], write: initialTrack(stages), play: initialTrack(stages) };
}

export function trackIdFor(mode: ExerciseMode): TrackId {
  return mode === 'play' ? 'play' : 'write';
}

export function trackOf(progress: Progress): Track {
  return progress[trackIdFor(progress.mode)];
}

export function withTrack(progress: Progress, track: Track): Progress {
  return { ...progress, [trackIdFor(progress.mode)]: track };
}

/** One number for "how did that go": the mean of pitch and rhythm scores. */
export function accuracyOf(result: Pick<GradeResult, 'pitchScore' | 'rhythmScore'>): number {
  return (result.pitchScore + result.rhythmScore) / 2;
}

/** Next stage index in a direction, skipping optional stages unless opted in; null at the end. */
export function neighbourStage(track: Track, stages: readonly Stage[], direction: 1 | -1, includeOptional: boolean): number | null {
  let i = track.stage + direction;
  while (i >= 0 && i < stages.length) {
    if (!stages[i]!.optional || includeOptional) return i;
    i += direction;
  }
  return null;
}

export type ProgressChange = 'longer' | 'shorter' | 'stage-up' | 'stage-down' | null;

export function applyResult(
  track: Track,
  result: Pick<GradeResult, 'pitchScore' | 'rhythmScore'>,
  stages: readonly Stage[],
  includeOptional = false,
): { track: Track; change: ProgressChange } {
  const stage = stages[track.stage]!;
  const clean = isClean(result);
  const weak = accuracyOf(result) < WEAK_THRESHOLD;
  let { stage: stageIndex, counts, tally, weakStreak } = track;
  let change: ProgressChange = null;

  if (clean) {
    tally += isPerfect(result) ? 2 : 1;
    weakStreak = 0;
    const next = neighbourStage(track, stages, 1, includeOptional);
    if (tally >= stage.unlockTally && next !== null) {
      stageIndex = next;
      counts = stages[stageIndex]!.startCounts;
      tally = 0;
      change = 'stage-up';
    } else if (counts < stage.growCounts) {
      counts = Math.min(stage.growCounts, counts + stage.lengthStep);
      change = 'longer';
    }
  } else if (weak) {
    tally = Math.max(0, tally - 1);
    const previous = neighbourStage(track, stages, -1, includeOptional);
    if (counts > stage.startCounts) {
      // Shortening is the first remedy; only weak rounds at the starting length count towards dropping a stage.
      counts = Math.max(stage.startCounts, counts - stage.lengthStep);
      weakStreak = 0;
      change = 'shorter';
    } else if (++weakStreak >= stage.demoteAfter && previous !== null) {
      stageIndex = previous;
      counts = stages[stageIndex]!.growCounts;
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
      counts,
      tally,
      weakStreak,
      exercises: track.exercises + 1,
      accuracySum: track.accuracySum + accuracyOf(result),
    },
    change,
  };
}

/** Manually chosen length within the current stage; the tally is kept, length is not what unlocks stages. */
export function withCounts(track: Track, counts: number, stages: readonly Stage[]): Track {
  const stage = stages[track.stage]!;
  const clamped = Math.max(MIN_COUNTS, Math.min(stage.maxCounts, Math.round(counts)));
  return { ...track, counts: clamped, weakStreak: 0 };
}

/** Unlock every stage up to `stageIndex` (testing aid). */
export function withUnlocked(track: Track, stageIndex: number, stages: readonly Stage[]): Track {
  const index = Math.max(track.unlocked, Math.min(stages.length - 1, Math.round(stageIndex)));
  return { ...track, unlocked: index };
}

/** Manually chosen stage, limited to stages already unlocked: starts at that stage's starting length with a fresh tally. */
export function withStage(track: Track, stageIndex: number, stages: readonly Stage[]): Track {
  const index = Math.max(0, Math.min(stages.length - 1, track.unlocked, Math.round(stageIndex)));
  return { ...track, stage: index, counts: stages[index]!.startCounts, tally: 0, weakStreak: 0 };
}
