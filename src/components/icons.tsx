import type { SVGProps } from 'react';

type IconProps = SVGProps<SVGSVGElement> & { size?: number };

function base({ size = 20, ...rest }: IconProps) {
  return { width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, 'aria-hidden': true, ...rest };
}

/** Small line icons, drawn inline so the single-file build needs no icon font. */
export const PlayIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M7 5v14l11-7z" fill="currentColor" stroke="none" />
  </svg>
);

export const StopIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <rect x="6" y="6" width="12" height="12" rx="2" fill="currentColor" stroke="none" />
  </svg>
);

export const SlowIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7v5l3 2" />
  </svg>
);

export const EyeIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);

export const EarIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M6 10a6 6 0 0 1 12 0c0 3-2 4-3 6s-1 4-3.5 4S9 18 9 16" />
    <path d="M10 10a2 2 0 0 1 4 0c0 1.5-2 2-2 4" />
  </svg>
);

export const GuitarIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M14 10l6-6" />
    <path d="M17 7l1.5 1.5" />
    <path d="M13 11a4 4 0 0 0-5.5 5.2A3.5 3.5 0 1 0 12 19a4 4 0 0 0 1-8z" />
  </svg>
);

export const LockIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <rect x="5" y="11" width="14" height="10" rx="2" />
    <path d="M8 11V8a4 4 0 0 1 8 0v3" />
  </svg>
);

export const CheckIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M5 12l5 5L20 7" />
  </svg>
);

export const ChevronLeftIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M15 5l-7 7 7 7" />
  </svg>
);

export const BookIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2z" />
    <path d="M4 19a2 2 0 0 1 2-2h13" />
  </svg>
);

export const MicIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <rect x="9" y="3" width="6" height="11" rx="3" />
    <path d="M5 11a7 7 0 0 0 14 0" />
    <path d="M12 18v3" />
  </svg>
);

export const MetronomeIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M9 4h6l3 16H6z" />
    <path d="M12 14l5-8" />
  </svg>
);

export const SparkIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M12 3l2 6 6 2-6 2-2 6-2-6-6-2 6-2z" fill="currentColor" stroke="none" />
  </svg>
);

export const RefreshIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M20 12a8 8 0 1 1-2.3-5.7" />
    <path d="M20 4v5h-5" />
  </svg>
);
