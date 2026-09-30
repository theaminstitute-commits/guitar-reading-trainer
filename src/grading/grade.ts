/**
 * Grade a learner's answer against the target melody.
 *
 * Both sides are compared as WRITTEN pitches (what is on the page), because
 * that is what the learner produced. Spelling is strict: E# for F is a mistake
 * even though it sounds the same.
 */
import type { Melody } from '../melody/types';
import { splitIntoBars } from '../melody/bars';
import { beatsOf, type DurationId } from '../music/duration';
import { spellInKey, type Key } from '../music/key';
import { midiFromSpelled, spelledEquals, writtenFromSounding, type Midi, type SpelledNote } from '../music/pitch';
import { answerNoteToSpelled, type AnswerNote } from '../notation/answer';
import { align } from './align';

export type MistakeKind =
  | 'wrong-letter'
  | 'wrong-accidental'
  | 'octave'
  | 'enharmonic'
  | 'wrong-duration'
  | 'missing'
  | 'extra';

export interface GradedTarget {
  index: number;
  bar: number;
  written: SpelledNote;
  /** Written MIDI (sounding + 12). */
  midi: Midi;
  duration: DurationId;
}

export interface GradedAnswer {
  index: number;
  id: number;
  bar: number;
  written: SpelledNote;
  midi: Midi;
  duration: DurationId;
}

export interface GradedPair {
  target: GradedTarget | null;
  answer: GradedAnswer | null;
  pitchOk: boolean;
  durationOk: boolean;
  mistakes: Mistake[];
}

export interface Mistake {
  kind: MistakeKind;
  /** 1-based display number, in melody order. */
  number: number;
  pairIndex: number;
}

export interface GradeResult {
  pairs: GradedPair[];
  mistakes: Mistake[];
  /** 0..1 */
  pitchScore: number;
  /** 0..1 */
  rhythmScore: number;
  targetCount: number;
  answerCount: number;
  extraCount: number;
  missingCount: number;
}

function pairCost(t: GradedTarget, a: GradedAnswer): number {
  let pitch: number;
  if (spelledEquals(t.written, a.written)) pitch = 0;
  else if (t.midi === a.midi || t.written.letter === a.written.letter) pitch = 0.3;
  else pitch = 0.9; // close to a gap, so a skipped note plus an added one is not read as a chain of wrong notes
  const duration = t.duration === a.duration ? 0 : 0.4;
  return pitch + duration;
}

function pitchMistake(t: GradedTarget, a: GradedAnswer): MistakeKind | null {
  if (spelledEquals(t.written, a.written)) return null;
  const sameLetter = t.written.letter === a.written.letter;
  const sameAccidental = t.written.accidental === a.written.accidental;
  const sameOctave = t.written.octave === a.written.octave;
  if (sameLetter && sameOctave && !sameAccidental) return 'wrong-accidental';
  if (sameLetter && sameAccidental && !sameOctave) return 'octave';
  if (t.midi === a.midi) return 'enharmonic';
  return 'wrong-letter';
}

export function gradeAnswer(melody: Melody, answerBars: readonly (readonly AnswerNote[])[], key: Key): GradeResult {
  const targetBars = splitIntoBars(melody.notes, melody.timeSignature);
  const targets: GradedTarget[] = [];
  targetBars.forEach((bar, barIndex) => {
    for (const note of bar.notes) {
      const midi = writtenFromSounding(note.midi);
      targets.push({ index: targets.length, bar: barIndex, written: spellInKey(midi, key), midi, duration: note.duration });
    }
  });

  const answers: GradedAnswer[] = [];
  answerBars.forEach((bar, barIndex) => {
    for (const note of bar) {
      const written = answerNoteToSpelled(note);
      answers.push({ index: answers.length, id: note.id, bar: barIndex, written, midi: midiFromSpelled(written), duration: note.duration });
    }
  });

  const aligned = align(targets, answers, pairCost);
  const pairs: GradedPair[] = [];
  const mistakes: Mistake[] = [];
  let pitchCorrect = 0;
  let rhythmCorrect = 0;
  let extraCount = 0;
  let missingCount = 0;

  aligned.forEach((p, pairIndex) => {
    const target = p.target === null ? null : targets[p.target]!;
    const answer = p.answer === null ? null : answers[p.answer]!;
    const pair: GradedPair = { target, answer, pitchOk: false, durationOk: false, mistakes: [] };
    const add = (kind: MistakeKind) => {
      const mistake: Mistake = { kind, number: mistakes.length + 1, pairIndex };
      mistakes.push(mistake);
      pair.mistakes.push(mistake);
    };

    if (target && answer) {
      const kind = pitchMistake(target, answer);
      pair.pitchOk = kind === null;
      pair.durationOk = target.duration === answer.duration;
      if (kind) add(kind);
      if (!pair.durationOk) add('wrong-duration');
      if (pair.pitchOk) pitchCorrect++;
      if (pair.durationOk) rhythmCorrect++;
    } else if (target) {
      missingCount++;
      add('missing');
    } else if (answer) {
      extraCount++;
      add('extra');
    }
    pairs.push(pair);
  });

  const denominator = Math.max(1, targets.length + extraCount);
  return {
    pairs,
    mistakes,
    pitchScore: pitchCorrect / denominator,
    rhythmScore: rhythmCorrect / denominator,
    targetCount: targets.length,
    answerCount: answers.length,
    extraCount,
    missingCount,
  };
}

/** Beats of a duration, exposed for explanations. */
export function durationBeats(d: DurationId): number {
  return beatsOf(d);
}
