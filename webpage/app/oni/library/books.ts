import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { canvas, normalFrom, tex } from '../room/surfaces';

/*
 * Libros sueltos: dos tapas y un lomo de tela (un recorte del atlas de lomos de las estanterías,
 * así que cada libro es de un color) y el bloque de hojas metido unos milímetros dentro, con sus
 * rayas de canto en relieve. Las esquinas de la tela están gastadas y más claras.
 */

const COVER = 0.004, INSET = 0.004;
let pagesMat: THREE.MeshStandardMaterial | undefined;

// el canto de las hojas: rayas finas en la altura, el color un hueso sucio que oscurece en los bordes
function pages() {
  if (pagesMat) return pagesMat;
  const c = canvas(256, 64), h = canvas(256, 64), x = c.getContext('2d')!, y = h.getContext('2d')!;
  x.fillStyle = '#b9ab8e';
  x.fillRect(0, 0, 256, 64);
  y.fillStyle = '#808080';
  y.fillRect(0, 0, 256, 64);
  for (let j = 0; j < 64; j++) {
    const v = Math.random();
    y.fillStyle = `rgba(${v > 0.5 ? 255 : 0},${v > 0.5 ? 255 : 0},${v > 0.5 ? 255 : 0},${0.15 + Math.random() * 0.25})`;
    y.fillRect(0, j, 256, 1);
    x.fillStyle = `rgba(60,45,30,${Math.random() * 0.12})`;
    x.fillRect(0, j, 256, 1);
  }
  const g = x.createLinearGradient(0, 0, 0, 64);
  g.addColorStop(0, 'rgba(40,30,20,0.45)');
  g.addColorStop(0.15, 'rgba(40,30,20,0)');
  g.addColorStop(0.85, 'rgba(40,30,20,0)');
  g.addColorStop(1, 'rgba(40,30,20,0.45)');
  x.fillStyle = g;
  x.fillRect(0, 0, 256, 64);
  pagesMat = new THREE.MeshStandardMaterial({ map: tex(c, [1, 1], true), normalMap: normalFrom(h, 3, [1, 1]), roughness: 0.92 });
  return pagesMat;
}

// lleva la uv de una caja a un recorte del atlas: cada libro, un parche de tela
function crop(g: THREE.BufferGeometry, u0: number, v0: number, s: number) {
  const uv = g.attributes.uv as THREE.BufferAttribute;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, u0 + uv.getX(i) * s, v0 + uv.getY(i) * s);
}

// la tela gastada: más clara y menos brillante en las esquinas, con color por vértice
function wear(g: THREE.BufferGeometry, size: THREE.Vector3) {
  const p = g.attributes.position as THREE.BufferAttribute, col = new Float32Array(p.count * 3);
  for (let i = 0; i < p.count; i++) {
    const e = Math.max(Math.abs(p.getX(i)) / (size.x / 2), Math.abs(p.getY(i)) / (size.y / 2));
    const k = 1 + 0.35 * Math.max(0, e - 0.9) * 10 * Math.random();
    col.set([k, k * 0.96, k * 0.9], i * 3);
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
}

/** Un libro de `size` = [ancho del lomo, alto, fondo] con el atlas de lomos como tela; el lomo mira a +z. */
export function makeBook(spine: THREE.Texture, size: [number, number, number]) {
  const [w, h, d] = size;
  const u0 = Math.random() * 0.94, v0 = Math.random() * 0.94, s = 0.04 + Math.random() * 0.02;
  // tapas a los lados (x), lomo delante (z+); un poco más grandes que el bloque de hojas
  const parts = [
    new THREE.BoxGeometry(COVER, h, d).translate(-w / 2 + COVER / 2, 0, 0),
    new THREE.BoxGeometry(COVER, h, d).translate(w / 2 - COVER / 2, 0, 0),
    new THREE.BoxGeometry(w, h, COVER * 1.5).translate(0, 0, d / 2 - COVER * 0.75),
  ];
  parts.forEach((g) => crop(g, u0, v0, s));
  const cloth = mergeGeometries(parts)!;
  wear(cloth, new THREE.Vector3(w, h, d));
  const block = new THREE.BoxGeometry(w - COVER * 2, h - INSET * 2, d - INSET - COVER).translate(0, 0, -INSET / 2);
  block.deleteAttribute('normal');
  block.computeVertexNormals();
  // el bloque de hojas: la uv del canto a lo largo (las rayas siguen el lomo)
  const geo = mergeGeometries([cloth.toNonIndexed(), withColor(block.toNonIndexed())], true)!;
  const mat = new THREE.MeshStandardMaterial({ map: spine, vertexColors: true, roughness: 0.78 });
  const mesh = new THREE.Mesh(geo, [mat, pages()]);
  mesh.castShadow = mesh.receiveShadow = true;
  return mesh;
}

function withColor(g: THREE.BufferGeometry) {
  g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(g.attributes.position.count * 3).fill(1), 3));
  return g;
}
