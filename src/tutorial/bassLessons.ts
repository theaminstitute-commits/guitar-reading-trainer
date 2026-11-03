/**
 * The tutorial for the bass (R41): the same course as the guitar's (R24, R27), one
 * idea per screen, rewritten for the bass staff and the four strings. Lesson ids
 * start "bass-" so finished bass lessons are told apart from guitar ones. There is
 * no chord lesson: the bass ladder ends at stage 17.
 */
import type { PlayableNote } from '../audio/player';
import type { DurationId } from '../music/duration';
import type { FretPosition } from '../music/fretboard';
import { BASS } from '../music/instrument';
import { C_MAJOR, keyFromId } from '../music/key';
import { midiFromSpelled, parseSpelled, soundingFromWritten } from '../music/pitch';
import type { Rng } from '../melody/random';
import type { ExampleNote, Lesson } from './lessons';
import {
  BASS_SIGNED,
  fretToStaff,
  nameNotes,
  naturalsBetween,
  placeNotes,
  rhythms,
  sharpsAndFlats,
  signatureNotes,
  staffToFret,
  tapAlong,
  withMemoryAid,
  type StaffToFretQuestion,
} from './questions';

const n = (name: string, label?: string, duration: DurationId = 'q'): ExampleNote => ({ name, label, duration });
const sounding = (name: string, duration: DurationId = 'q'): PlayableNote => ({ midi: soundingFromWritten(midiFromSpelled(parseSpelled(name))), duration });
const at = (string: number, fret: number): FretPosition => ({ string, fret });
/** A piano note: written where it sounds. */
const piano = (name: string, duration: DurationId = 'q'): PlayableNote => ({ midi: midiFromSpelled(parseSpelled(name)), duration, instrument: 'piano' });
const K = (id: string) => keyFromId(id)!;

/** The five lines and four spaces of the bass staff, G2 to A3. */
const STAFF_ONLY = naturalsBetween('G2', 'A3');
/** What bass stage 1 reads: the G, D and A strings, frets 0 to 3, written A2 to A3. */
const STAGE1 = naturalsBetween('A2', 'A3');
/** Stages 3 and 4 add the fourth fret: up to the B above the staff. */
const STAGE3 = naturalsBetween('A2', 'B3');
const UPPER_THREE = [1, 2, 3];
const TUNING = BASS.tuning;

/** Written pitch of each open string, 1st (G) to 4th (low E). */
const OPEN_WRITTEN = ['', 'G3', 'D3', 'A2', 'E2'];

/** "Which open string is this?" on the bass: tap the string on the fretboard; it sounds as it is tapped. */
export function bassOpenStringQuestions(rng: Rng, count: number): StaffToFretQuestion[] {
  const out: StaffToFretQuestion[] = [];
  for (let i = 0; i < count; i++) {
    let string = 1 + rng.int(4);
    while (out.length > 0 && out[out.length - 1]!.answers[0]!.string === string) string = 1 + rng.int(4);
    out.push({
      kind: 'staff-to-fret',
      prompt: 'Which open string is this? Tap it on the fretboard.',
      key: C_MAJOR,
      note: parseSpelled(OPEN_WRITTEN[string]!),
      answers: [{ string, fret: 0 }],
      frets: [0, 4],
      openOnly: true,
    });
  }
  return out;
}

