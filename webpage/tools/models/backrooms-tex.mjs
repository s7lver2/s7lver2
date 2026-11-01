// node backrooms-tex.mjs: las texturas repetibles del laberinto, sacadas de backrooms_vr2
// (public/models/backrooms/src/backrooms_vr2/textures) a public/models/backrooms/tex/*.webp.
// Ese escenario viene horneado: cada textura lleva la luz de su habitación. Se recorta un trozo, se le
// quita la luz (se divide por su versión muy desenfocada) y se hace repetible mezclándolo con una copia
// desplazada media textura, cuyos bordes son el centro del recorte y casan al repetirse.
import sharp from 'sharp';
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const DIR = fileURLToPath(new URL('../../public/models/backrooms/', import.meta.url));
const SRC = DIR + 'src/backrooms_vr2/textures/', OUT = DIR + 'tex/';
const S = 512;
mkdirSync(OUT, { recursive: true });

// la tira lisa de pared entre dos juntas (Wall_2, en medio a la izquierda) y un trozo de moqueta sin muebles encima
const CROPS = {
  wall: ['Wall_2', { left: 1045, top: 200, width: 230, height: 900 }],
  carpet: ['Moquette_1', { left: 40, top: 600, width: 480, height: 480 }],
};

async function flat(file, rect) {
  const img = sharp(SRC + file + '_baseColor.png').extract(rect).resize(S, S, { fit: 'fill' }).removeAlpha();
  const a = await img.clone().raw().toBuffer();
  const b = await img.clone().blur(48).raw().toBuffer();
  const mean = [0, 1, 2].map((c) => { let s = 0; for (let i = c; i < a.length; i += 3) s += a[i]; return s / (a.length / 3); });
  const o = Buffer.alloc(a.length);
  for (let i = 0; i < a.length; i++) o[i] = Math.min(255, (a[i] * mean[i % 3]) / Math.max(1, b[i]));
  return o;
}

function seamless(a) {
  const o = Buffer.alloc(a.length), h = S / 2;
  for (let y = 0; y < S; y++)
    for (let x = 0; x < S; x++) {
      // 1 en el centro (el recorte tal cual), 0 en los bordes (la copia desplazada)
      const w = Math.min(1, Math.min(x, S - 1 - x, y, S - 1 - y) / (S * 0.12));
      const i = (y * S + x) * 3, j = (((y + h) % S) * S + ((x + h) % S)) * 3;
      for (let c = 0; c < 3; c++) o[i + c] = a[i + c] * w + a[j + c] * (1 - w);
    }
  return o;
}

const write = (name, buf) => sharp(buf, { raw: { width: S, height: S, channels: 3 } }).webp({ quality: 82 }).toFile(OUT + name + '.webp');

// el papel de pared de las backrooms: rayas verticales tenues, 32 en la textura (cada ~9 cm si cubre 3 m)
const stripes = (a) => {
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) for (let c = 0; c < 3; c++) a[(y * S + x) * 3 + c] *= x % 16 < 8 ? 1.025 : 0.985;
  return a;
};
for (const [name, [file, rect]] of Object.entries(CROPS)) {
  const t = seamless(await flat(file, rect));
  await write(name, name === 'wall' ? stripes(t) : t);
  console.log(name, 'ok');
}

// el techo: sus placas vienen con agujeros y rejillas por medio; el grano de la pared, más claro, y la
// cuadrícula de placas dibujada encima (4 × 4 en la textura: placas de 0,6 m si la textura cubre 2,4 m)
const base = seamless(await flat(...CROPS.wall));
for (let y = 0; y < S; y++)
  for (let x = 0; x < S; x++) {
    const i = (y * S + x) * 3, gx = x % (S / 4), gy = y % (S / 4);
    const line = gx < 3 || gy < 3 ? 0.72 : gx < 5 || gy < 5 ? 1.06 : 1.12; // junta oscura y canto claro
    for (let c = 0; c < 3; c++) base[i + c] = Math.min(255, base[i + c] * line);
  }
await write('ceiling', base);
console.log('ceiling ok');
