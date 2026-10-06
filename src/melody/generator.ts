/**
 * Rule-based, seeded melody generator.
 *
 * Given a LevelConfig and a seed it always produces the same melody. Rules:
 *  - only pitches playable on the configured strings/frets AND in the key
 *  - every bar sums exactly to the time signature
 *  - consecutive notes never leap more than `maxLeapSteps` diatonic steps
 *  - the first note is on a start degree, the last note on an end degree
 */
import { beatsOf, cellBeats, DURATIONS, type DurationId } from '../music/duration';
import { midiAt, type FretPosition } from '../music/fretboard';
import { chordTonePitchClasses, degreeInfoOf, degreeOf, isDiatonic, keySignatureCount, spellInKey, type Key } from '../music/key';
import { pitchClass } from '../music/pitch';
import { barBeatsForCounts, MIN_COUNTS } from './meter';
import { staffStep, type Midi } from '../music/pitch';
import type { LevelConfig } from './levelConfig';
import { createRng, type Rng } from './random';
import type { Melody, MelodyNote } from './types';

interface PoolNote {
  midi: Midi;
  /** Diatonic position (staff step), used to measure leaps. */
  step: number;
  degree: number;
  /** A raised minor degree (harmonic or melodic 6/7). */
  raised: boolean;
  positions: FretPosition[];
}

/** All in-key pitches reachable in the level's fret window, ascending, with their positions. */
export function pitchPool(config: LevelConfig, key: Key): PoolNote[] {
  const byMidi = new Map<Midi, FretPosition[]>();
  const [low, high] = config.fretRange;
  for (const string of config.strings) {
    for (let fret = low; fret <= high; fret++) {
      const midi = midiAt({ string, fret });
      if (!isDiatonic(midi, key)) continue;
      const list = byMidi.get(midi) ?? [];
      list.push({ string, fret });
      byMidi.set(midi, list);
    }
  }
  return [...byMidi.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([midi, positions]) => ({
      midi,
      step: staffStep(spellInKey(midi, key)),
      degree: degreeOf(midi, key)!,
      raised: degreeInfoOf(midi, key)!.raised,
      positions,
    }));
}

/**
 * Fill every bar with durations from the allowed set so each bar adds up
 * exactly. Each pick writes its rhythm cell (an eighth brings its pair, a
 * dotted quarter brings its eighth), so eighths always sit on a beat.
 */
export function generateRhythm(config: LevelConfig, rng: Rng, barBeats: readonly number[]): DurationId[] {
  const out: DurationId[] = [];
  for (const beats of barBeats) {
    let remaining = beats;
    while (remaining > 1e-9) {
      const fits = config.durations.filter((d) => cellBeats(d) <= remaining + 1e-9);
      if (fits.length === 0) {
        throw new Error(
          `Level ${config.id}: no allowed duration fits the ${remaining} beats left in a bar`,
        );
      }
      const chosen = rng.pick(fits);
      for (const d of DURATIONS[chosen].cell) {
        out.push(d);
        remaining -= beatsOf(d);
      }
    }
  }
  return out;
}

function withinLeap(pool: PoolNote[], from: PoolNote, maxSteps: number): PoolNote[] {
  return pool.filter((p) => Math.abs(p.step - from.step) <= maxSteps);
}

/**
 * Melodic minor: the raised 6th and 7th are used going up, the natural 6th and
 * 7th coming down. Other keys allow every candidate.
 */
function allowedByMode(key: Key, from: PoolNote, candidate: PoolNote): boolean {
  if (key.mode !== 'melodic-minor') return true;
  if (candidate.degree !== 6 && candidate.degree !== 7) return true;
  if (candidate.midi === from.midi) return true;
  return candidate.raised ? candidate.midi > from.midi : candidate.midi < from.midi;
}

function nearest(pool: PoolNote[], from: PoolNote): PoolNote {
  return pool.reduce((best, p) =>
    Math.abs(p.step - from.step) < Math.abs(best.step - from.step) ? p : best,
  );
}

