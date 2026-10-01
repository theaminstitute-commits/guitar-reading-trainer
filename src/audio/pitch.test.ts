import { describe, expect, it } from 'vitest';
import { detectPitch, frequencyFromMidi, midiFromFrequency } from './pitch';
import { synthesize } from './synth.test-helper';

const SR = 44100;

function sine(frequency: number, seconds: number, amplitude = 0.5): Float32Array {
  const out = new Float32Array(Math.round(seconds * SR));
  for (let i = 0; i < out.length; i++) out[i] = amplitude * Math.sin((2 * Math.PI * frequency * i) / SR);
  return out;
}

describe('detectPitch (McLeod)', () => {
  it('finds a pure tone within half a hertz', () => {
    for (const f of [82.41, 110, 220, 329.63, 440, 659.26]) {
      const r = detectPitch(sine(f, 0.05), SR)!;
      expect(r).not.toBeNull();
      expect(Math.abs(r.frequency - f)).toBeLessThan(0.5);
      expect(r.clarity).toBeGreaterThan(0.95);
    }
  });

  it('returns the fundamental of a harmonic-rich pluck, not an overtone', () => {
    for (const midi of [40, 45, 50, 55, 59, 64, 69, 76]) {
      const signal = synthesize([{ midi, at: 0, length: 0.5 }], 0.5, SR);
      const frame = signal.subarray(2205, 2205 + 2048); // 50 ms in, past the attack
      const r = detectPitch(frame, SR)!;
      expect(r).not.toBeNull();
      expect(Math.round(midiFromFrequency(r.frequency))).toBe(midi);
      expect(r.clarity).toBeGreaterThan(0.85);
    }
  });

  it('returns null for silence and low clarity for noise', () => {
    expect(detectPitch(new Float32Array(2048), SR)).toBeNull();
    let seed = 1;
    const noise = new Float32Array(2048).map(() => {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      return (seed / 4294967296 - 0.5) * 0.5;
    });
    const r = detectPitch(noise, SR);
    expect(r === null || r.clarity < 0.6).toBe(true);
  });

  it('converts between MIDI and frequency', () => {
    expect(frequencyFromMidi(69)).toBe(440);
    expect(midiFromFrequency(440)).toBe(69);
    expect(Math.round(midiFromFrequency(frequencyFromMidi(52)))).toBe(52);
  });
});
