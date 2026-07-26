'use client';

import { useEffect, useRef, useState } from 'react';
import { resample, type ChartProps } from './types';
import { usePrefs } from '../../hooks/usePrefs';
import DotsChart from './DotsChart';
import BrailleChart, { brailleSupported } from './BrailleChart';
import SvgChart from './SvgChart';
import { T } from '../ui';

const COL_PX = 8; // CSS px consumed per data column

export default function Chart({ series, rows = 6, label }: ChartProps) {
  const { renderer, notify } = usePrefs();
  const box = useRef<HTMLDivElement | null>(null);
  const [cols, setCols] = useState(0);
  const [brailleOk, setBrailleOk] = useState<boolean | null>(null);
  const reduced =
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ResizeObserver, not window resize: the sidebar collapsing or a tab
  // switching changes the container without changing the window.
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => {
      setCols(Math.max(8, Math.floor(e.contentRect.width / COL_PX)));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    if (renderer !== 'braille') return;
    let alive = true;
    brailleSupported().then((ok) => {
      if (!alive) return;
      setBrailleOk(ok);
      if (!ok) {
        notify('La fuente no tiene braille (U+2800). Usando puntos.');
      }
    });
    return () => { alive = false; };
  }, [renderer, notify]);

  const values = (() => {
    if (cols === 0) return [];
    const fitted = resample(series, cols);
    const max = Math.max(...fitted, 1);
    return fitted.map((v) => v / max);
  })();

  const active = renderer === 'braille' && brailleOk === false ? 'dots' : renderer;

  return (
    <div ref={box} style={{ width: '100%', overflow: 'hidden' }}>
      {label && (
        <div style={{
          fontFamily: T.mono, fontSize: 10.5, letterSpacing: '.16em',
          textTransform: 'uppercase', color: T.mut, marginBottom: 8,
        }}>
          {label}
        </div>
      )}
      {values.length > 0 && (
        active === 'braille' ? <BrailleChart values={values} rows={rows} />
        : active === 'svg' ? <SvgChart values={values} rows={rows} />
        : <DotsChart values={values} rows={rows} animate={!reduced} />
      )}
    </div>
  );
}
