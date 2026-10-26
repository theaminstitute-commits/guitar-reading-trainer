/**
 * Where a chord can be played: fixed open-position shapes, named moveable
 * shapes (the E-shape and A-shape barres), and a search that finds every way
 * to put a chord's tones on a set of strings within a hand span. The search
 * is what gives close, drop-2 and drop-3 voicings, inversions, slash chords,
 * dyads on chosen string pairs and the wide shapes of the later stages.
 */
import { midiAt, STANDARD_TUNING, type FretPosition } from '../music/fretboard';
import { pitchClass, type Midi } from '../music/pitch';
import { QUALITIES, rootPitchClass, tonesOf, type Interval, type Quality, type QualityId, type RootSpelling } from './formulas';

export interface Voicing {
  /** Positions from the lowest-sounding note up. */
  positions: FretPosition[];
  /** Sounding pitches, ascending, parallel to `positions`. */
  midis: Midi[];
  /** The chord tone each note is, parallel to `positions`. */
  tones: Interval[];
}

export type VoicingType = 'close' | 'drop2' | 'drop3' | 'other';

export const MAX_FRET = 12;

/** Open-position shapes, strings 6 to 1, -1 = not played. Roots as spelled on a chord chart. */
export interface OpenShape {
  quality: QualityId;
  root: RootSpelling;
  frets: readonly number[];
}

const R = (letter: RootSpelling['letter'], accidental: RootSpelling['accidental'] = 0): RootSpelling => ({ letter, accidental });

export const OPEN_SHAPES: readonly OpenShape[] = [
  { quality: 'maj', root: R('C'), frets: [-1, 3, 2, 0, 1, 0] },
  { quality: 'maj', root: R('G'), frets: [3, 2, 0, 0, 0, 3] },
  { quality: 'maj', root: R('D'), frets: [-1, -1, 0, 2, 3, 2] },
  { quality: 'maj', root: R('A'), frets: [-1, 0, 2, 2, 2, 0] },
  { quality: 'maj', root: R('E'), frets: [0, 2, 2, 1, 0, 0] },
  { quality: 'min', root: R('A'), frets: [-1, 0, 2, 2, 1, 0] },
  { quality: 'min', root: R('E'), frets: [0, 2, 2, 0, 0, 0] },
  { quality: 'min', root: R('D'), frets: [-1, -1, 0, 2, 3, 1] },
  // The first partial barres: F on four strings, B minor with a first-finger barre on five.
  { quality: 'maj', root: R('F'), frets: [-1, -1, 3, 2, 1, 1] },
  { quality: 'min', root: R('B'), frets: [-1, 2, 4, 4, 3, 2] },
  // Open dominant sevenths.
  { quality: '7', root: R('E'), frets: [0, 2, 0, 1, 0, 0] },
  { quality: '7', root: R('A'), frets: [-1, 0, 2, 0, 2, 0] },
  { quality: '7', root: R('D'), frets: [-1, -1, 0, 2, 1, 2] },
  { quality: '7', root: R('G'), frets: [3, 2, 0, 0, 0, 1] },
  { quality: '7', root: R('C'), frets: [-1, 3, 2, 3, 1, 0] },
  { quality: '7', root: R('B'), frets: [-1, 2, 1, 2, 0, 2] },
  // Open suspended chords.
  { quality: 'sus2', root: R('D'), frets: [-1, -1, 0, 2, 3, 0] },
  { quality: 'sus4', root: R('D'), frets: [-1, -1, 0, 2, 3, 3] },
  { quality: 'sus2', root: R('A'), frets: [-1, 0, 2, 2, 0, 0] },
  { quality: 'sus4', root: R('A'), frets: [-1, 0, 2, 2, 3, 0] },
  { quality: 'sus4', root: R('E'), frets: [0, 2, 2, 2, 0, 0] },
  // Power chords with open roots.
  { quality: '5', root: R('E'), frets: [0, 2, -1, -1, -1, -1] },
  { quality: '5', root: R('A'), frets: [-1, 0, 2, -1, -1, -1] },
  { quality: '5', root: R('D'), frets: [-1, -1, 0, 2, -1, -1] },
];

/** A moveable shape: frets relative to the root fret, strings 6 to 1, -1 = not played; the root sits on `rootString`. */
export interface MoveableShape {
  id: string;
  name: string;
  quality: QualityId;
  rootString: number;
  frets: readonly number[];
}

