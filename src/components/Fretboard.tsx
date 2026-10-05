import type { FretPosition } from '../music/fretboard';

interface FretboardProps {
  /** Inclusive fret window of the stage; only this part of the neck is drawn (at least five frets). */
  frets?: readonly [number, number];
  /** The note sounding now. */
  active: FretPosition | null;
  /** Notes already played this pass, drawn faintly so the shape of the melody stays visible. */
  played?: readonly FretPosition[];
  /** Left-handed view: the whole board mirrored, nut on the right. */
  mirrored?: boolean;
}

const STRING_NAMES = ['E', 'B', 'G', 'D', 'A', 'E'];
const MARKER_FRETS = [3, 5, 7, 9, 15, 17, 19, 21];
const DOUBLE_MARKER_FRETS = [12, 24];
const MIN_FRETS = 5;

/** The frets drawn for a window: the window itself, widened to at least five frets, pushed down the neck rather than past fret 12. */
export function visibleFrets([low, high]: readonly [number, number]): { first: number; last: number } {
  const first = Math.max(1, low);
  let last = Math.max(high, first + MIN_FRETS - 1);
  if (last > 12 && high <= 12) last = 12;
  return { first: Math.max(1, Math.min(first, last - MIN_FRETS + 1)), last };
}

/**
 * Horizontal fretboard, high E string at the top, nut on the left when the window
 * starts at the nut; otherwise the board begins at the first fret of the window
 * with the fret numbers saying where on the neck it is. Pure SVG so it scales to
 * any width; at 375px the frets are still finger-sized.
 */
export default function Fretboard({ frets = [0, 4], active, played = [], mirrored = false }: FretboardProps) {
  const { first, last } = visibleFrets(frets);
  const hasNut = frets[0] === 0;
  const fretCount = last - first + 1;
  const left = 34;
  const top = 26;
  const fretWidth = 62;
  const stringGap = 20;
  const width = left + fretWidth * fretCount + 12;
  const height = top + stringGap * 5 + 22;
  const nutX = left;
  /** X of the wire at the far side of a fret. */
  const fretX = (fret: number) => nutX + fretWidth * (fret - first + 1);
  const stringY = (string: number) => top + stringGap * (string - 1);
  /** Circle centre for a position: between the fret wires, or just left of the nut for open. */
  const noteX = (fret: number) => (fret === 0 ? nutX - 14 : fretX(fret) - fretWidth / 2);
  const inWindow = (p: FretPosition) => (p.fret === 0 ? hasNut : p.fret >= first && p.fret <= last);
  const drawn = Array.from({ length: fretCount }, (_, i) => first + i);

  const same = (a: FretPosition, b: FretPosition) => a.string === b.string && a.fret === b.fret;
  // Mirror the drawing as a whole; flip each label back so it still reads left to right.
  const boardTransform = mirrored ? `translate(${width} 0) scale(-1 1)` : undefined;
  const label = (x: number) => (mirrored ? `translate(${2 * x} 0) scale(-1 1)` : undefined);

  return (
    <svg
      className="fretboard"
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label={active ? `String ${active.string}, fret ${active.fret}${mirrored ? ', left-handed view' : ''}` : `Fretboard, frets ${first} to ${last}`}
    >
      <g transform={boardTransform}>
      {/* Wood */}
      <rect x={nutX} y={top - 8} width={fretWidth * fretCount} height={stringGap * 5 + 16} rx={3} className="fb-wood" />

      {/* Fret numbers */}
      {drawn.map((fret) => (
        <text key={fret} x={fretX(fret) - fretWidth / 2} y={top - 13} className="fb-fret-number" textAnchor="middle" transform={label(fretX(fret) - fretWidth / 2)}>
          {fret}
        </text>
      ))}

      {/* Position markers */}
      {drawn
        .filter((f) => MARKER_FRETS.includes(f))
        .map((fret) => (
          <circle key={fret} cx={fretX(fret) - fretWidth / 2} cy={top + stringGap * 2.5} r={5} className="fb-marker" />
        ))}
      {drawn
        .filter((f) => DOUBLE_MARKER_FRETS.includes(f))
        .flatMap((fret) => [1.5, 3.5].map((row) => <circle key={`${fret}-${row}`} cx={fretX(fret) - fretWidth / 2} cy={top + stringGap * row} r={5} className="fb-marker" />))}

      {/* Nut, or the wire where the window starts, then the fret wires */}
      {hasNut ? (
        <rect x={nutX - 4} y={top - 8} width={5} height={stringGap * 5 + 16} className="fb-nut" />
      ) : (
        <line x1={nutX} x2={nutX} y1={top - 8} y2={top + stringGap * 5 + 8} className="fb-wire" />
      )}
      {drawn.map((fret) => (
        <line key={fret} x1={fretX(fret)} x2={fretX(fret)} y1={top - 8} y2={top + stringGap * 5 + 8} className="fb-wire" />
      ))}

      {/* Strings, thicker as they get lower */}
      {STRING_NAMES.map((name, i) => {
        const string = i + 1;
        return (
          <g key={string}>
            <line
              x1={nutX - (hasNut ? 4 : 0)}
              x2={nutX + fretWidth * fretCount}
              y1={stringY(string)}
              y2={stringY(string)}
              className="fb-string"
              strokeWidth={1 + i * 0.35}
            />
            <text x={nutX - 24} y={stringY(string) + 4} className="fb-string-name" textAnchor="middle" transform={label(nutX - 24)}>
              {name}
            </text>
          </g>
        );
      })}

      {/* Faint trail of notes already played */}
      {played
        .filter((p) => inWindow(p) && (!active || !same(p, active)))
        .map((p, i) => (
          <circle key={`p${i}`} cx={noteX(p.fret)} cy={stringY(p.string)} r={8} className="fb-played" />
        ))}

      {/* The note sounding now */}
      {active && inWindow(active) && (
        <g className="fb-active">
          <circle cx={noteX(active.fret)} cy={stringY(active.string)} r={13} className="fb-active-glow" />
          <circle cx={noteX(active.fret)} cy={stringY(active.string)} r={9} className="fb-active-dot" />
        </g>
      )}
      </g>
    </svg>
  );
}
