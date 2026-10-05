/**
 * Melody length is counted in beats ("counts"). Growth adds one count at a
 * time as a short extra bar at the end: 4 counts is a bar of 4/4, 5 is
 * 4/4 + 1/4, 6 is 4/4 + 2/4, 7 is 4/4 + 3/4, 8 is two bars of 4/4, 9 is
 * 4/4 + 4/4 + 1/4, and so on up to 16 (four bars of 4/4). The bars before
 * the last one are always 4/4.
 */

export const BASE_BEATS = 4;
export const MIN_COUNTS = BASE_BEATS;
export const MAX_COUNTS = BASE_BEATS * 4;
/** Length a stage grows to on its own (two bars of 4/4); longer is a manual choice. */
export const GROW_COUNTS = BASE_BEATS * 2;

/** Beats of each bar for a melody of `counts` beats. */
export function barBeatsForCounts(counts: number, base = BASE_BEATS): number[] {
  const full = Math.floor(counts / base);
  const remainder = counts - full * base;
  const bars = Array.from({ length: full }, () => base);
  if (remainder > 0 || bars.length === 0) bars.push(remainder > 0 ? remainder : counts);
  return bars;
}

/** Time signature of each bar: [beats, 4]. */
export function timeSignaturesFor(barBeats: readonly number[]): [number, number][] {
  return barBeats.map((b) => [b, 4]);
}

/** "4/4", "4/4 + 5/4", "4/4 + 4/4 + 4/4". */
export function describeMeter(barBeats: readonly number[]): string {
  return barBeats.map((b) => `${b}/4`).join(' + ');
}

export function totalCounts(barBeats: readonly number[]): number {
  return barBeats.reduce((s, b) => s + b, 0);
}
