import type { DurationId } from '../music/duration';
import { C_MAJOR, type Key } from '../music/key';
import { MAX_COUNTS, MIN_COUNTS } from './meter';

/**
 * Everything the generator needs to know about a level. New levels are new
 * config objects; the generator code does not change.
 */
export interface LevelConfig {
  id: string;
  title: string;
  /** Keys a melody may be in; one is picked per melody. */
  keys: readonly Key[];
  /** Longest melody in this level, in counts (beats). 16 = four bars of 4/4. */
  maxCounts: number;
  /** Length of the first exercises, in counts. Length grows one count at a time towards `maxCounts`. */
  startCounts: number;
  /** Consecutive clean rounds (see grading) needed before the melody gets a count longer. */
  promoteAfter: number;
  /** Consecutive weak rounds before the melody gets a count shorter again. */
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
  maxCounts: MAX_COUNTS,
  startCounts: MIN_COUNTS,
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
