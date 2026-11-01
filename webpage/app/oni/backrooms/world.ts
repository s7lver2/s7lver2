import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { CELL, type Cell, type Maze, type PropKind } from './maze';
import type { Assets } from './game';
import { bakeLight, lightmapped, LM } from './lightmap';

/*
 * El laberinto en 3D. Paredes, suelo, techo y fluorescentes van instanciados (cuatro dibujos para
 * todo); las piezas de backrooms_vr2, también, una malla instanciada por cada malla de la pieza.
 * Las luces son siempre las mismas (las pone game.ts): aquí solo se dice dónde están las lámparas.
 */

export const HEIGHT = 2.7;
const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]] as const;
export const center = (c: Cell, y = 0) => new THREE.Vector3(c.x * CELL + CELL / 2, y, c.y * CELL + CELL / 2);

/**
 * Un glb como mallas instanciadas en `mats`: una por material, con todas sus mallas fundidas (la
 * puerta de backrooms_vr2 son 240 trozos; sin fundir, 240 dibujos por puerta).
 */
function instanced(src: THREE.Object3D, mats: THREE.Matrix4[], fix?: (m: THREE.Material) => void) {
  const byMat = new Map<THREE.Material, THREE.BufferGeometry[]>();
  src.updateMatrixWorld(true);
  src.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    const mat = mesh.material as THREE.Material, g = mesh.geometry.clone();
    for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(k)) g.deleteAttribute(k);
    // vienen cuantizadas (Int16 normalizado, entre -1 y 1): a Float32 antes de moverlas, o lo que pase de 1 se recorta
    for (const [k, a] of Object.entries(g.attributes) as [string, THREE.BufferAttribute][]) {
      if (a.array instanceof Float32Array && !a.normalized && !(a as unknown as THREE.InterleavedBufferAttribute).isInterleavedBufferAttribute) continue;
      const f = new Float32Array(a.count * a.itemSize), get = [a.getX, a.getY, a.getZ, a.getW];
      for (let i = 0; i < a.count; i++) for (let c = 0; c < a.itemSize; c++) f[i * a.itemSize + c] = get[c].call(a, i);
      g.setAttribute(k, new THREE.BufferAttribute(f, a.itemSize));
    }
    g.applyMatrix4(mesh.matrixWorld);
    byMat.set(mat, [...(byMat.get(mat) ?? []), g.index ? g.toNonIndexed() : g]);
  });
  return [...byMat].map(([mat, gs]) => {
    fix?.(mat);
    const im = new THREE.InstancedMesh(mergeGeometries(gs) ?? gs[0], mat, mats.length);
    mats.forEach((m, i) => im.setMatrixAt(i, m));
    im.computeBoundingSphere();
    return im;
  });
}

const UP = new THREE.Vector3(0, 1, 0);

