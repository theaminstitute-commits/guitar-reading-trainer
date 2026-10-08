/**
 * The stage ladder (docs/stage-ladder.md, rules in docs/rules.md). One
 * dimension changes per stage. Each stage is a full LevelConfig plus a number,
 * a name and a one-line summary.
 *
 * R18: a stage that introduces keys uses only those keys; every other stage
 * draws from all the keys introduced so far. R19: the fifth and sixth strings
 * arrive with A and E♭ major (stage 6) and stay for every stage after it.
 */
import { keyFromId, MAJOR_KEYS, withMode, type Key } from '../music/key';
import { LEVEL_1, type LevelConfig } from './levelConfig';
import type { FretPosition } from '../music/fretboard';
import { barBeatsForCounts, describeMeter, MAX_COUNTS, MIN_COUNTS } from './meter';

export interface Stage extends LevelConfig {
  number: number;
  name: string;
  summary: string;
  /** Skipped by the ladder unless the learner opts in (no stage is optional today). */
  optional?: boolean;
}

const K = (...ids: string[]): Key[] => ids.map((id) => keyFromId(id)!);

const ALL_STRINGS = [1, 2, 3, 4, 5, 6];

const STAGE_1: Stage = {
  ...LEVEL_1,
  id: 'stage-1',
  number: 1,
  name: 'C major, first position',
  title: 'Stage 1: C major, first position',
  summary: 'Quarter and half notes on strings 1 to 4, frets 0 to 3: written D4 to G5.',
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
};

const STAGE_3: Stage = {
  ...STAGE_2,
  id: 'stage-3',
  number: 3,
  name: 'First key signatures',
  title: 'Stage 3: first key signatures',
  summary: 'G major and F major only: one sharp or one flat. The tonic sounds before the count-in.',
  keys: K('G', 'F'),
  tonicReference: true,
};

const STAGE_4: Stage = {
  ...STAGE_3,
  id: 'stage-4',
  number: 4,
  name: 'Two accidentals',
  title: 'Stage 4: two accidentals',
  summary: 'D major and B♭ major only.',
  keys: K('D', 'Bb'),
};

const STAGE_5: Stage = {
  ...STAGE_4,
  id: 'stage-5',
  number: 5,
  name: 'Eighth notes',
  title: 'Stage 5: eighth notes',
  summary: 'Pairs of beamed eighths on a beat, in every key so far.',
  keys: K('C', 'G', 'F', 'D', 'Bb'),
  durations: ['q', 'h', 'e'],
};

const STAGE_6: Stage = {
  ...STAGE_5,
  id: 'stage-6',
  number: 6,
  name: 'Three accidentals, low strings',
  title: 'Stage 6: three accidentals, on all six strings',
  summary: 'A major and E♭ major only, now on all six strings from the open low E. Ledger lines below the staff begin.',
  keys: K('A', 'Eb'),
  strings: ALL_STRINGS,
  // R13 is waived while strings are being added (rules.md, conflict log): the new strings are the feature here.
  featureFret: false,
};

const STAGE_7: Stage = {
  ...STAGE_6,
  id: 'stage-7',
  number: 7,
  name: 'Whole and dotted notes',
  title: 'Stage 7: whole notes and dotted quarters',
  summary: 'Whole notes, and a dotted quarter followed by an eighth, in every key so far on all six strings.',
  keys: K('C', 'G', 'F', 'D', 'Bb', 'A', 'Eb'),
  durations: ['q', 'h', 'e', 'w', 'q.'],
  featureFret: true,
};

const STAGE_8: Stage = {
  ...STAGE_7,
  id: 'stage-8',
  number: 8,
  name: 'Four accidentals',
  title: 'Stage 8: four accidentals',
  summary: 'E major and A♭ major only.',
  keys: K('E', 'Ab'),
};

const STAGE_9: Stage = {
  ...STAGE_8,
  id: 'stage-9',
  number: 9,
  name: 'Five accidentals',
  title: 'Stage 9: five accidentals',
  summary: 'B major and D♭ major only.',
  keys: K('B', 'Db'),
};

const STAGE_10: Stage = {
  ...STAGE_9,
  id: 'stage-10',
  number: 10,
  name: 'Six accidentals',
  title: 'Stage 10: six accidentals, the enharmonic pair',
  summary: 'F♯ major and G♭ major only: the same sound, two spellings. Strict spelling decides.',
  keys: K('F#', 'Gb'),
};

const STAGE_11: Stage = {
  ...STAGE_10,
  id: 'stage-11',
  number: 11,
  name: 'Seven accidentals',
  title: 'Stage 11: seven accidentals',
  summary: 'C♯ major and C♭ major only, where E♯, B♯, F♭ and C♭ are ordinary notes.',
  keys: K('C#', 'Cb'),
};

const STAGE_12: Stage = {
  ...STAGE_11,
  id: 'stage-12',
  number: 12,
  name: 'Fifth position',
  title: 'Stage 12: fifth position',
  summary: 'Frets 5 to 9 on all six strings, in any major key. Reading away from the nut, up to the ledger lines above.',
  keys: MAJOR_KEYS,
  fretRange: [5, 9],
  featureFret: true,
};

