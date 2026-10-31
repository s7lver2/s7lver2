import * as THREE from 'three';
import type { Paper } from './papers';

/*
 * Las hojas sueltas de los papers. La cara es una portada maquetada con los datos, como la
 * primera página de un paper: papel algo amarillento con grano, título en serif, autores, dónde y
 * cuándo, y el resumen a dos columnas hasta donde quepa. La hoja de relleno es un expediente
 * tachado con un sello rojo. Por detrás, papel liso.
 */

// se maqueta a 1024×1448 y se pinta a la mitad: con 30 hojas, la resolución entera eran ~240 MB de vídeo
const W = 1024, H = 1448, M = 96, RES = 0.5;
const SERIF = '"Times New Roman", Times, Georgia, serif';
export const SHEET_W = 0.21, SHEET_H = 0.297;

// parte un texto en líneas que caben en `width`
function lines(x: CanvasRenderingContext2D, text: string, width: number) {
  const out: string[] = [];
  let line = '';
  for (const w of text.split(/\s+/)) {
    const t = line ? line + ' ' + w : w;
    if (x.measureText(t).width > width && line) {
      out.push(line);
      line = w;
    } else line = t;
  }
  if (line) out.push(line);
  return out;
}

// una barra de tachado centrada en la altura real de las letras de la línea
function redact(x: CanvasRenderingContext2D, x0: number, baseline: number, w: number, size: number) {
  const m = x.measureText('x'), top = baseline - m.actualBoundingBoxAscent, mid = (top + baseline) / 2;
  const h = size * 0.92;
  x.fillStyle = '#0d0b0a';
  x.fillRect(x0 - 4, mid - h / 2, w + 8, h);
}

// el grano del papel: un trozo de ruido hecho una vez y repetido en todas las hojas
let grainTile: CanvasPattern | undefined;
function grain(x: CanvasRenderingContext2D) {
  if (!grainTile) {
    const t = Object.assign(document.createElement('canvas'), { width: 128, height: 128 }), tx = t.getContext('2d')!;
    tx.fillStyle = '#e9e1cf';
    tx.fillRect(0, 0, 128, 128);
    const img = tx.getImageData(0, 0, 128, 128), d = img.data;
    for (let i = 0; i < d.length; i += 4) {
      const n = (Math.random() - 0.5) * 14;
      d[i] += n;
      d[i + 1] += n;
      d[i + 2] += n * 0.8;
    }
    tx.putImageData(img, 0, 0);
    grainTile = x.createPattern(t, 'repeat')!;
  }
  return grainTile;
}

// la signatura del archivo: la revista o el congreso y el año, como en el rótulo de la biblioteca
export const shelfmark = (p: Paper) => `ARC-${(p.venue ?? 'UNPUB').replace(/[^A-Za-z0-9]/g, '').toUpperCase().slice(0, 8)}-${p.year}`;

/*
 * La portada es una ficha del archivo: la pestaña roja con su número y su signatura arriba, el
 * título grande a la izquierda, dónde y quién, el resumen que se apaga hacia abajo, y al pie el
 * código de barras del préstamo y un sello de «abrir» (el de «clasificado» si no hay PDF).
 */
