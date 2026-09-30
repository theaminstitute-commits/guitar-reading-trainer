import type { FretPosition } from '../music/fretboard';

interface FretboardProps {
  /** Frets to draw, nut plus this many. */
  fretCount?: number;
  /** The note sounding now. */
  active: FretPosition | null;
  /** Notes already played this pass, drawn faintly so the shape of the melody stays visible. */
  played?: readonly FretPosition[];
}

const STRING_NAMES = ['E', 'B', 'G', 'D', 'A', 'E'];
const MARKER_FRETS = [3, 5, 7, 9];

/**
 * Horizontal fretboard, high E string at the top, nut on the left. Pure SVG so it
 * scales to any width; at 375px the frets are still finger-sized.
 */
export default function Fretboard({ fretCount = 5, active, played = [] }: FretboardProps) {
  const left = 34;
  const top = 26;
  const fretWidth = 62;
  const stringGap = 20;
  const width = left + fretWidth * fretCount + 12;
  const height = top + stringGap * 5 + 22;
  const nutX = left;
  const fretX = (fret: number) => nutX + fretWidth * fret;
  const stringY = (string: number) => top + stringGap * (string - 1);
  /** Circle centre for a position: between the fret wires, or just left of the nut for open. */
  const noteX = (fret: number) => (fret === 0 ? nutX - 14 : fretX(fret) - fretWidth / 2);

  const same = (a: FretPosition, b: FretPosition) => a.string === b.string && a.fret === b.fret;

  return (
    <svg
      className="fretboard"
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label={active ? `String ${active.string}, fret ${active.fret}` : 'Fretboard'}
    >
      {/* Wood */}
      <rect x={nutX} y={top - 8} width={fretWidth * fretCount} height={stringGap * 5 + 16} rx={3} className="fb-wood" />

      {/* Fret numbers */}
      {Array.from({ length: fretCount }, (_, i) => i + 1).map((fret) => (
        <text key={fret} x={fretX(fret) - fretWidth / 2} y={top - 13} className="fb-fret-number" textAnchor="middle">
          {fret}
        </text>
      ))}

      {/* Position markers */}
      {MARKER_FRETS.filter((f) => f <= fretCount).map((fret) => (
        <circle key={fret} cx={fretX(fret) - fretWidth / 2} cy={top + stringGap * 2.5} r={5} className="fb-marker" />
      ))}

      {/* Nut and fret wires */}
      <rect x={nutX - 4} y={top - 8} width={5} height={stringGap * 5 + 16} className="fb-nut" />
      {Array.from({ length: fretCount }, (_, i) => i + 1).map((fret) => (
        <line key={fret} x1={fretX(fret)} x2={fretX(fret)} y1={top - 8} y2={top + stringGap * 5 + 8} className="fb-wire" />
      ))}

      {/* Strings, thicker as they get lower */}
      {STRING_NAMES.map((name, i) => {
        const string = i + 1;
        return (
          <g key={string}>
            <line
              x1={nutX - 4}
              x2={nutX + fretWidth * fretCount}
              y1={stringY(string)}
              y2={stringY(string)}
              className="fb-string"
              strokeWidth={1 + i * 0.35}
            />
            <text x={nutX - 24} y={stringY(string) + 4} className="fb-string-name" textAnchor="middle">
              {name}
            </text>
          </g>
        );
      })}

      {/* Faint trail of notes already played */}
      {played
        .filter((p) => !active || !same(p, active))
        .map((p, i) => (
          <circle key={`p${i}`} cx={noteX(p.fret)} cy={stringY(p.string)} r={8} className="fb-played" />
        ))}

      {/* The note sounding now */}
      {active && (
        <g className="fb-active">
          <circle cx={noteX(active.fret)} cy={stringY(active.string)} r={13} className="fb-active-glow" />
          <circle cx={noteX(active.fret)} cy={stringY(active.string)} r={9} className="fb-active-dot" />
        </g>
      )}
    </svg>
  );
}
