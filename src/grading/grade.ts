/**
 * Grade a learner's answer against the target melody.
 *
 * Both sides are compared as WRITTEN pitches (what is on the page), because
 * that is what the learner produced. The learner's signs are read under the
 * key signature with the bar rules (notation/accidentals), so a plain F in G
 * major is F sharp and a courtesy sign is not a mistake. Spelling is strict:
 * E# for F is a mistake even though it sounds the same.
 *
 * Played answers (microphone) are graded on tone and count only: the pitch
 * heard is spelled the way the key would spell it, durations are not compared.
 */
import type { Melody } from '../melody/types';
import { splitIntoBars } from '../melody/bars';
import { beatsOf, type DurationId } from '../music/duration';
import { spellInKey, type Key } from '../music/key';
import { midiFromSpelled, spelledEquals, writtenFromSounding, type Midi, type SpelledNote } from '../music/pitch';
import { resolveAnswerBar, type AnswerNote } from '../notation/answer';
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
  /** 0..1. When timing is not graded this equals pitchScore. */
  rhythmScore: number;
  /** False for played answers: only tone and count are graded. */
  timingGraded: boolean;
  targetCount: number;
  answerCount: number;
  extraCount: number;
  missingCount: number;
}

function pitchCost(t: GradedTarget, a: GradedAnswer): number {
  if (spelledEquals(t.written, a.written)) return 0;
  if (t.midi === a.midi || t.written.letter === a.written.letter) return 0.3;
  return 0.9; // close to a gap, so a skipped note plus an added one is not read as a chain of wrong notes
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

/** The melody's notes as written, with their bar numbers. */
export function gradedTargets(melody: Melody, key: Key): GradedTarget[] {
  const targets: GradedTarget[] = [];
  splitIntoBars(melody.notes, melody.barBeats).forEach((bar, barIndex) => {
    for (const note of bar.notes) {
      const midi = writtenFromSounding(note.midi);
      targets.push({ index: targets.length, bar: barIndex, written: spellInKey(midi, key), midi, duration: note.duration });
    }
  });
  return targets;
}

/**
 * Align and grade two sequences. With `timing` off, durations never count and
 * answers with no bar of their own take the bar of the nearest target before them.
 */
export function gradeSequences(targets: GradedTarget[], answers: GradedAnswer[], timing: boolean): GradeResult {
  const cost = (t: GradedTarget, a: GradedAnswer) => pitchCost(t, a) + (timing && t.duration !== a.duration ? 0.4 : 0);
  const aligned = align(targets, answers, cost);
  const pairs: GradedPair[] = [];
  const mistakes: Mistake[] = [];
  let pitchCorrect = 0;
  let rhythmCorrect = 0;
  let extraCount = 0;
  let missingCount = 0;
  let lastTargetBar = 0;

  aligned.forEach((p, pairIndex) => {
    const target = p.target === null ? null : targets[p.target]!;
    const answer = p.answer === null ? null : answers[p.answer]!;
    if (target) lastTargetBar = target.bar;
    if (answer && !timing) answer.bar = target ? target.bar : lastTargetBar;
    const pair: GradedPair = { target, answer, pitchOk: false, durationOk: false, mistakes: [] };
    const add = (kind: MistakeKind) => {
      const mistake: Mistake = { kind, number: mistakes.length + 1, pairIndex };
      mistakes.push(mistake);
      pair.mistakes.push(mistake);
    };

    if (target && answer) {
      const kind = pitchMistake(target, answer);
      pair.pitchOk = kind === null;
      pair.durationOk = !timing || target.duration === answer.duration;
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
    rhythmScore: timing ? rhythmCorrect / denominator : pitchCorrect / denominator,
    timingGraded: timing,
    targetCount: targets.length,
    answerCount: answers.length,
    extraCount,
    missingCount,
  };
}

/** Grade notes the learner wrote on the staff, bar by bar. */
export function gradeAnswer(melody: Melody, answerBars: readonly (readonly AnswerNote[])[], key: Key): GradeResult {
  const answers: GradedAnswer[] = [];
  answerBars.forEach((bar, barIndex) => {
    const resolved = resolveAnswerBar(bar, key);
    bar.forEach((note, i) => {
      const written = resolved[i]!;
      answers.push({ index: answers.length, id: note.id, bar: barIndex, written, midi: midiFromSpelled(written), duration: note.duration });
    });
  });
  return gradeSequences(gradedTargets(melody, key), answers, true);
}

/** Grade notes the learner played (sounding MIDI, in order): tone and count only. */
export function gradePlayed(melody: Melody, playedMidis: readonly number[], key: Key): GradeResult {
  const answers: GradedAnswer[] = playedMidis.map((sounding, index) => {
    const midi = writtenFromSounding(sounding);
    return { index, id: index + 1, bar: 0, written: spellInKey(midi, key), midi, duration: 'q' };
  });
  return gradeSequences(gradedTargets(melody, key), answers, false);
}

/** Beats of a duration, exposed for explanations. */
export function durationBeats(d: DurationId): number {
  return beatsOf(d);
}
