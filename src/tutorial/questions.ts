/**
 * The questions of the tutorial lessons and the placement test. Each kind is
 * pure data, generated from a seeded random source so a lesson can be tested;
 * the components in components/QuestionCard.tsx draw and grade them.
 */
import { cellBeats, DURATIONS, type DurationId } from '../music/duration';
import { midiAt, type FretPosition } from '../music/fretboard';
import { C_MAJOR, isDiatonic, keyName, spellInKey, type Key } from '../music/key';
import { letterStep, parseSpelled, spelledName, staffStep, writtenFromSounding, type SpelledNote } from '../music/pitch';
import type { Rng } from '../melody/random';

/** Name the note (or notes) drawn on the staff: pick one of the choices. */
export interface NameQuestion {
  kind: 'name';
  prompt: string;
  key: Key;
  /** Written notes, one or a chord (lowest first). */
  notes: SpelledNote[];
  choices: string[];
  answer: string;
}

/** Tap the line or space where a named note belongs. */
export interface PlaceQuestion {
  kind: 'place';
  prompt: string;
  key: Key;
  target: SpelledNote;
}

/** A note on the staff: tap where it is played on the fretboard (any position that sounds it counts). */
export interface StaffToFretQuestion {
  kind: 'staff-to-fret';
  prompt: string;
  key: Key;
  note: SpelledNote;
  answers: FretPosition[];
  frets: readonly [number, number];
  /**
   * Open-string questions: a tap anywhere on a string means that open string, and the
   * string sounds the moment it is tapped (the user: tap the fretboard, hear the choice).
   */
  openOnly?: boolean;
  /** Beginner aid: every natural note on the fretboard carries its letter; sharps and flats stay blank. */
  fretNames?: boolean;
}

/** A lit fret: tap where its note is written on the staff. */
export interface FretToStaffQuestion {
  kind: 'fret-to-staff';
  prompt: string;
  key: Key;
  position: FretPosition;
  target: SpelledNote;
  frets: readonly [number, number];
}

/** Hear one bar of rhythm on a single note, pick the bar that was played. */
export interface RhythmQuestion {
  kind: 'rhythm';
  prompt: string;
  options: DurationId[][];
  answer: number;
}

/** Tap along with the click, on every beat. */
export interface TapQuestion {
  kind: 'tap';
  prompt: string;
  tempo: number;
  beats: number;
}

export type Question = (NameQuestion | PlaceQuestion | StaffToFretQuestion | FretToStaffQuestion | RhythmQuestion | TapQuestion) & {
  /** Show the line and space memory aid (Every Good Boy Deserves Fruit, F A C E) with the question. */
  memoryAid?: boolean;
};

/** The same questions, each showing the line and space memory aid. */
export function withMemoryAid<Q extends Question>(questions: Q[]): Q[] {
  return questions.map((q) => ({ ...q, memoryAid: true }));
}

export const nameOf = (n: SpelledNote) => spelledName(n);
export const nameWithOctave = (n: SpelledNote) => `${spelledName(n)}${n.octave}`;
export const written = (text: string) => parseSpelled(text);

/** Four distinct choices: the answer and three others, shuffled. */
export function choicesWith(answer: string, distractors: readonly string[], rng: Rng): string[] {
  const pool = [...new Set(distractors.filter((d) => d !== answer))];
  const picked: string[] = [];
  while (picked.length < 3 && pool.length > 0) picked.push(pool.splice(rng.int(pool.length), 1)[0]!);
  return shuffle([answer, ...picked], rng);
}

export function shuffle<T>(items: readonly T[], rng: Rng): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = rng.int(i + 1);
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
}

/** Written naturals from `low` to `high` inclusive (e.g. 'E4' to 'F5'). */
export function naturalsBetween(low: string, high: string): SpelledNote[] {
  const out: SpelledNote[] = [];
  for (let s = staffStep(parseSpelled(low)); s <= staffStep(parseSpelled(high)); s++) {
    const octave = Math.floor(s / 7);
    const letter = 'CDEFGAB'[s % 7] as SpelledNote['letter'];
    out.push({ letter, accidental: 0, octave });
  }
  return out;
}

