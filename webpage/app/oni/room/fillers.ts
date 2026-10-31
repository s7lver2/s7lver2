import * as THREE from 'three';
import { RAW } from '../mask';

/*
 * Lo que enseñan las teles sin canal: la máscara, terminales, un mapa de red, un radar, un
 * ecualizador, un volcado hex, un osciloscopio, un latido y "NO SIGNAL". Pocos lienzos
 * compartidos entre muchas teles, pintados a 10 fps. Se pintan en gris y la tele los pasa a
 * fósforo rojo (mono); la máscara ya viene en su rojo. Las animaciones de s7lver entrarán aquí como un relleno más.
 */

export interface Filler { tex: THREE.Texture; mono: boolean; update?: (t: number) => void }

const W = 256, H = 192;
const BG = '#050505';
const LINES = ['sshd[7]: accepted key for oni', 'GET /cam/03/stream 200', 'pid 13 listen radio 88.7', 'ufw: BLOCK IN=eth0 SRC=203.0.113.7', 'rsync ~/projects -> /mnt/oni', 'kernel: tty0 hung up', 'cron[21]: (root) CMD watch', 'mask: stare'];

function make(mono: boolean, draw: (x: CanvasRenderingContext2D, t: number) => void): Filler {
  const c = Object.assign(document.createElement('canvas'), { width: W, height: H });
  const x = c.getContext('2d')!, tex = new THREE.CanvasTexture(c);
  if (!mono) tex.colorSpace = THREE.SRGBColorSpace;
  return {
    tex,
    mono,
    update(t) {
      x.fillStyle = BG;
      x.fillRect(0, 0, W, H);
      draw(x, t);
      tex.needsUpdate = true;
    },
  };
}
const mono = (font = 11) => `${font}px ui-monospace, Consolas, monospace`;

function terminal(seed: number) {
  const rows: string[] = [];
  let k = seed;
  return make(true, (x) => {
    rows.push(`${String(k).padStart(5, '0')} ${LINES[(k * 7 + seed) % LINES.length]}`);
    k += 1 + (seed % 3);
    if (rows.length > 15) rows.shift();
    x.font = mono();
    x.textBaseline = 'top';
    rows.forEach((r, i) => {
      x.fillStyle = i === rows.length - 1 ? '#f2f2f2' : '#8a8a8a';
      x.fillText(r, 8, 6 + i * 12);
    });
  });
}

function map() {
  const pts = Array.from({ length: 22 }, () => [20 + Math.random() * (W - 40), 16 + Math.random() * (H - 32)]);
  return make(true, (x, t) => {
    x.strokeStyle = '#5a5a5a';
    pts.forEach(([a, b], i) => {
      const [c, d] = pts[(i * 5 + 3) % pts.length];
      x.beginPath();
      x.moveTo(a, b);
      x.lineTo(c, d);
      x.stroke();
    });
    const hot = pts[Math.floor(t * 1.5) % pts.length];
    x.fillStyle = '#ffffff';
    x.fillRect(hot[0] - 3, hot[1] - 3, 6, 6);
    x.fillStyle = '#bdbdbd';
    for (const [a, b] of pts) x.fillRect(a - 1, b - 1, 2, 2);
  });
}

function wave() {
  return make(true, (x, t) => {
    x.strokeStyle = '#dcdcdc';
    x.beginPath();
    for (let i = 0; i < W; i += 2) {
      const v = Math.sin(i * 0.07 + t * 4) * Math.sin(i * 0.013 + t) * 50 + (Math.random() - 0.5) * 8;
      if (i) x.lineTo(i, H / 2 + v);
      else x.moveTo(i, H / 2 + v);
    }
    x.stroke();
  });
}

// la máscara en píxeles: parpadea, a veces se raja en tiras y los ojos se encienden
function mask() {
  const cols = RAW[0].length, rows = RAW.length, cell = Math.floor(Math.min(W / cols, (H - 10) / rows));
  const ox = (W - cols * cell) / 2, oy = (H - rows * cell) / 2;
  const TONE = ['', '', '#6e120c', '#c4221a', '#ff4a36', '#ffd9cf'];
  return make(false, (x, t) => {
    const blink = Math.sin(t * 0.9) > 0.97;
    const glitch = Math.sin(t * 2.3) > 0.9 ? ((t * 40) | 0) % 7 - 3 : 0;
    RAW.forEach((r, y) => {
      const sx = glitch && y % 5 === 2 ? glitch * cell : 0;
      [...r].forEach((ch, i) => {
        if (ch === ' ') return;
        x.fillStyle = ch === '5' ? (blink ? '#2a0605' : '#ffd9cf') : TONE[+ch];
        x.fillRect(ox + i * cell + sx, oy + y * cell, cell, cell);
      });
    });
  });
}

