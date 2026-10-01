/**
 * How the learner moves along the stage ladder (docs/stage-ladder.md).
 *
 * Inside a stage the melody length grows from the stage's starting length to
 * its maximum. Clean rounds add a bar, weak rounds remove one. Three clean
 * rounds at the maximum length unlock the next stage; two weak rounds at the
 * starting length drop back to the previous stage at its maximum length.
 */
import type { GradeResult } from '../grading/grade';
import type { Stage } from '../melody/stages';

export interface Progress {
  version: 2;
  /** Index into the stage list. */
  stage: number;
  /** Walk through stages marked optional (the seven-accidental stage). */
  includeOptional: boolean;
  /** 'watch': the fretboard shows each note as it plays. 'listen': ear only, no fretboard. */
  mode: ExerciseMode;
  /** Left-handed players see the fretboard mirrored, nut on the right. */
  handedness: Handedness;
  /** Current melody length in bars. */
  bars: number;
  cleanStreak: number;
  weakStreak: number;
  /** Lifetime counters. */
  exercises: number;
  /** Sum of per-exercise accuracy (0..1) for the lifetime average. */
  accuracySum: number;
}

export type ExerciseMode = 'watch' | 'listen';
export type Handedness = 'right' | 'left';

export const CLEAN_THRESHOLD = 0.9;
export const WEAK_THRESHOLD = 0.6;

export function initialProgress(stages: readonly Stage[]): Progress {
  return { version: 2, stage: 0, includeOptional: false, mode: 'watch', handedness: 'right', bars: stages[0]!.startBars, cleanStreak: 0, weakStreak: 0, exercises: 0, accuracySum: 0 };
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
  let { stage: stageIndex, bars, cleanStreak, weakStreak } = progress;
  let change: ProgressChange = null;

  if (clean) {
    cleanStreak += 1;
    weakStreak = 0;
    if (cleanStreak >= stage.promoteAfter) {
      cleanStreak = 0;
      const next = neighbourStage(progress, stages, 1);
      if (bars < stage.bars) {
        bars += 1;
        change = 'longer';
      } else if (next !== null) {
        stageIndex = next;
        bars = stages[stageIndex]!.startBars;
        change = 'stage-up';
      }
    }
  } else if (weak) {
    weakStreak += 1;
    cleanStreak = 0;
    if (weakStreak >= stage.demoteAfter) {
      weakStreak = 0;
      const previous = neighbourStage(progress, stages, -1);
      if (bars > stage.startBars) {
        bars -= 1;
        change = 'shorter';
      } else if (previous !== null) {
        stageIndex = previous;
        bars = stages[stageIndex]!.bars;
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
      bars,
      cleanStreak,
      weakStreak,
      exercises: progress.exercises + 1,
      accuracySum: progress.accuracySum + accuracyOf(result),
    },
    change,
  };
}

/** Manually chosen length within the current stage: resets the streaks so the new length gets a fair run. */
export function withBars(progress: Progress, bars: number, stages: readonly Stage[]): Progress {
  const stage = stages[progress.stage]!;
  const clamped = Math.max(1, Math.min(stage.bars, Math.round(bars)));
  return { ...progress, bars: clamped, cleanStreak: 0, weakStreak: 0 };
}

/** Manually chosen stage: starts at that stage's starting length with fresh streaks. */
export function withStage(progress: Progress, stageIndex: number, stages: readonly Stage[]): Progress {
  const index = Math.max(0, Math.min(stages.length - 1, Math.round(stageIndex)));
  return { ...progress, stage: index, bars: stages[index]!.startBars, cleanStreak: 0, weakStreak: 0 };
}