/** Picks `count` items, avoiding the same item twice in a row. */
function pickSeries<T>(items: readonly T[], count: number, rng: Rng): T[] {
  const out: T[] = [];
  for (let i = 0; i < count; i++) {
    let next = rng.pick(items);
    if (items.length > 1) while (next === out[out.length - 1]) next = rng.pick(items);
    out.push(next);
  }
  return out;
}

/** "What is this note?" with letter choices: the neighbours a line or space away are the usual slips. */
export function nameNotes(notes: readonly SpelledNote[], count: number, rng: Rng, key: Key = C_MAJOR, prompt = 'What is this note?'): NameQuestion[] {
  return pickSeries(notes, count, rng).map((n) => {
    const spelled = keyAccidental(n, key);
    const answer = nameOf(spelled);
    const near = [-2, -1, 1, 2].map((d) => nameOf(spellNear(spelled, d, key)));
    return { kind: 'name', prompt, key, notes: [spelled], choices: choicesWith(answer, near, rng), answer };
  });
}

/** The note `steps` letters away, spelled the way the key spells that letter. */
function spellNear(n: SpelledNote, steps: number, key: Key): SpelledNote {
  const letter = letterStep(n.letter, steps);
  const step = staffStep(n) + steps;
  const octave = Math.floor(step / 7);
  const natural: SpelledNote = { letter, accidental: 0, octave };
  return keyAccidental(natural, key);
}

/** A natural note given the accidental the key signature puts on its letter. */
export function keyAccidental(n: SpelledNote, key: Key): SpelledNote {
  for (const acc of [0, 1, -1] as const) {
    const candidate = { ...n, accidental: acc };
    const midi = (candidate.octave + 1) * 12 + [0, 2, 4, 5, 7, 9, 11]['CDEFGAB'.indexOf(n.letter)]! + acc;
    if (isDiatonic(midi, key) && spellInKey(midi, key).letter === n.letter) return candidate;
  }
  return n;
}

/**
 * "What is this note in <key>?": a note whose letter the key signature alters,
 * with the plain letter and the opposite sign among the choices, so reading the
 * signature is the whole question.
 */
export function signatureNotes(keys: readonly Key[], range: readonly SpelledNote[], count: number, rng: Rng): NameQuestion[] {
  const out: NameQuestion[] = [];
  for (let i = 0; i < count; i++) {
    const key = rng.pick(keys);
    const altered = range.map((n) => keyAccidental(n, key)).filter((n) => n.accidental !== 0);
    const pool = altered.length > 0 ? altered : range.map((n) => keyAccidental(n, key));
    const note = rng.pick(pool);
    const answer = nameOf(note);
    // The plain letter is always offered: forgetting the signature is the slip this question is about.
    const plain = nameOf({ ...note, accidental: 0 });
    const others = shuffle(
      [nameOf({ ...note, accidental: note.accidental > 0 ? -1 : 1 }), nameOf(spellNear(note, 1, key)), nameOf(spellNear(note, -1, key))].filter((c) => c !== answer && c !== plain),
      rng,
    );
    const choices = answer === plain ? choicesWith(answer, others, rng) : shuffle([answer, plain, ...others.slice(0, 2)], rng);
    out.push({ kind: 'name', prompt: `In ${keyName(key)}, what is this note?`, key, notes: [note], choices, answer });
  }
  return out;
}

/** "Tap where <note> goes." */
export function placeNotes(notes: readonly SpelledNote[], count: number, rng: Rng, key: Key = C_MAJOR): PlaceQuestion[] {
  return pickSeries(notes, count, rng).map((target) => ({ kind: 'place', prompt: `Tap the line or space where ${nameWithOctave(target)} is written.`, key, target }));
}

