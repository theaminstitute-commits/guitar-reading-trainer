/**
 * Grading the tap-along drill: each click is matched to the nearest unused tap
 * within a tolerance. Times are audio-context seconds. No microphone: the
 * learner taps the screen.
 */

/** How far from a click a tap may land and still count, in seconds. */
export const TAP_TOLERANCE = 0.16;

export interface TapResult {
  hits: number;
  total: number;
  /** Mean signed offset of the hits in milliseconds: negative is early, positive late. */
  meanOffsetMs: number;
  /** Taps that matched no click. */
  extra: number;
}

export function gradeTaps(clicks: readonly number[], taps: readonly number[], tolerance = TAP_TOLERANCE): TapResult {
  const used = new Set<number>();
  const offsets: number[] = [];
  for (const click of clicks) {
    let best = -1;
    let bestDistance = Infinity;
    taps.forEach((t, i) => {
      if (used.has(i)) return;
      const d = Math.abs(t - click);
      if (d <= tolerance && d < bestDistance) {
        best = i;
        bestDistance = d;
      }
    });
    if (best >= 0) {
      used.add(best);
      offsets.push(taps[best]! - click);
    }
  }
  const mean = offsets.length ? (offsets.reduce((s, o) => s + o, 0) / offsets.length) * 1000 : 0;
  return { hits: offsets.length, total: clicks.length, meanOffsetMs: Math.round(mean), extra: taps.length - used.size };
}

/** Passed when no more than two clicks were missed. */
export function tapPassed(r: TapResult): boolean {
  return r.hits >= r.total - 2;
}

/** One sentence on how the tapping went. */
export function tapVerdict(r: TapResult): string {
  const base = `${r.hits} of ${r.total} taps on the beat.`;
  if (r.hits === 0) return `${base} Tap the button each time you hear a click, starting after the four count-in clicks.`;
  const drift = Math.abs(r.meanOffsetMs) < 40 ? 'Right in time.' : r.meanOffsetMs < 0 ? 'You tend to tap a little early: wait for the click.' : 'You tend to tap a little late: feel the click coming.';
  return `${base} ${drift}`;
}
