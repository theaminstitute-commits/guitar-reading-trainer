/**
 * How the learner moves along the stage ladder (docs/stage-ladder.md).
 *
 * Inside a stage the melody length grows one count (beat) at a time from the
 * stage's starting length to its maximum (see melody/meter for how counts
 * become bars). Clean rounds add a count, weak rounds remove one. Three clean
 * rounds at the maximum length unlock the next stage; two weak rounds at the
 * starting length drop back to the previous stage at its maximum length.
 */
import type { GradeResult } from '../grading/grade';
import { MIN_COUNTS } from '../melody/meter';
import type { Stage } from '../melody/stages';

export type ExerciseMode = 'watch' | 'listen';
export type Handedness = 'right' | 'left';

export interface Progress {
  version: 3;
  /** Index into the stage list. */
  stage: number;
  /** Highest stage index ever reached; stages above it are locked until earned with clean rounds. */
  unlocked: number;
  /** Walk through stages marked optional (the seven-accidental stage). */
  includeOptional: boolean;
  /** 'watch': the fretboard shows each note as it plays. 'listen': ear only, no fretboard. */
  mode: ExerciseMode;
  /** Left-handed players see the fretboard mirrored, nut on the right. */
  handedness: Handedness;
  /** Current melody length in counts (beats). */
  counts: number;
  cleanStreak: number;
  weakStreak: number;
  /** Lifetime counters. */
  exercises: number;
  /** Sum of per-exercise accuracy (0..1) for the lifetime average. */
  accuracySum: number;
}

export const CLEAN_THRESHOLD = 0.9;
export const WEAK_THRESHOLD = 0.6;

export function initialProgress(stages: readonly Stage[]): Progress {
  return {
    version: 3,
    stage: 0,
    unlocked: 0,
    includeOptional: false,
    mode: 'watch',
    handedness: 'right',
    counts: stages[0]!.startCounts,
    cleanStreak: 0,
    weakStreak: 0,
    exercises: 0,
    accuracySum: 0,
  };
}

/** One number for "how did that go": the mean of pitch and rhythm scores. */
export function accuracyOf(result: Pick<GradeResult, 'pitchScore' | 'rhythmScore'>): number {
  return (result.pitchScore + result.rhythmScore) / 2;
}

/** Next stage index in a direction, skipping optional stages unless opted in; null at the end. */
export function neighbourStage(progress: Progress, stages: readonly Stage[], direction: 1 | -1): number | null {
  let i = progress.stage + direction;
  while (i >= 0 && i < stages.length) {
    if (!stages[i]!.optional || progress.includeOptional) return i;
    i += direction;
  }
  return null;
}

export type ProgressChange = 'longer' | 'shorter' | 'stage-up' | 'stage-down' | null;

export function applyResult(
  progress: Progress,
  result: Pick<GradeResult, 'pitchScore' | 'rhythmScore'>,
  stages: readonly Stage[],
): { progress: Progress; change: ProgressChange } {
  const stage = stages[progress.stage]!;
  const clean = result.pitchScore >= CLEAN_THRESHOLD && result.rhythmScore >= CLEAN_THRESHOLD;
  const weak = accuracyOf(result) < WEAK_THRESHOLD;
  let { stage: stageIndex, counts, cleanStreak, weakStreak } = progress;
  let change: ProgressChange = null;

  if (clean) {
    cleanStreak += 1;
    weakStreak = 0;
    if (cleanStreak >= stage.promoteAfter) {
      cleanStreak = 0;
      const next = neighbourStage(progress, stages, 1);
      if (counts < stage.maxCounts) {
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
      const previous = neighbourStage(progress, stages, -1);
      if (counts > stage.startCounts) {
        counts -= 1;
        change = 'shorter';
      } else if (previous !== null) {
        stageIndex = previous;
        counts = stages[stageIndex]!.maxCounts;
        change = 'stage-down';
      }
    }
  } else {
    cleanStreak = 0;
    weakStreak = 0;
  }

  return {
    progress: {
      ...progress,
      stage: stageIndex,
      unlocked: Math.max(progress.unlocked, stageIndex),
      counts,
      cleanStreak,
      weakStreak,
      exercises: progress.exercises + 1,
      accuracySum: progress.accuracySum + accuracyOf(result),
    },
    change,
  };
}

/** Manually chosen length within the current stage: resets the streaks so the new length gets a fair run. */
export function withCounts(progress: Progress, counts: number, stages: readonly Stage[]): Progress {
  const stage = stages[progress.stage]!;
  const clamped = Math.max(MIN_COUNTS, Math.min(stage.maxCounts, Math.round(counts)));
  return { ...progress, counts: clamped, cleanStreak: 0, weakStreak: 0 };
}

/** Manually chosen stage, limited to stages already unlocked: starts at that stage's starting length with fresh streaks. */
/** Unlock every stage up to `stageIndex` (testing aid). */
export function withUnlocked(progress: Progress, stageIndex: number, stages: readonly Stage[]): Progress {
  const index = Math.max(progress.unlocked, Math.min(stages.length - 1, Math.round(stageIndex)));
  return { ...progress, unlocked: index };
}

export function withStage(progress: Progress, stageIndex: number, stages: readonly Stage[]): Progress {
  const index = Math.max(0, Math.min(stages.length - 1, progress.unlocked, Math.round(stageIndex)));
  return { ...progress, stage: index, counts: stages[index]!.startCounts, cleanStreak: 0, weakStreak: 0 };
}
