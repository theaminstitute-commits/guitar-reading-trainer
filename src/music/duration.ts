/**
 * Note durations. Beat values are in quarter notes, which is enough while every
 * level is in x/4 time. Adding a new duration is one entry in this table.
 */

export type DurationId = 'w' | 'h' | 'q' | 'q.' | 'e';

export interface DurationInfo {
  id: DurationId;
  /** Length in quarter-note beats. */
  beats: number;
  label: string;
  /** VexFlow duration code (without dots). */
  vexflow: string;
  dots: number;
  /**
   * What the generator writes when it picks this duration. Eighths come in
   * beamed pairs on a beat, a dotted quarter is always followed by an eighth,
   * so bars stay readable and no eighth starts off the beat.
   */
  cell: readonly DurationId[];
}

export const DURATIONS: Record<DurationId, DurationInfo> = {
  w: { id: 'w', beats: 4, label: 'Whole note', vexflow: 'w', dots: 0, cell: ['w'] },
  h: { id: 'h', beats: 2, label: 'Half note', vexflow: 'h', dots: 0, cell: ['h'] },
  q: { id: 'q', beats: 1, label: 'Quarter note', vexflow: 'q', dots: 0, cell: ['q'] },
  'q.': { id: 'q.', beats: 1.5, label: 'Dotted quarter note', vexflow: 'q', dots: 1, cell: ['q.', 'e'] },
  e: { id: 'e', beats: 0.5, label: 'Eighth note', vexflow: '8', dots: 0, cell: ['e', 'e'] },
};

/** Total beats of a duration's generator cell. */
export function cellBeats(id: DurationId): number {
  return DURATIONS[id].cell.reduce((sum, d) => sum + DURATIONS[d].beats, 0);
}

/** Beats in words for explanations: "1 beat", "half a beat", "1.5 beats". */
export function beatsInWords(beats: number): string {
  if (beats === 0.5) return 'half a beat';
  if (beats === 1) return '1 beat';
  return `${beats} beats`;
}

export function beatsOf(id: DurationId): number {
  return DURATIONS[id].beats;
}

/** Beats per bar for a time signature such as [4, 4] or [3, 4]. */
export function beatsPerBar(timeSignature: readonly [number, number]): number {
  const [count, unit] = timeSignature;
  return count * (4 / unit);
}
