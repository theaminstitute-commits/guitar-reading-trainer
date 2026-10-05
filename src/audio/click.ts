/**
 * The metronome click: the same short electronic beep as the user's Tempus
 * (Seiko-style) metronome. A 1000 Hz sine with a quarter of 2 kHz overtone,
 * a 1 ms attack ramp to avoid a pop, and a fast exponential decay over 60 ms.
 * `tone` shifts the pitch in semitones as that app does (0 = 1000 Hz).
 */
export const CLICK_SECONDS = 0.06;

export function seikoClick(sampleRate: number, tone = 0): Float32Array<ArrayBuffer> {
  const base = 1000 * Math.pow(2, tone / 12);
  const n = Math.round(sampleRate * CLICK_SECONDS);
  const out = new Float32Array(new ArrayBuffer(n * 4));
  for (let i = 0; i < n; i++) {
    const t = i / sampleRate;
    const attack = Math.min(1, t / 0.001);
    const decay = Math.exp(-t * 70);
    const sample = 0.85 * Math.sin(2 * Math.PI * base * t) + 0.25 * Math.sin(2 * Math.PI * base * 2 * t);
    out[i] = 0.9 * attack * decay * sample;
  }
  return out;
}
