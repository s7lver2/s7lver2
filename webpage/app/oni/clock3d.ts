import * as THREE from 'three';

/*
 * Un reloj digital de LED rojo con la hora de verdad: cuerpo de plástico negro y una cara con
 * dígitos de siete segmentos, los apagados apenas visibles como en uno real, y los dos puntos
 * parpadeando cada segundo.
 */

// segmentos de cada cifra: a b c d e f g
const SEG = ['1111110', '0110000', '1101101', '1111001', '0110011', '1011011', '1011111', '1110000', '1111111', '1111011'];
const W = 320, H = 120, ON = '#ff3a28', OFF = '#2a0807';

function digit(x: CanvasRenderingContext2D, n: number, ox: number) {
  const w = 52, h = 86, t = 10, oy = (H - h) / 2;
  // a b c d e f g como rectángulos (x, y, ancho, alto) dentro de la cifra
  const r: [number, number, number, number][] = [
    [t, 0, w - 2 * t, t], [w - t, t, t, h / 2 - t * 1.5], [w - t, h / 2 + t / 2, t, h / 2 - t * 1.5],
    [t, h - t, w - 2 * t, t], [0, h / 2 + t / 2, t, h / 2 - t * 1.5], [0, t, t, h / 2 - t * 1.5], [t, h / 2 - t / 2, w - 2 * t, t],
  ];
  r.forEach(([a, b, c, d], i) => {
    x.fillStyle = n >= 0 && SEG[n][i] === '1' ? ON : OFF;
    x.fillRect(ox + a, oy + b, c, d);
  });
}

export function makeClock(width: number) {
  const c = Object.assign(document.createElement('canvas'), { width: W, height: H });
  const x = c.getContext('2d')!;
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  const draw = () => {
    const now = new Date(), hh = now.getHours(), mm = now.getMinutes();
    x.fillStyle = '#070202';
    x.fillRect(0, 0, W, H);
    x.save();
    x.transform(1, 0, -0.08, 1, 6, 0); // la inclinación de los relojes de LED
    [Math.floor(hh / 10), hh % 10, -1, Math.floor(mm / 10), mm % 10].forEach((n, i) => {
      if (i === 2) {
        x.fillStyle = now.getSeconds() % 2 ? OFF : ON;
        x.fillRect(154, 38, 12, 12);
        x.fillRect(154, 72, 12, 12);
      } else digit(x, n, [22, 86, 0, 182, 246][i]);
    });
    x.restore();
    tex.needsUpdate = true;
  };
  draw();
  const id = window.setInterval(draw, 1000);

  const h = width * 0.42, d = width * 0.3;
  const group = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(width, h, d), new THREE.MeshStandardMaterial({ color: 0x0d0b0b, roughness: 0.45, metalness: 0.1 }));
  body.position.y = h / 2;
  const face = new THREE.Mesh(new THREE.PlaneGeometry(width * 0.88, width * 0.88 * (H / W)), new THREE.MeshBasicMaterial({ map: tex, toneMapped: false }));
  face.position.set(0, h / 2, d / 2 + 0.001);
  group.add(body, face);
  return {
    group,
    dispose() {
      clearInterval(id);
      tex.dispose();
    },
  };
}
