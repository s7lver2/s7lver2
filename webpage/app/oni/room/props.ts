import * as THREE from 'three';
import type { TvSlot } from './wall';

/*
 * Los detalles de la sala, hechos a mano: la estantería donde apoyan las teles, platinas de
 * vídeo con su "12:00" parpadeando, cables que cuelgan, lo que hay encima de la mesa, el
 * fluorescente del techo, cajas por el suelo y el polvo en el aire. Devuelve lo que se anima.
 */

type Tick = (t: number, dt: number) => void;
const rnd = (a: number, b: number) => a + Math.random() * (b - a);

const steel = new THREE.MeshStandardMaterial({ color: 0x1e1c1c, roughness: 0.5, metalness: 0.75 });
const plastic = new THREE.MeshStandardMaterial({ color: 0x141212, roughness: 0.45, metalness: 0.1 });
const rubber = new THREE.MeshStandardMaterial({ color: 0x090808, roughness: 0.7 });
const card = new THREE.MeshStandardMaterial({ color: 0x2a201b, roughness: 0.95 });

function canvasTex(w: number, h: number, draw: (x: CanvasRenderingContext2D) => void) {
  const c = Object.assign(document.createElement('canvas'), { width: w, height: h });
  draw(c.getContext('2d')!);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// letra a mano: garabatos de líneas cortas
function scribble(x: CanvasRenderingContext2D, w: number, h: number, ink: string, lines: number) {
  x.strokeStyle = ink;
  x.lineWidth = Math.max(1, w / 90);
  for (let l = 0; l < lines; l++) {
    const y = h * (0.2 + (l * 0.6) / Math.max(1, lines - 1));
    x.beginPath();
    let px = w * 0.12;
    x.moveTo(px, y);
    while (px < w * rnd(0.55, 0.88)) {
      px += w * rnd(0.02, 0.05);
      x.lineTo(px, y + rnd(-h, h) * 0.035);
    }
    x.stroke();
  }
}

/** La estantería: una balda bajo cada tele y postes cada pocas teles, del suelo al techo. */
export function shelving(scene: THREE.Scene, slots: TvSlot[], ceil: number) {
  const g = new THREE.Group();
  const singles = slots.filter((s) => s.model !== 'tvstack');
  for (const s of singles) {
    const board = new THREE.Mesh(new THREE.BoxGeometry(s.scale + 0.03, 0.025, 0.52), steel);
    board.position.set(s.position[0], s.position[1] - 0.013, s.position[2]);
    board.rotation.y = s.rotY;
    g.add(board);
  }
  // postes: en el borde izquierdo de cada tercera tele de la fila de abajo, y en los extremos
  const base = singles.filter((s) => Math.abs(s.position[1] - Math.min(...singles.map((o) => o.position[1]))) < 0.01).sort((a, b) => a.position[0] - b.position[0]);
  base.forEach((s, i) => {
    if (i % 3 && i !== base.length - 1) return;
    const side = i === base.length - 1 ? 1 : -1;
    const right = new THREE.Vector3(Math.cos(s.rotY), 0, -Math.sin(s.rotY));
    const back = new THREE.Vector3(-Math.sin(s.rotY), 0, -Math.cos(s.rotY));
    for (const d of [-0.24, 0.24]) {
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.035, ceil, 0.035), steel);
      const p = new THREE.Vector3(...s.position).addScaledVector(right, side * (s.scale / 2 + 0.02)).addScaledVector(back, d);
      post.position.set(p.x, ceil / 2, p.z);
      post.rotation.y = s.rotY;
      g.add(post);
    }
  });
  scene.add(g);
}

/** Cables negros que caen desde las teles hasta el suelo, detrás de la mesa. */
export function hangingCables(scene: THREE.Scene, slots: TvSlot[], deskZ: number) {
  const singles = slots.filter((s) => s.model !== 'tvstack' && s.position[1] > 1);
  for (let i = 0; i < Math.min(18, singles.length); i++) {
    const s = singles[(i * 7) % singles.length];
    const back = new THREE.Vector3(-Math.sin(s.rotY), 0, -Math.cos(s.rotY));
    const a = new THREE.Vector3(...s.position).addScaledVector(back, -0.05).add(new THREE.Vector3(rnd(-0.15, 0.15), 0.02, 0));
    const end = new THREE.Vector3(a.x + rnd(-0.6, 0.6), 0.01, deskZ - rnd(0.1, 0.35));
    const mid = a.clone().lerp(end, 0.5).add(new THREE.Vector3(rnd(-0.1, 0.1), -rnd(0.1, 0.3), 0.2));
    const curve = new THREE.CatmullRomCurve3([a, mid, end, end.clone().add(new THREE.Vector3(rnd(-0.4, 0.4), 0, 0.5))]);
    scene.add(Object.assign(new THREE.Mesh(new THREE.TubeGeometry(curve, 24, rnd(0.004, 0.008), 5), rubber), { name: 'cable' }));
  }
}

