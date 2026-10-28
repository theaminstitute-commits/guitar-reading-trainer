import type { FretPosition } from '../music/fretboard';

interface FretboardProps {
  /** Inclusive fret window of the stage; only this part of the neck is drawn (at least five frets). */
  frets?: readonly [number, number];
  /** The note or chord sounding now. */
  active: FretPosition | readonly FretPosition[] | null;
  /** Notes already played this pass, drawn faintly so the shape of the melody stays visible. */
  played?: readonly FretPosition[];
  /** Left-handed view: the whole board mirrored, nut on the right. */
  mirrored?: boolean;
  /** Text inside each lit dot, parallel to `active` (beginner hints, lessons). */
  labels?: readonly string[];
  /** Makes every string and fret tappable (lesson drills). */
  onPick?: (position: FretPosition) => void;
  /** Answer marks for drills: a green or red ring at a position. */
  marks?: readonly { position: FretPosition; tone: 'good' | 'bad' }[];
  /**
   * Notes sounding now: each string vibrates, but only the part that really moves, from the
   * fret (or the nut, for an open string) to the bridge end of the drawing.
   */
  ringing?: readonly FretPosition[];
  /** Changes with every new note, so a repeated note starts its vibration again. */
  ringKey?: string | number;
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
export default function Fretboard({ frets = [0, 4], active: activeProp, played = [], mirrored = false, labels, onPick, marks = [], ringing = [], ringKey }: FretboardProps) {
  const actives: readonly FretPosition[] = activeProp === null ? [] : Array.isArray(activeProp) ? (activeProp as readonly FretPosition[]) : [activeProp as FretPosition];
  const active = actives[0] ?? null;
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
  /**
   * Circle centre for a position: just left of the nut for open, otherwise a quarter of the fret
   * from its wire, halfway between the middle of the fret and the wire, where a finger should
   * press (the user: show good technique, everywhere a fretted note is drawn).
   */
  const noteX = (fret: number) => (fret === 0 ? nutX - 14 : fretX(fret) - fretWidth / 4);
  const inWindow = (p: FretPosition) => (p.fret === 0 ? hasNut : p.fret >= first && p.fret <= last);
  const drawn = Array.from({ length: fretCount }, (_, i) => first + i);
  const boardEnd = nutX + fretWidth * fretCount;
  /** Where a sounding note's string starts to move: the fret wire under the finger, or the nut; null when that part is off the drawing. */
  const vibrationStart = (p: FretPosition): number | null => (p.fret === 0 || p.fret < first ? nutX : p.fret > last ? null : fretX(p.fret));
  const ringId = ringKey ?? ringing.map((r) => `${r.string}-${r.fret}`).join(',');

  const same = (a: FretPosition, b: FretPosition) => a.string === b.string && a.fret === b.fret;
  // Mirror the drawing as a whole; flip each label back so it still reads left to right.
  const boardTransform = mirrored ? `translate(${width} 0) scale(-1 1)` : undefined;
  const label = (x: number) => (mirrored ? `translate(${2 * x} 0) scale(-1 1)` : undefined);

  return (
    <svg
      className="fretboard"
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label={active ? `${actives.map((a) => `string ${a.string} fret ${a.fret}`).join(', ')}${mirrored ? ', left-handed view' : ''}` : `Fretboard, frets ${first} to ${last}`}
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
        const ring = ringing.find((r) => r.string === string);
        const start = ring ? vibrationStart(ring) : null;
        const moving = start !== null && start < boardEnd;
        // Slight: a few px at most, more on a long open string than on a short fretted one.
        const amp = moving ? Math.min(3, 0.9 + (boardEnd - start) / 150) : 0;
        const mid = moving ? (start + boardEnd) / 2 : 0;
        return (
          <g key={string}>
            <line
              x1={nutX - (hasNut ? 4 : 0)}
              x2={moving ? start : boardEnd}
              y1={stringY(string)}
              y2={stringY(string)}
              className="fb-string"
              strokeWidth={1 + i * 0.35}
            />
            {moving && (
              // The moving part: a blurred lens (the swing seen at speed) and the string itself flicking
              // up and down, both dying away like a plucked string. Drawn about y = 0, then moved onto the string.
              <g key={`v${ringId}`} transform={`translate(0 ${stringY(string)})`}>
                <g className="fb-ring">
                  <path d={`M ${start} 0 Q ${mid} ${-2 * amp} ${boardEnd} 0 Q ${mid} ${2 * amp} ${start} 0 Z`} className="fb-ring-blur" />
                  <path d={`M ${start} 0 Q ${mid} ${-2 * amp} ${boardEnd} 0`} className="fb-string fb-vibrate" fill="none" strokeWidth={1 + i * 0.35} />
                </g>
              </g>
            )}
            {/* A dot on the open string covers its name; the dot itself says the note. */}
            {!(hasNut && [...actives, ...marks.map((m) => m.position)].some((a) => a.string === string && a.fret === 0)) && (
              <text x={nutX - 24} y={stringY(string) + 4} className="fb-string-name" textAnchor="middle" transform={label(nutX - 24)}>
                {name}
              </text>
            )}
          </g>
        );
      })}

      {/* Faint trail of notes already played */}
      {played
        .filter((p) => inWindow(p) && !actives.some((a) => same(p, a)))
        .map((p, i) => (
          <circle key={`p${i}`} cx={noteX(p.fret)} cy={stringY(p.string)} r={8} className="fb-played" />
        ))}

      {/* The note, or every note of the chord, sounding now */}
      {actives.map((a, i) =>
        inWindow(a) ? (
          <g key={`a${i}`} className="fb-active">
            <circle cx={noteX(a.fret)} cy={stringY(a.string)} r={13} className="fb-active-glow" />
            <circle cx={noteX(a.fret)} cy={stringY(a.string)} r={9} className="fb-active-dot" />
            {labels?.[i] && (
              <text x={noteX(a.fret)} y={stringY(a.string) + 3.6} textAnchor="middle" className="fb-dot-label" transform={label(noteX(a.fret))}>
                {labels[i]}
              </text>
            )}
          </g>
        ) : null,
      )}

      {/* Drill answer marks */}
      {marks.filter((m) => inWindow(m.position)).map((m, i) => (
        <circle key={`m${i}`} cx={noteX(m.position.fret)} cy={stringY(m.position.string)} r={11} className={`fb-mark ${m.tone}`} />
      ))}

      {/* Tap targets: one cell per string and fret, the open-string zone left of the nut */}
      {onPick &&
        STRING_NAMES.flatMap((_, i) => {
          const string = i + 1;
          const cells = [...(hasNut ? [0] : []), ...drawn];
          return cells.map((fret) => {
            const x = fret === 0 ? nutX - 26 : fretX(fret) - fretWidth;
            const w = fret === 0 ? 24 : fretWidth;
            return (
              <rect
                key={`t${string}-${fret}`}
                x={x}
                y={stringY(string) - stringGap / 2}
                width={w}
                height={stringGap}
                className="fb-tap"
                onPointerDown={() => onPick({ string, fret })}
              />
            );
          });
        })}
      </g>
    </svg>
  );
}
