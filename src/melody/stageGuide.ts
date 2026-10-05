/**
 * What a stage guide page shows before a stage starts: the pitches the stage
 * can draw on, named and placed on the staff, which of them are new compared
 * with the stage before, where they sit on the fretboard, and the stage's
 * keys and note lengths in words.
 */
import type { DurationId } from '../music/duration';
import type { FretPosition } from '../music/fretboard';
import { keyId, keyName, spellInKey, type Key } from '../music/key';
import { spelledName, staffStep, writtenFromSounding, type Midi } from '../music/pitch';
import { pitchPool } from './generator';
import type { Stage } from './stages';

export interface GuidePitch {
  midi: Midi;
  /** Written staff step (an octave above sounding). */
  step: number;
  /** Written name with octave, e.g. "F♯5". */
  name: string;
  /** Not in the previous stage's pitch set. */
  isNew: boolean;
  positions: FretPosition[];
}

export interface StageGuide {
  stage: Stage;
  /** The key the pitches are shown in: C major when the stage has it, else the stage's first key. */
  key: Key;
  pitches: GuidePitch[];
  /** Facts in words for the page. */
  keys: string;
  lengths: string;
  range: string;
  listens: string;
}

const DURATION_WORDS: Record<DurationId, string> = {
  w: 'whole',
  h: 'half',
  q: 'quarter',
  'q.': 'dotted quarter',
  e: 'eighth',
};

export function displayKeyFor(stage: Stage): Key {
  return stage.keys.find((k) => keyId(k) === 'C') ?? stage.keys[0]!;
}

function joinWords(items: string[]): string {
  if (items.length <= 1) return items.join('');
  return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;
}

export function stageGuide(stage: Stage, previous: Stage | null): StageGuide {
  const key = displayKeyFor(stage);
  const before = new Set(previous ? pitchPool(previous, key).map((p) => p.midi) : []);
  const pitches = pitchPool(stage, key).map((p) => {
    const written = spellInKey(writtenFromSounding(p.midi), key);
    return {
      midi: p.midi,
      step: staffStep(written),
      name: `${spelledName(written)}${written.octave}`,
      isNew: !before.has(p.midi),
      positions: p.positions,
    };
  });
  const keys =
    stage.keys.length > 12
      ? `any of the ${stage.keys.length} keys, chosen at random`
      : stage.keys.length === 1
        ? keyName(stage.keys[0]!)
        : `${joinWords(stage.keys.map((k) => keyName(k)))}, chosen at random`;
  const lengths = `${joinWords(stage.durations.map((d) => DURATION_WORDS[d]))} notes`;
  const strings = stage.strings.length === 6 ? 'all six strings' : `strings ${stage.strings[0]} to ${stage.strings[stage.strings.length - 1]}`;
  const range = `${strings}, frets ${stage.fretRange[0]} to ${stage.fretRange[1]}`;
  const listens = `${stage.maxListens} listens per melody`;
  return { stage, key, pitches, keys, lengths, range, listens };
}
