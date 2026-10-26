/**
 * What each chord stage of Part D may draw (docs/stage-ladder.md). One
 * ChordStageConfig per stage, in ladder order, plus the mixed sets used by
 * chord melody, free reading and the bonus stages.
 */
import { adjacentSets, stringPairs } from './voicings';
import type { ChordItem, ChordStageConfig } from './stageConfig';

const SETS3 = adjacentSets(3);
const SETS4 = adjacentSets(4);
const SETS5 = adjacentSets(5);
/** The string sets drop-3 voicings live on: a skipped string under three adjacent ones. */
const DROP3_SETS = [[6, 4, 3, 2], [5, 3, 2, 1]];
const FOUR_NOTE_SETS = [...SETS4, ...DROP3_SETS];

const find = (quality: ChordItem['quality'], stringSets: readonly (readonly number[])[], extra: Partial<ChordItem> = {}): ChordItem => ({
  quality,
  source: 'find',
  stringSets,
  ...extra,
});

const CHORD_LENGTHS = ['w', 'h'] as const;
const DYAD_LENGTHS = ['h', 'q'] as const;
/** On mixed stages a chord takes the length of the melody note it sits under, down to a quarter. */
const MIXED_LENGTHS = ['w', 'h', 'q'] as const;

/** Part D in order: the 29 stages between melodic minor and free reading. */
export const PART_D: readonly { name: string; summary: string; config: ChordStageConfig }[] = [
  {
    name: 'Power chords',
    summary: 'Root and fifth on two adjacent strings, one shape, anywhere on the neck. Two notes written as one chord.',
    config: {
      items: [
        { quality: '5', source: 'open' },
        { quality: '5', source: 'shapes', shapes: ['E-5', 'A-5', 'D-5'] },
      ],
      durations: DYAD_LENGTHS,
    },
  },
  {
    name: 'Thirds and sixths',
    summary: 'Major and minor thirds and sixths on adjacent strings: the first two-note shapes that sound major or minor.',
    config: {
      items: [
        find('dyad-M3', stringPairs(1), { roots: 'diatonic-only' }),
        find('dyad-m3', stringPairs(1), { roots: 'diatonic-only' }),
        find('dyad-M6', stringPairs(1), { maxSpan: 5, roots: 'diatonic-only' }),
        find('dyad-m6', stringPairs(1), { maxSpan: 5, roots: 'diatonic-only' }),
      ],
      durations: DYAD_LENGTHS,
    },
  },
  {
    name: 'Fourths, octaves and tenths',
    summary: 'Wider two-note shapes: fourths on adjacent strings, octaves and tenths across a skipped string.',
    config: {
      items: [
        find('dyad-P4', stringPairs(1), { roots: 'diatonic-only' }),
        find('dyad-P8', stringPairs(2), { maxSpan: 3, roots: 'diatonic-only' }),
        find('dyad-M10', stringPairs(3), { maxSpan: 5, roots: 'diatonic-only' }),
        find('dyad-m10', stringPairs(3), { maxSpan: 5, roots: 'diatonic-only' }),
      ],
      durations: DYAD_LENGTHS,
    },
  },
  {
    name: 'Open major triads',
    summary: 'The open C, G, D, A and E chords, written as full chords on the staff.',
    config: { items: [{ quality: 'maj', source: 'open', openRoots: ['C', 'G', 'D', 'A', 'E'] }], durations: CHORD_LENGTHS },
  },
  {
    name: 'Open minor triads',
    summary: 'The open A minor, E minor and D minor chords.',
    config: { items: [{ quality: 'min', source: 'open', openRoots: ['A', 'E', 'D'] }], durations: CHORD_LENGTHS },
  },
  {
    name: 'Open triads with F and B minor',
    summary: 'Every open major and minor chord, with F and B minor as the first partial barres.',
    config: {
      items: [
        { quality: 'maj', source: 'open' },
        { quality: 'min', source: 'open' },
      ],
      durations: CHORD_LENGTHS,
    },
  },
  {
    name: 'Barre chords',
    summary: 'The E shape and A shape moved up the neck, major and minor, on any root.',
    config: {
      items: [
        { quality: 'maj', source: 'shapes', shapes: ['E-maj', 'A-maj'] },
        { quality: 'min', source: 'shapes', shapes: ['E-min', 'A-min'] },
      ],
      durations: CHORD_LENGTHS,
    },
  },
  {
    name: 'Diminished triads',
    summary: 'Three-note diminished shapes on adjacent strings, in any inversion.',
    config: { items: [find('dim', SETS3, { inversions: true })], durations: CHORD_LENGTHS },
  },
  {
    name: 'Augmented triads',
    summary: 'Three-note augmented shapes on adjacent strings, in any inversion. The raised fifth is written with a sign.',
    config: { items: [find('aug', SETS3, { inversions: true })], durations: CHORD_LENGTHS },
  },
  {
    name: 'Suspended triads',
    summary: 'sus2 and sus4: open shapes and three- and four-string shapes with the root in the bass.',
    config: {
      items: [
        { quality: 'sus2', source: 'open' },
        { quality: 'sus4', source: 'open' },
        find('sus2', SETS3),
        find('sus4', SETS3),
        find('sus4', SETS4),
      ],
      durations: CHORD_LENGTHS,
    },
  },
  {
    name: 'Dominant sevenths',
    summary: 'Open seventh chords and the E and A barre shapes.',
    config: {
      items: [
        { quality: '7', source: 'open' },
        { quality: '7', source: 'shapes', shapes: ['E-7', 'A-7'] },
      ],
      durations: CHORD_LENGTHS,
    },
  },
  {
    name: 'Minor sevenths',
    summary: 'Barre shapes and four-string voicings with the root in the bass.',
    config: {
      items: [{ quality: 'm7', source: 'shapes', shapes: ['E-m7', 'A-m7'] }, find('m7', SETS4)],
      durations: CHORD_LENGTHS,
    },
  },
  {
    name: 'Major sevenths',
    summary: 'Barre shapes and four-string voicings with the root in the bass.',
    config: {
      items: [{ quality: 'maj7', source: 'shapes', shapes: ['E-maj7', 'A-maj7'] }, find('maj7', SETS4)],
      durations: CHORD_LENGTHS,
    },
  },
  {
    name: 'Half-diminished sevenths',
    summary: 'Minor seven flat five on four strings, root in the bass.',
    config: { items: [find('m7b5', FOUR_NOTE_SETS)], durations: CHORD_LENGTHS },
  },
  {
    name: 'Diminished sevenths',
    summary: 'The symmetrical diminished seventh, in any inversion. The diminished seventh is a double flat or a sixth, spelled from the root.',
    config: { items: [find('dim7', FOUR_NOTE_SETS, { inversions: true })], durations: CHORD_LENGTHS },
  },
  {
    name: 'Minor-major sevenths',
    summary: 'A minor triad with a major seventh: the raised seventh takes a sign.',
    config: { items: [find('mMaj7', FOUR_NOTE_SETS)], durations: CHORD_LENGTHS },
  },
  {
    name: 'Augmented sevenths and 7sus4',
    summary: 'Dominant seventh with a raised fifth, and the seventh suspended fourth.',
    config: { items: [find('7#5', FOUR_NOTE_SETS), find('7sus4', FOUR_NOTE_SETS)], durations: CHORD_LENGTHS },
  },
  {
    name: 'Sixth chords',
    summary: 'Major sixth and minor sixth chords on four strings.',
    config: { items: [find('6', FOUR_NOTE_SETS), find('m6', FOUR_NOTE_SETS)], durations: CHORD_LENGTHS },
  },
  {
    name: 'Added-note chords',
    summary: 'add9 and add11: a triad with one note added and no seventh.',
    config: { items: [find('add9', FOUR_NOTE_SETS, { maxSpan: 5 }), find('add11', FOUR_NOTE_SETS, { maxSpan: 5 })], durations: CHORD_LENGTHS },
  },
  {
    name: 'Six-nine chords',
    summary: 'Root, third, sixth and ninth, with or without the fifth.',
    config: { items: [find('6/9', FOUR_NOTE_SETS), find('6/9', SETS5)], durations: CHORD_LENGTHS },
  },
  {
    name: 'Ninths',
    summary: 'Dominant, major and minor ninths; the fifth may be left out.',
    config: {
      items: [find('9', [...FOUR_NOTE_SETS, ...SETS5]), find('maj9', [...FOUR_NOTE_SETS, ...SETS5]), find('m9', [...FOUR_NOTE_SETS, ...SETS5])],
      durations: CHORD_LENGTHS,
    },
  },
  {
    name: 'Elevenths',
    summary: 'Minor eleventh and dominant eleventh (the dominant leaves out its third).',
    config: { items: [find('m11', [...FOUR_NOTE_SETS, ...SETS5]), find('11', [...FOUR_NOTE_SETS, ...SETS5])], durations: CHORD_LENGTHS },
  },
  {
    name: 'Thirteenths',
    summary: 'Dominant, major and minor thirteenths: root, third, seventh and thirteenth, the ninth and fifth when there is room.',
    config: {
      items: [find('13', [...FOUR_NOTE_SETS, ...SETS5]), find('maj13', [...FOUR_NOTE_SETS, ...SETS5]), find('m13', [...FOUR_NOTE_SETS, ...SETS5])],
      durations: CHORD_LENGTHS,
    },
  },
  {
    name: 'Altered dominants',
    summary: '7♭9, 7♯9, 7♭5, 7♯5, 7♯11 and the altered dominant. Every altered tone is spelled from the root: a sharp nine over C is D♯.',
    config: {
      items: [
        find('7b9', FOUR_NOTE_SETS, { roots: 'any' }),
        find('7#9', FOUR_NOTE_SETS, { roots: 'any' }),
        find('7b5', FOUR_NOTE_SETS, { roots: 'any' }),
        find('7#5', FOUR_NOTE_SETS, { roots: 'any' }),
        find('7#11', FOUR_NOTE_SETS, { roots: 'any' }),
        find('7alt', FOUR_NOTE_SETS, { roots: 'any' }),
      ],
      durations: CHORD_LENGTHS,
    },
  },
  {
    name: 'Slash chords and inversions',
    summary: 'Triads with the third or the fifth in the bass: C/E, G/B, D/A.',
    config: {
      items: [
        find('maj', SETS4, { bassTone: 'third' }),
        find('maj', SETS4, { bassTone: 'fifth' }),
        find('min', SETS4, { bassTone: 'third' }),
        find('min', SETS4, { bassTone: 'fifth' }),
        find('maj', SETS3, { bassTone: 'third' }),
        find('min', SETS3, { bassTone: 'third' }),
      ],
      durations: CHORD_LENGTHS,
    },
  },
  {
    name: 'Drop 2 and drop 3 voicings',
    summary: 'Four-note seventh chords with the second or third voice from the top dropped an octave, across the string sets, in every inversion.',
    config: {
      items: [
        find('7', SETS4, { inversions: true, types: ['drop2'] }),
        find('m7', SETS4, { inversions: true, types: ['drop2'] }),
        find('maj7', SETS4, { inversions: true, types: ['drop2'] }),
        find('m7b5', SETS4, { inversions: true, types: ['drop2'] }),
        find('7', DROP3_SETS, { inversions: true, types: ['drop3'] }),
        find('m7', DROP3_SETS, { inversions: true, types: ['drop3'] }),
        find('maj7', DROP3_SETS, { inversions: true, types: ['drop3'] }),
        find('m7b5', DROP3_SETS, { inversions: true, types: ['drop3'] }),
      ],
      durations: CHORD_LENGTHS,
    },
  },
  {
    name: 'Quartal and cluster voicings',
    summary: 'Stacked fourths and three adjacent scale steps, taken from the key.',
    config: {
      items: [
        find('quartal3', SETS3, { roots: 'diatonic-only', maxSpan: 5 }),
        find('quartal4', SETS4, { roots: 'diatonic-only', maxSpan: 5 }),
        find('cluster-maj', SETS3, { roots: 'diatonic-only', maxSpan: 5 }),
        find('cluster-min', SETS3, { roots: 'diatonic-only', maxSpan: 5 }),
        find('cluster-phr', SETS3, { roots: 'diatonic-only', maxSpan: 5 }),
      ],
      durations: CHORD_LENGTHS,
    },
  },
  {
    name: 'Polychords',
    summary: 'A major triad over a different bass note: D over C, A♭ over C, B♭ over C.',
    config: {
      items: [find('poly-II', FOUR_NOTE_SETS, { maxSpan: 5 }), find('poly-bVI', [...SETS3, ...SETS4], { maxSpan: 5 }), find('poly-bVII', FOUR_NOTE_SETS, { maxSpan: 5 })],
      durations: CHORD_LENGTHS,
    },
  },
  {
    name: 'Chord melody',
    summary: 'A melody with chords under some of its notes: the melody note stays on top of each chord.',
    config: {
      items: [
        find('maj', SETS3, { inversions: true }),
        find('min', SETS3, { inversions: true }),
        find('7', SETS4, { inversions: true }),
        find('m7', SETS4, { inversions: true }),
        find('maj7', SETS4, { inversions: true }),
      ],
      durations: MIXED_LENGTHS,
      mix: 0.5,
    },
  },
];

/** Free reading and the bonus stages: melody and chords mixed, with the whole chord vocabulary that keeps a melody on top. */
export const FREE_READING_CHORDS: ChordStageConfig = {
  items: [
    find('maj', SETS3, { inversions: true }),
    find('min', SETS3, { inversions: true }),
    find('dim', SETS3, { inversions: true }),
    find('7', SETS4, { inversions: true }),
    find('m7', SETS4, { inversions: true }),
    find('maj7', SETS4, { inversions: true }),
    find('m7b5', SETS4, { inversions: true }),
    find('6', SETS4, { inversions: true }),
    find('add9', SETS4, { inversions: true, maxSpan: 5 }),
  ],
  durations: MIXED_LENGTHS,
  mix: 0.35,
};
