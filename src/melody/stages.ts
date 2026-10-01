/**
 * The stage ladder (docs/stage-ladder.md). One dimension changes per stage.
 * Each stage is a full LevelConfig plus a number, a name and a one-line summary.
 */
import { keyFromId, type Key } from '../music/key';
import { LEVEL_1, type LevelConfig } from './levelConfig';

export interface Stage extends LevelConfig {
  number: number;
  name: string;
  summary: string;
}

const K = (...ids: string[]): Key[] => ids.map((id) => keyFromId(id)!);

const STAGE_1: Stage = {
  ...LEVEL_1,
  id: 'stage-1',
  number: 1,
  name: 'C major, first position',
  title: 'Stage 1: C major, first position',
  summary: 'Quarter and half notes on strings 1 to 3, frets 0 to 3.',
};

const STAGE_2: Stage = {
  ...STAGE_1,
  id: 'stage-2',
  number: 2,
  name: 'One more fret',
  title: 'Stage 2: one more fret, leaps up to a fourth',
  summary: 'Frets 0 to 4, so the same pitch can sit in two places. Leaps up to a fourth.',
  fretRange: [0, 4],
  maxLeapSteps: 3,
  startBars: 2,
};

const STAGE_3: Stage = {
  ...STAGE_2,
  id: 'stage-3',
  number: 3,
  name: 'First key signatures',
  title: 'Stage 3: first key signatures',
  summary: 'C, G and F major, chosen at random. The tonic sounds before the count-in.',
  keys: K('C', 'G', 'F'),
  tonicReference: true,
};

export const STAGES: readonly Stage[] = [STAGE_1, STAGE_2, STAGE_3];

export function stageAt(index: number): Stage {
  return STAGES[Math.max(0, Math.min(STAGES.length - 1, index))]!;
}
