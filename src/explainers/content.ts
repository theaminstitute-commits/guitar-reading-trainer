import type { ExplainerId } from '../grading/explain';
import { parseSpelled, staffStep } from '../music/pitch';
import type { RenderNote } from '../notation/renderStaff';

export interface Explainer {
  id: ExplainerId;
  title: string;
  paragraphs: string[];
  /** Notes drawn on an example staff under the text. */
  example?: { notes: RenderNote[]; caption: string };
}

const step = (name: string) => staffStep(parseSpelled(name));
const note = (id: number, name: string, duration: RenderNote['duration'], label: string): RenderNote => ({
  id,
  step: step(name),
  sign: 'none',
  duration,
  label,
});

export const EXPLAINERS: Record<ExplainerId, Explainer> = {
  'staff-basics': {
    id: 'staff-basics',
    title: 'Reading the treble staff',
    paragraphs: [
      'The staff has five lines and four spaces. Every line and every space is a letter, and the letters run up the alphabet from A to G and start again.',
      'The lines, from the bottom up, are E G B D F. The spaces, from the bottom up, spell F A C E. Notes that go higher or lower than the staff sit on short extra lines called ledger lines.',
      'A sharp (♯) raises a note by a half step, a flat (♭) lowers it, and a natural (♮) cancels one. A sign lasts until the end of the bar for that exact note, and must be written again in the next bar. Spelling matters: in C major the notes are the plain letters, so F is written F, never E♯.',
      'The key signature sits between the clef and the time signature. Its sharps or flats apply to every note of those letters, in every octave, for the whole piece, so in G major a plain F on the line is F♯ and you write nothing in front of it. A sign is only needed for a note outside the key, or to cancel one earlier in the bar.',
    ],
    example: {
      notes: [
        note(1, 'E4', 'q', 'E'),
        note(2, 'F4', 'q', 'F'),
        note(3, 'G4', 'q', 'G'),
        note(4, 'A4', 'q', 'A'),
        note(5, 'B4', 'q', 'B'),
        note(6, 'C5', 'q', 'C'),
        note(7, 'D5', 'q', 'D'),
        note(8, 'E5', 'q', 'E'),
        note(9, 'F5', 'q', 'F'),
      ],
      caption: 'Lines E G B D F, spaces F A C E, from the bottom up.',
    },
  },
  durations: {
    id: 'durations',
    title: 'Note lengths',
    paragraphs: [
      'In 4/4 time each bar holds four beats. A whole note fills the bar, a half note lasts two beats, a quarter note one beat, an eighth note half a beat.',
      'The shape tells you the length: a hollow head without a stem is a whole note, a hollow head with a stem is a half note, a filled head with a stem is a quarter note, and a filled head with a flag is an eighth. Two eighths on one beat are joined by a beam. A dot after a note adds half its value, so a dotted quarter is a beat and a half.',
      'When you write a bar, the lengths must add up to four beats exactly. The app will not let a note in if it does not fit.',
    ],
    example: {
      notes: [note(1, 'G4', 'w', '4'), note(2, 'G4', 'h', '2'), note(3, 'G4', 'q', '1'), note(4, 'G4', 'q.', '1½'), note(5, 'G4', 'e', '½'), note(6, 'G4', 'e', '½')],
      caption: 'Whole, half, quarter, dotted quarter and a pair of eighths on G, with their beats.',
    },
  },
  'guitar-octave': {
    id: 'guitar-octave',
    title: 'Why guitar music is written an octave up',
    paragraphs: [
      'The guitar is a transposing instrument: everything it plays sounds one octave lower than it is written. The open high E string sounds E4, but on the page it is written E5, in the top space of the staff.',
      'This keeps most guitar music on the treble staff without piles of ledger lines. It also means the note you hear and the note you write are not in the same octave.',
      'A quick check: the open G string (string 3) is written G4, on the second line. The G on the first string, third fret, an octave higher, is written G5, in the space above the staff.',
    ],
    example: {
      notes: [note(1, 'G4', 'h', 'string 3 open'), note(2, 'G5', 'h', 'string 1, fret 3')],
      caption: 'Both notes are G. The written note is an octave above what you hear.',
    },
  },
};

export const EXPLAINER_ORDER: ExplainerId[] = ['staff-basics', 'durations', 'guitar-octave'];
