/**
 * Tutorial lessons (R24, R27): Part 0 before stage 1 for complete beginners, and
 * a short lesson before each stage that brings something new. One idea per
 * screen; every idea is followed by something to do. Practice here never
 * counts towards the ladder.
 */
import type { PlayableNote } from '../audio/player';
import type { DurationId } from '../music/duration';
import type { FretPosition } from '../music/fretboard';
import { C_MAJOR, keyFromId, type Key } from '../music/key';
import { midiFromSpelled, parseSpelled, soundingFromWritten, type SpelledNote } from '../music/pitch';
import type { Rng } from '../melody/random';
import { measure } from '../notation/measure';
import {
  fretToStaff,
  nameNotes,
  naturalsBetween,
  placeNotes,
  rhythms,
  signatureNotes,
  shuffle,
  staffToFret,
  tapAlong,
  type NameQuestion,
  type Question,
} from './questions';

/** A note to draw on an example staff: a written name such as 'F#5', with an optional label underneath. */
export interface ExampleNote {
  name: string;
  label?: string;
  duration?: DurationId;
  /** Notes with the same chord number are stacked. */
  chord?: number;
  /** Draw the sign even where the key would not need it. */
  sign?: 'sharp' | 'flat' | 'natural';
}

export interface ExplainStep {
  kind: 'explain';
  title: string;
  body: string[];
  /** `legend`: name every line and space in a column of letters before the clef (lines and spaces in two colours). */
  staff?: { notes: ExampleNote[]; key?: Key; timeSignature?: boolean; legend?: boolean };
  fretboard?: { frets: readonly [number, number]; dots: FretPosition[]; labels?: string[] };
  /** "Hear it": notes played in order (sounding pitch), with an optional tempo. */
  play?: { notes: PlayableNote[]; tempo?: number };
}

export interface DrillStep {
  kind: 'drill';
  title: string;
  intro: string;
  make: (rng: Rng) => Question[];
}

/** Lesson 5: a stage 1 melody with the coach on and unlimited listens. */
export interface CoachedStep {
  kind: 'coached';
  title: string;
  intro: string;
}

export type LessonStep = ExplainStep | DrillStep | CoachedStep;

export interface Lesson {
  id: string;
  title: string;
  summary: string;
  steps: LessonStep[];
  /** For stage lessons: the stage it comes before. */
  stage?: number;
}

/** Lesson examples play slowly, so each note can be found on the staff as it lights up. */
export const LESSON_TEMPO = 54;

const n = (name: string, label?: string, duration: DurationId = 'q'): ExampleNote => ({ name, label, duration });
const sounding = (name: string, duration: DurationId = 'q'): PlayableNote => ({ midi: soundingFromWritten(midiFromSpelled(parseSpelled(name))), duration });
const at = (string: number, fret: number): FretPosition => ({ string, fret });

const STAGE1 = naturalsBetween('D4', 'G5');
const STAFF_ONLY = naturalsBetween('E4', 'F5');
const FIRST_FOUR = [1, 2, 3, 4];
const K = (id: string) => keyFromId(id)!;

/** A random-ish C-major note on the staff, used where a step only needs one. */
export function exampleNote(text: string): SpelledNote {
  return parseSpelled(text);
}

