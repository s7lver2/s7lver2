import * as THREE from 'three';
import { MASK } from '../mask';

/*
 * Los programas del muro: un lienzo con lo que se ve desde la silla, del que cada tele enseña
 * su trozo, así que sentado las teles juntas forman una imagen. La máscara gigante (parpadea y se raja en tiras) y
 * una lluvia tipo matrix en rojo.
 */

export type WallShow = 'mask' | 'rain';

const TONE = ['', '', '#6e120c', '#c4221a', '#ff4a36', '#ffd9cf'];
const GLYPHS = '01鬼ｱｲｳｴｵｶｷｸｹｺｻｼｽｾｿﾀﾁﾂﾃﾄﾅﾆﾇﾈﾉ<>/*=+';

export function makeWallShows(aspect: number) {
  const W = 320;
  let H = Math.round(W / aspect);
  const c = Object.assign(document.createElement('canvas'), { width: W, height: H });
  const x = c.getContext('2d')!, tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.magFilter = THREE.NearestFilter;
  const G = 11;
  const drops = Array.from({ length: Math.ceil(W / G) }, () => ({ y: -Math.random() * H, v: 30 + Math.random() * 50 }));
  let show: WallShow = 'mask';

  const mask = (t: number) => {
    // de fondo, barras rojas que bajan despacio: ninguna tele se queda muerta
    x.fillStyle = '#0c0302';
    x.fillRect(0, 0, W, H);
    x.fillStyle = '#3a0806';
    for (let y = ((t * 14) % 12) - 12; y < H; y += 12) x.fillRect(0, y, W, 5);
    const rows = MASK.length, cols = MASK[0].length, cell = Math.max(1, Math.floor(Math.min(W / cols, (H * 0.96) / rows)));
    const ox = Math.round((W - cols * cell) / 2), oy = Math.round((H - rows * cell) / 2);
    const blink = Math.sin(t * 0.8) > 0.96;
    const glitch = Math.sin(t * 1.7) > 0.88 ? (((t * 30) | 0) % 9) - 4 : 0;
    // una pasada de luz baja por la máscara, como un barrido de cámara
    const scan = ((t * 0.35) % 1.4) * rows;
    MASK.forEach((r, y) => {
      const sx = glitch && y % 4 === 1 ? glitch * cell : 0;
      [...r].forEach((ch, i) => {
        if (ch === ' ') return;
        const k = +ch + (Math.abs(y - scan) < 1.5 && ch !== '5' ? 1 : 0);
        x.fillStyle = ch === '5' ? (blink ? '#2a0605' : '#ff9a8a') : TONE[Math.min(4, k)];
        x.fillRect(ox + i * cell + sx, oy + y * cell, cell, cell);
      });
    });
  };

  const rain = (dt: number) => {
    x.fillStyle = 'rgba(5, 2, 2, 0.12)';
    x.fillRect(0, 0, W, H);
    x.font = `bold ${G}px ui-monospace, Consolas, monospace`;
    x.textBaseline = 'top';
    drops.forEach((d, i) => {
      const prev = Math.floor(d.y / G);
      d.y += d.v * dt;
      const row = Math.floor(d.y / G);
      if (row !== prev && row >= 0) {
        // la letra de antes se apaga a rojo oscuro; la cabeza, rojo claro
        x.fillStyle = '#2a0605';
        x.fillRect(i * G, prev * G, G, G);
        x.fillStyle = '#e0301f';
        x.fillText(GLYPHS[(Math.random() * GLYPHS.length) | 0], i * G, prev * G);
        x.fillStyle = '#ff7a66';
        x.fillText(GLYPHS[(Math.random() * GLYPHS.length) | 0], i * G, row * G);
      }
      if (d.y > H + Math.random() * H) Object.assign(d, { y: -Math.random() * H * 0.3, v: 30 + Math.random() * 50 });
    });
  };

  return {
    tex,
    resize(a: number) {
      c.height = H = Math.round(W / a);
    },
    set(s: WallShow) {
      show = s;
      x.fillStyle = '#050202';
      x.fillRect(0, 0, W, H);
    },
    update(t: number, dt: number) {
      if (show === 'mask') mask(t);
      else rain(dt);
      tex.needsUpdate = true;
    },
  };
}
