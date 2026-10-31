'use client';
import { useEffect, useRef } from 'react';
import { RAW } from '../mask';
import { dither } from './pixels';

/*
 * Pantalla de arranque de ONI//OS, como las de los 90: la máscara tramada en la rampa de
 * fósforo, quieta, y debajo una barra de bloques que se llena a saltos.
 */

const LUM: Record<string, number> = { '2': 0.22, '3': 0.42, '4': 0.66, '5': 1 };
const BLOCKS = 18;

export default function Boot({ progress }: { progress: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current!;
    const rows = RAW.length, cols = RAW[0].length, k = 2; // dos píxeles de trama por celda de la máscara
    c.width = cols * k;
    c.height = rows * k;
    const x = c.getContext('2d')!;
    // tono suavizado entre celdas, para que la trama haga los degradados
    const tone = (fx: number, fy: number) => {
      const ix = Math.floor(fx), iy = Math.floor(fy), ax = fx - ix, ay = fy - iy;
      const t = (i: number, j: number) => LUM[RAW[j]?.[i] ?? ' '] ?? 0;
      return t(ix, iy) * (1 - ax) * (1 - ay) + t(ix + 1, iy) * ax * (1 - ay) + t(ix, iy + 1) * (1 - ax) * ay + t(ix + 1, iy + 1) * ax * ay;
    };
    x.putImageData(dither(x.createImageData(c.width, c.height), (X, Y) => tone(X / k - 0.25, Y / k - 0.25)), 0, 0);
  }, []);
  const filled = Math.floor(progress * BLOCKS);
  return (
    <div className="pc-boot" role="progressbar" aria-label="Starting ONI//OS" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progress * 100)}>
      <canvas ref={ref} className="pc-boot__mask" aria-hidden="true" />
      <p>Starting ONI//OS...</p>
      <div className="pc-boot__bar" aria-hidden="true">
        {Array.from({ length: BLOCKS }, (_, i) => (
          <i key={i} data-on={i < filled || undefined} />
        ))}
      </div>
    </div>
  );
}
