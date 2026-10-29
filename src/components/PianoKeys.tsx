/**
 * A short piano keyboard for the lesson that compares guitar and piano (R37).
 * Keys are SOUNDING pitches. Marked keys carry a name underneath; the key that
 * sounds now lights up, so the guitar's written E5 is seen to be the piano's E4.
 */
const WHITE = [0, 2, 4, 5, 7, 9, 11];

export interface PianoMark {
  midi: number;
  label: string;
}

interface PianoKeysProps {
  /** Lowest and highest key, both C or naturals; the range is drawn whole. */
  low: number;
  high: number;
  marks?: readonly PianoMark[];
  /** The key sounding now. */
  lit?: number | null;
}

export default function PianoKeys({ low, high, marks = [], lit = null }: PianoKeysProps) {
  const whites: number[] = [];
  for (let m = low; m <= high; m++) if (WHITE.includes(m % 12)) whites.push(m);
  const w = 26;
  const h = 96;
  const width = whites.length * w;
  const xOf = (midi: number) => whites.indexOf(midi) * w;
  const blacks: { midi: number; x: number }[] = [];
  for (let m = low; m <= high; m++) if (!WHITE.includes(m % 12) && whites.includes(m - 1)) blacks.push({ midi: m, x: xOf(m - 1) + w - 8 });
  const mark = (midi: number) => marks.find((k) => k.midi === midi);
  return (
    <svg className="piano" viewBox={`-1 -1 ${width + 2} ${h + 34}`} role="img" aria-label="Piano keyboard">
      {whites.map((m) => (
        <g key={m}>
          <rect x={xOf(m)} y={0} width={w} height={h} rx={3} className={`piano-white${m === lit ? ' lit' : mark(m) ? ' marked' : ''}`} />
          {m % 12 === 0 && (
            <text x={xOf(m) + w / 2} y={h - 8} textAnchor="middle" className="piano-c">
              C{Math.floor(m / 12) - 1}
            </text>
          )}
          {mark(m) && (
            <text x={xOf(m) + w / 2} y={h + 18} textAnchor="middle" className={`piano-label${m === lit ? ' lit' : ''}`}>
              {mark(m)!.label}
            </text>
          )}
        </g>
      ))}
      {blacks.map((b) => (
        <rect key={b.midi} x={b.x} y={0} width={16} height={h * 0.6} rx={2} className={`piano-black${b.midi === lit ? ' lit' : ''}`} />
      ))}
    </svg>
  );
}
