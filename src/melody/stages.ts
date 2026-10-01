/**
 * The stage ladder (docs/stage-ladder.md). One dimension changes per stage.
 * Each stage is a full LevelConfig plus a number, a name and a one-line summary.
 */
import { keyFromId, MAJOR_KEYS, withMode, type Key } from '../music/key';
import { LEVEL_1, type LevelConfig } from './levelConfig';

export interface Stage extends LevelConfig {
  number: number;
  name: string;
  summary: string;
  /** Skipped by the ladder unless the learner opts in (the seven-accidental stage). */
  optional?: boolean;
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

const STAGE_4: Stage = {
  ...STAGE_3,
  id: 'stage-4',
  number: 4,
  name: 'Two accidentals',
  title: 'Stage 4: two accidentals',
  summary: 'D and B♭ major join the set.',
  keys: K('C', 'G', 'F', 'D', 'Bb'),
};

const STAGE_5: Stage = {
  ...STAGE_4,
  id: 'stage-5',
  number: 5,
  name: 'Eighth notes',
  title: 'Stage 5: eighth notes',
  summary: 'Pairs of beamed eighths on a beat, in the keys so far.',
  durations: ['q', 'h', 'e'],
};

const STAGE_6: Stage = {
  ...STAGE_5,
  id: 'stage-6',
  number: 6,
  name: 'Three accidentals',
  title: 'Stage 6: three accidentals',
  summary: 'A and E♭ major join the set.',
  keys: K('C', 'G', 'F', 'D', 'Bb', 'A', 'Eb'),
};

const STAGE_7: Stage = {
  ...STAGE_6,
  id: 'stage-7',
  number: 7,
  name: 'Whole and dotted notes',
  title: 'Stage 7: whole notes and dotted quarters',
  summary: 'Whole notes, and a dotted quarter followed by an eighth.',
  durations: ['q', 'h', 'e', 'w', 'q.'],
};

const STAGE_8: Stage = {
  ...STAGE_7,
  id: 'stage-8',
  number: 8,
  name: 'Four accidentals',
  title: 'Stage 8: four accidentals',
  summary: 'E and A♭ major join the set.',
  keys: K('C', 'G', 'F', 'D', 'Bb', 'A', 'Eb', 'E', 'Ab'),
};

const STAGE_9: Stage = {
  ...STAGE_8,
  id: 'stage-9',
  number: 9,
  name: 'Five accidentals',
  title: 'Stage 9: five accidentals',
  summary: 'B and D♭ major join the set.',
  keys: K('C', 'G', 'F', 'D', 'Bb', 'A', 'Eb', 'E', 'Ab', 'B', 'Db'),
};

const STAGE_10: Stage = {
  ...STAGE_9,
  id: 'stage-10',
  number: 10,
  name: 'Six accidentals',
  title: 'Stage 10: six accidentals, the enharmonic pair',
  summary: 'F♯ and G♭ major: the same sound, two spellings. Strict spelling decides.',
  keys: K('C', 'G', 'F', 'D', 'Bb', 'A', 'Eb', 'E', 'Ab', 'B', 'Db', 'F#', 'Gb'),
};

const STAGE_11: Stage = {
  ...STAGE_10,
  id: 'stage-11',
  number: 11,
  name: 'Seven accidentals',
  title: 'Stage 11: seven accidentals (optional)',
  summary: 'C♯ and C♭ major, where E♯, B♯, F♭ and C♭ are ordinary notes. Optional.',
  keys: MAJOR_KEYS,
  optional: true,
};

const STAGE_12: Stage = {
  ...STAGE_10,
  id: 'stage-12',
  number: 12,
  name: 'Low strings',
  title: 'Stage 12: the fourth string and ledger lines',
  summary: 'Strings 1 to 4, frets 0 to 4. Notes below the staff on ledger lines.',
  strings: [1, 2, 3, 4],
};

const STAGE_13: Stage = {
  ...STAGE_12,
  id: 'stage-13',
  number: 13,
  name: 'Fifth position',
  title: 'Stage 13: fifth position',
  summary: 'Frets 5 to 9 on strings 1 to 4. Reading away from the nut, up to the ledger lines above.',
  fretRange: [5, 9],
};

const MINORS_A = K('Am', 'Em', 'Dm');
const MINORS_B = K('Am', 'Em', 'Dm', 'Bm', 'Gm', 'F#m', 'Cm');

const STAGE_14: Stage = {
  ...STAGE_13,
  id: 'stage-14',
  number: 14,
  name: 'Natural minor',
  title: 'Stage 14: natural minor',
  summary: 'A, E and D minor. The same signature as the relative major, a different centre. Two listens from here on.',
  keys: MINORS_A,
  maxListens: 2,
};

const STAGE_15: Stage = {
  ...STAGE_14,
  id: 'stage-15',
  number: 15,
  name: 'Natural minor, more keys',
  title: 'Stage 15: natural minor across the cycle',
  summary: 'B, G, F♯ and C minor join the set.',
  keys: MINORS_B,
};

const STAGE_16: Stage = {
  ...STAGE_15,
  id: 'stage-16',
  number: 16,
  name: 'Harmonic minor',
  title: 'Stage 16: harmonic minor',
  summary: 'The raised seventh is written with a sign, and a sign lasts for the bar.',
  keys: MINORS_B.map((k) => withMode(k, 'harmonic-minor')),
};

const STAGE_17: Stage = {
  ...STAGE_16,
  id: 'stage-17',
  number: 17,
  name: 'Melodic minor',
  title: 'Stage 17: melodic minor',
  summary: 'Raised sixth and seventh going up, natural coming down. Spelling is graded strictly.',
  keys: MINORS_B.map((k) => withMode(k, 'melodic-minor')),
};

const STAGE_18: Stage = {
  ...STAGE_17,
  id: 'stage-18',
  number: 18,
  name: 'Free reading',
  title: 'Stage 18: free reading',
  summary: 'Any major key, any minor form, every rhythm so far.',
  keys: [
    ...MAJOR_KEYS,
    ...MINORS_B,
    ...MINORS_B.map((k) => withMode(k, 'harmonic-minor')),
    ...MINORS_B.map((k) => withMode(k, 'melodic-minor')),
  ],
};

export const STAGES: readonly Stage[] = [
  STAGE_1, STAGE_2, STAGE_3, STAGE_4, STAGE_5, STAGE_6, STAGE_7, STAGE_8, STAGE_9, STAGE_10,
  STAGE_11, STAGE_12, STAGE_13, STAGE_14, STAGE_15, STAGE_16, STAGE_17, STAGE_18,
];

export function stageAt(index: number): Stage {
  return STAGES[Math.max(0, Math.min(STAGES.length - 1, index))]!;
}
