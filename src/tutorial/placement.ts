/**
 * The placement test (R25): for players who can already read. Tiers of four
 * questions in ladder order; a tier is passed with three right. The test stops
 * at the first tier failed and places the learner at the stage that teaches it.
 * Passing every tier places them at the first chord stage, since chords are new
 * to the ladder rather than a reading test.
 */
import { keyFromId, type Key } from '../music/key';
import { createRng, type Rng } from '../melody/random';
import { nameNotes, naturalsBetween, rhythms, signatureNotes, type NameQuestion, type Question } from './questions';
import { shuffle } from './questions';
import { parseSpelled } from '../music/pitch';

export interface Tier {
  id: string;
  /** What the tier checks, for the result screen. */
  skill: string;
  /** Stage number a learner who fails this tier is placed at. */
  failStage: number;
  make: (rng: Rng) => Question[];
}

export const QUESTIONS_PER_TIER = 4;
export const PASS_MARK = 3;
/** Where a learner who passes every tier is placed: the first chord stage. */
export const TOP_STAGE = 18;

const K = (...ids: string[]): Key[] => ids.map((id) => keyFromId(id)!);

/** A note with a written sign in a harmonic minor key: the raised seventh. */
function raisedSevenths(rng: Rng, count: number): NameQuestion[] {
  const cases: [string, string, string][] = [
    ['Am-h', 'G#4', 'G♯'],
    ['Em-h', 'D#5', 'D♯'],
    ['Dm-h', 'C#5', 'C♯'],
    ['Gm-h', 'F#4', 'F♯'],
    ['Cm-h', 'B4', 'B♮'],
    ['Bm-h', 'A#4', 'A♯'],
  ];
  const out: NameQuestion[] = [];
  for (let i = 0; i < count; i++) {
    const [keyId, note, answer] = rng.pick(cases);
    const key = keyFromId(keyId)!;
    const spelled = parseSpelled(note);
    const letter = spelled.letter;
    const shown = answer.endsWith('♮') ? letter : answer;
    const choices = shuffle([shown, `${letter}♭`, `${letter}`, `${letter}♯`].filter((c, k, all) => all.indexOf(c) === k), rng).slice(0, 4);
    if (!choices.includes(shown)) choices[0] = shown;
    out.push({ kind: 'name', prompt: `In ${key.tonic}${['♭', '', '♯'][key.tonicAccidental + 1]} harmonic minor, what is this note?`, key, notes: [spelled], choices, answer: shown });
  }
  return out;
}

export const TIERS: readonly Tier[] = [
  { id: 'staff', skill: 'Notes on the staff', failStage: 1, make: (rng) => nameNotes(naturalsBetween('D4', 'G5'), QUESTIONS_PER_TIER, rng) },
  { id: 'signatures', skill: 'One and two sharps or flats', failStage: 3, make: (rng) => signatureNotes(K('G', 'F', 'D', 'Bb'), naturalsBetween('D4', 'G5'), QUESTIONS_PER_TIER, rng) },
  { id: 'rhythm', skill: 'Eighth notes', failStage: 5, make: (rng) => rhythms(['q', 'h', 'e'], QUESTIONS_PER_TIER, rng) },
  { id: 'ledger-low', skill: 'Ledger lines below the staff', failStage: 6, make: (rng) => nameNotes(naturalsBetween('E3', 'C4'), QUESTIONS_PER_TIER, rng) },
  { id: 'signatures-more', skill: 'Three to six sharps or flats', failStage: 8, make: (rng) => signatureNotes(K('A', 'Eb', 'E', 'Ab', 'B', 'Db', 'F#', 'Gb'), naturalsBetween('D4', 'G5'), QUESTIONS_PER_TIER, rng) },
  { id: 'ledger-high', skill: 'Ledger lines above the staff', failStage: 12, make: (rng) => nameNotes(naturalsBetween('A5', 'E6'), QUESTIONS_PER_TIER, rng) },
  { id: 'minor', skill: 'Raised notes in minor keys', failStage: 14, make: (rng) => raisedSevenths(rng, QUESTIONS_PER_TIER) },
];

/** The questions of a tier for a seed (each tier draws from its own stream, so a seed fixes the whole test). */
export function tierQuestions(tier: Tier, seed: number): Question[] {
  return tier.make(createRng(seed + TIERS.indexOf(tier) * 7919));
}

/** The stage number to place at from tier results so far: the first failed tier's stage, or the top. */
export function placementStage(passed: readonly boolean[]): number {
  const failed = passed.findIndex((p) => !p);
  return failed === -1 && passed.length === TIERS.length ? TOP_STAGE : TIERS[failed === -1 ? passed.length : failed]!.failStage;
}
