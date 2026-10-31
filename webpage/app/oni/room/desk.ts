import * as THREE from 'three';
import { canvas, crack, normalFrom, seeded, tex } from './surfaces';

/*
 * La consola: tablero de laminado oscuro gastado (rayas, cercos de café, la zona donde apoyas
 * los brazos más brillante y polvo al fondo), canto con perfil de acero, alfombrilla de goma con
 * pespunte bajo teclado y ratón, cajonera, faldón perforado, pasacables y el flexo.
 */

const rnd = (a: number, b: number) => a + Math.random() * (b - a);

// el tablero: color, relieve y brillo dibujados a la vez. Lienzo arriba = fondo de la mesa
function topMaps(aspect: number) {
  const W = 2048, H = Math.round(W / aspect);
  const c = canvas(W, H), hc = canvas(W, H), rc = canvas(W, H);
  const x = c.getContext('2d')!, h = hc.getContext('2d')!, r = rc.getContext('2d')!;
  x.fillStyle = '#1f1715';
  x.fillRect(0, 0, W, H);
  h.fillStyle = '#808080';
  h.fillRect(0, 0, W, H);
  r.fillStyle = '#8c8c8c';
  r.fillRect(0, 0, W, H);
  // la veta del laminado: hebras largas casi invisibles
  for (let i = 0; i < 420; i++) {
    const y = rnd(0, H), a = rnd(0.02, 0.06);
    x.strokeStyle = Math.random() < 0.5 ? `rgba(0,0,0,${a})` : `rgba(90,70,60,${a * 0.6})`;
    x.lineWidth = rnd(0.6, 2.2);
    x.beginPath();
    x.moveTo(0, y);
    x.bezierCurveTo(W * 0.3, y + rnd(-6, 6), W * 0.7, y + rnd(-6, 6), W, y + rnd(-3, 3));
    x.stroke();
  }
  // donde apoyas los brazos: el laminado gastado, algo más claro y liso
  for (const cx of [W * 0.45, W * 0.55]) {
    for (const [ctx, col] of [[x, '70,52,46,0.22'], [r, '30,30,30,0.6']] as const) {
      const g = ctx.createRadialGradient(cx, H * 0.85, 0, cx, H * 0.85, W * 0.12);
      g.addColorStop(0, `rgba(${col})`);
      g.addColorStop(1, `rgba(${col.replace(/[\d.]+$/, '0')})`);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);
    }
  }
  // polvo al fondo, junto a las teles: más claro y mate
  const dust = x.createLinearGradient(0, 0, 0, H * 0.35);
  dust.addColorStop(0, 'rgba(90,80,76,0.18)');
  dust.addColorStop(1, 'rgba(90,80,76,0)');
  x.fillStyle = dust;
  x.fillRect(0, 0, W, H);
  const rdust = r.createLinearGradient(0, 0, 0, H * 0.35);
  rdust.addColorStop(0, 'rgba(255,255,255,0.5)');
  rdust.addColorStop(1, 'rgba(255,255,255,0)');
  r.fillStyle = rdust;
  r.fillRect(0, 0, W, H);
  // rayas: surco en la altura, más claras en el color
  for (let i = 0; i < 70; i++) {
    const seed = 1 + ((Math.random() * 1e9) | 0), px = rnd(0, W), py = rnd(H * 0.3, H), len = rnd(10, 60);
    for (const [ctx, col, lw] of [[h, 'rgba(0,0,0,0.7)', 1.6], [x, 'rgba(120,100,92,0.14)', 1]] as const) {
      ctx.strokeStyle = col;
      ctx.lineWidth = lw;
      crack(ctx, px, py, len, 8, 0.15, seeded(seed));
    }
  }
  // cercos de café: anillos secos, mates, alguno sin cerrar
  for (let i = 0; i < 5; i++) {
    const cx = rnd(W * 0.15, W * 0.85), cy = rnd(H * 0.25, H * 0.8), rad = rnd(26, 34), a0 = rnd(0, 6.3), a1 = a0 + rnd(3.5, 6.3);
    for (const [ctx, col, lw] of [[x, 'rgba(84,48,30,0.45)', 3], [r, 'rgba(255,255,255,0.7)', 4], [h, 'rgba(255,255,255,0.4)', 2]] as const) {
      ctx.strokeStyle = col;
      ctx.lineWidth = lw;
      ctx.beginPath();
      ctx.arc(cx, cy, rad, a0, a1);
      ctx.stroke();
    }
  }
  return { map: tex(c, [1, 1], true), normalMap: normalFrom(hc, 2.5, [1, 1]), roughnessMap: tex(rc, [1, 1], false) };
}