export const MOVEABLE_SHAPES: readonly MoveableShape[] = [
  { id: 'E-maj', name: 'E shape', quality: 'maj', rootString: 6, frets: [0, 2, 2, 1, 0, 0] },
  { id: 'A-maj', name: 'A shape', quality: 'maj', rootString: 5, frets: [-1, 0, 2, 2, 2, 0] },
  { id: 'E-min', name: 'E shape', quality: 'min', rootString: 6, frets: [0, 2, 2, 0, 0, 0] },
  { id: 'A-min', name: 'A shape', quality: 'min', rootString: 5, frets: [-1, 0, 2, 2, 1, 0] },
  { id: 'E-7', name: 'E shape', quality: '7', rootString: 6, frets: [0, 2, 0, 1, 0, 0] },
  { id: 'A-7', name: 'A shape', quality: '7', rootString: 5, frets: [-1, 0, 2, 0, 2, 0] },
  { id: 'E-m7', name: 'E shape', quality: 'm7', rootString: 6, frets: [0, 2, 0, 0, 0, 0] },
  { id: 'A-m7', name: 'A shape', quality: 'm7', rootString: 5, frets: [-1, 0, 2, 0, 1, 0] },
  { id: 'E-maj7', name: 'E shape', quality: 'maj7', rootString: 6, frets: [0, -1, 1, 1, 0, -1] },
  { id: 'A-maj7', name: 'A shape', quality: 'maj7', rootString: 5, frets: [-1, 0, 2, 1, 2, 0] },
  { id: 'E-5', name: 'power chord, sixth string', quality: '5', rootString: 6, frets: [0, 2, -1, -1, -1, -1] },
  { id: 'A-5', name: 'power chord, fifth string', quality: '5', rootString: 5, frets: [-1, 0, 2, -1, -1, -1] },
  { id: 'D-5', name: 'power chord, fourth string', quality: '5', rootString: 4, frets: [-1, -1, 0, 2, -1, -1] },
];

function toneFor(quality: Quality, rootPc: number, midi: Midi): Interval | null {
  const pc = pitchClass(midi - rootPc);
  return tonesOf(quality).find((t) => pitchClass(t.semitones) === pc) ?? null;
}

/** A voicing from frets listed strings 6 to 1 (-1 = not played), or null if a note is not a chord tone. */
export function voicingFromFrets(quality: Quality, root: RootSpelling, frets: readonly number[]): Voicing | null {
  const rootPc = rootPitchClass(root);
  const notes: { position: FretPosition; midi: Midi; tone: Interval }[] = [];
  for (let i = 0; i < 6; i++) {
    const fret = frets[i]!;
    if (fret < 0) continue;
    const position = { string: 6 - i, fret };
    const midi = midiAt(position);
    const tone = toneFor(quality, rootPc, midi);
    if (!tone) return null;
    notes.push({ position, midi, tone });
  }
  notes.sort((a, b) => a.midi - b.midi);
  return { positions: notes.map((n) => n.position), midis: notes.map((n) => n.midi), tones: notes.map((n) => n.tone) };
}

/** Open shapes of a quality, as voicings with their roots. */
export function openVoicings(quality: QualityId): { root: RootSpelling; voicing: Voicing; shape: OpenShape }[] {
  return OPEN_SHAPES.filter((s) => s.quality === quality).map((shape) => ({
    root: shape.root,
    shape,
    voicing: voicingFromFrets(QUALITIES[quality], shape.root, shape.frets)!,
  }));
}

/** A moveable shape placed so its root sounds the given pitch class; null if it would pass fret 12. */
export function placeShape(shape: MoveableShape, root: RootSpelling): Voicing | null {
  const open = STANDARD_TUNING[shape.rootString]!;
  const rootFret = pitchClass(rootPitchClass(root) - open);
  const frets = shape.frets.map((f) => (f < 0 ? -1 : f + rootFret));
  if (Math.max(...frets) > MAX_FRET) return null;
  return voicingFromFrets(QUALITIES[shape.quality], root, frets);
}

export function shapeById(id: string): MoveableShape {
  const shape = MOVEABLE_SHAPES.find((s) => s.id === id);
  if (!shape) throw new Error(`No shape ${id}`);
  return shape;
}

export interface FindOptions {
  /** String sets to try, each listed from the lowest string (6) up, e.g. [[6,5,4,3],[5,4,3,2],[4,3,2,1]]. */
  stringSets: readonly (readonly number[])[];
  /** Largest fret stretch between fretted notes (open strings do not count). */
  maxSpan?: number;
  /** Allow a chord tone other than the root in the bass. */
  inversions?: boolean;
  /** The tone that must be in the bass (slash chords); implies inversions. */
  bassTone?: Interval;
  /** Keep only these voicing types (three or more notes). */
  types?: readonly VoicingType[];
}

const memo = new Map<string, Voicing[]>();

/**
 * Every way to voice a chord on the given string sets: each string carries one
 * chord tone, every required tone is present, a tone is doubled only when
 * there are more strings than tones (and then only the root or fifth), the
 * notes ascend from the lowest string, and the fretted notes fit the span.
 */
