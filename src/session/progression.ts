/**
 * How the learner moves along the stage ladder (docs/stage-ladder.md).
 *
 * Progress is kept in two independent tracks, one for writing (watch and
 * listen modes) and one for playing (read-and-play), because they are
 * different skills. Inside a stage the melody length grows one count (beat)
 * at a time from the stage's starting length to its maximum (see melody/meter
 * for how counts become bars). Clean rounds add a count, weak rounds remove
 * one. A perfect round (100% on both scores) counts as two clean rounds. A
 * clean streak at the stage's unlock length (12 counts, three bars) unlocks the
 * next stage; on the last stage the length keeps growing to the maximum. Two
 * weak rounds at the starting length drop back to the previous stage at its
 * unlock length. Stages stay unlocked once reached.
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
  cleanStreak: number;
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
  /** Walk through stages marked optional (the seven-accidental stage). */
  includeOptional: boolean;
  write: Track;
  play: Track;
}

export const CLEAN_THRESHOLD = 0.9;
export const WEAK_THRESHOLD = 0.6;

/** Every note and every length right: counts as two clean rounds. */
export function isPerfect(result: Pick<GradeResult, 'pitchScore' | 'rhythmScore'>): boolean {
  return result.pitchScore >= 1 && result.rhythmScore >= 1;
}

export function initialTrack(stages: readonly Stage[]): Track {
  return { stage: 0, unlocked: 0, counts: stages[0]!.startCounts, cleanStreak: 0, weakStreak: 0, exercises: 0, accuracySum: 0 };
}

export function initialProgress(stages: readonly Stage[]): Progress {
  return { version: 4, mode: 'watch', handedness: 'right', includeOptional: false, write: initialTrack(stages), play: initialTrack(stages) };
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
  const clean = result.pitchScore >= CLEAN_THRESHOLD && result.rhythmScore >= CLEAN_THRESHOLD;
  const perfect = isPerfect(result);
  const weak = accuracyOf(result) < WEAK_THRESHOLD;
  let { stage: stageIndex, counts, cleanStreak, weakStreak } = track;
  let change: ProgressChange = null;

  if (clean) {
    cleanStreak += perfect ? 2 : 1;
    weakStreak = 0;
    if (cleanStreak >= stage.promoteAfter) {
      cleanStreak = 0;
      const next = neighbourStage(track, stages, 1, includeOptional);
      const unlockReady = counts >= stage.unlockCounts && next !== null;
      if (!unlockReady && counts < stage.maxCounts) {
        counts += 1;
        change = 'longer';
      } else if (next !== null) {
        stageIndex = next;
        counts = stages[stageIndex]!.startCounts;
        change = 'stage-up';
      }
    }
  } else if (weak) {
    weakStreak += 1;
    cleanStreak = 0;
    if (weakStreak >= stage.demoteAfter) {
      weakStreak = 0;
      const previous = neighbourStage(track, stages, -1, includeOptional);
      if (counts > stage.startCounts) {
        counts -= 1;
        change = 'shorter';
      } else if (previous !== null) {
        stageIndex = previous;
        counts = stages[stageIndex]!.unlockCounts;
        change = 'stage-down';
      }
    }
  } else {
    cleanStreak = 0;
    weakStreak = 0;
  }

  return {
    track: {
      ...track,
      stage: stageIndex,
      unlocked: Math.max(track.unlocked, stageIndex),
      counts,
      cleanStreak,
      weakStreak,
      exercises: track.exercises + 1,
      accuracySum: track.accuracySum + accuracyOf(result),
    },
    change,
  };
}

/** Manually chosen length within the current stage: resets the streaks so the new length gets a fair run. */
export function withCounts(track: Track, counts: number, stages: readonly Stage[]): Track {
  const stage = stages[track.stage]!;
  const clamped = Math.max(MIN_COUNTS, Math.min(stage.maxCounts, Math.round(counts)));
  return { ...track, counts: clamped, cleanStreak: 0, weakStreak: 0 };
}

/** Unlock every stage up to `stageIndex` (testing aid). */
export function withUnlocked(track: Track, stageIndex: number, stages: readonly Stage[]): Track {
  const index = Math.max(track.unlocked, Math.min(stages.length - 1, Math.round(stageIndex)));
  return { ...track, unlocked: index };
}

/** Manually chosen stage, limited to stages already unlocked: starts at that stage's starting length with fresh streaks. */
export function withStage(track: Track, stageIndex: number, stages: readonly Stage[]): Track {
  const index = Math.max(0, Math.min(stages.length - 1, track.unlocked, Math.round(stageIndex)));
  return { ...track, stage: index, counts: stages[index]!.startCounts, cleanStreak: 0, weakStreak: 0 };
}
