/**
 * The coach on beginner melodies (the coached lesson, and stages 1 and 2 with
 * hints on): every note is checked against the melody as it is written. A
 * wrong note is flagged at once; after a set number of wrong tries at the same
 * note the coach names it and says where it sits on the staff.
 */
import { describeStaffPosition } from '../grading/explain';
import { gradedTargets } from '../grading/grade';
import type { Melody } from '../melody/types';
import { DURATIONS } from '../music/duration';
import { spelledEquals, spelledName, type SpelledNote } from '../music/pitch';
import { resolveAnswerBar, type AnswerNote } from '../notation/answer';

export interface CoachVerdict {
  tone: 'good' | 'try' | 'reveal' | 'extra';
  text: string;
}

const name = (n: SpelledNote) => `${spelledName(n)}${n.octave}`;

/** Where note `id` sits in the answer, counted across bars from the first note. */
function indexOf(bars: readonly (readonly AnswerNote[])[], id: number): number {
  return bars.flat().findIndex((n) => n.id === id);
}

/**
 * The coach's word on note `id` of the answer. `wrongTries` is how many times
 * the learner has already got this note wrong, including this one when it is wrong.
 */
export function coachVerdict(melody: Melody, bars: readonly (readonly AnswerNote[])[], id: number, wrongTries: number, revealAfter: number): CoachVerdict | null {
  const index = indexOf(bars, id);
  if (index < 0) return null;
  const targets = gradedTargets(melody, melody.key);
  const target = targets[index];
  if (!target) return { tone: 'extra', text: `The melody has only ${targets.length} notes. Delete this one.` };
  const resolved = bars.flatMap((bar) => resolveAnswerBar(bar, melody.key));
  const written = resolved[index]!;
  const note = bars.flat()[index]!;
  const pitchOk = spelledEquals(written, target.written);
  const lengthOk = note.duration === target.duration;
  if (pitchOk && lengthOk) return { tone: 'good', text: `Right: ${name(written)}.` };
  if (pitchOk) {
    return {
      tone: 'try',
      text: `Right note, wrong length: this ${name(written)} is a ${DURATIONS[target.duration].label.toLowerCase()}. Tap it and pick the length.`,
    };
  }
  if (wrongTries >= revealAfter) {
    return { tone: 'reveal', text: `This note is ${name(target.written)}, ${describeStaffPosition(target.written)}. Tap your note and move it with the arrows.` };
  }
  return { tone: 'try', text: `Not quite: that is ${name(written)}. Listen again and try another line or space.` };
}

/** Whether note `id` has the right pitch, for counting wrong tries. */
export function isRightPitch(melody: Melody, bars: readonly (readonly AnswerNote[])[], id: number): boolean | null {
  const index = indexOf(bars, id);
  const target = gradedTargets(melody, melody.key)[index];
  if (index < 0 || !target) return null;
  return spelledEquals(bars.flatMap((bar) => resolveAnswerBar(bar, melody.key))[index]!, target.written);
}
