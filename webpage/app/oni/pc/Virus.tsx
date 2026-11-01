'use client';
import { useEffect, useRef, useState } from 'react';
import { RAW } from '../mask';
import { ARROW, RAMP, paintGrid } from './pixels';
import type { PcAudio } from './pcAudio';
import { CCTV_H, CCTV_W, gradeCctv } from './cctv';
import CctvHud from './CctvHud';
import { holdStill } from '../still';

/*
 * passwords.txt era el anzuelo. Diez segundos medidos con el reloj (nunca con el audio):
 * el archivo se desborda, el sistema se infecta, la máscara se ríe y la pantalla acaba
 * siendo la cámara de seguridad que te estaba mirando.
 */

const BAIT = 1200, LAUGH = 6000, CAM = 9000, END = 10000;
const ERR = 'c0rr#pt.exe has performed an illegal operation';
const JUNK = '!#$%&*+/<=>?@[]^_{}~0123456789abcdefABCDEF▓▒░';
const junk = (n: number) => Array.from({ length: n }, () => JUNK[(Math.random() * JUNK.length) | 0]).join('');
const rgb = (t: number) => `rgb(${RAMP[t].join(',')})`;
type Phase = 'bait' | 'infect' | 'laugh' | 'cam';

// la máscara con la mandíbula abierta 0–3 celdas, en tres tintas: normal, sombra y quemada
function maskSprites() {
  const rows = RAW.length, cols = RAW[0].length;
  const make = (open: number, tint: 'n' | 'lo' | 'hi') => {
    const c = document.createElement('canvas');
    c.width = cols;
    c.height = rows + 3;
    const x = c.getContext('2d')!;
    RAW.forEach((r, y) =>
      [...r].forEach((ch, i) => {
        if (ch === ' ') return;
        const t = +ch;
        x.fillStyle = tint === 'lo' ? rgb(2) : tint === 'hi' ? rgb(5) : rgb(t === 5 ? 5 : t);
        x.fillRect(i, y >= 26 ? y + open : y, 1, 1);
      }),
    );
    // la boca abierta es un agujero negro
    if (tint === 'n' && open) {
      x.fillStyle = rgb(0);
      for (let i = 0; i < cols; i++) if (RAW[26][i] !== ' ' && RAW[25][i] !== ' ') x.fillRect(i, 26, 1, open);
    }
    return c;
  };
  return [0, 1, 2, 3].map((o) => ({ n: make(o, 'n'), lo: make(o, 'lo'), hi: make(o, 'hi') }));
}

