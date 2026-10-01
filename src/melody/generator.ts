/**
 * Rule-based, seeded melody generator.
 *
 * Given a LevelConfig and a seed it always produces the same melody. Rules:
 *  - only pitches playable on the configured strings/frets AND in the key
 *  - every bar sums exactly to the time signature
 *  - consecutive notes never leap more than `maxLeapSteps` diatonic steps
 *  - the first note is on a start degree, the last note on an end degree
 */
import { beatsOf, beatsPerBar, cellBeats, DURATIONS, type DurationId } from '../music/duration';
import { midiAt, type FretPosition } from '../music/fretboard';
import { degreeInfoOf, degreeOf, isDiatonic, spellInKey, type Key } from '../music/key';
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
export function generateRhythm(config: LevelConfig, rng: Rng, bars: number = config.bars): DurationId[] {
  const perBar = beatsPerBar(config.timeSignature);
  const out: DurationId[] = [];
  for (let bar = 0; bar < bars; bar++) {
    let remaining = perBar;
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
export function generateMelody(config: LevelConfig, seed: number, bars: number = config.bars): Melody {
  if (bars < 1 || bars > config.bars) throw new Error(`Level ${config.id}: ${bars} bars is outside 1..${config.bars}`);
  const rng = createRng(seed);
  // The key is drawn first so a seed fixes the key as well as the notes.
  const key = rng.pick(config.keys);
  const pool = pitchPool(config, key);
  if (pool.length === 0) throw new Error(`Level ${config.id}: no playable in-key pitches`);

  const rhythm = generateRhythm(config, rng, bars);
  const count = rhythm.length;

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
    timeSignature: config.timeSignature,
    bars,
    notes,
  };
}
