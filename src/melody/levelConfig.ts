import type { DurationId } from '../music/duration';
import { C_MAJOR, type Key } from '../music/key';
import { BASE_BEATS, GROW_COUNTS, MIN_COUNTS } from './meter';

/**
 * Everything the generator needs to know about a level. New levels are new
 * config objects; the generator code does not change.
 */
export interface LevelConfig {
  id: string;
  title: string;
  /** Keys a melody may be in; one is picked per melody. */
  keys: readonly Key[];
  /** Longest melody this level generates, in counts (beats). */
  maxCounts: number;
  /** Length of the first exercises, in counts. Every clean round adds `lengthStep` counts up to `growCounts`. */
  startCounts: number;
  /** Length the melody grows to on its own. 8 = two bars; reading, not memory, is the point. */
  growCounts: number;
  /** Counts added per clean round (and removed per weak one). 4 keeps the meter at whole bars of 4/4. */
  lengthStep: number;
  /** Tally points that unlock the next stage: a clean round is one, a perfect round two, a weak round takes one off. */
  unlockTally: number;
  /** Consecutive weak rounds at the starting length before dropping back a stage. */
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
  maxCounts: GROW_COUNTS,
  startCounts: MIN_COUNTS,
  growCounts: GROW_COUNTS,
  lengthStep: BASE_BEATS,
  unlockTally: 20,
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
