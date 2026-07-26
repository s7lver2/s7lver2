'use client';

import { useEffect, useRef } from 'react';
import { T } from '../ui';

const DOT = 2;      // dot diameter in CSS px
const PITCH_X = 4;  // horizontal dot spacing
const PITCH_Y = 4;  // vertical dot spacing

export default function DotsChart({ values, rows, animate }: {
  /** Already resampled to the column count, normalised to 0..1. */
  values: number[]; rows: number; animate: boolean;
}) {
  const ref = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const cv = ref.current;
    if (!cv) return;
    const ctx = cv.getContext('2d');
    if (!ctx) return;

    const cols = values.length * 2;          // 2 dots wide per data column
    const dotRows = rows * 4;                // 4 dots tall per braille row
    const w = cols * PITCH_X, h = dotRows * PITCH_Y;
    const dpr = window.devicePixelRatio || 1;

    cv.width = Math.round(w * dpr);
    cv.height = Math.round(h * dpr);
    cv.style.width = `${w}px`;
    cv.style.height = `${h}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    let raf = 0;
    const t0 = performance.now();

    const draw = (now: number) => {
      // Columns appear left to right; the last one keeps pulsing to mark live data.
      const progress = animate ? Math.min(1, (now - t0) / 700) : 1;
      const shown = Math.ceil(values.length * progress);

      ctx.clearRect(0, 0, w, h);
      for (let c = 0; c < shown; c++) {
        const isLast = c === values.length - 1;
        const pulse = isLast && animate ? 0.65 + 0.35 * Math.sin(now / 340) : 1;
        const filled = Math.round(values[c] * dotRows);
        for (let d = 0; d < filled; d++) {
          const y = h - (d + 0.5) * PITCH_Y;
          const frac = d / Math.max(1, dotRows - 1);
          ctx.globalAlpha = (0.35 + frac * 0.65) * pulse;
          ctx.fillStyle = isLast ? T.active : T.accent;
          for (let sub = 0; sub < 2; sub++) {
            ctx.beginPath();
            ctx.arc((c * 2 + sub + 0.5) * PITCH_X, y, DOT / 2, 0, Math.PI * 2);
            ctx.fill();
          }
        }
      }
      ctx.globalAlpha = 1;
      if (animate) raf = requestAnimationFrame(draw);
    };

    draw(performance.now());
    return () => { if (raf) cancelAnimationFrame(raf); };
  }, [values, rows, animate]);

  return <canvas ref={ref} style={{ display: 'block' }} />;
}
