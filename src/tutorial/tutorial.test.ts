import { describe, expect, it } from 'vitest';
import { generateMelody } from '../melody/generator';
import { createRng } from '../melody/random';
import { STAGES } from '../melody/stages';
import { gradedTargets } from '../grading/grade';
import { midiAt } from '../music/fretboard';
import { C_MAJOR, keyFromId } from '../music/key';
import { midiFromSpelled, parseSpelled, staffStep, writtenFromSounding } from '../music/pitch';
import type { AnswerNote } from '../notation/answer';
import { coachVerdict, isRightPitch } from './coach';
import { ALL_LESSONS, lessonForStage, openStringQuestions, PART_0, playedAsWritten, stage1Range, STAGE_LESSONS, writtenBars } from './lessons';
import { placementStage, QUESTIONS_PER_TIER, TIERS, tierQuestions, TOP_STAGE } from './placement';
import { choiceNote, isRightFret, keyAccidental, nameNotes, naturalsBetween, positionsOf, randomBar, rhythms, signatureNotes, staffToFret } from './questions';
import { gradeTaps, tapPassed } from './tap';
import { beatsOf } from '../music/duration';

const SEEDS = [1, 2, 3, 7, 11, 42, 99, 123];

describe('lesson content', () => {
  it('a fretboard tap counts wherever it sounds the written note', () => {
    const q = staffToFret(C_MAJOR, [1, 2, 3, 4], [0, 3], 1, createRng(1))[0]!;
    const b4 = { ...q, note: parseSpelled('B4'), answers: [{ string: 2, fret: 0 }] };
    expect(isRightFret(b4, { string: 2, fret: 0 })).toBe(true);
    expect(isRightFret(b4, { string: 3, fret: 4 })).toBe(true);
    expect(isRightFret(b4, { string: 3, fret: 3 })).toBe(false);
    expect(isRightFret(b4, { string: 5, fret: 2 })).toBe(false);
  });

  it('open-string questions: the written note is the open string to tap', () => {
    for (const seed of SEEDS) {
      for (const q of openStringQuestions(createRng(seed), 5)) {
        expect(q.openOnly).toBe(true);
        expect(q.answers).toHaveLength(1);
        expect(q.answers[0]!.fret).toBe(0);
        expect(midiFromSpelled(q.note)).toBe(writtenFromSounding(midiAt(q.answers[0]!)));
      }
    }
  });

  it('always asks the D below and the G above the staff in the stage 1 range drill', () => {
    for (const seed of SEEDS) {
      const asked = stage1Range(createRng(seed)).map((q) => `${q.notes[0]!.letter}${q.notes[0]!.octave}`);
      expect(asked).toHaveLength(6);
      expect(asked).toContain('D4');
      expect(asked).toContain('G5');
    }
  });

  it('has the four Part 0 lessons and a lesson before stages 3, 5, 6, 7, 12, 14 and 18', () => {
    expect(PART_0.map((l) => l.id)).toEqual(['staff', 'octave', 'rhythm', 'first-melody']);
    expect(PART_0.map((l) => l.title)).toEqual(['1. The staff', '2. Notes on the guitar', '3. Beat and rhythm', '4. Your first melody']);
    expect(STAGE_LESSONS.map((l) => l.stage)).toEqual([3, 5, 6, 7, 12, 14, 18]);
    expect(lessonForStage(6)!.id).toBe('stage-6');
    expect(lessonForStage(4)).toBeUndefined();
    expect(new Set(ALL_LESSONS.map((l) => l.id)).size).toBe(ALL_LESSONS.length);
  });

  it('every drill makes well-formed questions for any seed', () => {
    for (const lesson of ALL_LESSONS) {
      for (const step of lesson.steps) {
        if (step.kind !== 'drill') continue;
        for (const seed of SEEDS) {
          const qs = step.make(createRng(seed));
          expect(qs.length, `${lesson.id} ${step.title}`).toBeGreaterThan(0);
          for (const q of qs) {
            if (q.kind === 'name') {
              expect(q.choices, `${lesson.id} ${step.title}`).toContain(q.answer);
              expect(new Set(q.choices).size).toBe(q.choices.length);
              expect(q.choices.length).toBeGreaterThanOrEqual(2);
            }
            if (q.kind === 'staff-to-fret') {
              expect(q.answers.length).toBeGreaterThan(0);
              for (const a of q.answers) expect(writtenFromSounding(midiAt(a))).toBe(writtenFromSounding(midiAt(q.answers[0]!)));
            }
            if (q.kind === 'rhythm') {
              expect(q.options.length).toBeGreaterThanOrEqual(2);
              for (const bar of q.options) expect(bar.reduce((s, d) => s + beatsOf(d), 0)).toBe(4);
              expect(new Set(q.options.map((o) => o.join())).size).toBe(q.options.length);
            }
          }
        }
      }
    }
  });
});