/** Choose a display position for a pitch, staying close to the previous fret. */
function choosePosition(candidate: PoolNote, previous: FretPosition | null): FretPosition {
  if (candidate.positions.length === 1 || !previous) return candidate.positions[0]!;
  return [...candidate.positions].sort(
    (a, b) =>
      Math.abs(a.fret - previous.fret) - Math.abs(b.fret - previous.fret) || a.string - b.string,
  )[0]!;
}

/**
 * @param bars How many bars to generate; defaults to the level maximum. Shorter
 * melodies are used while the learner is starting out.
 */
const samePlace = (a: FretPosition, b: FretPosition) => a.string === b.string && a.fret === b.fret;

/** R13: the highest fret of the window that carries an in-key note on one of the level's strings, as positions. */
export function topFretPositions(config: LevelConfig, key: Key): FretPosition[] {
  for (let fret = config.fretRange[1]; fret >= config.fretRange[0]; fret--) {
    const at = config.strings.map((string) => ({ string, fret })).filter((p) => isDiatonic(midiAt(p), key));
    if (at.length > 0) return at;
  }
  return [];
}

/** R14: a note altered by the key signature (not a raised minor degree) is present. */
export function hasSignatureNote(melody: Melody): boolean {
  return melody.notes.some((n) => {
    const info = degreeInfoOf(n.midi, melody.key);
    return !!info && !info.raised && spellInKey(n.midi, melody.key).accidental !== 0;
  });
}

/** Position rules a level imposes on a melody in a key (R7, R13): sets of positions, one note on each set. */
export function positionRules(config: LevelConfig, key: Key): FretPosition[][] {
  const rules: FretPosition[][] = [];
  if (config.introduces && config.introduces.length > 0) rules.push([...config.introduces]);
  if (config.featureFret) rules.push(topFretPositions(config, key));
  return rules.filter((r) => r.length > 0);
}

const usesOneOf = (m: Melody, set: readonly FretPosition[]) => m.notes.some((n) => set.some((p) => samePlace(p, n)));

/**
 * Meet every position rule with a different note each, moving a note of the
 * right pitch onto a qualifying position where the walk did not land there by
 * itself (a pitch may live in two places). Returns null when no assignment of
 * notes to rules exists.
 */
function settlePositions(melody: Melody, rules: readonly FretPosition[][]): Melody | null {
  const notes = melody.notes.map((n) => ({ ...n }));
  // For each rule, the (note, position) pairs that would satisfy it: the note's own position when it
  // already qualifies (listed first, so nothing moves without need), or another place for the same pitch.
  const options = rules.map((set) =>
    notes.flatMap((n, i) => {
      const own = set.some((p) => samePlace(p, n)) ? [{ i, at: { string: n.string, fret: n.fret } }] : [];
      const moves = set.filter((p) => midiAt(p) === n.midi && !samePlace(p, n)).map((at) => ({ i, at }));
      return [...own, ...moves];
    }),
  );
  // One note may serve several rules, as long as every rule wants it in the same place.
  const assigned = new Map<number, FretPosition>();
  const search = (r: number): boolean => {
    if (r === rules.length) return true;
    for (const { i, at } of options[r]!) {
      const current = assigned.get(i);
      if (current && !samePlace(current, at)) continue;
      if (!current) assigned.set(i, at);
      if (search(r + 1)) return true;
      if (!current) assigned.delete(i);
    }
    return false;
  };
  if (!search(0)) return null;
  for (const [i, at] of assigned) notes[i] = { ...notes[i]!, string: at.string, fret: at.fret };
  return { ...melody, notes };
}

const ATTEMPTS = 200;
/** Step between redraw seeds: large and odd, so redraws of neighbouring seeds never coincide. */
const REDRAW_STEP = 1013904223;

/**
 * A melody that meets the level's rules (docs/rules.md): redraw until it does,
 * moving notes between positions where only the place is wrong. If no draw
 * meets every rule, the draw that meets most of them is used.
 */