export function paintSheet(paper: Paper, n = 1, of = 1) {
  const c = Object.assign(document.createElement('canvas'), { width: W * RES, height: H * RES }), x = c.getContext('2d')!;
  x.scale(RES, RES);
  // el papel: amarillento, con grano y algo más oscuro en los bordes
  x.fillStyle = grain(x);
  x.fillRect(0, 0, W, H);
  const g = x.createRadialGradient(W / 2, H / 2, H * 0.3, W / 2, H / 2, H * 0.75);
  g.addColorStop(0, 'rgba(120,90,50,0)');
  g.addColorStop(1, 'rgba(120,90,50,0.24)');
  x.fillStyle = g;
  x.fillRect(0, 0, W, H);
  const INK = '#1b1714', RED = '#a3170f';
  const pad = (k: number) => String(k).padStart(2, '0');

  // la pestaña: un bloque de tinta roja que asoma por arriba, con el número y la signatura
  x.fillStyle = RED;
  x.fillRect(W - M - 300, 0, 300, 132);
  x.fillStyle = '#f3e6dc';
  x.textBaseline = 'alphabetic';
  x.textAlign = 'left';
  x.font = `700 64px ${SERIF}`;
  x.fillText(`№ ${pad(n)}`, W - M - 276, 78);
  x.font = `600 21px ${SERIF}`;
  x.fillText(`${shelfmark(paper)} · ${pad(n)}/${pad(of)}`, W - M - 274, 114);

  // la cabecera: dónde y cuándo
  x.fillStyle = INK;
  x.font = `italic 28px ${SERIF}`;
  x.fillText([paper.venue, paper.year].filter(Boolean).join(' · '), M, M + 14);

  // el título, grande y a la izquierda (como mucho cuatro líneas)
  x.font = `700 76px ${SERIF}`;
  const tl = lines(x, paper.title, W - M * 2).slice(0, 4);
  let y = M + 210;
  for (const l of tl) {
    x.fillStyle = INK;
    x.fillText(l, M, y);
    if (paper.placeholder) redact(x, M, y, x.measureText(l).width, 76);
    y += 86;
  }
  x.fillStyle = INK;
  x.font = `32px ${SERIF}`;
  y += 18;
  for (const l of lines(x, paper.authors.join(', '), W - M * 2).slice(0, 2)) {
    x.fillText(l, M, y);
    y += 42;
  }
  // una regla corta de tinta roja antes del resumen
  y += 34;
  x.fillStyle = RED;
  x.fillRect(M, y - 26, 120, 7);
  y += 40;

  // el resumen, a una columna, que se apaga antes del pie
  x.font = `27px ${SERIF}`;
  const lh = 38, foot = H - M - 150, body = lines(x, paper.abstract.repeat(paper.placeholder ? 3 : 1), W - M * 2);
  const rows = Math.max(0, Math.floor((foot - y) / lh));
  body.slice(0, rows).forEach((l, i) => {
    const ly = y + i * lh;
    x.globalAlpha = Math.min(1, (rows - i) / 4);
    x.fillStyle = INK;
    x.fillText(l, M, ly);
    if (paper.placeholder && i % 5 !== 3) redact(x, M, ly, x.measureText(l).width, 27);
  });
  x.globalAlpha = 1;

  // el pie: el código de barras del préstamo y el sello
  const by = H - M - 96;
  let bx = M;
  const seed = [...paper.title].reduce((a, ch) => (a * 31 + ch.charCodeAt(0)) >>> 0, 7);
  for (let k = 0; bx < M + 300; k++) {
    const w = 3 + ((seed >> k % 24) & 3) * 3;
    if (k % 2 === 0) {
      x.fillStyle = INK;
      x.fillRect(bx, by, w, 70);
    }
    bx += w;
  }
  x.font = `20px ${SERIF}`;
  x.fillText(shelfmark(paper), M, by + 96);

  // el sello, torcido y con la tinta gastada: «abrir» con su flecha o «clasificado»
  const big = !!paper.placeholder;
  x.save();
  x.translate(big ? W / 2 : W - M - 170, big ? H * 0.5 : by + 30);
  x.rotate(big ? -0.21 : -0.08);
  x.strokeStyle = 'rgba(163,23,15,0.86)';
  x.fillStyle = 'rgba(163,23,15,0.86)';
  x.lineWidth = big ? 9 : 6;
  const [sw, sh] = big ? [600, 140] : [300, 92];
  x.strokeRect(-sw / 2, -sh / 2, sw, sh);
  x.font = `700 ${big ? 92 : 46}px ${SERIF}`;
  x.textAlign = 'center';
  x.textBaseline = 'middle';
  x.fillText(big ? 'CLASSIFIED' : 'OPEN  ↗', 0, 4);
  x.globalCompositeOperation = 'destination-out';
  for (let k = 0; k < (big ? 900 : 380); k++) x.fillRect(-sw / 2 - 10 + Math.random() * (sw + 20), -sh / 2 - 10 + Math.random() * (sh + 20), 2 + Math.random() * 3, 2 + Math.random() * 3);
  x.restore();
  return c;
}

// el dorso: papel con grano, no un blanco liso
const backMat = (() => {
  const c = Object.assign(document.createElement('canvas'), { width: 256, height: 362 }), x = c.getContext('2d')!;
  x.fillStyle = grain(x);
  x.fillRect(0, 0, c.width, c.height);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return new THREE.MeshStandardMaterial({ map: t, color: 0xd6d6d6, roughness: 0.9 });
})();

// una hoja algo curvada: un plano con unas filas desplazadas, no un rectángulo rígido
function sheetGeometry() {
  const g = new THREE.PlaneGeometry(SHEET_W, SHEET_H, 1, 6), p = g.attributes.position as THREE.BufferAttribute;
  const bend = (Math.random() - 0.3) * 0.035, twist = (Math.random() - 0.5) * 0.02;
  for (let i = 0; i < p.count; i++) {
    const v = p.getY(i) / SHEET_H + 0.5;
    p.setZ(i, Math.sin(v * Math.PI) * bend + p.getX(i) * twist * (v - 0.5) * 6);
  }
  g.computeVertexNormals();
  return g;
}

