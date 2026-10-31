'use client';
import { useEffect, useState, type ReactNode } from 'react';
import { tanker } from './fonts';

const KATA = 'アイウエオカキクケコサシスセソタチツテトナニヌネノハヒフヘホマミムメモヤユヨラリルレロワヲン';
const kata = () => KATA[(Math.random() * KATA.length) | 0];

/** Un texto que se engancha: unos fotogramas en katakana y luego el de verdad (sin movimiento, directo). */
export function useLatch(text: string, frames = 12) {
  const [shown, setShown] = useState(text);
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return setShown(text);
    let f = 0;
    const id = setInterval(() => {
      f++;
      setShown(f > frames ? text : text.replace(/[^\s·/-]/g, (c) => (Math.random() < 0.6 ? kata() : c)));
      if (f > frames) clearInterval(id);
    }, 70);
    return () => clearInterval(id);
  }, [text, frames]);
  return shown;
}

/**
 * El rótulo de cámara del inicio, en cada escena: el canal que se engancha en katakana, el sistema,
 * REC con la hora y la línea vertical en japonés (donde no la tapa nada). `children` es lo propio de la escena (abajo a la
 * izquierda). Es decorado: los lectores de pantalla ya tienen el contenido de cada escena.
 */
export default function Osd({ ch, sys, tate, off, children }: { ch: number; sys: string; tate?: string; off?: boolean; children?: ReactNode }) {
  const channel = useLatch(`CH ${String(ch).padStart(2, '0')}`, 14);
  const [clock, setClock] = useState('--:--:--');
  useEffect(() => {
    const s = () => setClock(new Date().toLocaleTimeString('en-GB'));
    s();
    const id = setInterval(s, 1000);
    return () => clearInterval(id);
  }, []);
  return (
    <div className={`oni-osd oni-osd--scene ${tanker.variable}`} data-off={off || undefined} aria-hidden="true">
      <span className="oni-osd__tl">
        <b>{channel}</b>
        <br />
        {sys}
      </span>
      <span className="oni-osd__tr">
        <i /> REC {clock}
      </span>
      {tate && <span className="oni-osd__tate">{tate}</span>}
      {children && <div className="oni-osd__bl">{children}</div>}
    </div>
  );
}
