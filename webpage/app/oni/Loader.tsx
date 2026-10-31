'use client';
import { useEffect, useRef, useState } from 'react';
import { MASK, COLS, ROWS } from './mask';

/*
 * Pantalla de carga: en el centro y en pequeño, la máscara oni en píxeles (sacada del modelo
 * 3D con luz lateral dura) se va descodificando mientras llegan los modelos: una línea de
 * barrido la repasa, un eco rojo tiembla detrás y los ojos parpadean. Debajo, LOADING y la barra. Al terminar espera una tecla o un clic (sin eso el navegador no deja
 * sonar nada), la máscara se deshace y queda el negro del que abrimos los ojos.
 */

const BAR = 26;
// casi todo negro; el rojo solo donde pega la luz
const TONE = ['', '#130404', '#4a0f0c', '#9b1c15', '#ff3b2e', '#fff1ec'];
const HOT = ['', '#2a0605', '#7a100b', '#e8261b', '#ff8a7e', '#ffffff']; // al pasar el barrido

interface Px {
  x: number;
  y: number;
  v: number;
  rank: number;
  vx: number;
  vy: number;
  on: number; // instante en que se encendió (para el destello de descodificación)
}

export default function Loader({
  progress,
  ready,
  onEnter,
  onDone,
  fontFamily,
}: {
  fontFamily: string;
  progress: number;
  ready: boolean;
  onEnter: () => void;
  onDone: () => void;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const slot = useRef<HTMLDivElement>(null);
  const [shown, setShown] = useState(0);
  const [phase, setPhase] = useState<'load' | 'ready' | 'leave'>('load');
  const target = useRef(0);
  const phaseRef = useRef(phase);
  phaseRef.current = phase;
  target.current = progress;

  // el número avanza hacia el progreso real, nunca de golpe ni hacia atrás
  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      setShown((s) => Math.min(target.current, s + Math.max(0.004, (target.current - s) * dt * 4) * (dt * 60)));
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  useEffect(() => {
    if (ready && shown >= 0.999 && phase === 'load') setPhase('ready');
  }, [ready, shown, phase]);

  // cualquier tecla, clic o intento de scroll entra; solo tecla y clic desbloquean el sonido
  useEffect(() => {
    if (phase !== 'ready') return;
    const go = () => {
      setPhase('leave');
      onEnter();
    };
    const opts = { once: true, passive: true } as const;
    const evs = ['keydown', 'pointerdown', 'wheel', 'touchmove'] as const;
    evs.forEach((e) => window.addEventListener(e, go, opts));
    return () => evs.forEach((e) => window.removeEventListener(e, go));
  }, [phase, onEnter]);

  const shownRef = useRef(0);
  shownRef.current = shown;
  useEffect(() => {
    const px: Px[] = [];
    MASK.forEach((row, y) =>
      [...row].forEach((ch, x) => {
        if (ch === ' ') return;
        const dx = x - COLS / 2, dy = y - ROWS / 2;
        const d = Math.hypot(dx, dy) || 1;
        // llega de abajo arriba con desorden, como una imagen por un cable lento; los ojos, los últimos
        px.push({ x, y, v: +ch, rank: ch === '5' ? 0.97 : (1 - y / ROWS) * 0.6 + Math.random() * 0.36, vx: (dx / d) * (0.5 + Math.random()), vy: (dy / d) * (0.5 + Math.random()) - 0.4, on: -1 });
      }),
    );

    const c = canvas.current!;
    const x = c.getContext('2d')!;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    let raf = 0;
    let leaveT = -1;
    let slice = { y0: -1, y1: -1, off: 0 };
    let echo = 1;
    let blinkUntil = 0;
    let nextBlink = performance.now() + 1800;
    const draw = (now: number) => {
      raf = requestAnimationFrame(draw);
      const t = now / 1000;
      const dpr = Math.min(window.devicePixelRatio, 2);
      const cell = Math.max(3, Math.floor(Math.min(window.innerWidth * 0.4, window.innerHeight * 0.22, 150) / COLS));
      const w = cell * COLS, h = cell * ROWS;
      // el hueco ocupa el sitio de la máscara; el lienzo es la pantalla entera, para que al
      // deshacerse los píxeles vuelen libres y no se corten en el borde de una caja
      const sl = slot.current;
      if (!sl) return; // desmontado entre frames (?pc lo cierra de golpe)
      if (sl.style.width !== w + 'px') {
        sl.style.width = w + 'px';
        sl.style.height = h + 'px';
      }
      const VW = window.innerWidth, VH = window.innerHeight;
      if (c.width !== Math.round(VW * dpr) || c.height !== Math.round(VH * dpr)) {
        c.width = Math.round(VW * dpr);
        c.height = Math.round(VH * dpr);
      }
      x.setTransform(1, 0, 0, 1, 0, 0);
      x.clearRect(0, 0, c.width, c.height);
      const r = sl.getBoundingClientRect();
      x.setTransform(dpr, 0, 0, dpr, Math.round(r.left * dpr), Math.round(r.top * dpr));
      if (phaseRef.current === 'leave' && leaveT < 0) leaveT = now;
      const lt = leaveT < 0 ? 0 : (now - leaveT) / 1000;
      const pr = shownRef.current;
      const s = cell - 1;

      if (!reduced) {
        // franjas que saltan de lado, de vez en cuando
        if (Math.random() < 0.025) {
          const y0 = (Math.random() * ROWS) | 0;
          slice = { y0, y1: y0 + 1 + ((Math.random() * 4) | 0), off: (Math.random() < 0.5 ? -1 : 1) * (1 + ((Math.random() * 2) | 0)) };
        } else if (Math.random() < 0.25) slice.y0 = -1;
        // el eco tiembla
        if (Math.random() < 0.1) echo = Math.random() < 0.5 ? 1 : 2;
        if (now > nextBlink) {
          blinkUntil = now + 130;
          nextBlink = now + (Math.random() < 0.3 ? 260 : 2200 + Math.random() * 3000);
        }
      }
      // la línea de barrido baja una y otra vez
      const scan = ((t * 0.55) % 1.4) * ROWS - ROWS * 0.2;
      const breathe = 0.9 + 0.1 * Math.sin(t * 1.7);

      // 1) el eco: la máscara entera desplazada, en rojo muy oscuro
      if (lt === 0) {
        x.fillStyle = '#2b0503';
        for (const p of px) {
          if (p.rank > pr || p.v < 3) continue;
          x.fillRect((p.x - echo) * cell, p.y * cell, s, s);
        }
      }

      // 2) los píxeles
      for (const p of px) {
        const sl = p.y >= slice.y0 && p.y < slice.y1 ? slice.off * cell : 0;
        let ox = sl, oy = 0, a = 1;
        if (lt > 0) {
          // al salir: los ojos aguantan un instante más, el resto se dispersa y se apaga
          const k = Math.max(0, lt - (p.v === 5 ? 0.4 : p.rank * 0.25));
          ox += p.vx * k * k * cell * 22 + (Math.random() - 0.5) * k * cell * 3;
          oy += p.vy * k * k * cell * 22;
          a = Math.max(0, 1 - k * 1.6);
          if (a <= 0) continue;
        }
        const X = p.x * cell + ox, Y = p.y * cell + oy;
        if (p.rank > pr) {
          x.globalAlpha = a;
          x.fillStyle = '#1c0605';
          x.fillRect(X + s / 2 - 1, Y + s / 2 - 1, 2, 2);
          continue;
        }
        if (p.on < 0) p.on = now;
        const fresh = now - p.on < 140; // recién descodificado: destello
        const lit = Math.abs(p.y - scan) < 1.6;
        let v = p.v;
        if (v === 5 && now < blinkUntil) v = 1; // parpadeo
        x.globalAlpha = a * (v === 5 ? 1 : breathe);
        if (v === 5) {
          // los ojos sangran un poco de rojo a los lados
          x.fillStyle = 'rgba(255,40,28,0.28)';
          x.fillRect(X - cell, Y, s + cell * 2, s);
        }
        x.fillStyle = fresh ? '#ffffff' : lit ? HOT[v] : TONE[v];
        x.fillRect(X, Y, s, s);
      }

      if (lt > (reduced ? 0.2 : 1.6)) {
        cancelAnimationFrame(raf);
        onDone();
      }
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [onDone]);

  const pct = Math.round(shown * 100);
  const fill = Math.round(shown * BAR);
  return (
    <div className="oni-load" style={{ ['--font-tanker' as string]: fontFamily }} data-phase={phase} role="progressbar" aria-label="Loading" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct}>
      <div ref={slot} className="oni-load__mask" aria-hidden="true" />
      <canvas ref={canvas} className="oni-load__fx" aria-hidden="true" />
      <div className="oni-load__bar" aria-hidden="true">
        <b>{phase === 'load' ? 'LOADING' : 'SIGNAL ACQUIRED'}</b>
        <span>
          [{'█'.repeat(fill)}
          <i>{'░'.repeat(BAR - fill)}</i>] {String(pct).padStart(3, '0')}%
        </span>
        <small>{phase === 'ready' ? 'press any key' : ' '}</small>
      </div>
    </div>
  );
}
