/**
 * Synthetic guitar-like signals for tests: a plucked note is a handful of
 * harmonics with a fast attack and an exponential decay.
 */
import { frequencyFromMidi } from './pitch';

export interface SynthNote {
  midi: number;
  /** Seconds after the start of the signal. */
  at: number;
  /** Seconds the string rings (it decays within this time). */
  length: number;
  amplitude?: number;
  /** 'pluck' restarts the envelope; 'slur' changes pitch without a new attack. */
  attack?: 'pluck' | 'slur';
}

export function synthesize(notes: SynthNote[], seconds: number, sampleRate = 44100): Float32Array {
  const out = new Float32Array(Math.round(seconds * sampleRate));
  const harmonics = [1, 0.5, 0.33, 0.2, 0.12, 0.08];
  const sorted = [...notes].sort((a, b) => a.at - b.at);
  sorted.forEach((note, index) => {
    const amp = note.amplitude ?? 0.4;
    const start = Math.round(note.at * sampleRate);
    // Plucking the same pitch again stops the string that was ringing.
    const next = sorted.slice(index + 1).find((n) => n.midi === note.midi && n.attack !== 'slur');
    const cutAt = next ? Math.round(next.at * sampleRate) : Infinity;
    const end = Math.min(out.length, Math.round((note.at + note.length) * sampleRate), cutAt);
    const f = frequencyFromMidi(note.midi);
    // A slur continues the previous note's envelope instead of re-attacking.
    const previous = note.attack === 'slur' && index > 0 ? sorted[index - 1]! : null;
    const envelopeStart = previous ? Math.round(previous.at * sampleRate) : start;
    for (let i = start; i < end; i++) {
      const t = (i - start) / sampleRate;
      const tEnv = (i - envelopeStart) / sampleRate;
      const attack = previous ? 1 : Math.min(1, tEnv / 0.01);
      const env = amp * attack * Math.exp(-tEnv / 0.6);
      let s = 0;
      for (let h = 0; h < harmonics.length; h++) s += harmonics[h]! * Math.sin(2 * Math.PI * f * (h + 1) * t);
      out[i] = out[i]! + env * s * 0.45;
    }
  });
  return out;
}

/** Split a signal into overlapping frames with their start times. */
export function frames(signal: Float32Array, frameSize: number, hop: number, sampleRate: number): { frame: Float32Array; time: number }[] {
  const result: { frame: Float32Array; time: number }[] = [];
  for (let start = 0; start + frameSize <= signal.length; start += hop) {
    result.push({ frame: signal.subarray(start, start + frameSize), time: start / sampleRate });
  }
  return result;
}
