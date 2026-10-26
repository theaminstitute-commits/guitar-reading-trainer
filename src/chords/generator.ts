/**
 * Chords for a melody: a whole bar of chords on a pure chord stage, or chords
 * dropped under chosen melody notes on a mixed stage so the melody stays on
 * top. Every chord tone is spelled from its root (formulas.ts) and carries a
 * fret position from a voicing (voicings.ts).
 */
import { keyDegrees, keySignatureCount, type Key } from '../music/key';
import { LETTER_PITCH_CLASS, LETTERS, parseSpelled, pitchClass, staffStep, writtenFromSounding, type Accidental, type Midi } from '../music/pitch';
import type { DurationId } from '../music/duration';
import type { Rng } from '../melody/random';
import type { MelodyNote } from '../melody/types';
import { chordSymbol, INTERVALS, QUALITIES, rootPitchClass, spellInterval, type Quality, type RootSpelling } from './formulas';
import type { ChordItem, ChordStageConfig } from './stageConfig';
import { findVoicings, openVoicings, placeShape, shapeById, type Voicing } from './voicings';

/** A chord ready to be written: its name, root, voicing and the item it came from. */
export interface ChordChoice {
  item: ChordItem;
  quality: Quality;
  root: RootSpelling;
  voicing: Voicing;
  /** "G", "Am7", "E♭maj7", with a shape name where the stage names shapes. */
  name: string;
}

/** The spellings of a pitch class that need at most one sharp or flat. */
function rootSpellings(pc: number): RootSpelling[] {
  const out: RootSpelling[] = [];
  for (const letter of LETTERS) {
    for (const accidental of [0, 1, -1] as Accidental[]) {
      if (pitchClass(LETTER_PITCH_CLASS[letter] + accidental) === pc) out.push({ letter, accidental });
    }
  }
  return out;
}

/** How many sharps and flats the chord's required tones carry when spelled from this root (double signs count twice). */
function spellingWeight(root: RootSpelling, quality: Quality): number {
  let weight = 0;
  for (const tone of quality.required) {
    try {
      weight += Math.abs(spellInterval(root, tone, 60).accidental);
    } catch {
      return Infinity;
    }
  }
  return weight;
}

/** Whether any required tone needs a double sharp or double flat from this root. */
function hasDoubleSign(root: RootSpelling, quality: Quality): boolean {
  return quality.required.some((tone) => {
    try {
      return Math.abs(spellInterval(root, tone, 60).accidental) === 2;
    } catch {
      return true;
    }
  });
}

/** The staff can show written E3 to E6 (the open low E to fret 12 on the first string); a spelling outside it cannot be written. */
const LOWEST_STEP = staffStep(parseSpelled('E3'));
const HIGHEST_STEP = staffStep(parseSpelled('E6'));

function writable(root: RootSpelling, voicing: Voicing): boolean {
  return voicing.tones.every((tone, i) => {
    const step = staffStep(spellInterval(root, tone, writtenFromSounding(voicing.midis[i]!)));
    return step >= LOWEST_STEP && step <= HIGHEST_STEP;
  });
}

/**
 * The root spelling a reader in the key would expect: the key's own spelling
 * when the root is in the key, otherwise whichever spelling gives the chord the
 * fewest signs, sharps winning ties in sharp keys and flats in flat keys.
 */
export function spellRoot(pc: number, quality: Quality, key: Key): RootSpelling {
  const inKey = keyDegrees(key).find((d) => d.pitchClass === pc && !d.raised);
  const candidates = rootSpellings(pc);
  // The key's own spelling of the root wins unless it forces a double sign on the chord (D flat diminished: A double flat).
  if (inKey) {
    const own = candidates.find((c) => c.letter === inKey.letter && c.accidental === inKey.accidental);
    if (own && !hasDoubleSign(own, quality)) return own;
  }
  const preferSharps = keySignatureCount(key) >= 0;
  return [...candidates].sort(
    (a, b) =>
      spellingWeight(a, quality) - spellingWeight(b, quality) ||
      (preferSharps ? b.accidental - a.accidental : a.accidental - b.accidental),
  )[0]!;
}

export function isDiatonicChord(root: RootSpelling, quality: Quality, key: Key): boolean {
  const pcs = new Set(keyDegrees(key).map((d) => d.pitchClass));
  const rootPc = rootPitchClass(root);
  return quality.required.every((t) => pcs.has(pitchClass(rootPc + t.semitones)));
}

const BASS_TONE = { third: [INTERVALS.m3, INTERVALS.M3], fifth: [INTERVALS.P5, INTERVALS.d5, INTERVALS.A5] };

const choiceMemo = new Map<string, ChordChoice[]>();

