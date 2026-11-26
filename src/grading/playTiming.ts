/**
 * The play round (R46): after Check, the learner plays the melody on the fretboard in time.
 * A note counts when the right pitch is tapped (on any string) within ±10% of a beat of its
 * time. A chord counts when its first tap lands in that window and every chord note is tapped
 * before the next note is due, with nothing wrong in between (a strum, or several fingers at once).
 *
 * Times are seconds on the audio clock, as heard (output latency taken out by the caller).
 */
import { groupEvents } from '../melody/bars';
import type { Melody } from '../melody/types';
import { beatsOf } from '../music/duration';
import type { Midi } from '../music/pitch';

/** The timing window either side of a note, as a fraction of a beat (the user, 2026-11-26: 10%). */
export const TIMING_WINDOW = 0.1;

/** One note or chord to play: when it is due, in beats from the first beat, and its sounding pitches. */
export interface PlayTarget {
  beat: number;
  midis: Midi[];
}

export interface PlayTap {
  /** Audio-clock seconds, as heard. */
  time: number;
  midi: Midi;
}

export type PlayVerdict = 'good' | 'early' | 'late' | 'wrong' | 'missed' | 'incomplete' | 'extra';

export interface PlayedEvent {
  verdict: PlayVerdict;
  /** How far the first right tap was from the beat, in beats (negative: early). */
  offsetBeats?: number;
}

export interface PlayGrade {
  events: PlayedEvent[];
  /** Notes and chords played right and in time. */
  good: number;
  total: number;
  /** Taps outside every note's reach (before the first or after the last). */
  stray: number;
  passed: boolean;
}

/** The melody as events to play, each with its beat. */
export function playTargets(melody: Pick<Melody, 'notes'>): PlayTarget[] {
  let beat = 0;
  return groupEvents(melody.notes).map((group) => {
    const target = { beat, midis: group.map((n) => n.midi) };
    beat += beatsOf(group[0]!.duration);
    return target;
  });
}

/**
 * Grades the taps of one take. `start` is the audio time of the first beat; `secondsPerBeat` the tempo.
 * Each event owns the taps from halfway after the previous event to halfway before the next (half a
 * beat before the first and up to its own length after the last); a tap outside all of them is stray.
 */
export function gradePlaying(targets: readonly PlayTarget[], taps: readonly PlayTap[], start: number, secondsPerBeat: number, lastLength = 1, window = TIMING_WINDOW): PlayGrade {
  const timeOf = (beat: number) => start + beat * secondsPerBeat;
  const bounds = targets.map((t, i) => {
    const prev = targets[i - 1];
    const next = targets[i + 1];
    const from = prev ? timeOf((prev.beat + t.beat) / 2) : timeOf(t.beat - 0.5);
    const to = next ? timeOf((t.beat + next.beat) / 2) : timeOf(t.beat + lastLength);
    return { from, to };
  });
  const claimed = new Set<number>();
  // A small epsilon so a tap exactly on the edge of the window still counts.
  const reach = window * secondsPerBeat + 1e-9;

  const events: PlayedEvent[] = targets.map((t, i) => {
    const { from, to } = bounds[i]!;
    const mine = taps.map((tap, k) => ({ tap, k })).filter(({ tap }) => tap.time >= from && tap.time < to);
    mine.forEach(({ k }) => claimed.add(k));
    const right = mine.filter(({ tap }) => t.midis.includes(tap.midi));
    const wrong = mine.length - right.length;
    if (right.length === 0) return { verdict: wrong > 0 ? 'wrong' : 'missed' };
    const first = right[0]!.tap;
    const offsetBeats = (first.time - timeOf(t.beat)) / secondsPerBeat;
    if (wrong > 0) return { verdict: 'wrong', offsetBeats };
    const pitches = new Set(right.map(({ tap }) => tap.midi));
    if (pitches.size < new Set(t.midis).size) return { verdict: 'incomplete', offsetBeats };
    if (right.length > t.midis.length) return { verdict: 'extra', offsetBeats };
    if (Math.abs(first.time - timeOf(t.beat)) > reach) return { verdict: offsetBeats < 0 ? 'early' : 'late', offsetBeats };
    return { verdict: 'good', offsetBeats };
  });

  const good = events.filter((e) => e.verdict === 'good').length;
  const stray = taps.length - claimed.size;
  return { events, good, total: targets.length, stray, passed: good === targets.length && stray === 0 };
}

/** What went wrong with one event, in a few words. */
export function verdictText(e: PlayedEvent, chord: boolean): string {
  const by = e.offsetBeats === undefined ? '' : ` by ${Math.abs(e.offsetBeats) < 0.95 ? `${Math.round(Math.abs(e.offsetBeats) * 100)}% of a beat` : `${Math.abs(e.offsetBeats).toFixed(1)} beats`}`;
  switch (e.verdict) {
    case 'good':
      return 'in time';
    case 'early':
      return `early${by}`;
    case 'late':
      return `late${by}`;
    case 'wrong':
      return chord ? 'a wrong note in the chord' : 'wrong note';
    case 'missed':
      return 'not played';
    case 'incomplete':
      return 'not every chord note played';
    case 'extra':
      return 'played more than once';
  }
}