// la suciedad, pintada a mano en un lienzo: manchas de humedad (un cerco más oscuro alrededor de una
// mancha irregular) y regueros de agua que bajan desde el techo
function stainTex(r: number, g: number, b: number) {
  const cv = Object.assign(document.createElement('canvas'), { width: 128, height: 128 }), x = cv.getContext('2d')!;
  for (let i = 0; i < 9; i++) {
    const cx = 64 + (Math.random() - 0.5) * 50, cy = 64 + (Math.random() - 0.5) * 50, rad = 14 + Math.random() * 26;
    const gr = x.createRadialGradient(cx, cy, rad * 0.2, cx, cy, rad);
    gr.addColorStop(0, `rgba(${r},${g},${b},0.16)`);
    gr.addColorStop(0.82, `rgba(${r},${g},${b},0.28)`); // el cerco
    gr.addColorStop(1, `rgba(${r},${g},${b},0)`);
    x.fillStyle = gr;
    x.fillRect(0, 0, 128, 128);
  }
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
function streakTex() {
  const cv = Object.assign(document.createElement('canvas'), { width: 64, height: 256 }), x = cv.getContext('2d')!;
  const top = x.createLinearGradient(0, 0, 0, 70);
  top.addColorStop(0, 'rgba(70,52,20,0.45)');
  top.addColorStop(1, 'rgba(70,52,20,0)');
  x.fillStyle = top;
  x.fillRect(0, 0, 64, 70);
  for (let i = 0; i < 7; i++) {
    const px = 6 + Math.random() * 52, len = 60 + Math.random() * 190, w = 2 + Math.random() * 5;
    const gr = x.createLinearGradient(0, 0, 0, len);
    gr.addColorStop(0, 'rgba(70,52,20,0.4)');
    gr.addColorStop(1, 'rgba(70,52,20,0)');
    x.fillStyle = gr;
    x.fillRect(px, 0, w, len);
  }
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
const decal = (map: THREE.Texture) => lit(new THREE.MeshStandardMaterial({ map, transparent: true, depthWrite: false, roughness: 1, polygonOffset: true, polygonOffsetFactor: -2 }));

// los materiales, uno por juego de assets y compartidos por todos los laberintos: si cada partida
// trajera los suyos, al desechar el anterior se borrarían sus programas y habría que recompilar
const mats = new WeakMap<Assets, ReturnType<typeof makeMaterials>>();
const makeMaterials = (a: Assets) => ({
  wallMat: lit(new THREE.MeshStandardMaterial({ map: a.tex.wall, roughness: 0.92 })),
  floorMat: lit(new THREE.MeshStandardMaterial({ map: a.tex.carpet, roughness: 1, color: 0xb8a888 })),
  ceilMat: lit(new THREE.MeshStandardMaterial({ map: a.tex.ceiling, roughness: 0.95 })),
  pitMat: new THREE.MeshBasicMaterial({ color: 0x000000, side: THREE.BackSide }),
  panelMat: new THREE.MeshBasicMaterial({ color: 0xffffff, fog: false }),
  metalMat: new THREE.MeshStandardMaterial({ color: 0x9c9a90, metalness: 0.55, roughness: 0.38, side: THREE.DoubleSide, emissive: 0x2a2820 }),
  floorStain: decal(stainTex(48, 36, 14)),
  ceilStain: decal(stainTex(120, 92, 30)),
  streak: decal(streakTex()),
  holeMat: new THREE.MeshBasicMaterial({ color: 0x0b0905 }),
});
const lit = <M extends THREE.Material>(m: M) => (lightmapped(m), m);
const materials = (a: Assets) => mats.get(a) ?? (mats.set(a, makeMaterials(a)), mats.get(a)!);
const yaw = (dx: number, dz: number) => Math.atan2(-dz, dx); // gira +x local hacia (dx, dz)
const place = (p: THREE.Vector3, ry: number, s = 1) => new THREE.Matrix4().compose(p, new THREE.Quaternion().setFromAxisAngle(UP, ry), new THREE.Vector3(s, s, s));

export class World {
  readonly root = new THREE.Group();
  readonly elevator: THREE.Object3D;
  readonly elevatorMixer: THREE.AnimationMixer;
  readonly elevatorClip?: THREE.AnimationClip;
  /** El lado abierto del ascensor (hacia donde mira). */
  readonly elevatorFront: THREE.Vector3;
  /** Con las puertas cerradas, la cabina es pared. */
  elevatorOpen = false;
  private lampPos: THREE.Vector3[];
  private lamps: THREE.InstancedMesh;
  private flicker: { i: number; phase: number; lamp: number }[] = [];
  private panelOn: boolean[] = [];
  private lampLevel: Float32Array;
  /** La corriente: 1 normal, 0 en un apagón (la lleva game.ts). */
  power = 1;
  private shownPower = -1;

  constructor(readonly maze: Maze, assets: Assets) {
    const { w, h, open } = maze;
    const isOpen = (x: number, y: number) => x >= 0 && y >= 0 && x < w && y < h && !!open[y * w + x];
    const voids = new Set(maze.voids.map((v) => v.y * w + v.x));
    const { wallMat, floorMat, ceilMat, pitMat, panelMat, metalMat, floorStain, ceilStain, streak, holeMat } = materials(assets);
    bakeLight(maze);

    // paredes: solo los bloques que tocan algún suelo (los de dentro no se ven)
    const walls: THREE.Matrix4[] = [], floors: THREE.Matrix4[] = [], ceils: THREE.Matrix4[] = [], pits: THREE.Matrix4[] = [];
    const m = new THREE.Matrix4();
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        const c = center({ x, y });
        if (!open[y * w + x]) {
          if (DIRS.some(([dx, dy]) => isOpen(x + dx, y + dy))) walls.push(m.clone().makeTranslation(c.x, HEIGHT / 2, c.z));
          continue;
        }
        ceils.push(m.clone().makeTranslation(c.x, HEIGHT, c.z));
        if (voids.has(y * w + x)) pits.push(m.clone().makeTranslation(c.x, -4, c.z));
        else floors.push(m.clone().makeTranslation(c.x, 0, c.z));
      }
    const box = new THREE.BoxGeometry(CELL, HEIGHT, CELL);
    const floorG = new THREE.PlaneGeometry(CELL, CELL).rotateX(-Math.PI / 2);
    const ceilG = new THREE.PlaneGeometry(CELL, CELL).rotateX(Math.PI / 2);
    // el hueco: un pozo negro de 8 m, sin fondo a la vista
    const pitG = new THREE.BoxGeometry(CELL, 8, CELL);
    pitG.deleteAttribute('uv');
    const inst = (g: THREE.BufferGeometry, mat: THREE.Material, ms: THREE.Matrix4[]) => {
      const im = new THREE.InstancedMesh(g, mat, Math.max(1, ms.length));
      im.count = ms.length;
      ms.forEach((x, i) => im.setMatrixAt(i, x));
      im.computeBoundingSphere();
      this.root.add(im);
      return im;
    };
    // la linterna proyecta sombra (en escritorio): las paredes la tapan, todo la recibe
    Object.assign(inst(box, wallMat, walls), { castShadow: true, receiveShadow: true });
    inst(floorG, floorMat, floors).receiveShadow = true;
    inst(ceilG, ceilMat, ceils).receiveShadow = true;
    inst(pitG, pitMat, pits);

    // el desgaste: manchas de humedad en la moqueta y el techo, placas de techo que faltan (un hueco
    // negro) y regueros de agua por las paredes; repartidos con un hash de la celda, siempre igual
    const hash = (x: number, y: number, k: number) => ((((x * 73856093) ^ (y * 19349663) ^ (k * 83492791)) >>> 0) % 1000) / 1000;
    const fs: THREE.Matrix4[] = [], cs: THREE.Matrix4[] = [], holes: THREE.Matrix4[] = [], streaks: THREE.Matrix4[] = [];
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        if (!open[y * w + x] || voids.has(y * w + x)) continue;
        const c = center({ x, y }), s = 0.8 + hash(x, y, 1) * 1.4, r = hash(x, y, 2) * Math.PI * 2;
        const at = (yy: number, ry = r, sc = s) => new THREE.Matrix4().compose(new THREE.Vector3(c.x + (hash(x, y, 3) - 0.5) * 0.8, yy, c.z + (hash(x, y, 4) - 0.5) * 0.8), new THREE.Quaternion().setFromAxisAngle(UP, ry), new THREE.Vector3(sc, 1, sc));
        if (hash(x, y, 5) < 0.14) fs.push(at(0.004));
        if (hash(x, y, 6) < 0.1) cs.push(at(HEIGHT - 0.004));
        if ((x % 2 || y % 2) && hash(x, y, 7) < 0.035) holes.push(at(HEIGHT - 0.003, 0, 0.4));
        DIRS.forEach(([dx, dy], k) => {
          if (isOpen(x + dx, y + dy) || hash(x, y, 10 + k) > 0.09) return;
          // contra esa pared, mirando hacia dentro de la celda, colgando del techo
          const p = new THREE.Vector3(c.x + dx * (CELL / 2 - 0.004), HEIGHT - 0.9, c.z + dy * (CELL / 2 - 0.004));
          streaks.push(new THREE.Matrix4().compose(p, new THREE.Quaternion().setFromAxisAngle(UP, Math.atan2(-dx, -dy)), new THREE.Vector3(0.6 + hash(x, y, 20 + k) * 0.6, 1, 1)));
        });
      }
    inst(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), floorStain, fs);
    inst(new THREE.PlaneGeometry(1, 1).rotateX(Math.PI / 2), ceilStain, cs);
    inst(new THREE.PlaneGeometry(1.5, 1.5).rotateX(Math.PI / 2), holeMat, holes);
    inst(new THREE.PlaneGeometry(0.7, 1.8), streak, streaks);

    // los fluorescentes: un panel cada dos celdas (3 m); los de `maze.lamps` encendidos, el resto
    // apagados, y uno de cada nueve encendidos parpadea
    const lit = new Set(maze.lamps.map((c) => c.y * w + c.x));
    const panels: { c: Cell; on: boolean }[] = [];
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (open[y * w + x] && x % 2 === 0 && y % 2 === 0) panels.push({ c: { x, y }, on: lit.has(y * w + x) });
    const panelG = new THREE.BoxGeometry(1.2, 0.05, 0.6);
    this.lamps = inst(panelG, panelMat, panels.map((p) => m.clone().makeTranslation(center(p.c).x, HEIGHT - 0.03, center(p.c).z)));
    // y alguno de los apagados se ha soltado de un lado y cuelga torcido
    panels.forEach((p, i) => {
      if (p.on || (p.c.x * 7 + p.c.y * 13) % 11 !== 3) return;
      const c = center(p.c), tilt = new THREE.Matrix4().makeRotationZ(0.5 * ((p.c.x & 2) - 1));
      this.lamps.setMatrixAt(i, new THREE.Matrix4().makeTranslation(c.x + 0.25, HEIGHT - 0.32, c.z).multiply(tilt));
    });
    this.panelOn = panels.map((p) => p.on);
    this.lampPos = [];
    panels.forEach((p, i) => {
      if (!p.on) return;
      if (i % 9 === 4) this.flicker.push({ i, phase: i * 1.7, lamp: this.lampPos.length });
      this.lampPos.push(center(p.c, HEIGHT - 0.25));
    });
    this.lampLevel = new Float32Array(this.lampPos.length).fill(1);
    this.paint();

    // las piezas
    const byKind = new Map<PropKind, THREE.Matrix4[]>();
    for (const p of maze.props) {
      const c = center(p.cell), [dx, dy] = DIRS[p.rot] ?? DIRS[0];
      let mat: THREE.Matrix4;
      if (p.kind === 'vent') mat = place(new THREE.Vector3(c.x, HEIGHT - 0.07, c.z), Math.PI, 1);
      else if (p.kind === 'armchair') mat = place(c, (p.rot * Math.PI) / 2 + 0.3);
      else if (p.kind === 'exit') continue; // va con el ascensor
      else mat = place(new THREE.Vector3(c.x + dx * (CELL / 2 - 0.02), p.kind === 'socket' ? 0.3 : 0, c.z + dy * (CELL / 2 - 0.02)), yaw(dx, dy));
      byKind.set(p.kind, [...(byKind.get(p.kind) ?? []), mat]);
    }
    const fix = (k: PropKind) => (mat: THREE.Material) => {
      if (k === 'socket' || k === 'door') mat.side = THREE.DoubleSide;
      lightmapped(mat);
    };
    for (const [k, ms] of byKind) for (const im of instanced(assets.gltf[k].scene, ms, fix(k))) (im.receiveShadow = true), this.root.add(im);

    // el ascensor: su celda (un callejón) es la cabina, de metal; las puertas, en la boca de la celda
    // mirando afuera, con pared a los lados y encima. El modelo trae dos puertas juntas: se queda con una
    const e = maze.props.find((p) => p.kind === 'exit')!;
    const [ox, oy] = DIRS[e.rot] ?? DIRS[0];
    this.elevatorFront = new THREE.Vector3(ox, 0, oy);
    const el = assets.gltf.elevator.scene.clone(true);
    el.getObjectByName('Null_1')?.removeFromParent();
    let bb = new THREE.Box3().setFromObject(el);
    const k = Math.min(1, (CELL * 0.9) / (bb.max.x - bb.min.x), (HEIGHT - 0.2) / bb.max.y);
    el.scale.multiplyScalar(k);
    bb = new THREE.Box3().setFromObject(el);
    const mid = bb.getCenter(new THREE.Vector3());
    const holder = new THREE.Group();
    el.position.set(-mid.x, 0, -bb.max.z); // la cara de las puertas en la boca, el resto hacia dentro
    holder.add(el);
    const ec = center(maze.elevator);
    holder.position.set(ec.x + ox * (CELL / 2), 0, ec.z + oy * (CELL / 2));
    holder.rotation.y = Math.atan2(ox, oy); // +z local hacia el lado abierto
    this.root.add(holder);
    // el marco: pared a los dos lados de las puertas y encima, hasta llenar la boca
    const dw = bb.max.x - bb.min.x, dh = bb.max.y, side = (CELL - dw) / 2;
    const slab = (wd: number, ht: number, x: number, y: number) => {
      if (wd <= 0.01 || ht <= 0.01) return;
      const s = new THREE.Mesh(new THREE.BoxGeometry(wd, ht, 0.12), wallMat);
      s.position.set(x, y, -0.06);
      holder.add(s);
    };
    slab(side, HEIGHT, -(dw + side) / 2, HEIGHT / 2);
    slab(side, HEIGHT, (dw + side) / 2, HEIGHT / 2);
    slab(dw, HEIGHT - dh, 0, (HEIGHT + dh) / 2);
    // la cabina: cinco caras de metal por dentro de la celda (sin la de las puertas)
    const cab = new THREE.Group(), c2 = CELL / 2 - 0.02;
    const face = (wd: number, ht: number, pos: THREE.Vector3, rx: number, ry: number) => {
      const f = new THREE.Mesh(new THREE.PlaneGeometry(wd, ht), metalMat);
      f.position.copy(pos);
      f.rotation.set(rx, ry, 0);
      cab.add(f);
    };
    face(CELL, HEIGHT, new THREE.Vector3(0, HEIGHT / 2, -CELL + 0.02), 0, 0);
    face(CELL, HEIGHT, new THREE.Vector3(-c2, HEIGHT / 2, -CELL / 2), 0, Math.PI / 2);
    face(CELL, HEIGHT, new THREE.Vector3(c2, HEIGHT / 2, -CELL / 2), 0, -Math.PI / 2);
    face(CELL, CELL, new THREE.Vector3(0, 0.01, -CELL / 2), -Math.PI / 2, 0);
    face(CELL, CELL, new THREE.Vector3(0, HEIGHT - 0.01, -CELL / 2), Math.PI / 2, 0);
    holder.add(cab);
    this.elevator = holder;
    this.elevatorMixer = new THREE.AnimationMixer(el);
    this.elevatorClip = assets.gltf.elevator.animations[0];
    const sign = assets.gltf.exit.scene.clone(true);
    sign.scale.setScalar(2.2);
    sign.position.set(0, Math.min(HEIGHT - 0.4, bb.max.y + 0.08), 0.02);
    holder.add(sign);
  }

  /** Celda de un punto del mundo. */
  cellAt(x: number, z: number): Cell {
    return { x: Math.floor(x / CELL), y: Math.floor(z / CELL) };
  }
  /** Pared (o fuera del mapa) en ese punto. */
  solid(x: number, z: number) {
    const c = this.cellAt(x, z), { w, h, open } = this.maze;
    if (c.x < 0 || c.y < 0 || c.x >= w || c.y >= h || !open[c.y * w + c.x]) return true;
    return !this.elevatorOpen && c.x === this.maze.elevator.x && c.y === this.maze.elevator.y;
  }
  /** Hueco al vacío en ese punto. */
  voidAt(x: number, z: number) {
    const c = this.cellAt(x, z);
    return this.maze.voids.some((v) => v.x === c.x && v.y === c.y);
  }
  /** Las cuatro lámparas encendidas más cercanas (para las cuatro luces que se mueven con el jugador), con lo que dan ahora (0–1). */
  lightsNear(p: THREE.Vector3, n = 4) {
    return this.lampPos
      .map((pos, i) => ({ pos, level: this.lampLevel[i] * this.power, d: pos.distanceToSquared(p) }))
      .sort((a, b) => a.d - b.d)
      .slice(0, n);
  }

  // los colores de los paneles: encendidos según la corriente, apagados grises
  private paint() {
    // los apagados no dan luz pero tampoco brillan a oscuras: en un apagón se oscurecen con todo
    const on = new THREE.Color(1, 0.96, 0.82), off = new THREE.Color(0.32, 0.3, 0.24).multiplyScalar(0.2 + 0.8 * this.power), c = new THREE.Color();
    this.panelOn.forEach((o, i) => this.lamps.setColorAt(i, o ? c.lerpColors(off, on, this.power) : off));
    this.lamps.instanceColor!.needsUpdate = true;
    this.shownPower = this.power;
  }

  update(t: number, dt: number) {
    this.elevatorMixer.update(dt);
    LM.uLmGain.value = 0.06 + 0.94 * this.power;
    if (this.power !== this.shownPower) this.paint();
    // parpadeo de tubo viejo: casi siempre bien, y a ratos una racha de apagarse y encenderse a saltos
    const on = new THREE.Color(1, 0.96, 0.82), off = new THREE.Color(0.32, 0.3, 0.24).multiplyScalar(0.2 + 0.8 * this.power), c = new THREE.Color();
    for (const f of this.flicker) {
      const burst = Math.sin(t * 0.37 + f.phase * 5) + Math.sin(t * 0.91 + f.phase) > 1.2;
      const k = Math.floor(t * 18 + f.phase * 10), r = Math.abs(Math.sin(k * 12.9898 + f.phase) * 43758.5453) % 1;
      const lvl = burst && r < 0.55 ? 0.08 : 1;
      this.lampLevel[f.lamp] = lvl;
      this.lamps.setColorAt(f.i, c.lerpColors(off, on, lvl * this.power));
    }
    if (this.flicker.length) this.lamps.instanceColor!.needsUpdate = true;
  }

  dispose() {
    // las geometrías son de este laberinto; los materiales, compartidos (ver `materials`), se quedan
    this.root.traverse((o) => {
      const im = o as THREE.InstancedMesh;
      if (im.isInstancedMesh) im.geometry.dispose(), im.dispose();
      else if ((o as THREE.Mesh).isMesh && !(o as THREE.SkinnedMesh).isSkinnedMesh && (o as THREE.Mesh).geometry.type !== 'BufferGeometry') (o as THREE.Mesh).geometry.dispose();
    });
    this.root.removeFromParent();
  }
}

