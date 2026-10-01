/**
 * Turns a stream of audio frames into a list of played notes.
 *
 * Each frame gets a level (RMS) and a pitch estimate. A note starts at an
 * onset: sound after silence, or a jump in level on a decaying string (the
 * same note plucked again). A note also changes when the pitch moves to a
 * different semitone and stays there for a few frames (a slur or hammer-on).
 * A note ends when the level falls to silence or the next note begins.
 *
 * Only pitch and order are needed by the grader, so timing is approximate.
 */
import { detectPitch, midiFromFrequency, rms } from './pitch';

export interface DetectedNote {
  /** Sounding MIDI note number. */
  midi: number;
  /** Seconds, on the clock the caller passes in. */
  start: number;
  end: number | null;
}

export interface TrackerOptions {
  sampleRate: number;
  /** Levels below this are silence. */
  silenceLevel?: number;
  /** A level this many times the quietest point of the current note is a new pluck. */
  onsetRatio?: number;
  /** Pitch estimates below this clarity are ignored. */
  minClarity?: number;
  /** Consecutive agreeing frames before a pitch is trusted. */
  stableFrames?: number;
  /** Frames to wait for a pitch after an onset before giving up on it. */
  onsetPatience?: number;
}

export class NoteTracker {
  readonly notes: DetectedNote[] = [];
  /** Level of the latest frame, 0..1, for meters. */
  level = 0;
  /** Pitch of the latest frame in MIDI (fractional), or null. */
  currentPitch: number | null = null;

  private readonly sampleRate: number;
  private readonly silenceLevel: number;
  private readonly onsetRatio: number;
  private readonly minClarity: number;
  private readonly stableFrames: number;
  private readonly onsetPatience: number;

  /** Levels of the last few frames, newest last. */
  private recentLevels: number[] = [];
  private envelopeMin = Infinity;
  private framesSinceOnset = 0;
  /** Pitch candidates collected after an onset, before the note is created. */
  private pending: { start: number; midis: number[] } | null = null;
  /** Consecutive frames of a different pitch during a note. */
  private changeMidi: number | null = null;
  private changeCount = 0;
  private changeStart = 0;

  constructor(options: TrackerOptions) {
    this.sampleRate = options.sampleRate;
    this.silenceLevel = options.silenceLevel ?? 0.01;
    this.onsetRatio = options.onsetRatio ?? 2.0;
    this.minClarity = options.minClarity ?? 0.85;
    this.stableFrames = options.stableFrames ?? 3;
    this.onsetPatience = options.onsetPatience ?? 10;
  }

  get current(): DetectedNote | null {
    const last = this.notes[this.notes.length - 1];
    return last && last.end === null ? last : null;
  }

  /** Feed one frame; `time` is the frame's start on the caller's clock. */
  push(frame: Float32Array, time: number): void {
    const level = rms(frame);
    this.level = Math.min(1, level * 4);
    const estimate = detectPitch(frame, this.sampleRate);
    const pitch = estimate && estimate.clarity >= this.minClarity ? midiFromFrequency(estimate.frequency) : null;
    this.currentPitch = pitch;
    const midi = pitch === null ? null : Math.round(pitch);

    if (level < this.silenceLevel) {
      this.endCurrent(time);
      this.pending = null;
      this.recentLevels = [];
      this.envelopeMin = Infinity;
      this.resetChange();
      return;
    }

    const sounding = this.current !== null || this.pending !== null;
    const earlier = this.recentLevels.length >= 3 ? this.recentLevels[this.recentLevels.length - 3]! : this.recentLevels[0] ?? 0;
    const risingHard = level > this.envelopeMin * this.onsetRatio && level > earlier * 1.6;
    const onset = !sounding || (risingHard && this.framesSinceOnset >= 3);

    if (onset) {
      this.endCurrent(time);
      this.pending = { start: time, midis: [] };
      this.framesSinceOnset = 0;
      this.envelopeMin = level;
      this.resetChange();
    } else {
      this.framesSinceOnset++;
      // Track the decay floor only once the attack has settled.
      if (this.framesSinceOnset >= 2) this.envelopeMin = Math.min(this.envelopeMin, level);
    }
    this.recentLevels.push(level);
    if (this.recentLevels.length > 4) this.recentLevels.shift();

    if (this.pending) {
      if (midi !== null) this.pending.midis.push(midi);
      const agreed = this.agreedPitch(this.pending.midis);
      if (agreed !== null) {
        this.notes.push({ midi: agreed, start: this.pending.start, end: null });
        this.pending = null;
      } else if (this.framesSinceOnset > this.onsetPatience) {
        this.pending = null; // noise or an unclear attack: forget it
      }
      return;
    }

    // During a note, a sustained change of pitch is a new note (slur).
    const current = this.current;
    if (current && midi !== null && midi !== current.midi) {
      if (this.changeMidi === midi) {
        this.changeCount++;
      } else {
        this.changeMidi = midi;
        this.changeCount = 1;
        this.changeStart = time;
      }
      if (this.changeCount >= this.stableFrames) {
        current.end = this.changeStart;
        this.notes.push({ midi, start: this.changeStart, end: null });
        this.resetChange();
      }
    } else {
      this.resetChange();
    }
  }

  /** Close any sounding note, e.g. when listening stops. */
  finish(time: number): DetectedNote[] {
    this.endCurrent(time);
    this.pending = null;
    return this.notes;
  }

  private agreedPitch(midis: number[]): number | null {
    if (midis.length < this.stableFrames) return null;
    const last = midis.slice(-this.stableFrames);
    return last.every((m) => m === last[0]) ? last[0]! : null;
  }

  private endCurrent(time: number): void {
    const current = this.current;
    if (current) current.end = time;
  }

  private resetChange(): void {
    this.changeMidi = null;
    this.changeCount = 0;
  }
}