/** Platina de vídeo: caja, ranura, botones y el reloj en rojo parpadeando 12:00. */
function vcr(): { obj: THREE.Group; tick: Tick } {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.43, 0.09, 0.3), plastic);
  body.position.y = 0.045;
  const slot = new THREE.Mesh(new THREE.BoxGeometry(0.19, 0.012, 0.004), rubber);
  slot.position.set(-0.07, 0.055, 0.151);
  const dispMat = new THREE.MeshBasicMaterial({ toneMapped: false });
  dispMat.map = canvasTex(64, 24, (x) => {
    x.fillStyle = '#100303';
    x.fillRect(0, 0, 64, 24);
    x.fillStyle = '#ff4a36';
    x.font = 'bold 18px ui-monospace, Consolas, monospace';
    x.fillText('12:00', 6, 19);
  });
  const disp = new THREE.Mesh(new THREE.PlaneGeometry(0.07, 0.026), dispMat);
  disp.position.set(0.12, 0.05, 0.151);
  g.add(body, slot, disp);
  const ph = Math.random() * 2;
  return { obj: g, tick: (t) => (dispMat.color.setScalar(Math.floor(t + ph) % 2 ? 1 : 0.08)) };
}

/** Un switch de red con su fila de LEDs que parpadean a su aire. */
function netSwitch(): { obj: THREE.Group; tick: Tick } {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.045, 0.2), steel);
  body.position.y = 0.0225;
  g.add(body);
  const leds: THREE.MeshBasicMaterial[] = [];
  for (let i = 0; i < 12; i++) {
    const m = new THREE.MeshBasicMaterial({ color: i % 4 === 3 ? 0xff4a36 : 0xe8e8e8, toneMapped: false, transparent: true });
    const led = new THREE.Mesh(new THREE.PlaneGeometry(0.008, 0.006), m);
    led.position.set(-0.18 + i * 0.03, 0.03, 0.101);
    g.add(led);
    leds.push(m);
  }
  return { obj: g, tick: () => leds.forEach((m) => Math.random() < 0.08 && (m.opacity = m.opacity > 0.5 ? 0.05 : 1)) };
}