export const PART_0: readonly Lesson[] = [
  {
    id: 'staff',
    title: '1. The staff',
    summary: 'Lines, spaces and the letters they stand for.',
    steps: [
      {
        kind: 'explain',
        title: 'Five lines, four spaces',
        body: [
          'Music is written on a staff: five lines with four spaces between them. A note sits either on a line (the line runs through it) or in a space (between two lines).',
          'The higher a note sits, the higher it sounds. The curly sign at the start is the treble clef. Guitar music always uses it.',
        ],
        staff: { notes: [n('E4', 'line', 'w'), n('F4', 'space', 'w'), n('G4', 'line', 'w'), n('A4', 'space', 'w')] },
        play: { notes: [sounding('E4'), sounding('F4'), sounding('G4'), sounding('A4')] },
      },
      {
        kind: 'explain',
        title: 'The letters run up the alphabet',
        body: [
          'Each line and space is a letter. Going up one line or space goes up one letter: E F G A B C D E F. After G the letters start again at A.',
          'The lines from the bottom are E G B D F: "Every Good Boy Deserves Fruit". The spaces spell F A C E. Before the clef the line letters are in violet and the space letters in pink.',
        ],
        staff: { notes: STAFF_ONLY.map((s) => n(`${s.letter}${s.octave}`)), legend: true },
        play: { notes: STAFF_ONLY.map((s) => sounding(`${s.letter}${s.octave}`)) },
      },
      { kind: 'drill', title: 'Name the note', intro: 'A note appears on the staff. Pick its letter.', make: (rng) => nameNotes(STAFF_ONLY, 6, rng) },
      { kind: 'drill', title: 'Find the line or space', intro: 'Now the other way: tap where the note belongs.', make: (rng) => placeNotes(STAFF_ONLY, 4, rng) },
      {
        kind: 'explain',
        title: 'Just above and below',
        body: [
          'The staff carries on one step past its lines. The space just below the bottom line is D, and the space just above the top line is G.',
          'Stage 1 reads from that D up to that G, which is everything you need for the first melodies.',
        ],
        staff: { notes: [n('D4', 'D', 'w'), n('G5', 'G', 'w')] },
      },
      { kind: 'drill', title: 'The whole stage 1 range', intro: 'Name these, including the D below and the G above the staff.', make: (rng) => nameNotes(STAGE1, 5, rng) },
    ],
  },
  {
    id: 'octave',
    title: '2. The guitar octave',
    summary: 'Guitar music is written an octave higher than it sounds.',
    steps: [
      {
        kind: 'explain',
        title: 'Written higher than it sounds',
        body: [
          'Guitar is written one octave (eight letters) higher than it sounds, so its notes fit on the treble staff instead of far below it. Every guitarist reads this way, and the app always does.',
          'You never have to work this out: the written note is simply the one you read and play. It only matters when you compare with a piano, which is written where it sounds.',
        ],
        staff: { notes: [n('E5', 'written E5', 'w')] },
        play: { notes: [sounding('E5', 'h')] },
      },
      {
        kind: 'explain',
        title: 'The six open strings on the staff',
        body: [
          'Here are the open strings, from the thickest (6th, low E) to the thinnest (1st, high E). The low three need short extra lines under the staff, called ledger lines; you meet those at stage 6.',
          'Stage 1 uses the four thinnest strings: D, G, B and the high E.',
        ],
        staff: { notes: [n('E3', 'E 6th', 'w'), n('A3', 'A 5th', 'w'), n('D4', 'D 4th', 'w'), n('G4', 'G 3rd', 'w'), n('B4', 'B 2nd', 'w'), n('E5', 'E 1st', 'w')] },
        fretboard: { frets: [0, 4], dots: [at(6, 0), at(5, 0), at(4, 0), at(3, 0), at(2, 0), at(1, 0)], labels: ['E', 'A', 'D', 'G', 'B', 'E'] },
        play: { notes: ['E3', 'A3', 'D4', 'G4', 'B4', 'E5'].map((x) => sounding(x)) },
      },
      {
        kind: 'drill',
        title: 'Which open string?',
        intro: 'An open string is written on the staff. Which one is it?',
        make: (rng) => openStringQuestions(rng, 5),
      },
    ],
  },
  {
    id: 'neck',
    title: '3. Notes on the neck',
    summary: 'Strings 1 to 4, frets 0 to 3: the notes of stage 1.',
    steps: [
      {
        kind: 'explain',
        title: 'Each fret is one step up',
        body: [
          'Pressing a string behind a fret raises it. Fret 0 is the open string. In first position your first finger plays fret 1, the second finger fret 2 and the third finger fret 3.',
          'On the 2nd string: open is B, fret 1 is C, fret 3 is D. On the 1st string: open is E, fret 1 is F, fret 3 is G.',
        ],
        staff: { notes: [n('B4', 'B open', 'h'), n('C5', 'C fr 1', 'h'), n('D5', 'D fr 3', 'h'), n('E5', 'E open', 'h'), n('F5', 'F fr 1', 'h'), n('G5', 'G fr 3', 'h')] },
        fretboard: { frets: [0, 3], dots: [at(2, 0), at(2, 1), at(2, 3), at(1, 0), at(1, 1), at(1, 3)], labels: ['B', 'C', 'D', 'E', 'F', 'G'] },
        play: { notes: ['B4', 'C5', 'D5', 'E5', 'F5', 'G5'].map((x) => sounding(x)) },
      },
      {
        kind: 'explain',
        title: 'The 3rd and 4th strings',
        body: ['On the 3rd string: open is G, fret 2 is A. On the 4th string: open is D, fret 2 is E, fret 3 is F. Together that is every note from D below the staff to G above it.'],
        staff: { notes: [n('D4', 'D open', 'h'), n('E4', 'E fr 2', 'h'), n('F4', 'F fr 3', 'h'), n('G4', 'G open', 'h'), n('A4', 'A fr 2', 'h')] },
        fretboard: { frets: [0, 3], dots: [at(4, 0), at(4, 2), at(4, 3), at(3, 0), at(3, 2)], labels: ['D', 'E', 'F', 'G', 'A'] },
        play: { notes: ['D4', 'E4', 'F4', 'G4', 'A4'].map((x) => sounding(x)) },
      },
      { kind: 'drill', title: 'Staff to fretboard', intro: 'A note is on the staff. Tap where you play it.', make: (rng) => staffToFret(C_MAJOR, FIRST_FOUR, [0, 3], 5, rng) },
      { kind: 'drill', title: 'Fretboard to staff', intro: 'A fret lights up. Tap where its note is written.', make: (rng) => fretToStaff(C_MAJOR, FIRST_FOUR, [0, 3], 4, rng) },
    ],
  },
  {
    id: 'rhythm',
    title: '4. Beat and rhythm',
    summary: 'Counting, bars, 4/4, quarter and half notes.',
    steps: [
      {
        kind: 'explain',
        title: 'The beat and the bar',
        body: [
          'Music moves on a steady beat, like a clock ticking. Beats are grouped into bars, separated by bar lines. The 4/4 at the start means four beats in every bar: count 1 2 3 4, 1 2 3 4.',
          'Before every melody the app clicks four times to count you in. That is one empty bar of 4/4.',
        ],
        staff: { notes: [n('B4', '1'), n('B4', '2'), n('B4', '3'), n('B4', '4')], timeSignature: true },
        play: { notes: [sounding('B4'), sounding('B4'), sounding('B4'), sounding('B4')] },
      },
      {
        kind: 'explain',
        title: 'Quarter notes and half notes',
        body: [
          'A quarter note (filled head with a stem) lasts one beat. A half note (hollow head with a stem) lasts two beats. A whole note (hollow, no stem) lasts all four.',
          'So a bar of 4/4 can be four quarters, two halves, or a mix such as half, quarter, quarter. The notes of a bar always add up to four beats.',
        ],
        staff: { notes: [n('B4', '1 2', 'h'), n('B4', '3'), n('B4', '4')], timeSignature: true },
        play: { notes: [sounding('B4', 'h'), sounding('B4'), sounding('B4')] },
      },
      { kind: 'drill', title: 'Which rhythm?', intro: 'One bar is played on a single note. Pick the bar you heard.', make: (rng) => rhythms(['q', 'h'], 4, rng) },
      { kind: 'drill', title: 'Tap along', intro: 'Feel the beat. Tap on every click after the count-in.', make: () => [tapAlong(72, 8)] },
    ],
  },
  {
    id: 'first-melody',
    title: '5. Your first melody',
    summary: 'A stage 1 melody, with a coach checking every note.',
    steps: [
      {
        kind: 'explain',
        title: 'How an exercise works',
        body: [
          'Tap Play. After the count-in the melody plays and each note lights up on the fretboard.',
          'Write it on the staff: pick a length (quarter or half), then tap the line or space. The dashed box shows where the next note goes. Tap a note to select it; the arrows move it, Delete removes it, Undo steps back.',
          'When the bar is full, tap Check my answer. Here a coach tells you at once if a note is wrong, and after two wrong tries names it for you. You can listen as often as you like.',
        ],
      },
      { kind: 'coached', title: 'Write the melody', intro: 'Play, watch, write. The coach helps with every note.' },
    ],
  },
];