describe('questions', () => {
  it('spells notes the way the key signature does', () => {
    expect(keyAccidental(parseSpelled('F5'), keyFromId('G')!).accidental).toBe(1);
    expect(keyAccidental(parseSpelled('B4'), keyFromId('F')!).accidental).toBe(-1);
    expect(keyAccidental(parseSpelled('E4'), C_MAJOR).accidental).toBe(0);
  });

  it('asks signature questions only about notes the signature alters', () => {
    const qs = signatureNotes([keyFromId('D')!], naturalsBetween('D4', 'G5'), 20, createRng(5));
    for (const q of qs) {
      expect(q.answer).toMatch(/♯$/);
      expect(q.choices).toContain(q.answer.replace('♯', ''));
    }
  });

  it('names notes with letter choices one or two steps away', () => {
    const [q] = nameNotes([parseSpelled('G4')], 1, createRng(3));
    expect(q!.answer).toBe('G');
    for (const c of q!.choices) expect(['E', 'F', 'G', 'A', 'B']).toContain(c);
  });

  it('finds every fret position of a written note', () => {
    expect(positionsOf(parseSpelled('E5'), [1, 2, 3, 4, 5, 6], [0, 12])).toEqual([
      { string: 1, fret: 0 },
      { string: 2, fret: 5 },
      { string: 3, fret: 9 },
    ]);
    const qs = staffToFret(C_MAJOR, [1, 2, 3, 4], [0, 3], 10, createRng(9));
    for (const q of qs) expect(q.answers.every((a) => a.fret <= 3 && a.string <= 4)).toBe(true);
  });

  it('fills bars to four beats with eighths in pairs', () => {
    for (const seed of SEEDS) {
      const bar = randomBar(['q', 'h', 'e', 'q.'], createRng(seed));
      expect(bar.reduce((s, d) => s + beatsOf(d), 0)).toBe(4);
    }
    expect(rhythms(['q', 'h'], 3, createRng(1))).toHaveLength(3);
  });
});

describe('tap-along grading', () => {
  const clicks = Array.from({ length: 8 }, (_, i) => 10 + i * (60 / 72));
  it('counts taps near clicks, each tap once', () => {
    const r = gradeTaps(clicks, clicks.map((c) => c + 0.05));
    expect(r.hits).toBe(8);
    expect(r.meanOffsetMs).toBe(50);
    expect(tapPassed(r)).toBe(true);
    expect(gradeTaps(clicks, [clicks[0]!, clicks[0]! + 0.01]).hits).toBe(1);
  });
  it('fails when taps drift away or are missing', () => {
    expect(tapPassed(gradeTaps(clicks, clicks.slice(0, 5)))).toBe(false);
    expect(gradeTaps(clicks, clicks.map((c) => c + 0.3)).hits).toBe(0);
  });
});

describe('placement test', () => {
  it('places at the stage of the first tier failed, or at the chords when everything passes', () => {
    expect(placementStage([false])).toBe(1);
    expect(placementStage([true, false])).toBe(3);
    expect(placementStage([true, true, true, false])).toBe(6);
    expect(placementStage(TIERS.map(() => true))).toBe(TOP_STAGE);
    expect(STAGES[TOP_STAGE - 1]!.chords).toBeDefined();
  });
  it('gives four answerable questions per tier, the same for the same seed', () => {
    for (const tier of TIERS) {
      const a = tierQuestions(tier, 77);
      expect(a).toHaveLength(QUESTIONS_PER_TIER);
      expect(JSON.stringify(tierQuestions(tier, 77))).toBe(JSON.stringify(a));
      for (const q of a) if (q.kind === 'name') expect(q.choices).toContain(q.answer);
    }
  });
  it('places tiers at stages that teach them', () => {
    for (const tier of TIERS) expect(STAGES[tier.failStage - 1]).toBeDefined();
  });
});