/** Lo que hay encima de la mesa y por los lados. */
export function clutter(scene: THREE.Scene, deskY: number, deskZ: number, deskW: number, x0: number, x1: number, ceil: number): Tick[] {
  const ticks: Tick[] = [];
  // la zona del mando queda despejada: nada de papeles encima
  const free = (a: number, b: number) => {
    let v = rnd(a, b);
    while (v > 0.3 && v < 0.95) v = rnd(a, b);
    return v;
  };
  const add = (o: THREE.Object3D, x: number, y: number, z: number, ry = 0) => {
    o.position.set(x, y, z);
    o.rotation.y = ry;
    scene.add(o);
    return o;
  };

  // platinas apiladas en la mesa y en el suelo, y el switch
  for (const [x, y, z, n] of [[-1.45, deskY, deskZ - 0.02, 3], [1.15, deskY, deskZ - 0.04, 2], [x1 - 0.55, 0, deskZ + 0.2, 4]] as const)
    for (let i = 0; i < n; i++) {
      const v = vcr();
      add(v.obj, x + rnd(-0.015, 0.015), y + i * 0.092, z, rnd(-0.06, 0.06));
      ticks.push(v.tick);
    }
  const sw = netSwitch();
  add(sw.obj, -0.62, deskY, deskZ - 0.3, 0.05);
  ticks.push(sw.tick);

  // latas, una taza y una botella
  const can = new THREE.CylinderGeometry(0.033, 0.033, 0.122, 18);
  const canMats = [0xb81c14, 0xd9d6d2, 0x1a1a1a].map((c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.3, metalness: 0.8 }));
  for (const [x, z, m] of [[0.95, deskZ + 0.12, 0], [1.03, deskZ + 0.02, 1], [-0.9, deskZ + 0.18, 0], [-1.7, 0.4, 2]] as const) {
    const c = new THREE.Mesh(can, canMats[m]);
    add(c, x, (x < -1.6 ? 0 : deskY) + 0.061, z);
  }
  const fallen = new THREE.Mesh(can, canMats[1]);
  add(fallen, 0.4, 0.033, 0.9).rotation.set(Math.PI / 2, 0, 0.7);
  const mug = new THREE.Group();
  const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.042, 0.038, 0.1, 20, 1, true), new THREE.MeshStandardMaterial({ color: 0xd8d4cf, roughness: 0.4, side: THREE.DoubleSide }));
  cup.position.y = 0.05;
  const handle = new THREE.Mesh(new THREE.TorusGeometry(0.026, 0.007, 8, 16, Math.PI), cup.material);
  handle.position.set(0.045, 0.05, 0);
  handle.rotation.z = -Math.PI / 2;
  const coffee = new THREE.Mesh(new THREE.CircleGeometry(0.038, 16), new THREE.MeshStandardMaterial({ color: 0x120805, roughness: 0.15 }));
  coffee.rotation.x = -Math.PI / 2;
  coffee.position.y = 0.085;
  mug.add(cup, handle, coffee);
  add(mug, -0.45, deskY, deskZ + 0.22, 0.6);

  // papeles y pósits: hojas con garabatos sobre la mesa, notas pegadas
  for (let i = 0; i < 5; i++) {
    const paper = new THREE.Mesh(
      new THREE.PlaneGeometry(0.21, 0.297),
      new THREE.MeshStandardMaterial({ roughness: 0.95, map: canvasTex(128, 180, (x) => ((x.fillStyle = '#8e8883'), x.fillRect(0, 0, 128, 180), scribble(x, 128, 180, '#3a3533', 9))) }),
    );
    paper.rotation.set(-Math.PI / 2, 0, rnd(-0.6, 0.6));
    add(paper, free(-1.6, 1.4), deskY + 0.002 + i * 0.0015, deskZ + rnd(0.05, 0.32));
  }
  for (let i = 0; i < 7; i++) {
    const red = i % 3 === 0;
    const note = new THREE.Mesh(
      new THREE.PlaneGeometry(0.075, 0.075),
      new THREE.MeshStandardMaterial({ roughness: 0.9, map: canvasTex(48, 48, (x) => ((x.fillStyle = red ? '#b8241b' : '#9a948c'), x.fillRect(0, 0, 48, 48), scribble(x, 48, 48, red ? '#2a0605' : '#4a2a26', 3))) }),
    );
    note.rotation.set(-Math.PI / 2 + 0.02, 0, rnd(-0.4, 0.4));
    add(note, free(-1.9, 1.9), deskY + 0.004, deskZ + rnd(-0.3, 0.3));
  }

  // cajas de cartón y una maleta de transporte por el suelo
  for (const [x, z, w, h, d, r] of [[x1 - 0.5, 1.4, 0.5, 0.36, 0.4, 0.2], [x1 - 0.55, 1.42, 0.42, 0.3, 0.36, -0.1], [x0 + 0.5, 1.6, 0.55, 0.4, 0.45, 0.4], [x1 - 0.45, 2.1, 0.36, 0.28, 0.36, 0.5]] as const) {
    const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), card);
    add(b, x, (x === x1 - 0.55 ? 0.36 : 0) + h / 2, z, r);
  }
  const caseM = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.42, 0.45), rubber);
  add(caseM, x0 + 0.55, 0.21, 0.6, 0.25);
  for (const e of [-0.33, 0.33]) {
    const edge = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.43, 0.46), steel);
    edge.position.set(e, 0, 0);
    caseM.add(edge);
  }

  // el techo: tuberías y un fluorescente casi muerto que a veces intenta encenderse
  for (const [z, r] of [[-1.2, 0.05], [-0.9, 0.035], [0.6, 0.06]] as const) {
    const pipe = new THREE.Mesh(new THREE.CylinderGeometry(r, r, x1 - x0, 12), steel);
    pipe.rotation.z = Math.PI / 2;
    add(pipe, (x0 + x1) / 2, ceil - 0.1 - r, z);
  }
  const fixture = new THREE.Mesh(new THREE.BoxGeometry(1.25, 0.06, 0.16), steel);
  add(fixture, 0, ceil - 0.24, 0.1);
  const tubeMat = new THREE.MeshBasicMaterial({ color: 0x222222, toneMapped: false });
  const tube = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.016, 1.18, 10), tubeMat);
  tube.rotation.z = Math.PI / 2;
  add(tube, 0, ceil - 0.285, 0.1);
  const fl = new THREE.PointLight(0xe9edf0, 0, 4, 1.6);
  add(fl, 0, ceil - 0.35, 0.1);
  let next = rnd(4, 9), until = 0;
  ticks.push((t) => {
    if (t > next) {
      until = t + rnd(0.2, 0.9);
      next = t + rnd(6, 14);
    }
    const on = t < until && Math.random() < 0.55 ? 1 : 0;
    fl.intensity = on * 3.5;
    tubeMat.color.setScalar(on ? 1.4 : 0.13);
  });
  return ticks;
}

/** Polvo flotando en la luz de las pantallas. */
export function dust(scene: THREE.Scene, x0: number, x1: number, wallZ: number): Tick {
  const n = 420, pos = new Float32Array(n * 3), seed = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    pos.set([rnd(x0 + 0.3, x1 - 0.3), rnd(0.2, 2.6), rnd(wallZ + 0.2, 1.8)], i * 3);
    seed[i] = Math.random() * 100;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const mat = new THREE.PointsMaterial({ color: 0xbdb8b4, size: 0.008, transparent: true, opacity: 0.45, depthWrite: false, blending: THREE.AdditiveBlending });
  scene.add(new THREE.Points(geo, mat));
  return (t, dt) => {
    for (let i = 0; i < n; i++) {
      const s = seed[i];
      pos[i * 3] += Math.sin(t * 0.13 + s) * 0.012 * dt;
      pos[i * 3 + 1] += (Math.sin(t * 0.09 + s * 2) * 0.01 - 0.004) * dt;
      pos[i * 3 + 2] += Math.cos(t * 0.11 + s) * 0.01 * dt;
      if (pos[i * 3 + 1] < 0.1) pos[i * 3 + 1] = 2.6;
    }
    geo.attributes.position.needsUpdate = true;
  };
}