function makeSheet(paper: Paper, n: number, of: number) {
  const t = new THREE.CanvasTexture(paintSheet(paper, n, of));
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  const g = sheetGeometry();
  // un poco de luz propia: el papel claro coge la poca que hay y tiene que leerse
  // el papel, algo por debajo del blanco: cerca de una luz se quemaba con el bloom
  const front = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ map: t, color: 0xdadada, roughness: 0.85, emissive: 0xffffff, emissiveMap: t, emissiveIntensity: 0.08, side: THREE.FrontSide }));
  const back = new THREE.Mesh(g, backMat);
  back.rotation.y = Math.PI;
  back.scale.x = -1;
  front.add(back);
  front.castShadow = true;
  return front;
}

/** Pinta una hoja por paper (lo caro, una vez). */
export function makeSheets(papers: Paper[]) {
  return papers.map((paper, i) => ({ mesh: makeSheet(paper, i + 1, papers.length), paper }));
}

/**
 * Coloca hojas ya pintadas por `area`, en el aire (desde 0,2 m) y giradas: las cercanas a `eye`
 * le dan la cara. Sin solaparse en su pantalla (ni con `avoid`), y sin hojas que queden
 * diminutas (menos del 1,2 % de la pantalla) o tapadas del todo. Se puede volver a llamar
 * (al cambiar el tamaño de la ventana) con las mismas hojas.
 */
export function placeSheets(sheets: { mesh: THREE.Mesh; paper: Paper }[], area: THREE.Box3, eye: THREE.Camera, avoid: THREE.Box2[] = []) {
  const placed: THREE.Box2[] = [...avoid];
  const v = new THREE.Vector3(), eyePos = eye.getWorldPosition(new THREE.Vector3());
  const corners = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([a, b]) => new THREE.Vector3((a * SHEET_W) / 2, (b * SHEET_H) / 2, 0));
  for (const { mesh } of sheets) {
    let best: { score: number; pos: THREE.Vector3; q: THREE.Quaternion; rect: THREE.Box2 } | undefined;
    for (let tries = 0; tries < 160; tries++) {
      const pos = new THREE.Vector3(
        THREE.MathUtils.lerp(area.min.x, area.max.x, Math.random()),
        THREE.MathUtils.lerp(Math.max(0.2, area.min.y), area.max.y, Math.random()),
        THREE.MathUtils.lerp(area.min.z, area.max.z, Math.random()),
      );
      // de cara a la cámara, girada como mucho ±35° en cada eje
      mesh.position.copy(pos);
      mesh.lookAt(eyePos);
      const k = THREE.MathUtils.degToRad(35);
      mesh.rotateX((Math.random() - 0.5) * 2 * k * 0.6);
      mesh.rotateY((Math.random() - 0.5) * 2 * k);
      mesh.rotateZ((Math.random() - 0.5) * 2 * k);
      const q = mesh.quaternion.clone(), rect = new THREE.Box2();
      for (const c of corners) {
        v.copy(c).applyQuaternion(q).add(pos).project(eye);
        rect.expandByPoint(new THREE.Vector2(v.x, v.y));
      }
      const size = (rect.max.x - rect.min.x) * (rect.max.y - rect.min.y);
      // en pantalla y de un tamaño que se pueda pulsar
      let score = (rect.min.x > -0.98 && rect.max.x < 0.98 && rect.min.y > -0.95 && rect.max.y < 0.95 ? 0 : 10) + (size / 4 < 0.012 ? 10 : 0);
      for (const [j, o] of placed.entries()) {
        const w = j < avoid.length ? 40 : 1; // taparle a él no vale: pisar otra hoja, algo
        const ix = Math.max(0, Math.min(o.max.x, rect.max.x) - Math.max(o.min.x, rect.min.x));
        const iy = Math.max(0, Math.min(o.max.y, rect.max.y) - Math.max(o.min.y, rect.min.y));
        const over = (ix * iy) / Math.max(1e-4, size);
        score += w * over + (over > 0.97 ? 10 : 0); // tapada del todo, descartada
      }
      if (!best || score < best.score) best = { score, pos, q, rect };
      if (score === 0) break;
    }
    mesh.position.copy(best!.pos);
    mesh.quaternion.copy(best!.q);
    placed.push(best!.rect);
  }
}
