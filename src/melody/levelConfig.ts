import type { DurationId } from '../music/duration';
import { C_MAJOR, type Key } from '../music/key';

/**
 * Everything the generator needs to know about a level. New levels are new
 * config objects; the generator code does not change.
 */
export interface LevelConfig {
  id: string;
  title: string;
  /** Keys a melody may be in; one is picked per melody. */
  keys: readonly Key[];
  timeSignature: readonly [number, number];
  /** Longest melody in this level, in bars. */
  bars: number;
  /** Length of the first exercises. Length grows towards `bars` as the learner succeeds. */
  startBars: number;
  /** Consecutive clean rounds (see grading) needed before the melody gets a bar longer. */
  promoteAfter: number;
  /** Consecutive weak rounds before the melody gets a bar shorter again. */
  demoteAfter: number;
  tempo: number;
  /** How many times the learner may hear the melody per exercise (Play, Replay and Slow all count). */
  maxListens: number;
  /** Play the tonic twice before the count-in so the learner has a tonal anchor. */
  tonicReference: boolean;
  /** Strings the melody may use, guitarist numbering (1 = high E). */
  strings: readonly number[];
  /** Inclusive fret range. */
  fretRange: readonly [number, number];
  durations: readonly DurationId[];
  /** Largest allowed interval between consecutive notes, in diatonic steps (2 = a third). */
  maxLeapSteps: number;
  /** Scale degrees the melody may start on and must end on. */
  startDegrees: readonly number[];
  endDegrees: readonly number[];
}

export const LEVEL_1: LevelConfig = {
  id: 'level-1',
  title: 'Stage 1: C major, first position',
  keys: [C_MAJOR],
  timeSignature: [4, 4],
  bars: 4,
  startBars: 1,
  promoteAfter: 3,
  demoteAfter: 2,
  tempo: 72,
  maxListens: 3,
  tonicReference: false,
  strings: [1, 2, 3],
  fretRange: [0, 3],
  durations: ['q', 'h'],
  maxLeapSteps: 2,
  startDegrees: [1, 3, 5],
  endDegrees: [1, 3, 5],
};

export const LEVELS: readonly LevelConfig[] = [LEVEL_1];
