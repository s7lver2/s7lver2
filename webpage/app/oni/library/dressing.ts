import * as THREE from 'three';
import { makeBook } from './books';

/*
 * El decorado, para que ninguna balda sea igual a su vecina: todas las estanterías son la misma
 * malla instanciada, así que cada una se tiñe un poco distinta y lleva encima lo suyo, hecho con
 * libros sueltos: pilas tumbadas en el borde, alguno que sobresale, alguno caído en el pasillo,
 * y papeles por el suelo. Además, los libros que la grabación hace caer de una balda del fondo.
 */
export interface Row {
  /** z del frente de la fila (el que da al pasillo). */
  front: number;
  /** Hacia dónde da: +1 si el pasillo queda en z mayor. */
  facing: 1 | -1;
}

export function dress(
  scene: THREE.Scene,
  o: { shelves: THREE.InstancedMesh[]; spine: THREE.Texture; rand: () => number; rows: Row[]; x0: number; bay: number; bays: number; levels: number[]; floorZ: [number, number] },
) {
  const r = o.rand;
  // cada estantería, su tono: la misma para todas las piezas de una instancia
  const tint = new THREE.Color();
  const n = o.shelves[0]?.count ?? 0;
  const tints = Array.from({ length: n }, () => tint.setHSL(0.06 + (r() - 0.5) * 0.04, 0.12 * r(), 0.78 + r() * 0.3).clone());
  for (const s of o.shelves) {
    tints.forEach((c, i) => s.setColorAt(i, c));
    s.instanceColor!.needsUpdate = true;
  }

  const size = (): [number, number, number] => [0.03 + r() * 0.035, 0.22 + r() * 0.1, 0.16 + r() * 0.06];
  const add = (b: THREE.Object3D) => (scene.add(b), b);
  for (const row of o.rows)
    for (let i = 0; i < o.bays; i++) {
      const cx = o.x0 + o.bay * (i + 0.5);
      // una pila tumbada en el borde de una balda
      if (r() < 0.75) {
        const lvl = o.levels[1 + ((r() * (o.levels.length - 2)) | 0)];
        const x = cx + (r() - 0.5) * o.bay * 0.6;
        let y = lvl;
        for (let k = 0, m = 2 + ((r() * 3) | 0); k < m; k++) {
          const [w, h, d] = size(), b = add(makeBook(o.spine, [w, h, d]));
          b.rotation.set(0, (r() - 0.5) * 0.4 + (row.facing > 0 ? 0 : Math.PI), Math.PI / 2);
          b.position.set(x + (r() - 0.5) * 0.03, y + w / 2, row.front + row.facing * (0.02 + r() * 0.03));
          y += w;
        }
      }
      // uno o dos que sobresalen de su hilera
      for (let k = 0, m = (r() * 3) | 0; k < m; k++) {
        const [w, h, d] = size(), b = add(makeBook(o.spine, [w, h, d]));
        b.rotation.set(0, row.facing > 0 ? 0 : Math.PI, (r() - 0.5) * 0.1);
        b.position.set(cx + (r() - 0.5) * o.bay * 0.8, o.levels[(r() * (o.levels.length - 1)) | 0] + h / 2 + 0.002, row.front + row.facing * (0.03 + r() * 0.06) - row.facing * d / 2);
      }
    }

  // por el suelo del pasillo: algún libro caído y papeles sueltos
  const paper = new THREE.MeshStandardMaterial({ color: 0x8f877b, roughness: 0.95, side: THREE.DoubleSide });
  const sheet = new THREE.PlaneGeometry(0.15, 0.21).rotateX(-Math.PI / 2);
  for (let k = 0; k < 4; k++) {
    const [w, h, d] = size(), b = add(makeBook(o.spine, [w, h, d]));
    b.rotation.set(0, r() * Math.PI * 2, Math.PI / 2);
    b.position.set(o.x0 + 0.6 + r() * o.bay * o.bays * 0.85, w / 2, THREE.MathUtils.lerp(o.floorZ[0], o.floorZ[1], r()));
  }
  for (let k = 0; k < 7; k++) {
    const p = add(new THREE.Mesh(sheet, paper));
    p.rotation.y = r() * Math.PI * 2;
    p.position.set(o.x0 + 0.4 + r() * o.bay * o.bays * 0.9, 0.003 + k * 0.0004, THREE.MathUtils.lerp(o.floorZ[0], o.floorZ[1], r()));
    p.receiveShadow = true;
  }

  // los que caerán en la grabación: de pie, asomando del todo en baldas altas del fondo del pasillo
  const fallers = [0.62, 0.8].map((u, k) => {
    const row = o.rows[k % o.rows.length], [w, h, d] = size(), b = add(makeBook(o.spine, [w, h, d]));
    b.rotation.set(0, row.facing > 0 ? 0 : Math.PI, 0.12);
    b.position.set(o.x0 + o.bay * o.bays * u, o.levels[o.levels.length - 2 + k] + h / 2 + 0.002, row.front + row.facing * 0.07 - (row.facing * d) / 2);
    return { book: b, half: w / 2, facing: row.facing };
  });
  return { fallers };
}
