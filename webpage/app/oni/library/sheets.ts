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

export function paintSheet(paper: Paper) {
  const c = Object.assign(document.createElement('canvas'), { width: W * RES, height: H * RES }), x = c.getContext('2d')!;
  x.scale(RES, RES);
  // el papel: amarillento, con grano y algo más oscuro en los bordes
  x.fillStyle = grain(x);
  x.fillRect(0, 0, W, H);
  const g = x.createRadialGradient(W / 2, H / 2, H * 0.3, W / 2, H / 2, H * 0.75);
  g.addColorStop(0, 'rgba(120,90,50,0)');
  g.addColorStop(1, 'rgba(120,90,50,0.22)');
  x.fillStyle = g;
  x.fillRect(0, 0, W, H);

  x.fillStyle = '#1b1714';
  x.textBaseline = 'alphabetic';
  // la cabecera: dónde y cuándo
  x.font = `italic 26px ${SERIF}`;
  x.textAlign = 'left';
  x.fillText([paper.venue, paper.year].filter(Boolean).join(' · '), M, M + 10);
  // el título, centrado, en las líneas que hagan falta (como mucho tres)
  x.textAlign = 'center';
  x.font = `600 58px ${SERIF}`;
  const tl = lines(x, paper.title, W - M * 2).slice(0, 3);
  let y = M + 150;
  for (const l of tl) {
    x.fillText(l, W / 2, y);
    if (paper.placeholder) redact(x, W / 2 - x.measureText(l).width / 2, y, x.measureText(l).width, 58);
    y += 70;
  }
  x.fillStyle = '#1b1714';
  x.font = `30px ${SERIF}`;
  y += 20;
  x.fillText(paper.authors.join(', '), W / 2, y);
  y += 80;
  x.font = `600 30px ${SERIF}`;
  x.fillText('Abstract', W / 2, y);
  y += 50;
  // el resumen, a dos columnas, cortado donde se acaba la hoja
  x.textAlign = 'left';
  x.font = `25px ${SERIF}`;
  const colW = (W - M * 2 - 48) / 2, lh = 34, body = lines(x, paper.abstract.repeat(paper.placeholder ? 3 : 1), colW);
  const perCol = Math.floor((H - M - y) / lh);
  body.slice(0, perCol * 2).forEach((l, i) => {
    const cx = i < perCol ? M : M + colW + 48, ly = y + (i % perCol) * lh;
    x.fillStyle = '#1b1714';
    x.fillText(l, cx, ly);
    if (paper.placeholder && (i % 5 !== 3)) redact(x, cx, ly, x.measureText(l).width, 25);
  });
  if (paper.placeholder) {
    // el sello, torcido y con la tinta gastada
    x.save();
    x.translate(W / 2, H * 0.47);
    x.rotate(-0.21);
    x.strokeStyle = 'rgba(176,26,18,0.82)';
    x.fillStyle = 'rgba(176,26,18,0.82)';
    x.lineWidth = 9;
    x.strokeRect(-300, -70, 600, 140);
    x.font = `700 92px ${SERIF}`;
    x.textAlign = 'center';
    x.textBaseline = 'middle';
    x.fillText('CLASSIFIED', 0, 6);
    x.globalCompositeOperation = 'destination-out';
    for (let i = 0; i < 900; i++) x.fillRect(-310 + Math.random() * 620, -80 + Math.random() * 160, 2 + Math.random() * 3, 2 + Math.random() * 3);
    x.restore();
  }
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

function makeSheet(paper: Paper) {
  const t = new THREE.CanvasTexture(paintSheet(paper));
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  const g = sheetGeometry();
  // un poco de luz propia: el papel claro coge la poca que hay y tiene que leerse
  // el papel, algo por debajo del blanco: cerca de una luz se quemaba con el bloom
  const front = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ map: t, color: 0xdadada, roughness: 0.85, emissive: 0xffffff, emissiveMap: t, emissiveIntensity: 0.03, side: THREE.FrontSide }));
  const back = new THREE.Mesh(g, backMat);
  back.rotation.y = Math.PI;
  back.scale.x = -1;
  front.add(back);
  front.castShadow = true;
  return front;
}

/** Pinta una hoja por paper (lo caro, una vez). */
export function makeSheets(papers: Paper[]) {
  return papers.map((paper) => ({ mesh: makeSheet(paper), paper }));
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
