/**
 * Turn a graded mistake into a short teaching explanation.
 */
import { DURATIONS, type DurationId } from '../music/duration';
import { spellInKey, type Key } from '../music/key';
import { soundingFromWritten, spelledFromStaffStep, spelledName, staffStep, type SpelledNote } from '../music/pitch';
import type { GradedPair, Mistake } from './grade';

export type ExplainerId = 'staff-basics' | 'durations' | 'guitar-octave';

export interface Explanation {
  number: number;
  title: string;
  text: string;
  /** Which explainer card helps with this mistake. */
  explainer: ExplainerId | null;
  /** Bar the mistake sits in, 1-based. */
  bar: number;
}

const LINE_NAMES = ['first (bottom)', 'second', 'third', 'fourth', 'fifth (top)'];
const SPACE_NAMES = ['first (bottom)', 'second', 'third', 'fourth'];

/** Where a written note sits on the treble staff, in words. */
export function describeStaffPosition(note: SpelledNote): string {
  const bottomLine = staffStep({ letter: 'E', accidental: 0, octave: 4 });
  const offset = staffStep(note) - bottomLine; // 0 = bottom line, 8 = top line
  if (offset >= 0 && offset <= 8) {
    return offset % 2 === 0 ? `on the ${LINE_NAMES[offset / 2]} line` : `in the ${SPACE_NAMES[(offset - 1) / 2]} space`;
  }
  if (offset === -1) return 'in the space just below the staff';
  if (offset === -2) return 'on the first ledger line below the staff';
  if (offset === 9) return 'in the space just above the staff';
  if (offset === 10) return 'on the first ledger line above the staff';
  if (offset < 0) return `${Math.ceil(-offset / 2)} ledger lines below the staff`;
  return `${Math.floor((offset - 8) / 2)} ledger lines above the staff`;
}

function name(x: SpelledNote | { written: SpelledNote }): string {
  const note = 'written' in x ? x.written : x;
  return `${spelledName(note)}${note.octave}`;
}

function durationWords(id: DurationId): string {
  const info = DURATIONS[id];
  const beats = info.beats;
  return `${info.label.toLowerCase()} (${beats} ${beats === 1 ? 'beat' : 'beats'})`;
}

export function explainMistake(mistake: Mistake, pair: GradedPair, key: Key, notesInBar: (bar: number) => number): Explanation {
  const t = pair.target;
  const a = pair.answer;
  const bar = (t?.bar ?? a?.bar ?? 0) + 1;
  const base = { number: mistake.number, bar };

  switch (mistake.kind) {
    case 'wrong-letter': {
      return {
        ...base,
        title: `Wrong note: ${name(a!)} instead of ${name(t!)}`,
        text: `You wrote ${name(a!)}, but this note is ${name(t!)}, ${describeStaffPosition(t!.written)}. Listen to the two versions and hear the difference.`,
        explainer: 'staff-basics',
      };
    }
    case 'wrong-accidental': {
      const keyHasNoAccidentals = key.tonic === 'C' && key.tonicAccidental === 0;
      return {
        ...base,
        title: `Wrong accidental: ${name(a!)} instead of ${name(t!)}`,
        text: `Right line, wrong sign. The melody has ${name(t!)} here, you wrote ${name(a!)}.${
          keyHasNoAccidentals ? ' In C major every note is natural unless you clearly hear a note outside the key.' : ''
        }`,
        explainer: 'staff-basics',
      };
    }
    case 'octave': {
      const sounding = spellInKey(soundingFromWritten(t!.midi), key);
      return {
        ...base,
        title: `Right letter, wrong octave: ${name(a!)} instead of ${name(t!)}`,
        text: `The note is ${name(t!)}, ${describeStaffPosition(t!.written)}. Guitar music is written one octave higher than it sounds: this note sounds as ${name(sounding)} on the instrument but is written ${name(t!)}.`,
        explainer: 'guitar-octave',
      };
    }
    case 'enharmonic': {
      return {
        ...base,
        title: `Spelling: ${name(a!)} instead of ${name(t!)}`,
        text: `${name(a!)} sounds the same as ${name(t!)}, but in this key the note is written ${name(t!)}. Spelling counts: use the letter the key uses.`,
        explainer: 'staff-basics',
      };
    }
    case 'wrong-duration': {
      return {
        ...base,
        title: `Wrong length: ${DURATIONS[a!.duration].label.toLowerCase()} instead of ${DURATIONS[t!.duration].label.toLowerCase()}`,
        text: `This ${name(t!)} is a ${durationWords(t!.duration)}, you wrote a ${durationWords(a!.duration)}. Listen for how long it rings before the next note starts.`,
        explainer: 'durations',
      };
    }
    case 'missing': {
      const count = notesInBar(t!.bar);
      return {
        ...base,
        title: `Missing note: ${name(t!)}`,
        text: `There is a ${name(t!)} (${durationWords(t!.duration)}) here that you left out. Bar ${bar} has ${count} ${count === 1 ? 'note' : 'notes'}; count them on the next listen.`,
        explainer: null,
      };
    }
    case 'extra': {
      const count = notesInBar(a!.bar);
      return {
        ...base,
        title: `Extra note: ${name(a!)}`,
        text: `This ${name(a!)} is not in the melody. Bar ${bar} has only ${count} ${count === 1 ? 'note' : 'notes'}.`,
        explainer: null,
      };
    }
  }
}

/** A written note for a staff step, for callers that only have a step. */
export function nameOfStep(step: number): string {
  return name(spelledFromStaffStep(step));
}