export function generateMelody(config: LevelConfig, seed: number, counts: number = config.maxCounts): Melody {
  let best: { melody: Melody; met: number } | null = null;
  // The key is drawn once from the seed and kept through every redraw, so the rules never bias which keys come up.
  const first = generateOnce(config, seed, counts);
  for (let attempt = 0; attempt < ATTEMPTS; attempt++) {
    const drawn = attempt === 0 ? first : generateOnce(config, seed + attempt * REDRAW_STEP, counts, first.key);
    const rules = positionRules(config, drawn.key);
    const needsSignature = keySignatureCount(drawn.key) !== 0;
    const signatureOk = !needsSignature || hasSignatureNote(drawn);
    const settled = settlePositions(drawn, rules);
    if (settled && signatureOk) return { ...settled, seed };
    const met = (signatureOk ? 1 : 0) + rules.filter((r) => usesOneOf(settled ?? drawn, r)).length;
    if (!best || met > best.met) best = { melody: { ...(settled ?? drawn), seed }, met };
  }
  return best!.melody;
}

function generateOnce(config: LevelConfig, seed: number, counts: number, fixedKey?: Key): Melody {
  if (counts < MIN_COUNTS || counts > config.maxCounts) {
    throw new Error(`Level ${config.id}: ${counts} counts is outside ${MIN_COUNTS}..${config.maxCounts}`);
  }
  const barBeats = barBeatsForCounts(counts);
  const rng = createRng(seed);
  // The key is drawn first so a seed fixes the key as well as the notes.
  const key = fixedKey ?? rng.pick(config.keys);
  const pool = pitchPool(config, key);
  if (pool.length === 0) throw new Error(`Level ${config.id}: no playable in-key pitches`);

  const rhythm = generateRhythm(config, rng, barBeats);
  const count = rhythm.length;

  // Which notes fall on the first beat of a bar: those prefer chord tones so the
  // melody keeps its footing in the key, whatever the meter.
  const barStarts = new Set<number>();
  {
    let position = 0;
    let barIndex = 0;
    let barEnd = barBeats[0]!;
    rhythm.forEach((d, i) => {
      if (Math.abs(position - (barEnd - barBeats[barIndex]!)) < 1e-9) barStarts.add(i);
      position += beatsOf(d);
      if (position >= barEnd - 1e-9 && barIndex < barBeats.length - 1) {
        barIndex++;
        barEnd += barBeats[barIndex]!;
      }
    });
  }
  const chordTones = chordTonePitchClasses(key);
  const isChordTone = (p: PoolNote) => chordTones.includes(pitchClass(p.midi));

  const starts = pool.filter((p) => config.startDegrees.includes(p.degree));
  const ends = pool.filter((p) => config.endDegrees.includes(p.degree));
  if (starts.length === 0 || ends.length === 0) {
    throw new Error(`Level ${config.id}: start/end degrees of ${key.tonic} are not playable in the fret window`);
  }

  const chosen: PoolNote[] = [rng.pick(starts)];
  for (let i = 1; i < count; i++) {
    const previous = chosen[i - 1]!;
    let candidates = withinLeap(pool, previous, config.maxLeapSteps).filter((c) => allowedByMode(key, previous, c));
    if (candidates.length === 0) candidates = withinLeap(pool, previous, config.maxLeapSteps);
    if (barStarts.has(i) && i !== count - 1) {
      const strong = candidates.filter(isChordTone);
      if (strong.length > 0) candidates = strong;
    }
    if (i === count - 1) {
      const endCandidates = candidates.filter((p) => config.endDegrees.includes(p.degree));
      candidates = endCandidates.length > 0 ? endCandidates : [nearest(ends, previous)];
    }
    let next = rng.pick(candidates);
    // Repeated notes are allowed but should not dominate: re-roll once.
    if (next === previous && candidates.length > 1) next = rng.pick(candidates);
    chosen.push(next);
  }

  const notes: MelodyNote[] = [];
  let previousPosition: FretPosition | null = null;
  chosen.forEach((p, i) => {
    const position = choosePosition(p, previousPosition);
    previousPosition = position;
    notes.push({ midi: p.midi, duration: rhythm[i]!, string: position.string, fret: position.fret });
  });

  return {
    seed,
    levelId: config.id,
    key,
    tempo: config.tempo,
    barBeats,
    timeSignature: [barBeats[0]!, 4],
    bars: barBeats.length,
    counts,
    notes,
  };
}
