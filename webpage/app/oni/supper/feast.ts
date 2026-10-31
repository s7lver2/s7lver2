import * as THREE from 'three';
import { TABLE, chair, glb } from './table';

/*
 * La comida y el caos: lo que sigue en la mesa (el asado delante del centro, bandejas, copas,
 * velas) y lo que ha salido volando y se queda suspendido, girando despacio, a cámara lenta.
 * La comida es la de verdad (pan, hamburguesas y copas de calavera); la vajilla, piezas
 * sencillas de metal y loza.
 */

const metal = new THREE.MeshStandardMaterial({ color: 0xb59a7a, metalness: 0.85, roughness: 0.32 });
const china = new THREE.MeshStandardMaterial({ color: 0xcfc4ba, roughness: 0.45 });
const roast = new THREE.MeshStandardMaterial({ color: 0x6b2f14, roughness: 0.55 });
const wax = new THREE.MeshStandardMaterial({ color: 0xd9cfc0, roughness: 0.8 });
const flame = new THREE.MeshBasicMaterial({ color: 0xffb070, toneMapped: false });

const plate = () => new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.1, 0.018, 28), china);
const platter = () => new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.2, 0.022, 32), metal);
const cloche = () => new THREE.Mesh(new THREE.SphereGeometry(0.17, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), metal);
const pot = () => new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.11, 0.16, 20, 1, true), metal);
const goblet = () => {
  const pts = [[0, 0], [0.04, 0], [0.04, 0.008], [0.008, 0.02], [0.007, 0.09], [0.04, 0.11], [0.045, 0.17], [0.04, 0.17], [0.036, 0.115], [0, 0.1]].map(([x, y]) => new THREE.Vector2(x, y));
  return new THREE.Mesh(new THREE.LatheGeometry(pts, 20), metal);
};
const candle = () => {
  const g = new THREE.Group();
  const c = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.2, 12), wax);
  c.position.y = 0.1;
  const f = new THREE.Mesh(new THREE.SphereGeometry(0.012, 8, 6), flame);
  f.scale.y = 1.8;
  f.position.y = 0.225;
  return g.add(c, f);
};

interface Flying {
  o: THREE.Object3D;
  home: THREE.Vector3;
  spin: THREE.Vector3;
  phase: number;
}

export async function makeFeast() {
  const group = new THREE.Group(), flying: Flying[] = [];
  const top = TABLE.top + 0.012;
  const on = (o: THREE.Object3D, x: number, z: number, y = 0) => {
    o.position.set(x, top + y, z);
    o.traverse((m) => void (m.castShadow = m.receiveShadow = true));
    group.add(o);
    return o;
  };

  // la comida de verdad: cada modelo a su tamaño (el lado más largo, en m)
  const food = async (url: string, len: number) => {
    const g = await glb(url), size = new THREE.Box3().setFromObject(g).getSize(new THREE.Vector3());
    g.scale.setScalar(len / Math.max(size.x, size.y, size.z));
    // apoyado por debajo y centrado: así 'on' lo deja encima de la mesa
    const box = new THREE.Box3().setFromObject(g), c = box.getCenter(new THREE.Vector3());
    const pivot = new THREE.Group().add(g);
    g.position.set(-c.x, -box.min.y, -c.z);
    return pivot;
  };
  const F = {
    bread: () => food('/models/supper/bread.glb', 0.3),
    burger: () => food('/models/supper/burger.glb', 0.12),
    skull: () => food('/models/supper/skull.glb', 0.14),
  };
  // junto al centro (sin taparle las manos), el pan en su bandeja; delante de él, solo su plato
  on(platter(), -0.62, 0.12);
  on(await F.bread(), -0.62, 0.12, 0.012).rotation.y = 0.4;
  on(plate(), 0, 0.3);
  on(await F.bread(), 0.95, 0.05);
  on(await F.bread(), -2.0, 0.0).rotation.y = 1.2;
  for (const [x, z] of [[-1.45, 0.25], [1.75, 0.28], [2.85, 0.1]] as const) on(await F.burger(), x, z).rotation.y = x;
  for (const [x, z] of [[0.45, 0.32], [-0.35, 0.3], [1.3, 0.3], [-2.5, 0.25]] as const) on(await F.skull(), x, z).rotation.y = Math.PI + x * 0.3;
  // a lo largo de la mesa, lo que queda en pie
  for (const [x, z] of [[-0.75, 0.25], [0.78, 0.2], [-1.9, 0.1], [2.1, 0.22], [-2.9, 0.18]] as const) on(plate(), x, z);
  for (const [x, z] of [[-1.1, 0.05], [1.05, 0.0], [-2.4, -0.05], [2.95, 0.1]] as const) on(candle(), x, z);
  on(cloche(), 1.6, -0.02);
  on(cloche(), -2.15, -0.05);
  // un plato volcado
  on(plate(), -1.3, 0.3, 0.06).rotation.x = 0.5;

  // lo que vuela: suspendido por encima de la mesa, girando despacio
  const [seat, cloth] = await Promise.all([chair(), glb('/models/supper/cloth.glb')]);
  cloth.scale.setScalar(0.45);
  const fly = await Promise.all([F.bread(), F.burger(), F.burger(), F.skull(), F.skull(), F.burger()]);
  const make = [plate, plate, plate, () => fly[0], () => fly[1], () => fly[3], cloche, pot, () => fly[2], platter, () => fly[4], plate, () => fly[5], () => cloth, () => seat];
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  make.forEach((f, i) => {
    const o = f();
    o.traverse((m) => void (m.castShadow = true));
    // la silla, al fondo a un lado, y el mantel al otro; el resto, repartido sin tapar la cara del centro
    const side = i % 2 ? 1 : -1, x = i === make.length - 1 ? -2.3 : i === make.length - 2 ? 1.9 : side * (0.55 + rnd() * 2.6);
    const home = new THREE.Vector3(x, 1.15 + rnd() * 1.1, -0.4 + rnd() * 0.9);
    o.position.copy(home);
    o.rotation.set(rnd() * 6, rnd() * 6, rnd() * 6);
    group.add(o);
    flying.push({ o, home, spin: new THREE.Vector3(rnd() - 0.5, rnd() - 0.5, rnd() - 0.5).multiplyScalar(0.5), phase: rnd() * 6 });
  });

  return {
    group,
    /**
     * Cámara lenta: giran y suben y bajan muy despacio (sin movimiento, quietos). Con el fallo de la
     * máscara (`glitch`), un tercio de ellos desaparece y salta un poco de sitio.
     */
    update(t: number, dt: number, reduced: boolean, glitch = false) {
      if (reduced) return;
      for (const [i, f] of flying.entries()) {
        const gone = glitch && (i + Math.floor(t * 20)) % 3 === 0;
        f.o.visible = !gone;
        if (glitch) f.o.position.x = f.home.x + (Math.random() - 0.5) * 0.04;
        else f.o.position.x = f.home.x;
        f.o.rotation.x += f.spin.x * dt;
        f.o.rotation.y += f.spin.y * dt;
        f.o.rotation.z += f.spin.z * dt;
        f.o.position.y = f.home.y + Math.sin(t * 0.4 + f.phase) * 0.06;
      }
    },
  };
}
