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
import { beatsOf, beatsPerBar, type DurationId } from '../music/duration';
import type { Midi } from '../music/pitch';
import { loadSampleBuffers } from './loadSamples';
import { GUITAR_SAMPLES } from './sampleMap';

export interface PlayableNote {
  midi: Midi;
  duration: DurationId;
}

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
  /** The guitar sampler once loaded; the self-play check listens to it directly. */
  sampler: Tone.Sampler | null = null;
  private click: Tone.Synth | null = null;
  private loading: Promise<void> | null = null;
  private scheduledIds: number[] = [];
  private currentEvents: PlayerEvents | null = null;
  private _isPlaying = false;
  private metronomeTimer: ReturnType<typeof setInterval> | null = null;

  get isPlaying(): boolean {
    return this._isPlaying;
  }

  /** Must be called from a user gesture the first time (mobile audio unlock). */
  load(): Promise<void> {
    if (!this.loading) {
      this.loading = (async () => {
        await Tone.start();
        const buffers = await loadSampleBuffers(GUITAR_SAMPLES);
        this.sampler = new Tone.Sampler({
          urls: buffers,
          release: 0.6,
          volume: 2,
        }).toDestination();
        this.click = new Tone.Synth({
          oscillator: { type: 'triangle' },
          envelope: { attack: 0.001, decay: 0.05, sustain: 0, release: 0.03 },
          volume: -8,
        }).toDestination();
        await Tone.loaded();
      })();
    }
    return this.loading;
  }

  get isLoaded(): boolean {
    return this.sampler !== null && this.sampler.loaded;
  }

  async play(notes: readonly PlayableNote[], options: PlayOptions, events: PlayerEvents = {}) {
    await this.load();
    this.stop();
    const sampler = this.sampler!;
    const click = this.click!;
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
      const { midi, times } = options.reference;
      const name = Tone.Frequency(midi, 'midi').toNote();
      for (let i = 0; i < times; i++) {
        const at = cursor;
        const index = i;
        this.scheduledIds.push(
          transport.schedule((time) => {
            sampler.triggerAttackRelease(name, secondsPerBeat * 1.8, time);
            uiAt(() => events.onReference?.(index, times), time);
          }, at),
        );
        cursor += secondsPerBeat * 2;
      }
      // A beat of silence between the reference and the count-in.
      cursor += secondsPerBeat;
    }
    for (let beat = 0; beat < countInBeats; beat++) {
      const at = cursor;
      const b = beat;
      this.scheduledIds.push(
        transport.schedule((time) => {
          click.triggerAttackRelease(b === 0 ? 1760 : 1320, 0.03, time);
          uiAt(() => events.onCountIn?.(b, countInBeats), time);
        }, at),
      );
      cursor += secondsPerBeat;
    }

    if (options.metronome) {
      const totalBeats = notes.reduce((sum, n) => sum + beatsOf(n.duration), 0);
      let beatInBar = 0;
      let bar = 0;
      for (let beat = 0; beat < totalBeats; beat++) {
        const barLength = options.barBeats?.[bar] ?? beatsPerBar(options.timeSignature);
        const accent = beatInBar === 0;
        this.scheduledIds.push(
          transport.schedule((time) => {
            click.triggerAttackRelease(accent ? 1760 : 1320, 0.03, time);
          }, cursor + beat * secondsPerBeat),
        );
        beatInBar += 1;
        if (beatInBar >= barLength) {
          beatInBar = 0;
          bar += 1;
        }
      }
    }

    notes.forEach((note, index) => {
      const at = cursor;
      const length = beatsOf(note.duration) * secondsPerBeat;
      const name = Tone.Frequency(note.midi, 'midi').toNote();
      this.scheduledIds.push(
        transport.schedule((time) => {
          sampler.triggerAttackRelease(name, length * GATE, time);
          uiAt(() => events.onNote?.(index), time);
        }, at),
      );
      cursor += length;
    });

    this.scheduledIds.push(
      transport.schedule((time) => {
        uiAt(() => this.finish(true), time);
      }, cursor + 0.05),
    );

    transport.start();
  }

  stop(): void {
    if (this._isPlaying) this.finish(false);
  }

  /**
   * A free-running click at a tempo, accented on the first beat of each bar
   * (the bar lengths cycle), independent of melody playback. `onTick` gets the
   * audio-context time of every click so a listener can ignore it.
   */
  async startMetronome(tempo: number, barBeats: readonly number[], onTick?: (contextTime: number, accent: boolean) => void): Promise<void> {
    await this.load();
    this.stopMetronome();
    const click = this.click!;
    const secondsPerBeat = 60 / tempo;
    const lookahead = 0.12;
    let next = Tone.now() + 0.1;
    let beatInBar = 0;
    let bar = 0;
    const schedule = () => {
      while (next < Tone.now() + lookahead) {
        const accent = beatInBar === 0;
        click.triggerAttackRelease(accent ? 1760 : 1320, 0.03, next);
        onTick?.(next, accent);
        next += secondsPerBeat;
        beatInBar += 1;
        if (beatInBar >= (barBeats[bar % Math.max(1, barBeats.length)] ?? 4)) {
          beatInBar = 0;
          bar += 1;
        }
      }
    };
    schedule();
    this.metronomeTimer = setInterval(schedule, 30);
  }

  stopMetronome(): void {
    if (this.metronomeTimer !== null) clearInterval(this.metronomeTimer);
    this.metronomeTimer = null;
  }

  get metronomeRunning(): boolean {
    return this.metronomeTimer !== null;
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
    this.stopMetronome();
    this.sampler?.dispose();
    this.click?.dispose();
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