/** "Which open string is this?" */
function openStringQuestions(rng: Rng, count: number): NameQuestion[] {
  const strings: [string, string][] = [
    ['E3', '6th (low E)'],
    ['A3', '5th (A)'],
    ['D4', '4th (D)'],
    ['G4', '3rd (G)'],
    ['B4', '2nd (B)'],
    ['E5', '1st (high E)'],
  ];
  const out: NameQuestion[] = [];
  for (let i = 0; i < count; i++) {
    const [note, answer] = rng.pick(strings);
    const others = shuffle(
      strings.map((s) => s[1]).filter((s) => s !== answer),
      rng,
    ).slice(0, 3);
    out.push({ kind: 'name', prompt: 'Which open string is this?', key: C_MAJOR, notes: [parseSpelled(note)], choices: shuffle([answer, ...others], rng), answer });
  }
  return out;
}

/** Short lessons before the stages that bring something new; each runs before that stage's guide page. */
export const STAGE_LESSONS: readonly Lesson[] = [
  {
    id: 'stage-3',
    stage: 3,
    title: 'Sharps, flats and key signatures',
    summary: 'Before stage 3.',
    steps: [
      {
        kind: 'explain',
        title: 'Sharps and flats',
        body: [
          'A sharp (♯) raises a note by one fret, a flat (♭) lowers it by one fret. F♯ is played one fret above F; B♭ one fret below B.',
          'Signs can sit at the very start of the line, after the clef. That is the key signature, and it applies to every note of that letter for the whole melody. In G major there is a sharp on the F line, so every F you see is played as F♯, with no sign in front of it.',
        ],
        staff: { key: K('G'), notes: [n('D5', 'D'), n('E5', 'E'), n('F#5', 'F♯'), n('G5', 'G')] },
        play: { notes: ['D5', 'E5', 'F#5', 'G5'].map((x) => sounding(x)) },
      },
      {
        kind: 'explain',
        title: 'F major: one flat',
        body: ['F major has one flat, on the B line: every B is B♭. Stage 3 picks G major or F major at random, so look at the key signature before each melody.'],
        staff: { key: K('F'), notes: [n('A4', 'A'), n('Bb4', 'B♭'), n('C5', 'C'), n('F5', 'F')] },
        play: { notes: ['A4', 'Bb4', 'C5', 'F5'].map((x) => sounding(x)) },
      },
      { kind: 'drill', title: 'Read the signature', intro: 'What is the note, once the key signature is applied?', make: (rng) => signatureNotes([K('G'), K('F')], STAGE1, 5, rng) },
    ],
  },
  {
    id: 'stage-5',
    stage: 5,
    title: 'Eighth notes',
    summary: 'Before stage 5.',
    steps: [
      {
        kind: 'explain',
        title: 'Two notes in one beat',
        body: [
          'An eighth note lasts half a beat. Two eighths share one beat and are joined by a beam. Count them "1 and", "2 and": the first eighth on the number, the second on the "and".',
        ],
        staff: { notes: [n('B4', '1', 'e'), n('B4', '&', 'e'), n('B4', '2'), n('B4', '3', 'e'), n('B4', '&', 'e'), n('B4', '4')], timeSignature: true },
        play: { notes: [sounding('B4', 'e'), sounding('B4', 'e'), sounding('B4'), sounding('B4', 'e'), sounding('B4', 'e'), sounding('B4')] },
      },
      { kind: 'drill', title: 'Which rhythm?', intro: 'Pick the bar you heard.', make: (rng) => rhythms(['q', 'h', 'e'], 4, rng) },
    ],
  },
  {
    id: 'stage-6',
    stage: 6,
    title: 'Ledger lines and the low strings',
    summary: 'Before stage 6.',
    steps: [
      {
        kind: 'explain',
        title: 'Below the staff',
        body: [
          'Notes lower than D need ledger lines: short lines added under the staff, spaced like the staff lines. The letters keep counting down: the first ledger line is C, the space under it B, the second line A, then G, F, and the third line is the open low E.',
          'From stage 6 all six strings are used, so these notes come up in every melody.',
        ],
        staff: { notes: [n('C4', 'C', 'w'), n('A3', 'A', 'w'), n('F3', 'F', 'w'), n('E3', 'E', 'w')] },
        fretboard: { frets: [0, 4], dots: [at(5, 3), at(5, 0), at(6, 1), at(6, 0)], labels: ['C', 'A', 'F', 'E'] },
        play: { notes: ['C4', 'A3', 'F3', 'E3'].map((x) => sounding(x)) },
      },
      { kind: 'drill', title: 'Name the low notes', intro: 'Count the ledger lines from the staff downwards.', make: (rng) => nameNotes(naturalsBetween('E3', 'D4'), 5, rng) },
      { kind: 'drill', title: 'Find them on the neck', intro: 'Tap where the note is played.', make: (rng) => staffToFret(C_MAJOR, [5, 6], [0, 4], 3, rng) },
    ],
  },
  {
    id: 'stage-7',
    stage: 7,
    title: 'Whole notes and dotted notes',
    summary: 'Before stage 7.',
    steps: [
      {
        kind: 'explain',
        title: 'Longer notes',
        body: [
          'A whole note (hollow, no stem) lasts four beats, the whole bar. A dot after a note adds half its length again: a dotted quarter lasts one and a half beats, and is usually followed by an eighth to fill the beat.',
        ],
        staff: { notes: [n('B4', '1 2', 'q.'), n('B4', '&', 'e'), n('B4', '3', 'h')], timeSignature: true },
        play: { notes: [sounding('B4', 'q.'), sounding('B4', 'e'), sounding('B4', 'h')] },
      },
      { kind: 'drill', title: 'Which rhythm?', intro: 'Pick the bar you heard.', make: (rng) => rhythms(['q', 'h', 'w', 'q.'], 4, rng) },
    ],
  },
  {
    id: 'stage-12',
    stage: 12,
    title: 'Positions up the neck',
    summary: 'Before stage 12.',
    steps: [
      {
        kind: 'explain',
        title: 'Fifth position',
        body: [
          'A position is where your first finger sits. In fifth position the first finger plays fret 5 and each finger covers one fret, up to fret 8 or 9. The same written notes can be played here as in first position, plus higher ones that need ledger lines above the staff.',
          'The fretboard shows frets 5 to 9 at this stage. The numbers above it tell you where you are on the neck.',
        ],
        fretboard: { frets: [5, 9], dots: [at(1, 5), at(1, 7), at(1, 8), at(2, 5), at(2, 6), at(2, 8)], labels: ['A', 'B', 'C', 'E', 'F', 'G'] },
        staff: { notes: [n('E5', 'E'), n('F5', 'F'), n('G5', 'G'), n('A5', 'A'), n('B5', 'B'), n('C6', 'C')] },
        play: { notes: ['E5', 'F5', 'G5', 'A5', 'B5', 'C6'].map((x) => sounding(x)) },
      },
      { kind: 'drill', title: 'Find it in fifth position', intro: 'Tap where the note is played between frets 5 and 9.', make: (rng) => staffToFret(C_MAJOR, [1, 2, 3, 4, 5, 6], [5, 9], 5, rng) },
    ],
  },
  {
    id: 'stage-14',
    stage: 14,
    title: 'Minor keys',
    summary: 'Before stage 14.',
    steps: [
      {
        kind: 'explain',
        title: 'The same signature, a different home',
        body: [
          'Every key signature belongs to a major key and a minor key. With no sharps or flats it is C major or A minor; one sharp is G major or E minor; one flat is F major or D minor.',
          'The notes are read exactly as before. What changes is the home note the melody starts and ends on, which gives minor its darker sound. The key name above the staff tells you which one it is.',
        ],
        staff: { key: K('Em'), notes: [n('E4', 'E'), n('G4', 'G'), n('B4', 'B'), n('E5', 'E')] },
        play: { notes: ['E4', 'G4', 'B4', 'E5'].map((x) => sounding(x)) },
      },
      { kind: 'drill', title: 'Read the signature', intro: 'What is the note, once the key signature is applied?', make: (rng) => signatureNotes([K('Em'), K('Dm'), K('Bm'), K('Gm')], STAGE1, 5, rng) },
    ],
  },
  {
    id: 'stage-18',
    stage: 18,
    title: 'Chords',
    summary: 'Before stage 18.',
    steps: [
      {
        kind: 'explain',
        title: 'Notes stacked on one stem',
        body: [
          'A chord is several notes played at once. On the staff they are stacked on top of each other and share one stem and one length. Read them from the bottom up.',
          'To write a chord: write its lowest note as usual, keep it selected, turn on Chord on the staff palette, and tap the line or space of each note above it. Turn Chord off to go back to single notes.',
        ],
        staff: { notes: [{ name: 'E4', chord: 1, duration: 'h' }, { name: 'B4', chord: 1, duration: 'h' }, { name: 'G4', chord: 2, duration: 'h' }, { name: 'D5', chord: 2, duration: 'h' }], timeSignature: true },
        play: { notes: [{ ...sounding('E4', 'h'), chord: 1 }, { ...sounding('B4', 'h'), chord: 1 }, { ...sounding('G4', 'h'), chord: 2 }, { ...sounding('D5', 'h'), chord: 2 }] },
      },
      { kind: 'drill', title: 'How many notes?', intro: 'Count the notes in each chord, bottom to top.', make: (rng) => chordCountQuestions(rng, 4) },
    ],
  },
];