export const BASS_PART_0: readonly Lesson[] = [
  {
    id: 'bass-staff',
    title: '1. The staff',
    summary: 'Lines, spaces and the letters they stand for, on the bass staff.',
    steps: [
      {
        kind: 'explain',
        title: 'Five lines, four spaces',
        body: [
          'Music is written on a staff: five lines with four spaces between them. A note sits either on a line (the line runs through it) or in a space (between two lines).',
          'The higher a note sits, the higher it sounds. The sign at the start of the staff is a clef. Though there are several clefs in music, the bass uses the bass clef: its two dots sit either side of the F line, the fourth line up.',
        ],
        staff: { notes: [n('G2', 'line', 'w'), n('A2', 'space', 'w'), n('B2', 'line', 'w'), n('C3', 'space', 'w'), n('D3', 'line', 'w'), n('E3', 'space', 'w')] },
        play: { notes: ['G2', 'A2', 'B2', 'C3', 'D3', 'E3'].map((x) => sounding(x)), tempo: 120 },
      },
      {
        kind: 'explain',
        title: 'The letters run up the alphabet',
        body: [
          'Each line and space is a letter. Going up one line or space goes up one letter: G A B C D E F G A. After G the letters start again at A.',
          'The lines from the bottom are G B D F A: "Good Boys Do Fine Always". The spaces spell A C E G: "All Cows Eat Grass". Before the clef the line letters are in violet and the space letters in pink.',
        ],
        staff: { notes: STAFF_ONLY.map((s) => n(`${s.letter}${s.octave}`)), legend: true },
        play: { notes: STAFF_ONLY.map((s) => sounding(`${s.letter}${s.octave}`)), tempo: 70 },
      },
      { kind: 'drill', title: 'Name the note', intro: 'A note appears on the staff. Pick its letter.', make: (rng) => withMemoryAid(nameNotes(STAFF_ONLY, 6, rng)) },
      {
        kind: 'explain',
        title: 'Same letter, different octave',
        body: [
          'Because the letters start again after G, the same letter appears more than once on the staff. The A in the bottom space and the A on the top line are both A: the higher one sounds the same note, only higher. The distance from one A to the next is called an octave.',
          'To tell them apart, every note carries a number after its letter: A2 is the lower A, A3 the higher one. The number goes up by one each time the letters pass C, so B2 is followed by C3.',
          'When the app names a note, such as A2 or D3, the letter tells you which line or space, and the number tells you which one of the repeats.',
          'Played together, the two As blend almost into one sound. The second bar stacks A2 and A3 as a two-note chord: an octave played at once.',
        ],
        staff: {
          notes: [n('A2', 'A2', 'h'), n('A3', 'A3', 'h'), { name: 'A2', label: 'A2 + A3', duration: 'w', chord: 1 }, { name: 'A3', duration: 'w', chord: 1 }],
          timeSignature: true,
        },
        play: {
          notes: [sounding('A2', 'h'), sounding('A3', 'h'), { ...sounding('A2', 'w'), chord: 1 }, { ...sounding('A3', 'w'), chord: 1 }],
          tempo: 70,
        },
      },
      {
        kind: 'drill',
        title: 'Find the line or space',
        intro: 'Now the other way: tap where the note belongs. Mind the number: it says which of the repeated letters is meant.',
        make: (rng) => withMemoryAid(placeNotes(STAFF_ONLY, 4, rng)).map((q) => ({ ...q, octaveSplit: true })),
      },
      {
        kind: 'explain',
        title: 'Just above and below',
        body: [
          'The staff carries on one step past its lines. The space just below the bottom line is F, and the space just above the top line is B.',
          'Stage 1 stays on the staff, from the A in the bottom space to the A on the top line. The B above comes in at stage 2, and the F below, with the open low E under it, at stage 6.',
        ],
        staff: { notes: [n('F2', 'F', 'w'), n('A2', 'A', 'w'), n('A3', 'A', 'w'), n('B3', 'B', 'w')] },
      },
      { kind: 'drill', title: 'The whole stage 1 range', intro: 'Name these: every note stage 1 uses, from the bottom space to the top line.', make: (rng) => withMemoryAid(nameNotes(STAGE1, 6, rng)) },
    ],
  },
  {
    id: 'bass-octave',
    title: '2. Notes on the bass',
    summary: 'Written an octave up, the open strings, sharps and flats, and the notes of stage 1 on the neck.',
    steps: [
      {
        kind: 'explain',
        title: 'Written higher than it sounds',
        body: [
          'Bass is written one octave (eight letters) higher than it sounds, so its notes fit on the bass staff instead of far below it. Every bass player reads this way, and the app always does.',
          'Tap Hear it. The bass plays its written G3, the open G string. Then the piano plays its G2: the very same sound, on the same piano key. Last the piano plays its G3, one octave higher. The piano is written where it sounds.',
          'You never have to work this out: the written note is simply the one you read and play. It only matters when you compare with a piano or another instrument.',
        ],
        staff: { notes: [n('G3', 'bass G3', 'w'), n('G2', 'piano G2', 'w'), n('G3', 'piano G3', 'w')] },
        fretboard: { frets: [0, 4], dots: [at(1, 0)], labels: ['G'] },
        piano: { low: 36, high: 59, marks: [{ midi: 43, label: 'G2' }, { midi: 55, label: 'G3' }] },
        play: { notes: [sounding('G3', 'w'), piano('G2', 'w'), piano('G3', 'w')], tempo: 150 },
      },
      {
        kind: 'explain',
        title: 'The four open strings on the staff',
        body: [
          'Here are the open strings, from the thickest (4th, low E) to the thinnest (1st, G). The low E sits on a short extra line under the staff, called a ledger line; you meet it at stage 6.',
          'Stage 1 uses the three thinner strings: A, D and G.',
        ],
        staff: { notes: [n('E2', 'E 4th', 'w'), n('A2', 'A 3rd', 'w'), n('D3', 'D 2nd', 'w'), n('G3', 'G 1st', 'w')] },
        fretboard: { frets: [0, 4], dots: [at(4, 0), at(3, 0), at(2, 0), at(1, 0)], labels: ['E', 'A', 'D', 'G'] },
        play: { notes: ['E2', 'A2', 'D3', 'G3'].map((x) => sounding(x)) },
      },
      {
        kind: 'drill',
        title: 'Which open string?',
        intro: 'An open string is written on the staff. Tap that string on the fretboard: you hear each string as you tap it.',
        make: (rng) => bassOpenStringQuestions(rng, 5),
      },
      {
        kind: 'explain',
        title: 'Sharps and flats',
        body: [
          "Each fret raises a note by the smallest step in music, a half step. Most letters are two frets apart, and the fret between them is a note too. It has no letter of its own, so it borrows a neighbour's letter with a sign.",
          'A sharp (♯) means one fret higher, a flat (♭) one fret lower. The fret between D and E is D♯ (D sharp) or E♭ (E flat): two names for one note, which sound exactly the same. Notes like these are called enharmonic.',
          'You do not need them yet: stages 1 and 2 use only the plain letters. Sharps and flats are written from stage 3, and the app explains them again there.',
        ],
        staff: { notes: [n('D3', 'D'), { ...n('D#3', 'D♯'), sign: 'sharp' }, { ...n('Eb3', 'E♭'), sign: 'flat' }, n('E3', 'E')] },
        fretboard: { frets: [0, 4], dots: [at(2, 0), at(2, 1), at(2, 1), at(2, 2)], labels: ['D', 'D♯', 'E♭', 'E'] },
        play: { notes: ['D3', 'D#3', 'Eb3', 'E3'].map((x) => sounding(x)) },
      },
      {
        kind: 'explain',
        title: 'Nothing between E and F, or B and C',
        body: [
          'Two pairs of letters are only one fret apart, with no sharp or flat between them: E and F, and B and C.',
          'So going up a string, one letter is not always one fret. On the A string: B is on fret 2 and C right next to it on fret 3, then C♯ on fret 4. On the D string: E is on fret 2 and F on fret 3, with F♯ on fret 4.',
          'Remember the two close pairs, E⁠–⁠F and B⁠–⁠C, and the frets always add up.',
        ],
        staff: {
          notes: [
            { ...n('B2', 'B'), mark: true },
            { ...n('C3', 'C'), mark: true },
            { ...n('C#3', 'C♯'), sign: 'sharp' },
            n('D3', 'D'),
            { ...n('E3', 'E'), mark: true },
            { ...n('F3', 'F'), mark: true },
            { ...n('F#3', 'F♯'), sign: 'sharp' },
            n('G3', 'G'),
          ],
        },
        fretboard: { frets: [0, 4], dots: [at(3, 2), at(3, 3), at(3, 4), at(2, 0), at(2, 2), at(2, 3), at(2, 4), at(1, 0)], labels: ['B', 'C', 'C♯', 'D', 'E', 'F', 'F♯', 'G'] },
        play: { notes: ['B2', 'C3', 'C#3', 'D3', 'E3', 'F3', 'F#3', 'G3'].map((x) => sounding(x)) },
      },
      { kind: 'drill', title: 'Name the sharp or flat', intro: 'A sharp or flat sits in front of the note. Name the note, sign included.', make: (rng) => sharpsAndFlats(rng, BASS_SIGNED) },
      {
        kind: 'explain',
        title: 'Key signatures',
        body: [
          'Instead of a sign in front of every note, music often writes the flats or sharps once, at the start of each line, right after the clef. That is the key signature: every note on that line or space is then flat (or sharp), with no sign in front of it.',
          'Here is F major: one flat, on the B line, so every B is played as B♭.',
          'C major has no sharps or flats at all, so its key signature is empty. Stages 1 and 2 are in C major, which is why they only use plain letters. Key signatures come in at stage 3.',
        ],
        staff: { key: K('F'), notes: [n('A2', 'A'), { ...n('Bb2', 'B♭'), mark: true }, n('C3', 'C'), n('D3', 'D')] },
        play: { notes: ['A2', 'Bb2', 'C3', 'D3'].map((x) => sounding(x)) },
      },
      {
        kind: 'drill',
        title: 'Staff to fretboard',
        intro: 'A note is on the staff. Tap where you play it.',
        make: (rng) => staffToFret(C_MAJOR, UPPER_THREE, [0, 3], 5, rng, TUNING).map((q) => ({ ...q, fretNames: true, dropIn: true })),
      },
      {
        kind: 'drill',
        title: 'Fretboard to staff',
        intro: 'A fret lights up. Tap where its note is written.',
        make: (rng) => fretToStaff(C_MAJOR, UPPER_THREE, [0, 3], 4, rng, TUNING).map((q) => ({ ...q, showName: true, dropIn: true })),
      },
    ],
  },
  {
    id: 'bass-rhythm',
    title: '3. Beat and rhythm',
    summary: 'Counting, bars, 4/4, quarter and half notes.',
    steps: [
      {
        kind: 'explain',
        title: 'The beat and the bar',
        body: [
          'Music moves on a steady beat, like a clock ticking. Beats are grouped into bars, separated by bar lines. The 4/4 at the start means four beats in every bar: count 1 2 3 4, 1 2 3 4.',
          'Before every melody the app clicks four times to count you in. That is one empty bar of 4/4.',
        ],
        staff: { notes: [n('D3', '1'), n('D3', '2'), n('D3', '3'), n('D3', '4')], timeSignature: true },
        play: { notes: [sounding('D3'), sounding('D3'), sounding('D3'), sounding('D3')] },
      },
      {
        kind: 'explain',
        title: 'Quarter notes and half notes',
        body: [
          'A quarter note (filled head with a stem) lasts one beat. A half note (hollow head with a stem) lasts two beats. A whole note (hollow, no stem) lasts all four.',
          'So a bar of 4/4 can be four quarters, two halves, or a mix such as half, quarter, quarter. The notes of a bar always add up to four beats.',
        ],
        staff: { notes: [n('D3', '1 2', 'h'), n('D3', '3'), n('D3', '4')], timeSignature: true },
        play: { notes: [sounding('D3', 'h'), sounding('D3'), sounding('D3')] },
      },
      { kind: 'drill', title: 'Which rhythm?', intro: 'One bar is played on a single note. Pick the bar you heard.', make: (rng) => rhythms(['q', 'h'], 4, rng) },
      { kind: 'drill', title: 'Tap along', intro: 'Feel the beat. Tap on every click after the count-in.', make: () => [tapAlong(72, 8)] },
    ],
  },
  {
    id: 'bass-first-melody',
    title: '4. Your first melody',
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

/** Short lessons before the bass stages that bring something new (the guitar's, less the chord lesson). */
export const BASS_STAGE_LESSONS: readonly Lesson[] = [
  {
    id: 'bass-stage-3',
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
        staff: { key: K('G'), notes: [n('D3', 'D'), n('E3', 'E'), n('F#3', 'F♯'), n('G3', 'G')] },
        play: { notes: ['D3', 'E3', 'F#3', 'G3'].map((x) => sounding(x)) },
      },
      {
        kind: 'explain',
        title: 'F major: one flat',
        body: ['F major has one flat, on the B line: every B is B♭. Stage 3 picks G major or F major at random, so look at the key signature before each melody.'],
        staff: { key: K('F'), notes: [n('A2', 'A'), n('Bb2', 'B♭'), n('C3', 'C'), n('F3', 'F')] },
        play: { notes: ['A2', 'Bb2', 'C3', 'F3'].map((x) => sounding(x)) },
      },
      { kind: 'drill', title: 'Read the signature', intro: 'What is the note, once the key signature is applied?', make: (rng) => signatureNotes([K('G'), K('F')], STAGE3, 5, rng) },
    ],
  },
  {
    id: 'bass-stage-5',
    stage: 5,
    title: 'Eighth notes',
    summary: 'Before stage 5.',
    steps: [
      {
        kind: 'explain',
        title: 'Two notes in one beat',
        body: ['An eighth note lasts half a beat. Two eighths share one beat and are joined by a beam. Count them "1 and", "2 and": the first eighth on the number, the second on the "and".'],
        staff: { notes: [n('D3', '1', 'e'), n('D3', '&', 'e'), n('D3', '2'), n('D3', '3', 'e'), n('D3', '&', 'e'), n('D3', '4')], timeSignature: true },
        play: { notes: [sounding('D3', 'e'), sounding('D3', 'e'), sounding('D3'), sounding('D3', 'e'), sounding('D3', 'e'), sounding('D3')] },
      },
      { kind: 'drill', title: 'Which rhythm?', intro: 'Pick the bar you heard.', make: (rng) => rhythms(['q', 'h', 'e'], 4, rng) },
    ],
  },
  {
    id: 'bass-stage-6',
    stage: 6,
    title: 'The low E string and its ledger line',
    summary: 'Before stage 6.',
    steps: [
      {
        kind: 'explain',
        title: 'Below the staff',
        body: [
          'Notes lower than the bottom line, G, go under the staff. The space just below it is F, and the next note down sits on a ledger line: a short line added under the staff, spaced like the staff lines. That is E, the open low E string.',
          'From stage 6 all four strings are used, so the low E string comes up in every melody: E open, F on fret 1, G on fret 3.',
        ],
        staff: { notes: [n('G2', 'G', 'w'), n('F2', 'F', 'w'), n('E2', 'E', 'w')] },
        fretboard: { frets: [0, 4], dots: [at(4, 3), at(4, 1), at(4, 0)], labels: ['G', 'F', 'E'] },
        play: { notes: ['G2', 'F2', 'E2'].map((x) => sounding(x)) },
      },
      { kind: 'drill', title: 'Name the low notes', intro: 'Count down from the bottom line.', make: (rng) => nameNotes(naturalsBetween('E2', 'B2'), 5, rng) },
      { kind: 'drill', title: 'Find them on the neck', intro: 'Tap where the note is played.', make: (rng) => staffToFret(C_MAJOR, [3, 4], [0, 4], 3, rng, TUNING) },
    ],
  },
  {
    id: 'bass-stage-7',
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
        staff: { notes: [n('D3', '1 2', 'q.'), n('D3', '&', 'e'), n('D3', '3', 'h')], timeSignature: true },
        play: { notes: [sounding('D3', 'q.'), sounding('D3', 'e'), sounding('D3', 'h')] },
      },
      { kind: 'drill', title: 'Which rhythm?', intro: 'Pick the bar you heard.', make: (rng) => rhythms(['q', 'h', 'w', 'q.'], 4, rng) },
    ],
  },
  {
    id: 'bass-stage-12',
    stage: 12,
    title: 'Positions up the neck',
    summary: 'Before stage 12.',
    steps: [
      {
        kind: 'explain',
        title: 'Fifth position',
        body: [
          'A position is where your first finger sits. In fifth position the first finger plays fret 5 and the hand reaches up to fret 8 or 9. The same written notes can be played here as in first position, plus higher ones that need ledger lines above the staff.',
          'The fretboard shows frets 5 to 9 at this stage. The numbers above it tell you where you are on the neck.',
        ],
        fretboard: { frets: [5, 9], dots: [at(2, 5), at(2, 7), at(2, 9), at(1, 5), at(1, 7), at(1, 9)], labels: ['G', 'A', 'B', 'C', 'D', 'E'] },
        staff: { notes: [n('G3', 'G'), n('A3', 'A'), n('B3', 'B'), n('C4', 'C'), n('D4', 'D'), n('E4', 'E')] },
        play: { notes: ['G3', 'A3', 'B3', 'C4', 'D4', 'E4'].map((x) => sounding(x)) },
      },
      { kind: 'drill', title: 'Find it in fifth position', intro: 'Tap where the note is played between frets 5 and 9.', make: (rng) => staffToFret(C_MAJOR, [1, 2, 3, 4], [5, 9], 5, rng, TUNING) },
    ],
  },
  {
    id: 'bass-stage-14',
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
        staff: { key: K('Em'), notes: [n('E2', 'E'), n('G2', 'G'), n('B2', 'B'), n('E3', 'E')] },
        play: { notes: ['E2', 'G2', 'B2', 'E3'].map((x) => sounding(x)) },
      },
      { kind: 'drill', title: 'Read the signature', intro: 'What is the note, once the key signature is applied?', make: (rng) => signatureNotes([K('Em'), K('Dm'), K('Bm'), K('Gm')], STAGE3, 5, rng) },
    ],
  },
];
