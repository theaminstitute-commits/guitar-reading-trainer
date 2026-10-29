/**
 * Guitar playback with Tone.js.
 *
 * Plays any list of {midi, duration} notes (a target melody or a learner's
 * answer) at a tempo, with an optional one-bar count-in click. UI callbacks fire
 * in sync with the audio so the fretboard can highlight each note.
 *
 * All pitches here are SOUNDING pitches.
 */
import * as Tone from 'tone';
import { seikoClick } from './click';
import { unlockAudio } from './unlock';
import { groupEvents, totalBeats as countBeats } from '../melody/bars';
import { beatsOf, beatsPerBar, type DurationId } from '../music/duration';
import type { Midi } from '../music/pitch';
import { loadSampleBuffers } from './loadSamples';
import { GUITAR_SAMPLES } from './sampleMap';

export interface PlayableNote {
  midi: Midi;
  duration: DurationId;
  /** Notes with the same id sound together, strummed from the lowest up. */
  chord?: number;
}

/** Seconds between the notes of a strummed chord. */
const STRUM = 0.022;

export interface PlayOptions {
  tempo: number;
  /** Playback speed multiplier: 1 = normal, 0.7 = slow. */
  rate?: number;
  timeSignature: readonly [number, number];
  countIn?: boolean;
  /** Click on every beat while the notes play, accented on the first beat of each bar. */
  metronome?: boolean;
  /** Beats per bar for the accent pattern; the time signature repeats when absent. */
  barBeats?: readonly number[];
  /** Sounding pitch to play as a tonal reference before the count-in, and how many times. */
  reference?: { midi: Midi; times: number };
}

export interface PlayerEvents {
  /** Reference note `index` (0-based) of `total` has started. */
  onReference?: (index: number, total: number) => void;
  /** Count-in click `beat` (0-based) of `total`. */
  onCountIn?: (beat: number, total: number) => void;
  /** Note `index` has just started sounding. */
  onNote?: (index: number) => void;
  /** Playback finished or was stopped. `completed` is false when stopped early. */
  onEnd?: (completed: boolean) => void;
}

/**
 * Run a UI callback when the audio clock reaches `time`. Uses setTimeout rather
 * than Tone.Draw (requestAnimationFrame) so callbacks still fire, a little late,
 * when the tab is in the background; otherwise the UI could get stuck mid-playback.
 */
function uiAt(fn: () => void, time: number): void {
  const ms = (time - Tone.getContext().currentTime) * 1000;
  setTimeout(fn, Math.max(0, ms));
}

/** Fraction of a note's length that actually rings, leaving a small gap between notes. */
const GATE = 0.92;

export class GuitarPlayer {
  /** The guitar sampler once loaded. */
  sampler: Tone.Sampler | null = null;
  private click: Tone.ToneAudioBuffer | null = null;
  private clickGain: Tone.Gain | null = null;
  private loading: Promise<void> | null = null;
  private scheduledIds: number[] = [];
  private currentEvents: PlayerEvents | null = null;
  private _isPlaying = false;

  get isPlaying(): boolean {
    return this._isPlaying;
  }

  /** Decodes the samples once. Starting the sound itself is unlockAudio's job (R35): never awaited, so a tap iOS refuses cannot stall every later play. */
  load(): Promise<void> {
    unlockAudio();
    if (!this.loading) {
      this.loading = (async () => {
        const buffers = await loadSampleBuffers(GUITAR_SAMPLES);
        this.sampler = new Tone.Sampler({
          urls: buffers,
          release: 0.6,
          volume: 2,
        }).toDestination();
        // The Seiko-style beep from the user's Tempus metronome, rendered once into a buffer.
        const rate = Tone.getContext().sampleRate;
        const samples = seikoClick(rate);
        const buffer = Tone.getContext().createBuffer(1, samples.length, rate);
        buffer.copyToChannel(samples, 0);
        this.click = new Tone.ToneAudioBuffer(buffer);
        this.clickGain = new Tone.Gain(0.5).toDestination();
        await Tone.loaded();
      })();
    }
    return this.loading;
  }

  get isLoaded(): boolean {
    return this.sampler !== null && this.sampler.loaded;
  }