/** "How many notes are in this chord?" over stacks of two to four notes. */
function chordCountQuestions(rng: Rng, count: number): NameQuestion[] {
  const stacks = [
    ['E4', 'B4'],
    ['G4', 'D5'],
    ['C4', 'E4', 'G4'],
    ['D4', 'A4', 'D5', 'F5'],
    ['A3', 'E4', 'A4', 'C5'],
    ['G3', 'B3', 'D4'],
    ['E4', 'G4', 'B4', 'D5'],
  ];
  const out: NameQuestion[] = [];
  for (let i = 0; i < count; i++) {
    const stack = rng.pick(stacks);
    const answer = String(stack.length);
    out.push({ kind: 'name', prompt: 'How many notes are in this chord?', key: C_MAJOR, notes: stack.map((x) => parseSpelled(x)), choices: ['2', '3', '4', '5'], answer });
  }
  return out;
}

export const ALL_LESSONS: readonly Lesson[] = [...PART_0, ...STAGE_LESSONS];

/** An example's notes laid out as written: complete 4/4 bars, a lone last note lengthened to a whole note, rests where a bar is short. */
export function writtenBars(step: ExplainStep): { duration: DurationId; chord?: number; rest?: boolean; index: number }[][] {
  if (!step.staff) return [];
  type Written = { duration: DurationId; chord?: number; rest?: boolean; index: number };
  const rest = (duration: DurationId): Written => ({ duration, rest: true, index: -1 });
  return measure<Written>(
    step.staff.notes.map((n, index) => ({ duration: n.duration ?? 'q', chord: n.chord, index })),
    rest,
  );
}

/**
 * What "Hear it" plays: the example's notes, each for exactly the length it is
 * written on the staff, so the ear and the page agree (a lone last note that the
 * staff shows as a whole note rings for four counts).
 */
export function playedAsWritten(step: ExplainStep): PlayableNote[] {
  if (!step.play) return [];
  if (!step.staff) return step.play.notes;
  const lengths = new Map<number, DurationId>();
  for (const bar of writtenBars(step)) for (const n of bar) if (!n.rest) lengths.set(n.index, n.duration);
  return step.play.notes.map((p, i) => ({ ...p, duration: lengths.get(i) ?? p.duration }));
}

export function lessonById(id: string): Lesson | undefined {
  return ALL_LESSONS.find((l) => l.id === id);
}

export function lessonForStage(stageNumber: number): Lesson | undefined {
  return STAGE_LESSONS.find((l) => l.stage === stageNumber);
}
