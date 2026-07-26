'use client';

import { T } from '../ui';

/** Conventional fallback: an SVG area chart that stretches to fill its box. */
export default function SvgChart({ values, rows }: { values: number[]; rows: number }) {
  if (values.length === 0) return null;
  const h = rows * 4 * 2.5; // px, matches roughly the dots renderer's height
  const w = 100, top = 100, bottom = 0;
  const pts = values.map((v, i) => {
    const x = values.length > 1 ? (i / (values.length - 1)) * w : 0;
    const y = top - v * (top - bottom);
    return `${x},${y}`;
  });
  const area = `0,${top} ${pts.join(' ')} ${w},${top}`;

  return (
    <svg viewBox={`0 0 ${w} 100`} preserveAspectRatio="none" style={{ width: '100%', height: h, display: 'block' }}>
      <defs>
        <linearGradient id="admin-svg-grad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={T.accent} stopOpacity={0.35} />
          <stop offset="100%" stopColor={T.accent} stopOpacity={0} />
        </linearGradient>
      </defs>
      <polygon points={area} fill="url(#admin-svg-grad)" />
      <polyline points={pts.join(' ')} fill="none" stroke={T.accent} strokeWidth={1.4} vectorEffect="non-scaling-stroke" />
    </svg>
  );
}
