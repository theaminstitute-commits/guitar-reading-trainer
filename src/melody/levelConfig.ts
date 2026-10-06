import type { DurationId } from '../music/duration';
import type { FretPosition } from '../music/fretboard';
import { C_MAJOR, type Key } from '../music/key';
import { MIN_COUNTS } from './meter';

/**
 * Everything the generator needs to know about a level. New levels are new
 * config objects; the generator code does not change.
 */
export interface LevelConfig {
  id: string;
  title: string;
  /** Keys a melody may be in; one is picked per melody. */
  keys: readonly Key[];
  /** Longest melody this level generates, in counts (beats); the same as `startCounts`, length is fixed per level. */
  maxCounts: number;
  /** Melody length in counts: 4 (one bar of 4/4) on the main ladder, one more per bonus stage. */
  startCounts: number;
  /** Flawless melodies (every note and length right) that unlock the next stage. */
  unlockAfter: number;
  /** Consecutive weak rounds before dropping back a stage. */
  demoteAfter: number;
  /** Positions (string and fret) this level adds compared with the one before; every melody uses at least one (R7). */
  introduces?: readonly FretPosition[];
  /** Every melody puts a note on the highest fret of the window that has an in-key note (R13). Main stages only. */
  featureFret?: boolean;
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
  maxCounts: MIN_COUNTS,
  startCounts: MIN_COUNTS,
  unlockAfter: 10,
  demoteAfter: 2,
  tempo: 72,
  maxListens: 3,
  tonicReference: false,
  strings: [1, 2, 3, 4],
  fretRange: [0, 3],
  featureFret: true,
  durations: ['q', 'h'],
  maxLeapSteps: 2,
  startDegrees: [1, 3, 5],
  endDegrees: [1, 3, 5],
};

export const LEVELS: readonly LevelConfig[] = [LEVEL_1];
