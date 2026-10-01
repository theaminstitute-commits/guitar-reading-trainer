/**
 * Monophonic pitch detection with the McLeod Pitch Method (MPM).
 *
 * MPM looks for the lag at which a frame of audio best matches itself, using
 * the normalised square difference function, and picks the first strong peak
 * rather than the highest. That makes it far less prone to the octave errors
 * plain autocorrelation makes on harmonic-rich sounds like a plucked string.
 */

export interface PitchEstimate {
  frequency: number;
  /** 0..1, how periodic the frame is. Below ~0.8 the estimate is unreliable. */
  clarity: number;
}

export interface PitchOptions {
  /** Lowest frequency to look for. Guitar low E is 82 Hz. */
  minFrequency?: number;
  maxFrequency?: number;
  /** Peaks at least this fraction of the strongest one count as candidates. */
  peakThreshold?: number;
}

const DEFAULTS: Required<PitchOptions> = { minFrequency: 70, maxFrequency: 1200, peakThreshold: 0.9 };

/**
 * Estimate the fundamental frequency of one frame of samples, or null when the
 * frame is silent or not periodic enough.
 */
export function detectPitch(frame: Float32Array, sampleRate: number, options: PitchOptions = {}): PitchEstimate | null {
  const { minFrequency, maxFrequency, peakThreshold } = { ...DEFAULTS, ...options };
  const n = frame.length;
  const maxLag = Math.min(n - 2, Math.ceil(sampleRate / minFrequency));
  const minLag = Math.max(2, Math.floor(sampleRate / maxFrequency));
  if (maxLag <= minLag) return null;

  // Normalised square difference: nsdf(t) = 2 * sum(x[i] x[i+t]) / sum(x[i]^2 + x[i+t]^2)
  const nsdf = new Float32Array(maxLag + 1);
  for (let lag = 0; lag <= maxLag; lag++) {
    let r = 0;
    let m = 0;
    for (let i = 0; i + lag < n; i++) {
      const a = frame[i]!;
      const b = frame[i + lag]!;
      r += a * b;
      m += a * a + b * b;
    }
    nsdf[lag] = m > 0 ? (2 * r) / m : 0;
  }

  // Key maxima: the highest point between each positive-going and the next
  // negative-going zero crossing, skipping the lag-0 peak.
  const peaks: number[] = [];
  let lag = 1;
  while (lag <= maxLag && nsdf[lag]! > 0) lag++; // leave the lag-0 hump
  while (lag <= maxLag) {
    while (lag <= maxLag && nsdf[lag]! <= 0) lag++;
    let best = -1;
    let bestValue = -Infinity;
    while (lag <= maxLag && nsdf[lag]! > 0) {
      if (nsdf[lag]! > bestValue) {
        bestValue = nsdf[lag]!;
        best = lag;
      }
      lag++;
    }
    if (best >= minLag) peaks.push(best);
  }
  if (peaks.length === 0) return null;

  const highest = Math.max(...peaks.map((p) => nsdf[p]!));
  const chosen = peaks.find((p) => nsdf[p]! >= highest * peakThreshold)!;

  // Parabolic interpolation around the chosen peak for sub-sample precision.
  const y0 = nsdf[chosen - 1] ?? nsdf[chosen]!;
  const y1 = nsdf[chosen]!;
  const y2 = nsdf[chosen + 1] ?? nsdf[chosen]!;
  const denominator = y0 - 2 * y1 + y2;
  const shift = denominator === 0 ? 0 : (0.5 * (y0 - y2)) / denominator;
  const period = chosen + Math.max(-1, Math.min(1, shift));
  const clarity = Math.max(0, Math.min(1, y1 - 0.25 * (y0 - y2) * shift));

  const frequency = sampleRate / period;
  if (frequency < minFrequency || frequency > maxFrequency) return null;
  return { frequency, clarity };
}

/** MIDI note number (fractional) of a frequency, A4 = 69. */
export function midiFromFrequency(frequency: number): number {
  return 69 + 12 * Math.log2(frequency / 440);
}

export function frequencyFromMidi(midi: number): number {
  return 440 * 2 ** ((midi - 69) / 12);
}

/** Root mean square level of a frame. */
export function rms(frame: Float32Array): number {
  let sum = 0;
  for (let i = 0; i < frame.length; i++) sum += frame[i]! * frame[i]!;
  return Math.sqrt(sum / frame.length);
}
