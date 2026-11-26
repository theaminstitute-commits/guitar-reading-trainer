/**
 * The play round (R46): after Check, the learner plays the melody on the fretboard in time.
 * A note counts when the right pitch is tapped (on any string) within ±20% of a beat of its
 * time. A chord counts when its first tap lands in that window and every chord note is tapped
 * (a strum, or several fingers at once).
 *
 * Each tap is matched to the nearest note of its pitch within a beat, so a note played early or
 * late is reported as timing, not as a wrong note. A tap that matches no note is an extra: a note
 * played again (a half note tapped twice), or a wrong pitch. Times are seconds on the audio clock,
 * as heard (output latency taken out by the caller).
 */
import { groupEvents } from '../melody/bars';
import type { Melody } from '../melody/types';
import { beatsInWords, beatsOf, DURATIONS, type DurationId } from '../music/duration';
import { spellInKey, type Key } from '../music/key';
import { spelledName, writtenFromSounding, type Midi } from '../music/pitch';

/** The timing window either side of a note, as a fraction of a beat (the user, 2026-11-26: 10%, doubled to 20% the same day). */
export const TIMING_WINDOW = 0.2;
/** How far from its note a tap of the right pitch is still that note, played early or late. */
const REACH_BEATS = 1;

/** One note or chord to play: when it is due, in beats from the first beat, its sounding pitches and length. */
export interface PlayTarget {
  beat: number;
  midis: Midi[];
  duration: DurationId;
}

export interface PlayTap {
  /** Audio-clock seconds, as heard. */
  time: number;
  midi: Midi;
}

export type PlayVerdict = 'good' | 'early' | 'late' | 'wrong' | 'missed' | 'incomplete';

export interface PlayedEvent {
  verdict: PlayVerdict;
  /** How far the first tap was from the beat, in beats (negative: early). */
  offsetBeats?: number;
  /** A wrong note: the pitch played in its place. */
  played?: Midi;
}

/** A tap that belongs to no note. `repeat`: a note played again; `wrong`: a pitch that is not there; before or after the melody. */
export interface ExtraTap {
  kind: 'repeat' | 'wrong' | 'before' | 'after';
  midi: Midi;
  /** Beats from the first beat. */
  beat: number;
  /** The note it concerns: the one repeated, or the one it landed on. */
  event?: number;
}

export interface PlayGrade {
  events: PlayedEvent[];
  extras: ExtraTap[];
  /** Notes and chords played right and in time. */
  good: number;
  total: number;
  passed: boolean;
}

/** The melody as events to play, each with its beat. */
export function playTargets(melody: Pick<Melody, 'notes'>): PlayTarget[] {
  let beat = 0;
  return groupEvents(melody.notes).map((group) => {
    const target = { beat, midis: group.map((n) => n.midi), duration: group[0]!.duration };
    beat += beatsOf(group[0]!.duration);
    return target;
  });
}

/** Grades the taps of one take. `start` is the audio time of the first beat. */
export function gradePlaying(targets: readonly PlayTarget[], taps: readonly PlayTap[], start: number, secondsPerBeat: number, window = TIMING_WINDOW): PlayGrade {
  const last = targets[targets.length - 1]!;
  const end = last.beat + beatsOf(last.duration);
  const assigned: { beat: number; midi: Midi }[][] = targets.map(() => []);
  const extras: ExtraTap[] = [];
  /** The note whose time is nearest a beat: where a tap landed. */
  const placeOf = (beat: number) => targets.reduce((best, t, i) => (Math.abs(t.beat - beat) < Math.abs(targets[best]!.beat - beat) ? i : best), 0);

  for (const tap of [...taps].sort((a, b) => a.time - b.time)) {
    const beat = (tap.time - start) / secondsPerBeat;
    if (beat < -0.5) {
      extras.push({ kind: 'before', midi: tap.midi, beat });
      continue;
    }
    if (beat >= end) {
      extras.push({ kind: 'after', midi: tap.midi, beat });
      continue;
    }
    // The nearest note of this pitch, within a beat, that still needs it.
    let best = -1;
    targets.forEach((t, i) => {
      if (!t.midis.includes(tap.midi) || assigned[i]!.some((a) => a.midi === tap.midi)) return;
      if (Math.abs(beat - t.beat) > REACH_BEATS) return;
      if (best < 0 || Math.abs(beat - t.beat) < Math.abs(beat - targets[best]!.beat)) best = i;
    });
    if (best >= 0) {
      assigned[best]!.push({ beat, midi: tap.midi });
      continue;
    }
    // No note wants it. The same pitch as a note already played before it: played again.
    let repeated = -1;
    targets.forEach((t, i) => {
      if (t.beat <= beat + window && t.midis.includes(tap.midi)) repeated = i;
    });
    if (repeated >= 0 && assigned[repeated]!.length > 0) extras.push({ kind: 'repeat', midi: tap.midi, beat, event: repeated });
    else extras.push({ kind: 'wrong', midi: tap.midi, beat, event: placeOf(beat) });
  }

  const events: PlayedEvent[] = targets.map((t, i) => {
    const mine = assigned[i]!;
    if (mine.length === 0) {
      // Nothing of its own: whatever was tapped in its place is what was played instead.
      const instead = extras.findIndex((x) => (x.kind === 'wrong' || x.kind === 'repeat') && placeOf(x.beat) === i);
      if (instead < 0) return { verdict: 'missed' };
      const [x] = extras.splice(instead, 1);
      return { verdict: 'wrong', played: x!.midi, offsetBeats: x!.beat - t.beat };
    }
    const offsetBeats = Math.min(...mine.map((a) => a.beat)) - t.beat;
    if (new Set(mine.map((a) => a.midi)).size < new Set(t.midis).size) return { verdict: 'incomplete', offsetBeats };
    if (Math.abs(offsetBeats) > window + 1e-9) return { verdict: offsetBeats < 0 ? 'early' : 'late', offsetBeats };
    return { verdict: 'good', offsetBeats };
  });

  const good = events.filter((e) => e.verdict === 'good').length;
  return { events, extras, good, total: targets.length, passed: good === targets.length && extras.length === 0 };
}