export function findVoicings(root: RootSpelling, quality: Quality, options: FindOptions): Voicing[] {
  const key = `${root.letter}${root.accidental}|${quality.id}|${JSON.stringify(options.stringSets)}|${options.maxSpan ?? 4}|${options.inversions ? 1 : 0}|${options.bassTone?.label ?? ''}|${(options.types ?? []).join(',')}`;
  const cached = memo.get(key);
  if (cached) return cached;

  const rootPc = rootPitchClass(root);
  const tones = tonesOf(quality);
  const required = quality.required;
  const maxSpan = options.maxSpan ?? 4;
  const out: Voicing[] = [];

  for (const strings of options.stringSets) {
    const n = strings.length;
    const doublingAllowed = n > tones.length ? tones.filter((t) => t.semitones === 0 || t.semitones === 7) : [];
    const assignment: Interval[] = [];
    const assign = (i: number) => {
      if (i === n) {
        if (!required.every((t) => assignment.includes(t))) return;
        const counts = new Map<Interval, number>();
        for (const t of assignment) counts.set(t, (counts.get(t) ?? 0) + 1);
        for (const [t, c] of counts) if (c > 1 && !doublingAllowed.includes(t)) return;
        if (options.bassTone && assignment[0] !== options.bassTone) return;
        if (!options.inversions && !options.bassTone && assignment[0]!.semitones !== 0) return;
        placeAssignment(strings, assignment, rootPc, maxSpan, out, (v) => !options.types || options.types.includes(voicingType(v.midis)));
        return;
      }
      for (const t of tones) {
        assignment.push(t);
        assign(i + 1);
        assignment.pop();
      }
    };
    assign(0);
  }
  out.sort((a, b) => a.midis[0]! - b.midis[0]! || Math.min(...a.positions.map((p) => p.fret)) - Math.min(...b.positions.map((p) => p.fret)));
  memo.set(key, out);
  return out;
}

function placeAssignment(strings: readonly number[], tones: readonly Interval[], rootPc: number, maxSpan: number, out: Voicing[], keep: (v: Voicing) => boolean) {
  const options = strings.map((string, i) => {
    const open = STANDARD_TUNING[string]!;
    const first = pitchClass(rootPc + tones[i]!.semitones - open);
    const frets = [first];
    if (first + 12 <= MAX_FRET) frets.push(first + 12);
    return frets;
  });
  const chosen: number[] = [];
  const walk = (i: number) => {
    if (i === strings.length) {
      const fretted = chosen.filter((f) => f > 0);
      const span = fretted.length === 0 ? 0 : Math.max(...fretted) - Math.min(...fretted);
      if (span > maxSpan) return;
      const positions = strings.map((string, k) => ({ string, fret: chosen[k]! }));
      const midis = positions.map((p) => midiAt(p));
      for (let k = 1; k < midis.length; k++) if (midis[k]! <= midis[k - 1]!) return;
      const voicing = { positions, midis, tones: [...tones] };
      if (keep(voicing)) out.push(voicing);
      return;
    }
    for (const f of options[i]!) {
      chosen.push(f);
      walk(i + 1);
      chosen.pop();
    }
  };
  walk(0);
}

/** Whether no chord tone of the set could sit between two adjacent notes: the stacking is as tight as it can be. */
function isClose(sorted: readonly Midi[]): boolean {
  if (sorted.length < 3) return true;
  const pcs = new Set(sorted.map(pitchClass));
  for (let k = 1; k < sorted.length; k++) {
    for (let m = sorted[k - 1]! + 1; m < sorted[k]!; m++) if (pcs.has(pitchClass(m))) return false;
  }
  return sorted[sorted.length - 1]! - sorted[0]! < 12;
}

/** Close, drop-2 (second voice from the top dropped an octave) or drop-3 (third voice from the top dropped), by reconstruction. */
export function voicingType(midis: readonly Midi[]): VoicingType {
  const sorted = [...midis].sort((a, b) => a - b);
  if (sorted.length < 3) return 'other';
  if (isClose(sorted)) return 'close';
  const raised = sorted[0]! + 12;
  const rebuilt = [...sorted.slice(1), raised].sort((a, b) => a - b);
  if (!isClose(rebuilt)) return 'other';
  const fromTop = rebuilt.length - 1 - rebuilt.indexOf(raised);
  if (fromTop === 1) return 'drop2';
  if (fromTop === 2) return 'drop3';
  return 'other';
}

/** Adjacent string sets of a size, lowest string first. */
export function adjacentSets(size: number): number[][] {
  const sets: number[][] = [];
  for (let low = 6; low - size + 1 >= 1; low--) sets.push(Array.from({ length: size }, (_, i) => low - i));
  return sets;
}

/** String pairs a given number of strings apart (1 = adjacent, 2 = one skipped). */
export function stringPairs(gap: number): number[][] {
  const sets: number[][] = [];
  for (let low = 6; low - gap >= 1; low--) sets.push([low, low - gap]);
  return sets;
}