  async play(notes: readonly PlayableNote[], options: PlayOptions, events: PlayerEvents = {}) {
    // Before any await: still inside the tap, where iOS allows sound to start.
    unlockAudio();
    await this.load();
    this.stop();
    const sampler = this.sampler!;
    const transport = Tone.getTransport();

    const rate = options.rate ?? 1;
    const secondsPerBeat = 60 / (options.tempo * rate);
    const countInBeats = options.countIn === false ? 0 : beatsPerBar(options.timeSignature);

    this.currentEvents = events;
    this._isPlaying = true;
    transport.cancel(0);
    transport.position = 0;

    let cursor = 0;
    if (options.reference && options.reference.times > 0) {
      // The key note, quickly: one beat apart at the written tempo whatever the playback rate,
      // then half a beat of air before the count-in. Two tonics at 72 bpm take 2.1 s, not the
      // 4.2 s (6 s in slow mode) of the old two-beat spacing and full-beat rest.
      const { midi, times } = options.reference;
      const name = Tone.Frequency(midi, 'midi').toNote();
      const referenceBeat = 60 / options.tempo;
      for (let i = 0; i < times; i++) {
        const at = cursor;
        const index = i;
        this.scheduledIds.push(
          transport.schedule((time) => {
            sampler.triggerAttackRelease(name, referenceBeat * 1.4, time);
            uiAt(() => events.onReference?.(index, times), time);
          }, at),
        );
        cursor += referenceBeat;
      }
      cursor += referenceBeat * 0.5;
    }
    for (let beat = 0; beat < countInBeats; beat++) {
      const at = cursor;
      const b = beat;
      this.scheduledIds.push(
        transport.schedule((time) => {
          this.tick(time, b === 0);
          uiAt(() => events.onCountIn?.(b, countInBeats), time);
        }, at),
      );
      cursor += secondsPerBeat;
    }

    if (options.metronome) {
      const totalBeats = countBeats(notes);
      let beatInBar = 0;
      let bar = 0;
      for (let beat = 0; beat < totalBeats; beat++) {
        const barLength = options.barBeats?.[bar] ?? beatsPerBar(options.timeSignature);
        const accent = beatInBar === 0;
        this.scheduledIds.push(
          transport.schedule((time) => {
            this.tick(time, accent);
          }, cursor + beat * secondsPerBeat),
        );
        beatInBar += 1;
        if (beatInBar >= barLength) {
          beatInBar = 0;
          bar += 1;
        }
      }
    }

    let index = 0;
    for (const group of groupEvents(notes)) {
      const at = cursor;
      const length = beatsOf(group[0]!.duration) * secondsPerBeat;
      const firstIndex = index;
      index += group.length;
      group.forEach((note, k) => {
        const name = Tone.Frequency(note.midi, 'midi').toNote();
        const offset = k * STRUM;
        this.scheduledIds.push(
          transport.schedule((time) => {
            sampler.triggerAttackRelease(name, Math.max(0.05, length * GATE - offset), time);
            if (k === 0) uiAt(() => events.onNote?.(firstIndex), time);
          }, at + offset),
        );
      });
      cursor += length;
    }

    this.scheduledIds.push(
      transport.schedule((time) => {
        uiAt(() => this.finish(true), time);
      }, cursor + 0.05),
    );

    transport.start();
  }

  /** The audio context's clock in seconds: what click times and tap times are compared on. */
  now(): number {
    return Tone.getContext().currentTime;
  }

  /**
   * A plain click track: `countIn` clicks, then `beats` more, at a tempo. Returns the
   * context times of the clicks after the count-in, so taps can be graded against them.
   */
  async clickTrack(tempo: number, beats: number, countIn = 4, onTick?: (index: number) => void): Promise<number[]> {
    unlockAudio();
    await this.load();
    this.stop();
    const spb = 60 / tempo;
    const start = this.now() + 0.35;
    const graded: number[] = [];
    for (let i = 0; i < countIn + beats; i++) {
      const time = start + i * spb;
      this.tick(time, false);
      if (i >= countIn) graded.push(time);
      const index = i;
      uiAt(() => onTick?.(index), time);
    }
    return graded;
  }

  /** One click at an audio-context time: one uniform click, like Tempus, with no accent (the `accent` flag is kept for callers and ignored). */
  private tick(time: number, accent: boolean): void {
    if (!this.click || !this.clickGain) return;
    const source = new Tone.ToneBufferSource({ url: this.click, onended: () => source.dispose() }).connect(this.clickGain);
    void accent;
    source.start(time);
  }

  stop(): void {
    if (this._isPlaying) this.finish(false);
  }

  private finish(completed: boolean): void {
    const transport = Tone.getTransport();
    for (const id of this.scheduledIds) transport.clear(id);
    this.scheduledIds = [];
    transport.stop();
    transport.cancel(0);
    this.sampler?.releaseAll();
    const events = this.currentEvents;
    this.currentEvents = null;
    this._isPlaying = false;
    events?.onEnd?.(completed);
  }

  dispose(): void {
    this.stop();
    this.sampler?.dispose();
    this.click?.dispose();
    this.clickGain?.dispose();
    this.clickGain = null;
    this.sampler = null;
    this.click = null;
    this.loading = null;
  }
}

let shared: GuitarPlayer | null = null;

/** One player for the whole app, so samples are decoded once and screens can share it. */
export function sharedPlayer(): GuitarPlayer {
  return (shared ??= new GuitarPlayer());
}