/** "beat 3", "between beats 2 and 3", with the bar when the melody has more than one. */
export function beatLabel(beat: number, barBeats: readonly number[]): string {
  let bar = 0;
  let from = 0;
  while (bar < barBeats.length - 1 && beat >= from + barBeats[bar]! - TIMING_WINDOW) {
    from += barBeats[bar]!;
    bar += 1;
  }
  const inBar = Math.max(0, beat - from);
  const near = Math.round(inBar);
  const where = Math.abs(inBar - near) <= TIMING_WINDOW ? `beat ${near + 1}` : `between beats ${Math.floor(inBar) + 1} and ${Math.floor(inBar) + 2}`;
  return barBeats.length > 1 ? `bar ${bar + 1}, ${where}` : where;
}

const amount = (beats: number) => (Math.abs(beats) < 0.95 ? `${Math.round(Math.abs(beats) * 100)}% of a beat` : `${Math.abs(beats).toFixed(1)} beats`);
const lengthName = (d: DurationId) => `${DURATIONS[d].label.toLowerCase()} (${beatsInWords(beatsOf(d))})`;

export interface PlayProblem {
  /** "Note 2, D5", "Chord 3", "Before the first note". */
  title: string;
  /** Timing or pitch, so a timing slip is never called a wrong note. */
  kind: 'timing' | 'pitch' | 'missing';
  text: string;
}

/** Every problem of a take, in melody order, in words. */
export function describePlay(grade: PlayGrade, melody: Pick<Melody, 'notes' | 'key' | 'barBeats'>): PlayProblem[] {
  const targets = playTargets(melody);
  const groups = groupEvents(melody.notes);
  const key: Key = melody.key;
  const name = (midi: Midi) => {
    const s = spellInKey(writtenFromSounding(midi), key);
    return `${spelledName(s)}${s.octave}`;
  };
  const noteName = (i: number) => {
    const n = groups[i]![0]!;
    const s = n.spelled ?? spellInKey(writtenFromSounding(n.midi), key);
    return `${spelledName(s)}${s.octave}`;
  };
  const title = (i: number) => (groups[i]!.length > 1 ? `Chord ${i + 1}` : `Note ${i + 1}, ${noteName(i)}`);
  const what = (i: number) => (groups[i]!.length > 1 ? `chord ${i + 1}` : noteName(i));
  const at = (beat: number) => beatLabel(beat, melody.barBeats);
  const out: { order: number; problem: PlayProblem }[] = [];

  grade.events.forEach((e, i) => {
    const t = targets[i]!;
    let problem: PlayProblem | null = null;
    if (e.verdict === 'early' || e.verdict === 'late') problem = { title: title(i), kind: 'timing', text: `${e.verdict === 'early' ? 'Early' : 'Late'} by ${amount(e.offsetBeats!)}. It comes on ${at(t.beat)}.` };
    else if (e.verdict === 'missed') problem = { title: title(i), kind: 'missing', text: `Not played. It comes on ${at(t.beat)}.` };
    else if (e.verdict === 'incomplete') problem = { title: title(i), kind: 'pitch', text: 'Not every note of the chord was played.' };
    else if (e.verdict === 'wrong' && e.played !== undefined) {
      const prev = targets[i - 1];
      const next = targets[i + 1];
      if (prev && prev.midis.includes(e.played))
        problem = { title: title(i), kind: 'timing', text: `${what(i - 1)} was played again here instead. ${what(i - 1)} is a ${lengthName(prev.duration)}: play it once and hold it, then ${what(i)} comes in on ${at(t.beat)}.` };
      else if (next && next.midis.includes(e.played)) problem = { title: title(i), kind: 'timing', text: `${what(i + 1)} came too soon, in this note's place. ${what(i)} comes on ${at(t.beat)}, ${what(i + 1)} on ${at(next.beat)}.` };
      else problem = { title: title(i), kind: 'pitch', text: `${name(e.played)} was played instead.` };
    }
    if (problem) out.push({ order: t.beat, problem });
  });

  for (const x of grade.extras) {
    let problem: PlayProblem;
    if (x.kind === 'before') problem = { title: 'Before the first note', kind: 'timing', text: `${name(x.midi)} was played during the count-in. The melody starts after it.` };
    else if (x.kind === 'after') problem = { title: 'After the last note', kind: 'timing', text: `${name(x.midi)} was played after the melody had ended.` };
    else if (x.kind === 'repeat') {
      const t = targets[x.event!]!;
      problem = {
        title: title(x.event!),
        kind: 'timing',
        text: `Played again on ${at(x.beat)}. It is a ${lengthName(t.duration)}: play it once and hold it${targets[x.event! + 1] ? ` until ${what(x.event! + 1)} on ${at(targets[x.event! + 1]!.beat)}` : ''}.`,
      };
    } else problem = { title: `Extra note on ${at(x.beat)}`, kind: 'pitch', text: `${name(x.midi)} was played, as well as ${what(x.event!)}.` };
    out.push({ order: x.beat, problem });
  }
  return out.sort((a, b) => a.order - b.order).map((o) => o.problem);
}