// la alfombrilla de goma: negra con algo de rojo, grano fino y un pespunte alrededor
function matMap(w: number, d: number) {
  const W = 1024, H = Math.round((W * d) / w);
  const c = canvas(W, H), x = c.getContext('2d')!;
  x.fillStyle = '#140d0c';
  x.fillRect(0, 0, W, H);
  for (let i = 0; i < 6000; i++) {
    x.fillStyle = `rgba(${Math.random() < 0.5 ? '0,0,0' : '60,30,26'},0.35)`;
    x.fillRect(rnd(0, W), rnd(0, H), 2, 2);
  }
  x.strokeStyle = '#5a2620';
  x.lineWidth = 3;
  x.setLineDash([10, 7]);
  x.strokeRect(12, 12, W - 24, H - 24);
  return tex(c, [1, 1], true);
}

// chapa perforada: agujeros redondos en rejilla, para el faldón
function holes() {
  const c = canvas(32), x = c.getContext('2d')!;
  x.fillStyle = '#fff';
  x.fillRect(0, 0, 32, 32);
  x.fillStyle = '#000';
  x.beginPath();
  x.arc(16, 16, 8, 0, Math.PI * 2);
  x.fill();
  return c;
}

export function buildDesk(s: THREE.Scene, width: number, deskY: number, deskZ: number, depth = 0.8) {
  const steel = new THREE.MeshStandardMaterial({ color: 0x232020, roughness: 0.45, metalness: 0.7, side: THREE.DoubleSide });
  const edge = new THREE.MeshStandardMaterial({ color: 0x120e0d, roughness: 0.35, metalness: 0.1 });
  const top = new THREE.MeshStandardMaterial({ ...topMaps(width / depth), roughness: 1, metalness: 0.05 });
  // el laminado y el acero reflejan el muro de teles (la escena pone el entorno)
  for (const m of [steel, edge, top]) m.userData.env = 1;
  // la cara de arriba lleva el laminado; los cantos, su banda oscura
  const board = new THREE.Mesh(new THREE.BoxGeometry(width, 0.04, depth), [edge, edge, top, edge, edge, edge]);
  board.position.set(0, deskY - 0.02, deskZ);
  board.receiveShadow = true;
  s.add(board);
  // perfil de acero en el canto de delante
  const trim = new THREE.Mesh(new THREE.BoxGeometry(width + 0.004, 0.046, 0.012), steel);
  trim.position.set(0, deskY - 0.022, deskZ + depth / 2);
  s.add(trim);

  for (const x of [-width / 2 + 0.05, width / 2 - 0.05, -0.55, 0.55]) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.04, deskY - 0.05, 0.7), steel);
    leg.position.set(x, (deskY - 0.05) / 2, deskZ);
    s.add(leg);
  }
  const bar = new THREE.Mesh(new THREE.BoxGeometry(width - 0.1, 0.04, 0.03), steel);
  bar.position.set(0, 0.12, deskZ - 0.3);
  s.add(bar);

  // faldón de chapa perforada al fondo, bajo el tablero
  const ht = new THREE.CanvasTexture(holes());
  ht.wrapS = ht.wrapT = THREE.RepeatWrapping;
  ht.repeat.set((width - 0.1) / 0.02, 0.4 / 0.02);
  const panel = new THREE.Mesh(new THREE.PlaneGeometry(width - 0.1, 0.4), new THREE.MeshStandardMaterial({ color: 0x1c1919, roughness: 0.5, metalness: 0.6, alphaMap: ht, alphaTest: 0.5, side: THREE.DoubleSide }));
  panel.position.set(0, deskY - 0.24, deskZ - depth / 2 + 0.06);
  s.add(panel);

  // la cajonera, bajo el flexo
  const ped = new THREE.Group(), pw = 0.42, ph = deskY - 0.07, pd = 0.6;
  const body = new THREE.Mesh(new THREE.BoxGeometry(pw, ph, pd), new THREE.MeshStandardMaterial({ color: 0x1a1616, roughness: 0.55, metalness: 0.5 }));
  body.position.y = ph / 2 + 0.03;
  ped.add(body);
  const fronts = [0.16, 0.16, ph - 0.36];
  let y = 0.04;
  for (const fh of fronts.reverse()) {
    const f = new THREE.Mesh(new THREE.BoxGeometry(pw - 0.02, fh - 0.012, 0.012), new THREE.MeshStandardMaterial({ color: 0x221c1b, roughness: 0.4, metalness: 0.55 }));
    f.position.set(0, y + fh / 2, pd / 2 + 0.006);
    const handle = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.01, 0.014), new THREE.MeshStandardMaterial({ color: 0x6a625e, roughness: 0.3, metalness: 0.9 }));
    handle.position.set(0, y + fh - 0.035, pd / 2 + 0.019);
    ped.add(f, handle);
    y += fh;
  }
  ped.position.set(-width / 2 + 0.4, 0, deskZ + 0.05);
  s.add(ped);

  // alfombrilla bajo teclado y ratón
  const mw = 0.92, md = 0.36;
  const mat = new THREE.Mesh(new THREE.BoxGeometry(mw, 0.004, md), new THREE.MeshStandardMaterial({ map: matMap(mw, md), roughness: 0.95 }));
  mat.position.set(0.08, deskY + 0.002, deskZ + 0.19);
  mat.receiveShadow = true;
  s.add(mat);

  // pasacables: un aro negro con el agujero
  const grommet = new THREE.Mesh(new THREE.RingGeometry(0.022, 0.032, 24), new THREE.MeshStandardMaterial({ color: 0x0c0a0a, roughness: 0.5 }));
  grommet.rotation.x = -Math.PI / 2;
  grommet.position.set(1.25, deskY + 0.0008, deskZ - 0.3);
  const hole = new THREE.Mesh(new THREE.CircleGeometry(0.022, 24), new THREE.MeshBasicMaterial({ color: 0x000000 }));
  hole.rotation.x = -Math.PI / 2;
  hole.position.set(1.25, deskY + 0.0006, deskZ - 0.3);
  s.add(grommet, hole);

  // flexo: base, brazo, pantalla y bombilla, con su foco cálido sobre la mesa
  const lamp = new THREE.Group();
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.08, 0.02, 20), steel);
  const arm1 = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.36), steel);
  arm1.position.set(0, 0.18, -0.06);
  arm1.rotation.x = -0.35;
  const arm2 = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.3), steel);
  arm2.position.set(0, 0.38, 0.03);
  arm2.rotation.x = 1.0;
  const shade = new THREE.Mesh(new THREE.ConeGeometry(0.075, 0.12, 20, 1, true), steel);
  shade.position.set(0, 0.42, 0.16);
  shade.rotation.x = 0.5;
  const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.025, 12, 8), new THREE.MeshBasicMaterial({ color: 0xffb08a, toneMapped: false }));
  bulb.position.set(0, 0.39, 0.18);
  lamp.add(base, arm1, arm2, shade, bulb);
  lamp.position.set(-width / 2 + 0.45, deskY, deskZ - 0.15);
  lamp.rotation.y = 0.5;
  s.add(lamp);
  lamp.updateMatrixWorld(true);
  const warm = new THREE.SpotLight(0xff7a52, 3.2, 2.4, 0.75, 0.7, 1.8);
  warm.position.copy(lamp.localToWorld(new THREE.Vector3(0, 0.39, 0.18)));
  warm.target.position.set(lamp.position.x + 0.25, deskY, deskZ + 0.15);
  s.add(warm, warm.target);
  return warm;
}
