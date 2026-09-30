/**
 * How melody length grows and shrinks with the learner's results.
 *
 * A clean round (high pitch and rhythm scores) adds to a streak; enough clean
 * rounds in a row make the melody a bar longer. Weak rounds do the reverse.
 */
import type { LevelConfig } from '../melody/levelConfig';
import type { GradeResult } from '../grading/grade';

export interface Progress {
  version: 1;
  /** Current melody length in bars. */
  bars: number;
  cleanStreak: number;
  weakStreak: number;
  /** Lifetime counters. */
  exercises: number;
  /** Sum of per-exercise accuracy (0..1) for the lifetime average. */
  accuracySum: number;
}

export const CLEAN_THRESHOLD = 0.9;
export const WEAK_THRESHOLD = 0.6;

export function initialProgress(level: LevelConfig): Progress {
  return { version: 1, bars: level.startBars, cleanStreak: 0, weakStreak: 0, exercises: 0, accuracySum: 0 };
}

/** One number for "how did that go": the mean of pitch and rhythm scores. */
export function accuracyOf(result: Pick<GradeResult, 'pitchScore' | 'rhythmScore'>): number {
  return (result.pitchScore + result.rhythmScore) / 2;
}

export type LengthChange = 'longer' | 'shorter' | null;

export function applyResult(
  progress: Progress,
  result: Pick<GradeResult, 'pitchScore' | 'rhythmScore'>,
  level: LevelConfig,
): { progress: Progress; change: LengthChange } {
  const clean = result.pitchScore >= CLEAN_THRESHOLD && result.rhythmScore >= CLEAN_THRESHOLD;
  const weak = accuracyOf(result) < WEAK_THRESHOLD;
  let { bars, cleanStreak, weakStreak } = progress;
  let change: LengthChange = null;

  if (clean) {
    cleanStreak += 1;
    weakStreak = 0;
    if (cleanStreak >= level.promoteAfter && bars < level.bars) {
      bars += 1;
      cleanStreak = 0;
      change = 'longer';
    }
  } else if (weak) {
    weakStreak += 1;
    cleanStreak = 0;
    if (weakStreak >= level.demoteAfter && bars > 1) {
      bars -= 1;
      weakStreak = 0;
      change = 'shorter';
    }
  } else {
    cleanStreak = 0;
    weakStreak = 0;
  }

  return {
    progress: {
      ...progress,
      bars,
      cleanStreak,
      weakStreak,
      exercises: progress.exercises + 1,
      accuracySum: progress.accuracySum + accuracyOf(result),
    },
    change,
  };
}

/** Manually chosen length: resets the streaks so the new length gets a fair run. */
export function withBars(progress: Progress, bars: number, level: LevelConfig): Progress {
  const clamped = Math.max(1, Math.min(level.bars, Math.round(bars)));
  return { ...progress, bars: clamped, cleanStreak: 0, weakStreak: 0 };
}