describe('the coach', () => {
  const melody = generateMelody(STAGES[0]!, 5);
  const targets = gradedTargets(melody, melody.key);
  const note = (id: number, i: number, shift = 0): AnswerNote => ({ id, step: staffStep(targets[i]!.written) + shift, sign: 'none', duration: targets[i]!.duration });

  it('says right for a right note and flags a wrong one, naming it after two wrong tries', () => {
    expect(coachVerdict(melody, [[note(1, 0)]], 1, 0, 2)!.tone).toBe('good');
    expect(isRightPitch(melody, [[note(1, 0, 1)]], 1)).toBe(false);
    expect(coachVerdict(melody, [[note(1, 0, 1)]], 1, 1, 2)!.tone).toBe('try');
    const reveal = coachVerdict(melody, [[note(1, 0, 1)]], 1, 2, 2)!;
    expect(reveal.tone).toBe('reveal');
    expect(reveal.text).toContain(`${targets[0]!.written.letter}`);
  });

  it('spots a right note with the wrong length and a note past the end', () => {
    const wrongLength: AnswerNote = { ...note(1, 0), duration: targets[0]!.duration === 'q' ? 'h' : 'q' };
    expect(coachVerdict(melody, [[wrongLength]], 1, 0, 2)!.text).toContain('wrong length');
    const all = targets.map((_, i) => note(i + 1, i));
    const extra: AnswerNote = { id: 99, step: all[0]!.step, sign: 'none', duration: 'q' };
    expect(coachVerdict(melody, [[...all, extra]], 99, 0, 2)!.tone).toBe('extra');
  });
});

describe('lesson examples', () => {
  it('sound each note for exactly the length the staff shows, rests only after the last note', () => {
    for (const lesson of ALL_LESSONS) {
      for (const step of lesson.steps) {
        if (step.kind !== 'explain' || !step.staff || !step.play) continue;
        const written = writtenBars(step).flat();
        const lastNote = written.map((n) => !n.rest).lastIndexOf(true);
        expect(written.slice(0, lastNote).every((n) => !n.rest), `${lesson.id}: ${step.title}`).toBe(true);
        const played = playedAsWritten(step);
        const lengthOf = new Map(written.filter((n) => !n.rest).map((n) => [n.index, n.duration] as const));
        expect(played.map((p) => p.duration), `${lesson.id}: ${step.title}`).toEqual(played.map((_, i) => lengthOf.get(step.play!.staffIndex?.[i] ?? i)));
      }
    }
    // The alphabet: nine notes, the last written and played as a whole note.
    const alphabet = PART_0[0]!.steps.find((s) => s.kind === 'explain' && s.title === 'The letters run up the alphabet')!;
    expect(alphabet.kind === 'explain' && playedAsWritten(alphabet).map((p) => p.duration).join(' ')).toBe('q q q q q q q q w');
  });

  it('play exactly the notes they show, in order, so each one can light up as it sounds', () => {
    for (const lesson of ALL_LESSONS) {
      for (const step of lesson.steps) {
        if (step.kind !== 'explain' || !step.staff || !step.play) continue;
        const shown = step.staff.notes.map((n) => midiFromSpelled(parseSpelled(n.name)) - 12);
        const expected = step.play.staffIndex ? step.play.staffIndex.map((i) => shown[i]) : shown;
        expect(step.play.notes.map((p) => p.midi), `${lesson.id}: ${step.title}`).toEqual(expected);
      }
    }
  });

  it('never need a sign the lesson did not ask for: every example note agrees with its key signature', async () => {
    const { displaySignsForBars } = await import('../notation/accidentals');
    for (const lesson of ALL_LESSONS) {
      for (const step of lesson.steps) {
        if (step.kind !== 'explain' || !step.staff) continue;
        const key = step.staff.key ?? C_MAJOR;
        const notes = step.staff.notes.filter((n) => !n.sign).map((n) => parseSpelled(n.name));
        const signs = displaySignsForBars([notes], key)[0]!;
        expect(signs.every((s) => s === 'none'), `${lesson.id}: ${step.title}`).toBe(true);
      }
    }
  });
});

describe('a picked letter sounds where it would sit (R33)', () => {
  const near = (choice: string, shown: string) => {
    const n = choiceNote(choice, parseSpelled(shown));
    return n ? `${n.letter}${['b', '', '#'][n.accidental + 1]}${n.octave}` : null;
  };
  it('puts the letter on the line or space nearest the shown note', () => {
    expect(near('G', 'G5')).toBe('G5');
    expect(near('D', 'G5')).toBe('D5');
    expect(near('E', 'G5')).toBe('E5');
    expect(near('C', 'G5')).toBe('C6');
    expect(near('B', 'C5')).toBe('B4');
    expect(near('D', 'C5')).toBe('D5');
  });
  it('keeps the sign the choice names, and a natural sign means natural', () => {
    expect(near('F♯', 'F#4')).toBe('F#4');
    expect(near('F', 'F#4')).toBe('F4');
    expect(near('B♭', 'B4')).toBe('Bb4');
    expect(near('B♮', 'Bb4')).toBe('B4');
  });
  it('stays silent for a choice that is not a note name', () => {
    expect(near('C major', 'C4')).toBeNull();
  });
});
