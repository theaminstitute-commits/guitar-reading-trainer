import { describe, expect, it } from 'vitest';
import { midiAt } from '../music/fretboard';
import { BASS } from '../music/instrument';
import { midiFromSpelled, parseSpelled, staffStep, writtenFromSounding } from '../music/pitch';
import { createRng } from '../melody/random';
import { BASS_STAGES } from '../melody/stages';
import { BASS_PART_0, BASS_STAGE_LESSONS, bassOpenStringQuestions } from './bassLessons';
import { lessonForStage, part0For, stageLessonsFor } from './lessons';
import { BASS_TIERS, placementFor, placementStage } from './placement';
import type { Question } from './questions';

const SEEDS = [1, 2, 3, 17, 99, 1234];
const inRange = (step: number) => step >= BASS.inputRange[0] && step <= BASS.inputRange[1];

/** The written notes a question shows or asks for. */
function notesOf(q: Question): number[] {
  switch (q.kind) {
    case 'name':
      return q.notes.map((n) => staffStep(n));
    case 'place':
      return [staffStep(q.target)];
    case 'staff-to-fret':
      return [staffStep(q.note)];
    case 'fret-to-staff':
      return [staffStep(q.target)];
    default:
      return [];
  }
}

describe('the bass tutorial (R41)', () => {
  it('is its own course, with bass ids, the same four lessons and no chord lesson', () => {
    expect(part0For('bass')).toBe(BASS_PART_0);
    expect(stageLessonsFor('bass')).toBe(BASS_STAGE_LESSONS);
    expect(BASS_PART_0.map((l) => l.title)).toEqual(['1. The staff', '2. Notes on the bass', '3. Beat and rhythm', '4. Your first melody']);
    for (const l of [...BASS_PART_0, ...BASS_STAGE_LESSONS]) expect(l.id.startsWith('bass-')).toBe(true);
    expect(BASS_STAGE_LESSONS.map((l) => l.stage)).toEqual([3, 5, 6, 7, 12, 14]);
    expect(lessonForStage(18, 'bass')).toBeUndefined();
    expect(lessonForStage(6, 'bass')?.id).toBe('bass-stage-6');
    expect(lessonForStage(6)?.id).toBe('stage-6');
  });

  it('keeps every example and drill note within the bass staff the app can write', () => {
    for (const lesson of [...BASS_PART_0, ...BASS_STAGE_LESSONS]) {
      for (const step of lesson.steps) {
        if (step.kind === 'explain') for (const n of step.staff?.notes ?? []) expect(inRange(staffStep(parseSpelled(n.name))), `${lesson.id}: ${n.name}`).toBe(true);
        if (step.kind === 'drill')
          for (const seed of SEEDS) for (const q of step.make(createRng(seed))) for (const s of notesOf(q)) expect(inRange(s), `${lesson.id}: ${step.title}`).toBe(true);
      }
    }
  });

  it('places every fretboard answer and dot where the bass plays that written note', () => {
    for (const lesson of [...BASS_PART_0, ...BASS_STAGE_LESSONS]) {
      for (const step of lesson.steps) {
        if (step.kind !== 'drill') continue;
        for (const seed of SEEDS)
          for (const q of step.make(createRng(seed))) {
            if (q.kind === 'staff-to-fret') for (const a of q.answers) expect(writtenFromSounding(midiAt(a, BASS.tuning))).toBe(midiFromSpelled(q.note));
            if (q.kind === 'fret-to-staff') expect(writtenFromSounding(midiAt(q.position, BASS.tuning))).toBe(midiFromSpelled(q.target));
          }
      }
    }
    // The example fretboards: each dot sounds its staff note.
    for (const lesson of [...BASS_PART_0, ...BASS_STAGE_LESSONS]) {
      for (const step of lesson.steps) {
        if (step.kind !== 'explain' || !step.fretboard || !step.staff) continue;
        step.fretboard.dots.forEach((d, i) => {
          const note = step.staff!.notes[i];
          if (note) expect(writtenFromSounding(midiAt(d, BASS.tuning)), `${lesson.id}: ${step.title} dot ${i}`).toBe(midiFromSpelled(parseSpelled(note.name)));
        });
      }
    }
  });

  it('asks for the four open strings, never the same twice in a row', () => {
    const qs = bassOpenStringQuestions(createRng(5), 12);
    for (const [i, q] of qs.entries()) {
      const string = q.answers[0]!.string;
      expect(string).toBeGreaterThanOrEqual(1);
      expect(string).toBeLessThanOrEqual(4);
      expect(writtenFromSounding(BASS.tuning[string]!)).toBe(midiFromSpelled(q.note));
      if (i > 0) expect(string).not.toBe(qs[i - 1]!.answers[0]!.string);
    }
  });
});

describe('the bass placement test (R41)', () => {
  it('places within the bass ladder, at stage 17 when every tier is passed', () => {
    const { tiers, top } = placementFor('bass');
    expect(tiers).toBe(BASS_TIERS);
    expect(top).toBe(BASS_STAGES.length);
    expect(placementStage(tiers.map(() => true), tiers, top)).toBe(17);
    expect(placementStage([true, true, false], tiers, top)).toBe(5);
  });

  it('asks only notes on or around the bass staff', () => {
    for (const tier of BASS_TIERS) for (const seed of SEEDS) for (const q of tier.make(createRng(seed))) for (const s of notesOf(q)) expect(inRange(s), tier.id).toBe(true);
  });
});
