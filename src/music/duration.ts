/**
 * Note durations. Beat values are in quarter notes, which is enough while every
 * level is in x/4 time. Adding a new duration is one entry in this table.
 */

export type DurationId = 'w' | 'h' | 'q' | 'e';

export interface DurationInfo {
  id: DurationId;
  /** Length in quarter-note beats. */
  beats: number;
  label: string;
  /** VexFlow duration code. */
  vexflow: string;
}

export const DURATIONS: Record<DurationId, DurationInfo> = {
  w: { id: 'w', beats: 4, label: 'Whole note', vexflow: 'w' },
  h: { id: 'h', beats: 2, label: 'Half note', vexflow: 'h' },
  q: { id: 'q', beats: 1, label: 'Quarter note', vexflow: 'q' },
  e: { id: 'e', beats: 0.5, label: 'Eighth note', vexflow: '8' },
};

export function beatsOf(id: DurationId): number {
  return DURATIONS[id].beats;
}

/** Beats per bar for a time signature such as [4, 4] or [3, 4]. */
export function beatsPerBar(timeSignature: readonly [number, number]): number {
  const [count, unit] = timeSignature;
  return count * (4 / unit);
}
