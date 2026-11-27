/**
 * The points towards the next stage (R47) as a bar of one segment per point: a striped segment for
 * a melody written right, two solid ones for playing it in time. The fuller the bar, the more it
 * comes alive (the user, 2026-11-27): the colours run from calm teal to electric violet along it,
 * grow brighter with every third, glow from two thirds and shimmer when the stage is nearly won.
 */
import type { CSSProperties } from 'react';
import { PLAY_POINTS, WRITE_POINTS } from '../session/progression';

type Kind = 'w' | 'p' | '';

/** Each point in the order earned. Points carried over from before R47 count as written. */
export function pointKinds(tally: number, earned: readonly number[], target: number): Kind[] {
  const listed = earned.reduce((a, b) => a + b, 0);
  const kinds: Kind[] = Array.from({ length: Math.max(0, tally - listed) }, () => 'w');
  for (const points of earned) {
    kinds.push('w');
    for (let i = WRITE_POINTS; i < points; i++) kinds.push('p');
  }
  return Array.from({ length: target }, (_, i) => (i < tally ? (kinds[i] ?? 'w') : ''));
}

/** 0 to 3: under a third, under two thirds, under nine tenths, nearly there. */
export function energyOf(tally: number, target: number): number {
  const f = target > 0 ? tally / target : 0;
  return f >= 0.9 ? 3 : f >= 2 / 3 ? 2 : f >= 1 / 3 ? 1 : 0;
}

const MOOD = ['Warming up', 'Picking up speed', 'Charged up', 'Nearly there!'];

interface PointsBarProps {
  tally: number;
  earned: readonly number[];
  target: number;
  /** Points just earned: their segments pop in. */
  fresh?: number;
}

export default function PointsBar({ tally, earned, target, fresh = 0 }: PointsBarProps) {
  const kinds = pointKinds(tally, earned, target);
  const energy = energyOf(tally, target);
  const played = kinds.filter((k) => k === 'p').length;
  return (
    <div className={`points-bar e${energy}`}>
      <div className="points-head">
        <span className="points-count">
          <strong>{tally}</strong> / {target} points
        </span>
        <span className="points-mood">{MOOD[energy]}</span>
      </div>
      <div
        className="points-track"
        role="img"
        aria-label={`${tally} of ${target} points on this stage: ${tally - played} for writing, ${played} for playing`}
        style={{ '--fill': Math.min(1, tally / target) } as CSSProperties}
      >
        {kinds.map((k, i) => (
          <span
            key={i}
            className={[k, i === tally - 1 ? 'lead' : '', fresh > 0 && i >= tally - fresh && i < tally ? 'new' : ''].filter(Boolean).join(' ')}
            style={{ '--h': 178 + (92 * i) / Math.max(1, target - 1), '--d': `${(i - (tally - fresh)) * 110}ms` } as CSSProperties}
          />
        ))}
      </div>
      <div className="points-key" aria-hidden="true">
        <span>
          <i className="key w" /> written right +{WRITE_POINTS}
        </span>
        <span>
          <i className="key p" /> played in time +{PLAY_POINTS}
        </span>
      </div>
    </div>
  );
}