function radar() {
  const blips = Array.from({ length: 6 }, () => [Math.random() * Math.PI * 2, 20 + Math.random() * 60]);
  return make(true, (x, t) => {
    const cx = W / 2, cy = H / 2, R = 86, a = (t * 1.6) % (Math.PI * 2);
    x.strokeStyle = '#3a3a3a';
    for (const r of [R, R * 0.66, R * 0.33]) {
      x.beginPath();
      x.arc(cx, cy, r, 0, Math.PI * 2);
      x.stroke();
    }
    for (let i = 0; i < 24; i++) {
      x.strokeStyle = `rgba(230,230,230,${0.5 - i / 48})`;
      x.beginPath();
      x.moveTo(cx, cy);
      x.lineTo(cx + Math.cos(a - i * 0.04) * R, cy + Math.sin(a - i * 0.04) * R);
      x.stroke();
    }
    for (const [ba, br] of blips) {
      const age = (a - ba + Math.PI * 4) % (Math.PI * 2);
      if (age < 2.5) {
        x.fillStyle = `rgba(255,255,255,${1 - age / 2.5})`;
        x.fillRect(cx + Math.cos(ba) * br - 2, cy + Math.sin(ba) * br - 2, 4, 4);
      }
    }
  });
}

function eq() {
  const v = Array(24).fill(0);
  return make(true, (x, t) => {
    v.forEach((_, i) => (v[i] = Math.max(v[i] * 0.6, Math.abs(Math.sin(t * 3 + i * 0.7)) * Math.random())));
    v.forEach((h, i) => {
      for (let k = 0; k < Math.round(h * 14); k++) {
        x.fillStyle = k > 11 ? '#ffffff' : '#9a9a9a';
        x.fillRect(12 + i * 10, H - 16 - k * 11, 8, 8);
      }
    });
  });
}

function hexdump() {
  let off = 0x7f00;
  return make(true, (x) => {
    x.font = mono(10);
    x.textBaseline = 'top';
    for (let r = 0; r < 15; r++) {
      const bytes = Array.from({ length: 8 }, () => ((Math.random() * 256) | 0).toString(16).padStart(2, '0')).join(' ');
      x.fillStyle = '#6a6a6a';
      x.fillText((off + r * 8).toString(16), 8, 6 + r * 12);
      x.fillStyle = r === 7 ? '#ffffff' : '#a8a8a8';
      x.fillText(bytes, 52, 6 + r * 12);
    }
    off += 8;
  });
}

function lissajous() {
  return make(true, (x, t) => {
    x.strokeStyle = '#e6e6e6';
    x.beginPath();
    for (let i = 0; i <= 200; i++) {
      const s = (i / 200) * Math.PI * 2;
      const px = W / 2 + Math.sin(s * 3 + t) * 90, py = H / 2 + Math.sin(s * 2 + t * 0.7) * 70;
      if (i) x.lineTo(px, py);
      else x.moveTo(px, py);
    }
    x.stroke();
  });
}

function heartbeat() {
  const pts: number[] = [];
  return make(true, (x, t) => {
    const ph = (t * 1.1) % 1;
    for (let k = 0; k < 6; k++) pts.push(ph > 0.1 && ph < 0.16 ? (Math.random() < 0.5 ? -60 : 40) : (Math.random() - 0.5) * 4);
    while (pts.length > W / 2) pts.shift();
    x.strokeStyle = '#f0f0f0';
    x.beginPath();
    pts.forEach((v, i) => (i ? x.lineTo(i * 2, H / 2 + v) : x.moveTo(0, H / 2 + v)));
    x.stroke();
    x.font = mono(12);
    x.fillStyle = '#9a9a9a';
    x.fillText(`BPM ${60 + ((Math.sin(t) * 8) | 0)}`, 10, 18);
  });
}

function noSignal() {
  return make(true, (x, t) => {
    for (let i = 0; i < 7; i++) {
      x.fillStyle = `rgb(${[230, 200, 170, 140, 110, 80, 50][i]},${[230, 200, 170, 140, 110, 80, 50][i]},${[230, 200, 170, 140, 110, 80, 50][i]})`;
      x.fillRect((i * W) / 7, 0, W / 7 + 1, H * 0.66);
    }
    if (Math.floor(t * 1.5) % 2) {
      x.fillStyle = BG;
      x.fillRect(W / 2 - 62, H * 0.66 + 14, 124, 28);
      x.font = `bold ${mono(16)}`;
      x.fillStyle = '#ffffff';
      x.textAlign = 'center';
      x.fillText('NO SIGNAL', W / 2, H * 0.66 + 34);
      x.textAlign = 'left';
    }
  });
}

/** Todos los rellenos; la máscara va primero para que la llegada la reparta bien. */
export function makeFillers(): Filler[] {
  return [mask(), terminal(1), radar(), map(), eq(), terminal(4), hexdump(), wave(), lissajous(), heartbeat(), noSignal(), terminal(9)];
}
