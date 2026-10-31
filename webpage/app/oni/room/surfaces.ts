import * as THREE from 'three';

/*
 * Relieve hecho a mano: se dibuja la altura en gris en un lienzo (grietas, juntas, rayas) y de
 * ahí sale el mapa de normales; la rugosidad, igual, en otro lienzo gris (blanco = mate).
 */

export const canvas = (w: number, h = w) => Object.assign(document.createElement('canvas'), { width: w, height: h });

export function tex(c: HTMLCanvasElement, repeat: [number, number], srgb: boolean) {
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(...repeat);
  t.anisotropy = 4;
  return t;
}

/** Normales a partir de la altura (gris, más claro = más alto), con bordes que se repiten. */
export function normalFrom(h: HTMLCanvasElement, strength: number, repeat: [number, number]) {
  const W = h.width, H = h.height, src = h.getContext('2d')!.getImageData(0, 0, W, H).data;
  const out = canvas(W, H), x = out.getContext('2d')!, img = x.createImageData(W, H), d = img.data;
  const at = (i: number, j: number) => src[(((j + H) % H) * W + ((i + W) % W)) * 4] / 255;
  for (let j = 0; j < H; j++)
    for (let i = 0; i < W; i++) {
      // la v de la textura sube y el lienzo baja: por eso la y va con el signo cambiado
      const nx = -(at(i + 1, j) - at(i - 1, j)) * strength, ny = (at(i, j + 1) - at(i, j - 1)) * strength;
      const k = 1 / Math.hypot(nx, ny, 1), o = (j * W + i) * 4;
      d[o] = (nx * k * 0.5 + 0.5) * 255;
      d[o + 1] = (ny * k * 0.5 + 0.5) * 255;
      d[o + 2] = (k * 0.5 + 0.5) * 255;
      d[o + 3] = 255;
    }
  x.putImageData(img, 0, 0);
  return tex(out, repeat, false);
}

/** Azar repetible: la misma grieta en el color y en la altura. */
export const seeded = (s: number) => () => (s = (s * 16807) % 2147483647) / 2147483647;

/** Una línea que tiembla: grietas y rayas. */
export function crack(x: CanvasRenderingContext2D, x0: number, y0: number, len: number, step: number, wobble: number, rand = Math.random) {
  let a = rand() * Math.PI * 2, px = x0, py = y0;
  x.beginPath();
  x.moveTo(px, py);
  for (let s = 0; s < len; s += step) {
    a += (rand() - 0.5) * wobble;
    px += Math.cos(a) * step;
    py += Math.sin(a) * step;
    x.lineTo(px, py);
  }
  x.stroke();
}