const STAGE_13: Stage = {
  ...STAGE_12,
  id: 'stage-13',
  number: 13,
  name: 'Up to the octave',
  title: 'Stage 13: up to the octave',
  summary: 'Frets 9 to 12 on all six strings. Fret 12 is the octave of the open string; the top notes sit three ledger lines above.',
  fretRange: [9, 12],
};

const MINORS_A = K('Am', 'Em', 'Dm');
const MINORS_B = K('Bm', 'Gm', 'F#m', 'Cm');
const ALL_MINORS = [...MINORS_A, ...MINORS_B];

const STAGE_14: Stage = {
  ...STAGE_13,
  id: 'stage-14',
  number: 14,
  name: 'Natural minor',
  title: 'Stage 14: natural minor',
  summary: 'A, E and D minor only. The same signature as the relative major, a different centre. Two listens from here on.',
  keys: MINORS_A,
  maxListens: 2,
};

const STAGE_15: Stage = {
  ...STAGE_14,
  id: 'stage-15',
  number: 15,
  name: 'Natural minor, more keys',
  title: 'Stage 15: natural minor across the cycle',
  summary: 'B, G, F♯ and C minor only.',
  keys: MINORS_B,
};

const STAGE_16: Stage = {
  ...STAGE_15,
  id: 'stage-16',
  number: 16,
  name: 'Harmonic minor',
  title: 'Stage 16: harmonic minor',
  summary: 'All seven minor keys in their harmonic form. The raised seventh is written with a sign, and a sign lasts for the bar.',
  keys: ALL_MINORS.map((k) => withMode(k, 'harmonic-minor')),
};

const STAGE_17: Stage = {
  ...STAGE_16,
  id: 'stage-17',
  number: 17,
  name: 'Melodic minor',
  title: 'Stage 17: melodic minor',
  summary: 'All seven minor keys in their melodic form. Raised sixth and seventh going up, natural coming down. Spelling is graded strictly.',
  keys: ALL_MINORS.map((k) => withMode(k, 'melodic-minor')),
};

const STAGE_18: Stage = {
  ...STAGE_17,
  id: 'stage-18',
  number: 18,
  name: 'Free reading',
  title: 'Stage 18: free reading',
  summary: 'Any major key, any minor form, every rhythm, all six strings from the nut to fret 12.',
  keys: [
    ...MAJOR_KEYS,
    ...ALL_MINORS,
    ...ALL_MINORS.map((k) => withMode(k, 'harmonic-minor')),
    ...ALL_MINORS.map((k) => withMode(k, 'melodic-minor')),
  ],
  strings: ALL_STRINGS,
  fretRange: [0, 12],
};

/** Free reading is the last of the main ladder; everything after it is a bonus stage. */
export const MAIN_STAGE_COUNT = 18;

/**
 * Bonus stages after free reading: one count more each, so every length beyond
 * one bar of 4/4 lives here (5 counts is 4/4 + 1/4) up to four full bars. Keys
 * and positions come from everything the ladder covered.
 */
const BONUS: Stage[] = Array.from({ length: MAX_COUNTS - MIN_COUNTS }, (_, i) => {
  const counts = MIN_COUNTS + i + 1;
  const meter = describeMeter(barBeatsForCounts(counts));
  return {
    ...STAGE_18,
    id: `bonus-${i + 1}`,
    number: MAIN_STAGE_COUNT + 1 + i,
    name: `Bonus ${i + 1}: ${counts} counts`,
    title: `Bonus stage ${i + 1}: ${counts} counts (${meter})`,
    summary: `${meter}. Any key, any minor form, anywhere on the neck. The melody is ${counts} counts long every time.`,
    startCounts: counts,
    maxCounts: counts,
    featureFret: false,
  };
});

function positionsOf(level: LevelConfig): FretPosition[] {
  const out: FretPosition[] = [];
  for (const string of level.strings) for (let fret = level.fretRange[0]; fret <= level.fretRange[1]; fret++) out.push({ string, fret });
  return out;
}

/** Positions a stage adds compared with the stage before it; melodies there must use one of them (R7). */
function introducedBy(stage: Stage, previous: Stage): FretPosition[] {
  const before = positionsOf(previous);
  return positionsOf(stage).filter((p) => !before.some((q) => q.string === p.string && q.fret === p.fret));
}

const MAIN: Stage[] = [
  STAGE_1, STAGE_2, STAGE_3, STAGE_4, STAGE_5, STAGE_6, STAGE_7, STAGE_8, STAGE_9, STAGE_10,
  STAGE_11, STAGE_12, STAGE_13, STAGE_14, STAGE_15, STAGE_16, STAGE_17, STAGE_18,
].map((stage, i, all) => {
  if (i === 0) return stage;
  const introduces = introducedBy(stage, all[i - 1]!);
  return introduces.length > 0 ? { ...stage, introduces } : stage;
});

export const STAGES: readonly Stage[] = [...MAIN, ...BONUS];

export function stageAt(index: number): Stage {
  return STAGES[Math.max(0, Math.min(STAGES.length - 1, index))]!;
}