export default function Virus({ audio, cctv, reduced, onDone }: { audio: PcAudio; cctv: ImageBitmap | null; reduced: boolean; onDone: () => void }) {
  const [phase, setPhase] = useState<Phase>('bait');
  const [errs, setErrs] = useState<{ n: number; x: string; y: string }[]>([]);
  const [bait, setBait] = useState<{ x: number; y: number; w: number; h: number; lines: string[] } | null>(null);
  const trail = useRef<HTMLDivElement>(null);
  const noise = useRef<HTMLCanvasElement>(null);
  const laugh = useRef<HTMLCanvasElement>(null);
  const cam = useRef<HTMLCanvasElement>(null);
  const done = useRef(onDone);
  done.current = onDone;

  // el reloj de toda la secuencia
  useEffect(() => {
    const desk = document.querySelector<HTMLElement>('.pc-desk');
    const screen = document.querySelector<HTMLElement>('.pc-screen');
    desk?.setAttribute('inert', '');
    audio.loadLaugh();
    window.dispatchEvent(new Event('oni:virus')); // la terminal se entera
    const t0 = performance.now();
    let raf = 0, nextErr = 0, nErr = 0, nextBait = 0, hdd = 0, ended = false, flashes = 0, nextFlash = 0;
    let cur: Phase = 'bait';
    // la fase, también en <html data-virus>: la sala que carga detrás no pinta durante la risa. El caos
    // y la imagen fija de la cámara sujetan la pantalla quieta (en Firefox, la sala compila ahí)
    let free: (() => void) | undefined;
    const go = (p: Phase) => {
      if (cur === p) return;
      cur = p;
      document.documentElement.dataset.virus = p;
      if (p === 'infect' || p === 'cam') free ??= holdStill();
      else (free?.(), (free = undefined));
      setPhase(p);
    };
    const fall: { el: HTMLElement; x: number; y: number; vx: number; vy: number; r: number; vr: number }[] = [];

    // el anzuelo: la ventana de passwords.txt se llena de basura que se sale por los bordes
    const win = document.querySelector<HTMLElement>('.pc-win[aria-label="passwords.txt"] .pc-win__b');
    const box = win?.getBoundingClientRect(), root = desk?.getBoundingClientRect();

    const tick = (now: number) => {
      raf = requestAnimationFrame(tick);
      const t = now - t0;
      if (t < BAIT) {
        if (box && root && now > nextBait) {
          nextBait = now + (reduced ? 300 : 60);
          const k = t / BAIT, cols = Math.max(8, (box.width / 8.6) | 0);
          setBait({
            x: box.left - root.left,
            y: box.top - root.top,
            w: box.width,
            h: box.height,
            lines: Array.from({ length: 4 + ((k * 14) | 0) }, (_, i) => (i < 4 && k < 0.3 ? ['# no abrir', 'root      ', 's7lver    ', 'oni       '][i] : '') + junk((cols * (0.4 + k * 1.8)) | 0)),
          });
        }
        return;
      }
      if (t < LAUGH) {
        go('infect');
        const k = (t - BAIT) / (LAUGH - BAIT);
        if (!hdd) {
          setBait(null);
          audio.stuckBeeps(true);
          hdd = window.setInterval(() => audio.hdd(4), 160);
          if (!reduced)
            document.querySelectorAll<HTMLElement>('.pc-icons li, .pc-ls li').forEach((el) =>
              fall.push({ el, x: 0, y: 0, vx: (Math.random() - 0.5) * 3, vy: -Math.random() * 4, r: 0, vr: (Math.random() - 0.5) * 6 }),
            );
        }
        audio.detune(k);
        // ventanas de error: primero en cascada, luego por toda la pantalla (en movimiento reducido, solo una)
        if (now > nextErr && (!reduced || nErr === 0)) {
          nextErr = now + 400 - 340 * k;
          const n = nErr++;
          const spread = k > 0.45;
          setErrs((e) =>
            [...e, { n, x: spread ? `${Math.random() * 80}%` : `calc(8% + ${(n * 23) % 260}px)`, y: spread ? `${4 + Math.random() * 80}%` : `calc(14% + ${(n * 17) % 220}px)` }].slice(-70),
          );
          audio.error();
        }
        for (const f of fall) {
          f.vy += 0.6;
          f.x += f.vx;
          f.y += f.vy;
          f.r += f.vr;
          f.el.style.transform = `translate(${f.x}px, ${f.y}px) rotate(${f.r}deg)`;
        }
        if (!reduced) {
          // saltos de sincronía cada vez más seguidos
          if (Math.random() < k * 0.18) {
            screen?.setAttribute('data-jit', '');
            setTimeout(() => screen?.removeAttribute('data-jit'), 40 + Math.random() * 60);
          }
          // un par de fogonazos del tubo (nunca más de dos por segundo)
          if (k > 0.35 && flashes < 4 && now > nextFlash && Math.random() < 0.04) {
            flashes++;
            nextFlash = now + 520;
            desk?.setAttribute('data-burn', '');
            audio.crunch();
            setTimeout(() => desk?.removeAttribute('data-burn'), 70);
          }
          interference(noise.current, k, now);
        }
        return;
      }
      if (t < CAM) {
        if (cur !== 'laugh') {
          go('laugh');
          clearInterval(hdd);
          audio.stuckBeeps(false);
          audio.detune(0);
          audio.crunch();
          audio.laugh();
        }
        return;
      }
      if (cur !== 'cam') {
        go('cam');
        audio.crunch();
      }
      if (t >= END && !ended) {
        ended = true;
        done.current();
      }
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      delete document.documentElement.dataset.virus;
      free?.();
      clearInterval(hdd);
      audio.stuckBeeps(false);
      audio.detune(0);
    };
  }, [audio, reduced]);

  // el cursor deja 8 copias que lo persiguen
  useEffect(() => {
    if (phase !== 'infect' || reduced) return;
    const box = trail.current!;
    const cs = [...box.children] as HTMLCanvasElement[];
    cs.forEach((c) => paintGrid(c, ARROW));
    const hist: [number, number][] = [];
    const mv = (e: PointerEvent) => {
      if (e.pointerType !== 'mouse') return;
      hist.unshift([e.clientX, e.clientY]);
      hist.length = 48;
      cs.forEach((c, i) => {
        const p = hist[(i + 1) * 5] ?? hist[hist.length - 1];
        if (p) c.style.transform = `translate(${p[0]}px, ${p[1]}px)`;
      });
    };
    window.addEventListener('pointermove', mv);
    return () => window.removeEventListener('pointermove', mv);
  }, [phase, reduced]);

  // la risa: un solo lienzo. La mandíbula y los golpes siguen el volumen de la risa; sin
  // audio, un ritmo de "ja" a unos 5 por segundo
  useEffect(() => {
    if (phase !== 'laugh') return;
    const c = laugh.current!, x = c.getContext('2d')!;
    const sprites = maskSprites();
    const t0 = performance.now();
    let raf = 0, rows: { y: number; size: number; off: number; hot: number }[] = [], fill = 0;
    const size = () => {
      c.width = c.clientWidth;
      c.height = c.clientHeight;
    };
    size();
    window.addEventListener('resize', size);
    const font = getComputedStyle(c).fontFamily;
    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      const t = (now - t0) / 1000, W = c.width, H = c.height;
      const lv = audio.laughLevel();
      const amp = reduced ? 0.3 : lv >= 0 ? lv : Math.pow(Math.abs(Math.sin(t * Math.PI * 5.2)), 3) * (0.6 + 0.4 * Math.sin(t * 1.7));
      x.setTransform(1, 0, 0, 1, 0, 0);
      x.fillStyle = rgb(0);
      x.fillRect(0, 0, W, H);

      // HA HA HA rellenando la pantalla de arriba abajo, cada línea de un tamaño
      while (fill < H && rows.length < (reduced ? 999 : t * 14)) {
        const s = [18, 18, 26, 40, 18, 64][rows.length % 6];
        rows.push({ y: fill, size: s, off: Math.random() * 60, hot: 0 });
        fill += s * 1.05;
      }
      if (!reduced && amp > 0.6) rows[(Math.random() * rows.length) | 0].hot = 1;
      for (const r of rows) {
        x.font = `700 ${r.size}px ${font}`;
        x.textBaseline = 'top';
        r.hot *= 0.9;
        x.fillStyle = r.hot > 0.3 ? rgb(4) : r.size > 30 ? rgb(2) : rgb(1);
        const jx = reduced ? 0 : (Math.random() - 0.5) * amp * 18;
        x.fillText('HA '.repeat(Math.ceil(W / (r.size * 1.6)) + 2), -r.off + jx, r.y);
      }

      // la máscara empuja hacia ti y cada carcajada la golpea
      const open = reduced ? 0 : amp > 0.55 ? 3 : amp > 0.3 ? 2 : amp > 0.12 ? 1 : 0;
      const sp = sprites[open];
      const zoom = reduced ? 0.7 : 0.55 + Math.min(1, t / 3) * 0.3 + amp * 0.08;
      const cell = Math.max(2, Math.floor((Math.min(W, H * 1.2) * zoom) / sp.n.width));
      const mw = sp.n.width * cell, mh = sp.n.height * cell;
      const shake = reduced ? 0 : amp * 14;
      const mx = (W - mw) / 2 + (Math.random() - 0.5) * shake, my = (H - mh) / 2 + (Math.random() - 0.5) * shake;
      x.imageSmoothingEnabled = false;
      if (!reduced) {
        const d = Math.round(cell * (0.5 + amp * 2.5));
        x.globalAlpha = 0.85;
        x.drawImage(sp.lo, mx - d, my, mw, mh);
        x.globalAlpha = 0.35 + amp * 0.4;
        x.drawImage(sp.hi, mx + d, my - (d >> 1), mw, mh);
        x.globalAlpha = 1;
      }
      x.drawImage(sp.n, mx, my, mw, mh);

      // en los picos la imagen se raja en tiras desplazadas
      if (!reduced && amp > 0.5)
        for (let i = 0; i < 3; i++) {
          const sy = Math.random() * H, sh = 6 + Math.random() * 40;
          x.drawImage(c, 0, sy, W, sh, (Math.random() - 0.5) * 80 * amp, sy, W, sh);
        }
    };
    raf = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', size);
    };
  }, [phase, reduced, audio]);

  // la cámara de seguridad: la habitación en gris virado a rojo, con grano y la banda de tracking
  useEffect(() => {
    if (phase !== 'cam') return;
    const c = cam.current!, x = c.getContext('2d')!;
    let raf = 0, base: ImageData | null = null;
    c.width = CCTV_W;
    c.height = CCTV_H;
    if (cctv) base = gradeCctv(cctv);
    else {
      const img = new Image();
      img.src = '/pc/room.webp';
      img.onload = () => (base = gradeCctv(img));
    }
    const W = CCTV_W, H = CCTV_H;
    let last = 0;
    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      if (!base || (reduced && last && now - last < 1000) || now - last < 60) return;
      last = now;
      const out = new ImageData(new Uint8ClampedArray(base.data), W, H), d = out.data;
      const band = reduced ? -99 : ((now / 14) % (H + 60)) - 30; // la banda baja despacio
      for (let y = 0; y < H; y++) {
        const inBand = Math.abs(y - band) < 10;
        const shift = inBand ? ((Math.random() * 10) | 0) : 0;
        for (let xx = 0; xx < W; xx++) {
          const i = (y * W + xx) * 4, s = shift ? (y * W + Math.min(W - 1, xx + shift)) * 4 : i;
          const n = reduced ? 0 : (Math.random() - 0.5) * (inBand ? 90 : 38);
          d[i] = base.data[s] + n;
          d[i + 1] = base.data[s + 1] + n * 0.5;
          d[i + 2] = base.data[s + 2] + n * 0.5;
        }
      }
      x.putImageData(out, 0, 0);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [phase, cctv, reduced]);

  return (
    <div className="pc-virus" data-phase={phase} data-reduced={reduced || undefined}>
      {bait && (
        <pre className="pc-virus__bait" style={{ left: bait.x, top: bait.y, width: bait.w, minHeight: bait.h }}>
          {bait.lines.join('\n')}
        </pre>
      )}
      {phase === 'infect' &&
        errs.map((e) => (
          <div key={e.n} className="pc-virus__err" role={e.n === 0 ? 'alert' : undefined} style={{ left: e.x, top: e.y }}>
            <div className="pc-virus__errt">ONI//OS</div>
            <p>{e.n > 14 && e.n % 3 === 0 ? junk(ERR.length) : ERR}</p>
            <span>[ ok ]</span>
          </div>
        ))}
      {phase === 'infect' && !reduced && <canvas ref={noise} className="pc-virus__noise" aria-hidden="true" />}
      {phase === 'infect' && !reduced && (
        <div ref={trail} className="pc-virus__trail" aria-hidden="true">
          {Array.from({ length: 8 }, (_, i) => (
            <canvas key={i} style={{ opacity: 0.85 - i * 0.09 }} />
          ))}
        </div>
      )}
      {phase === 'laugh' && <canvas ref={laugh} className="pc-virus__laugh" role="img" aria-label="the mask laughs: HA HA HA" />}
      {phase === 'cam' && (
        <div className="pc-virus__cam">
          <canvas ref={cam} role="img" aria-label="security camera 03: your room" />
          <CctvHud cam={3} />
        </div>
      )}
    </div>
  );
}

// interferencia: bandas de ruido que suben por la pantalla, cada vez más gruesas
function interference(c: HTMLCanvasElement | null, k: number, now: number) {
  if (!c) return;
  const x = c.getContext('2d')!;
  const W = 160, H = 90;
  if (c.width !== W) {
    c.width = W;
    c.height = H;
  }
  x.clearRect(0, 0, W, H);
  const n = 1 + ((k * 5) | 0);
  for (let b = 0; b < n; b++) {
    const y0 = (H - ((now / (9 + b * 3)) % (H + 20)) + b * 23) % (H + 20) - 10;
    const h = 1 + Math.random() * (2 + k * 6);
    for (let y = y0; y < y0 + h; y++)
      for (let xx = 0; xx < W; xx++) {
        if (Math.random() > 0.55) continue;
        x.fillStyle = rgb(Math.random() < 0.3 ? 4 : 2);
        x.fillRect(xx, y | 0, 1, 1);
      }
  }
}
