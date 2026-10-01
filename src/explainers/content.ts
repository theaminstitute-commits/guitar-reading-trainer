import type { ExplainerId } from '../grading/explain';
import { keyFromId, type Key } from '../music/key';
import { parseSpelled, staffStep } from '../music/pitch';
import type { Sign } from '../notation/accidentals';
import type { RenderNote } from '../notation/renderStaff';

export interface Explainer {
  id: ExplainerId;
  title: string;
  paragraphs: string[];
  /** Notes drawn on an example staff under the text, with an optional key signature. */
  example?: { notes: RenderNote[]; caption: string; key?: Key };
}

const step = (name: string) => staffStep(parseSpelled(name));
const note = (id: number, name: string, duration: RenderNote['duration'], label: string, sign: Sign = 'none'): RenderNote => ({
  id,
  step: step(name),
  sign,
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
  'key-signatures': {
    id: 'key-signatures',
    title: 'Key signatures',
    paragraphs: [
      'The key signature sits between the clef and the time signature. Each sharp or flat in it applies to every note of that letter, in every octave, for the whole piece. In G major the signature has one sharp on the F line, so a plain F anywhere on the staff is F♯ and you write nothing in front of it.',
      'Sharps are always added in the order F C G D A E B, flats in the order B E A D G C F. In a sharp key the last sharp is a half step below the tonic: one sharp (F♯) means G major. In a flat key the last flat but one names the key: three flats (B♭ E♭ A♭) means E♭ major, and one flat is F major.',
      'You only write a sign for a note that leaves the key signature, or to cancel a sign earlier in the bar. A sign that merely repeats what the key already says is a courtesy accidental: allowed, often helpful after an altered bar, never required.',
    ],
    example: {
      key: keyFromId('G')!,
      notes: [
        note(1, 'G4', 'q', 'G'),
        note(2, 'A4', 'q', 'A'),
        note(3, 'B4', 'q', 'B'),
        note(4, 'C5', 'q', 'C'),
        note(5, 'D5', 'q', 'D'),
        note(6, 'E5', 'q', 'E'),
        note(7, 'F5', 'q', 'F♯'),
        note(8, 'G5', 'q', 'G'),
      ],
      caption: 'G major: the F on the top line is F♯ because of the key signature. No sign is written.',
    },
  },
  'minor-keys': {
    id: 'minor-keys',
    title: 'Minor keys',
    paragraphs: [
      'Every key signature belongs to two keys: a major key and its relative minor, whose tonic is a third below. No sharps or flats is C major or A minor; one sharp is G major or E minor; one flat is F major or D minor. Natural minor uses the signature’s notes and nothing else, so reading it is the same as reading the major; only the home note changes.',
      'Harmonic minor raises the seventh degree to make a leading note a half step below the tonic. That raised note is not in the key signature, so it is always written with a sign: G♯ in A minor, F♯ in G minor, B♮ in C minor (where the sign cancels the B♭). Like any sign, it lasts for the rest of the bar on that pitch and must be written again in the next bar.',
      'Melodic minor raises both the sixth and the seventh on the way up, and uses the natural sixth and seventh on the way down. So in A minor a rising line is F♯ G♯ A and a falling line is A G F. The app grades this strictly: a raised note in a falling line, or a natural one in a rising line, is a wrong accidental.',
    ],
    example: {
      key: keyFromId('Am-h')!,
      notes: [
        note(1, 'A4', 'q', 'A'),
        note(2, 'B4', 'q', 'B'),
        note(3, 'C5', 'q', 'C'),
        note(4, 'D5', 'q', 'D'),
        note(5, 'E5', 'q', 'E'),
        note(6, 'F5', 'q', 'F'),
        note(7, 'G5', 'q', 'G♯', 'sharp'),
        note(8, 'A5', 'q', 'A'),
      ],
      caption: 'A harmonic minor: no key signature, and the raised seventh G♯ carries its own sign.',
    },
  },
  'ledger-lines': {
    id: 'ledger-lines',
    title: 'Ledger lines',
    paragraphs: [
      'Ledger lines are short lines that carry the staff on above or below its five lines. They are spaced exactly like the staff lines, and the letters keep counting: a note can sit on a ledger line or in the space between two.',
      'Below the treble staff: the space just under the bottom line is D, and the first ledger line is middle C (C4). On the guitar that C is the second string, first fret, and the open fourth string D sits just below the staff.',
      'Above the staff: the space over the top line is G, the first ledger line is A, the space above that is B, and the second ledger line is C (C6, which sounds as C5 on the guitar). Fifth-position playing on the first string lives up here.',
    ],
    example: {
      notes: [
        note(1, 'C4', 'q', 'C'),
        note(2, 'D4', 'q', 'D'),
        note(3, 'E4', 'q', 'E'),
        note(4, 'F5', 'q', 'F'),
        note(5, 'G5', 'q', 'G'),
        note(6, 'A5', 'q', 'A'),
        note(7, 'B5', 'q', 'B'),
        note(8, 'C6', 'q', 'C'),
      ],
      caption: 'Middle C on the first ledger line below; G, A, B, C climbing above the staff.',
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

export const EXPLAINER_ORDER: ExplainerId[] = ['staff-basics', 'key-signatures', 'minor-keys', 'ledger-lines', 'durations', 'guitar-octave'];