/** Every chord an item can give in a key, root choices already applied. */
export function choicesFor(item: ChordItem, key: Key): ChordChoice[] {
  const memoKey = `${JSON.stringify(item)}|${key.tonic}${key.tonicAccidental}${key.mode}`;
  const cached = choiceMemo.get(memoKey);
  if (cached) return cached;
  const quality = QUALITIES[item.quality];
  const out: ChordChoice[] = [];

  if (item.source === 'open') {
    for (const { root, voicing } of openVoicings(item.quality)) {
      if (item.openRoots && !item.openRoots.includes(root.letter + (root.accidental === 1 ? '#' : root.accidental === -1 ? 'b' : ''))) continue;
      if (writable(root, voicing)) out.push({ item, quality, root, voicing, name: chordSymbol(root, quality) });
    }
    // Open shapes have fixed roots: in a key that holds some of them, only those are drawn.
    const diatonic = out.filter((c) => isDiatonicChord(c.root, c.quality, key));
    if (item.roots !== 'any' && diatonic.length > 0) {
      out.length = 0;
      out.push(...diatonic);
    }
  } else {
    const roots = Array.from({ length: 12 }, (_, pc) => spellRoot(pc, quality, key));
    const diatonic = roots.filter((r) => isDiatonicChord(r, quality, key));
    const wanted = item.roots === 'any' ? roots : diatonic.length > 0 || item.roots === 'diatonic-only' ? diatonic : roots;
    for (const root of wanted) {
      if (item.source === 'shapes') {
        for (const id of item.shapes ?? []) {
          const shape = shapeById(id);
          if (shape.quality !== item.quality) throw new Error(`Shape ${id} is not ${item.quality}`);
          const voicing = placeShape(shape, root);
          if (voicing && writable(root, voicing)) out.push({ item, quality, root, voicing, name: `${chordSymbol(root, quality)} (${shape.name})` });
        }
      } else {
        const bassTone = item.bassTone ? BASS_TONE[item.bassTone].find((t) => quality.required.includes(t)) : undefined;
        const voicings = findVoicings(root, quality, {
          stringSets: item.stringSets ?? [],
          maxSpan: item.maxSpan,
          inversions: item.inversions,
          bassTone,
          types: item.types,
        });
        for (const voicing of voicings) {
          if (!writable(root, voicing)) continue;
          const bass = voicing.tones[0]!;
          const slash = bass.semitones === 0 ? '' : `/${spellInterval(root, bass, 60).letter}${['𝄫', '♭', '', '♯', '𝄪'][spellInterval(root, bass, 60).accidental + 2]}`;
          out.push({ item, quality, root, voicing, name: chordSymbol(root, quality) + slash });
        }
      }
    }
  }
  choiceMemo.set(memoKey, out);
  return out;
}

/** The notes of a chord, lowest first, spelled from the root, as one chord event. */
export function chordNotes(choice: ChordChoice, duration: DurationId, chordId: number): MelodyNote[] {
  return choice.voicing.positions.map((position, i) => ({
    midi: choice.voicing.midis[i]!,
    duration,
    string: position.string,
    fret: position.fret,
    chord: chordId,
    spelled: spellInterval(choice.root, choice.voicing.tones[i]!, writtenFromSounding(choice.voicing.midis[i]!)),
  }));
}

/** One chord drawn at random from the stage's items; items with nothing to give in this key are skipped. */
export function drawChord(config: ChordStageConfig, key: Key, rng: Rng, avoid?: ChordChoice): ChordChoice {
  const items = [...config.items];
  for (let tries = 0; tries < 12 && items.length > 0; tries++) {
    const item = rng.pick(items);
    const choices = choicesFor(item, key);
    if (choices.length === 0) {
      items.splice(items.indexOf(item), 1);
      continue;
    }
    let choice = rng.pick(choices);
    if (avoid && sameChord(choice, avoid) && choices.length > 1) choice = rng.pick(choices);
    return choice;
  }
  throw new Error(`No chord of the stage can be voiced in ${key.tonic}${key.tonicAccidental} ${key.mode}`);
}

export function sameChord(a: ChordChoice, b: ChordChoice): boolean {
  return a.voicing.midis.join() === b.voicing.midis.join();
}

/** Whether a stage's vocabulary has at least one chord that belongs to the key, so the key signature means something there. */
export function keyFitsVocabulary(config: ChordStageConfig, key: Key): boolean {
  return config.items.some((item) => choicesFor(item, key).some((c) => isDiatonicChord(c.root, c.quality, key)));
}

/** Chords whose top note is a given pitch, for putting a chord under a melody note. */
export function chordsWithTop(config: ChordStageConfig, key: Key, top: Midi): ChordChoice[] {
  return config.items.flatMap((item) => choicesFor(item, key).filter((c) => c.voicing.midis[c.voicing.midis.length - 1] === top));
}