/** Every position in a window that sounds the written note (guitar sounds an octave below the page). */
export function positionsOf(n: SpelledNote, strings: readonly number[], frets: readonly [number, number]): FretPosition[] {
  const sounding = (n.octave + 1) * 12 + [0, 2, 4, 5, 7, 9, 11]['CDEFGAB'.indexOf(n.letter)]! + n.accidental - 12;
  const out: FretPosition[] = [];
  for (const string of strings) {
    for (let fret = frets[0]; fret <= frets[1]; fret++) if (midiAt({ string, fret }) === sounding) out.push({ string, fret });
  }
  return out;
}

/** Notes of a key playable in a window, written, with their positions. */
export function windowNotes(key: Key, strings: readonly number[], frets: readonly [number, number]): { note: SpelledNote; positions: FretPosition[] }[] {
  const byStep = new Map<number, { note: SpelledNote; positions: FretPosition[] }>();
  for (const string of strings) {
    for (let fret = frets[0]; fret <= frets[1]; fret++) {
      const midi = midiAt({ string, fret });
      if (!isDiatonic(midi, key)) continue;
      const note = spellInKey(writtenFromSounding(midi), key);
      const s = staffStep(note);
      const entry = byStep.get(s) ?? { note, positions: [] };
      entry.positions.push({ string, fret });
      byStep.set(s, entry);
    }
  }
  return [...byStep.entries()].sort((a, b) => a[0] - b[0]).map(([, v]) => v);
}

export function staffToFret(key: Key, strings: readonly number[], frets: readonly [number, number], count: number, rng: Rng): StaffToFretQuestion[] {
  return pickSeries(windowNotes(key, strings, frets), count, rng).map(({ note, positions }) => ({
    kind: 'staff-to-fret',
    prompt: 'Where is this note played? Tap it on the fretboard.',
    key,
    note,
    answers: positions,
    frets,
  }));
}

export function fretToStaff(key: Key, strings: readonly number[], frets: readonly [number, number], count: number, rng: Rng): FretToStaffQuestion[] {
  return pickSeries(windowNotes(key, strings, frets), count, rng).map(({ note, positions }) => ({
    kind: 'fret-to-staff',
    prompt: 'Where is this note written? Tap the line or space.',
    key,
    position: rng.pick(positions),
    target: note,
    frets,
  }));
}

/** One bar of `beats` beats from the allowed lengths; eighths come in pairs, a dotted quarter brings its eighth. */
export function randomBar(durations: readonly DurationId[], rng: Rng, beats = 4): DurationId[] {
  const out: DurationId[] = [];
  let left = beats;
  while (left > 1e-9) {
    const fits = durations.filter((d) => cellBeats(d) <= left + 1e-9);
    const pick = rng.pick(fits);
    for (const d of DURATIONS[pick].cell) {
      out.push(d);
      left -= DURATIONS[d].beats;
    }
  }
  return out;
}

export function rhythms(durations: readonly DurationId[], count: number, rng: Rng): RhythmQuestion[] {
  const out: RhythmQuestion[] = [];
  for (let i = 0; i < count; i++) {
    const options: DurationId[][] = [];
    for (let tries = 0; options.length < 3 && tries < 60; tries++) {
      const bar = randomBar(durations, rng);
      if (!options.some((o) => o.join() === bar.join())) options.push(bar);
    }
    out.push({ kind: 'rhythm', prompt: 'Listen, then pick the bar you heard.', options, answer: rng.int(options.length) });
  }
  return out;
}

export function tapAlong(tempo = 72, beats = 8): TapQuestion {
  return { kind: 'tap', prompt: `Four clicks count you in. Then tap the button on every click, ${beats} times.`, tempo, beats };
}

/** Grade an answer to a choice question. */
export function isRightChoice(q: NameQuestion | RhythmQuestion, choice: string | number): boolean {
  return q.kind === 'name' ? choice === q.answer : choice === q.answer;
}

/** Grade a staff tap: the line or space must match (the key signature supplies the sign). */
export function isRightStep(q: PlaceQuestion | FretToStaffQuestion, step: number): boolean {
  return step === staffStep(q.target);
}

export function isRightFret(q: StaffToFretQuestion, p: FretPosition): boolean {
  return q.answers.some((a) => a.string === p.string && a.fret === p.fret);
}
