/*
 * El revelado de las cámaras de seguridad, compartido por el virus y la sala: auto-niveles
 * (la habitación es oscura y una cámara barata lo compensa a lo bruto) y gris virado a rojo.
 * La CAM 03 se ve igual en la pantalla completa del virus y en su tele de la sala.
 */

export const CCTV_W = 480, CCTV_H = 360;

export function gradeCctv(src: CanvasImageSource & { width: number; height: number }): ImageData {
  const c = Object.assign(document.createElement('canvas'), { width: CCTV_W, height: CCTV_H });
  const x = c.getContext('2d', { willReadFrequently: true })!;
  const k = Math.max(CCTV_W / src.width, CCTV_H / src.height);
  x.drawImage(src, (CCTV_W - src.width * k) / 2, (CCTV_H - src.height * k) / 2, src.width * k, src.height * k);
  const img = x.getImageData(0, 0, CCTV_W, CCTV_H), d = img.data;
  const lum = new Float32Array(d.length / 4);
  for (let i = 0; i < lum.length; i++) lum[i] = (d[i * 4] * 0.3 + d[i * 4 + 1] * 0.59 + d[i * 4 + 2] * 0.11) / 255;
  const sorted = Float32Array.from(lum).sort();
  const lo = sorted[(sorted.length * 0.02) | 0], hi = Math.max(lo + 0.05, sorted[(sorted.length * 0.985) | 0]);
  for (let i = 0; i < d.length; i += 4) {
    const l = Math.pow(Math.min(1, Math.max(0, (lum[i / 4] - lo) / (hi - lo))), 0.75);
    d[i] = 10 + l * 245;
    d[i + 1] = 4 + l * l * 150;
    d[i + 2] = 4 + l * l * 130;
  }
  return img;
}

/** El rótulo de la cámara, igual en los dos sitios: número arriba a la izquierda, hora abajo. */
export function stampCctv(x: CanvasRenderingContext2D, cam: number, time: string, font: string) {
  const W = x.canvas.width, H = x.canvas.height, s = Math.round(H / 20);
  x.font = `${s}px ${font}`;
  x.fillStyle = '#ffd9cf';
  x.textBaseline = 'top';
  x.fillText(`CAM ${String(cam).padStart(2, '0')}`, W * 0.06, H * 0.06);
  x.textAlign = 'right';
  x.textBaseline = 'bottom';
  x.fillText(`REC ${time}`, W * 0.94, H * 0.94);
  x.textAlign = 'left';
}

/** La letra de los rótulos (la del ordenador). */
export const CCTV_FONT = "ui-monospace, 'Cascadia Mono', Consolas, monospace";
