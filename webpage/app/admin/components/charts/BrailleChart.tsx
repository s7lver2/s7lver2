'use client';

import { useEffect, useState } from 'react';
import { T } from '../ui';

/**
 * True when the resolved font actually has U+2800-U+28FF.
 *
 * Measured by advance width: JetBrains Mono renders `M` at 9.600px and gets a
 * substituted 12.055px for the braille block, which shears the grid. Only a
 * covering font gives equal advances.
 *
 * Must run after document.fonts.ready — measuring earlier measures the
 * fallback face and always reports a mismatch.
 */
export async function brailleSupported(): Promise<boolean> {
  await document.fonts.ready;
  const span = document.createElement('span');
  span.style.cssText =
    `position:absolute;visibility:hidden;white-space:pre;font:12px ${T.mono}`;
  document.body.appendChild(span);
  const advance = (ch: string) => {
    span.textContent = ch.repeat(20);
    return span.getBoundingClientRect().width / 20;
  };
  const latin = advance('M');
  const braille = advance('⣿');
  span.remove();
  return Math.abs(latin - braille) < 0.05;
}

const BASE = 0x2800;
/** Dot bit positions within a 2x4 cell, [col][row]. */
const BITS = [[0x01, 0x02, 0x04, 0x40], [0x08, 0x10, 0x20, 0x80]];

export default function BrailleChart({ values, rows }: { values: number[]; rows: number }) {
  const [lines, setLines] = useState<string[]>([]);

  useEffect(() => {
    const dotRows = rows * 4;
    const grid: number[][] = Array.from({ length: rows }, () => Array(values.length).fill(0));
    values.forEach((v, c) => {
      const filled = Math.round(v * dotRows);
      for (let d = 0; d < filled; d++) {
        const fromTop = dotRows - 1 - d;
        const cell = Math.floor(fromTop / 4);
        const bitRow = fromTop % 4;
        grid[cell][c] |= BITS[0][bitRow] | BITS[1][bitRow];
      }
    });
    setLines(grid.map((row) => row.map((m) => String.fromCharCode(BASE + m)).join('')));
  }, [values, rows]);

  return (
    <pre style={{
      margin: 0, fontFamily: T.mono, fontSize: 12, lineHeight: '12px',
      letterSpacing: 0, color: T.accent,
    }}>
      {lines.join('\n')}
    </pre>
  );
}
