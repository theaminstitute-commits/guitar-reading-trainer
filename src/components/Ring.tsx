interface RingProps {
  /** 0..1 */
  value: number;
  size?: number;
  stroke?: number;
  /** CSS colour of the arc. */
  color?: string;
  /** Text in the middle. */
  label?: string;
  /** Smaller text under the label. */
  sub?: string;
  className?: string;
}

/** A circular progress ring with a value in the middle. */
export default function Ring({ value, size = 72, stroke = 7, color = 'var(--accent)', label, sub, className }: RingProps) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const v = Math.max(0, Math.min(1, value));
  return (
    <div className={`ring${className ? ` ${className}` : ''}`} style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
        <circle cx={size / 2} cy={size / 2} r={r} className="ring-track" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          className="ring-arc"
          stroke={color}
          strokeWidth={stroke}
          strokeDasharray={`${c * v} ${c * (1 - v)}`}
          strokeDashoffset={c / 4}
        />
      </svg>
      <div className="ring-text">
        {label && <span className="ring-label">{label}</span>}
        {sub && <span className="ring-sub">{sub}</span>}
      </div>
    </div>
  );
}
