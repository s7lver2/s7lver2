import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { disposeDeep } from '../dispose';

/*
 * La sala del ritual: un santuario en ruinas a las afueras de la ciudad, de noche. Detrás del
 * silencio, un torii lacado con un filo de neón rojo y, al fondo, en la bruma, el templo;
 * alrededor del círculo, cinco faroles de piedra (tōrō) con la lumbre roja; más lejos, rocas con
 * musgo medio enterradas; y en el horizonte, la ciudad. La luna, fría y por detrás, recorta el
 * torii, el templo y las rocas contra el cielo. Todo existe desde la carga: nada recompila después.
 */
const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
const glb = (n: string) => loader.loadAsync(`/models/ritual/${n}.glb`).then((g) => g.scene);

// encaja un modelo: su lado más largo en horizontal mide `w` metros y apoya en el suelo
function fit(o: THREE.Object3D, w: number) {
  o.updateMatrixWorld(true);
  const b = new THREE.Box3().setFromObject(o), sz = b.getSize(new THREE.Vector3()), k = w / Math.max(sz.x, sz.z);
  o.scale.multiplyScalar(k);
  const c = b.getCenter(new THREE.Vector3());
  o.position.set(-c.x * k, -b.min.y * k, -c.z * k);
  const g = new THREE.Group();
  g.add(o);
  return g;
}
const NEON = new THREE.Color(6, 0.14, 0.08);

export async function makeHall(o: { radius: number; entrance: THREE.Vector3 }) {
  const [toriiModel, templeModel, stoneModel] = await Promise.all([glb('torii'), glb('temple'), glb('stones')]);
  const group = new THREE.Group();
  const stone = new THREE.MeshStandardMaterial({ color: 0x0c0c0e, roughness: 0.85, metalness: 0 });
  const neon = new THREE.MeshBasicMaterial({ color: NEON, toneMapped: false });
  // la lumbre de los faroles: el mismo rojo, más apagado (sin bloom)
  const ember = new THREE.MeshBasicMaterial({ color: new THREE.Color(1.6, 0.08, 0.03) });
  const box = (w: number, h: number, d: number, m: THREE.Material = stone) => {
    const x = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
    if (m === stone) x.castShadow = x.receiveShadow = true;
    return x;
  };

  // el torii, detrás de la figura del silencio (al fondo del primer plano), de cara al círculo: el
  // modelo viene con el ancho a lo largo de z; se gira para que cruce el paso
  toriiModel.rotation.y = Math.PI / 2;
  toriiModel.traverse((m) => {
    const mesh = m as THREE.Mesh;
    if (!mesh.isMesh) return;
    mesh.castShadow = mesh.receiveShadow = true;
    // la laca, apagada: de noche casi negra, con el rojo justo para leerse con la luna
    const mat = mesh.material as THREE.MeshStandardMaterial;
    mat.color.multiplyScalar(0.55);
    mat.envMapIntensity = 0.4;
  });
  const torii = fit(toriiModel, 6.2);
  const tb = new THREE.Box3().setFromObject(torii), th = tb.max.y;
  for (const s of [-1, 1]) {
    // el neón por la cara de dentro de cada pilar
    const strip = box(0.025, th * 0.66, 0.025, neon);
    strip.position.set(s * 1.36, th * 0.36, 0.2);
    torii.add(strip);
  }
  const lip = box(2.72, 0.025, 0.025, neon);
  lip.position.set(0, th * 0.69, 0.2);
  torii.add(lip);
  // y lo que el neón alumbra: la laca de dentro de los pilares y el suelo bajo el arco, en rojo
  const glow = new THREE.PointLight(0xff2a1a, 9, 6, 1.6);
  glow.position.set(0, th * 0.55, 0.9);
  torii.add(glow);
  const dir = o.entrance.clone().setY(0).normalize();
  torii.position.copy(dir).multiplyScalar(-9.5);
  torii.rotation.y = Math.atan2(dir.x, dir.z);
  group.add(torii);

  // el templo, al fondo del torii y en la bruma: una silueta oscura con el tejado cortando el cielo
  templeModel.traverse((m) => {
    const mesh = m as THREE.Mesh;
    if (!mesh.isMesh) return;
    const mat = mesh.material as THREE.MeshStandardMaterial;
    mat.color.multiplyScalar(0.35);
    mat.envMapIntensity = 0.2;
  });
  const temple = fit(templeModel, 15);
  temple.position.copy(dir).multiplyScalar(-21);
  temple.rotation.y = Math.atan2(dir.x, dir.z) + Math.PI / 2;
  group.add(temple);

  // la luna: fría, alta y por detrás del templo, sin sombras; perfila lo que queda contra el cielo
  const moon = new THREE.DirectionalLight(0x8ea6d8, 0.9);
  moon.position.copy(dir).multiplyScalar(-30).setY(18);
  group.add(moon, moon.target);

  // los faroles, entre las puntas de la estrella, algo por fuera
  const roof = new THREE.ConeGeometry(0.34, 0.2, 4);
  for (let i = 0; i < 5; i++) {
    const a = ((i + 0.5) / 5) * Math.PI * 2, l = new THREE.Group();
    const foot = box(0.42, 0.14, 0.42);
    foot.position.y = 0.07;
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.09, 0.62, 12), stone);
    post.position.y = 0.45;
    post.castShadow = true;
    const seat = box(0.36, 0.08, 0.36);
    seat.position.y = 0.8;
    const fire = box(0.26, 0.24, 0.26);
    fire.position.y = 0.96;
    // la ventana de la lumbre, en las cuatro caras
    const glow = box(0.27, 0.11, 0.12, ember);
    glow.position.y = 0.97;
    const glow2 = glow.clone();
    glow2.rotation.y = Math.PI / 2;
    const cap = new THREE.Mesh(roof, stone);
    cap.position.y = 1.18;
    cap.rotation.y = Math.PI / 4;
    cap.castShadow = true;
    l.add(foot, post, seat, fire, glow, glow2, cap);
    l.position.set(Math.sin(a) * (o.radius + 2.1), 0, Math.cos(a) * (o.radius + 2.1));
    l.rotation.y = a;
    group.add(l);
  }

  // las rocas, lejos y en la bruma, medio enterradas: las cinco del paquete, cada una con su musgo
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const rocks: THREE.Object3D[] = [];
  stoneModel.updateMatrixWorld(true);
  stoneModel.traverse((m) => {
    const mesh = m as THREE.Mesh;
    if (!mesh.isMesh) return;
    const g = mesh.geometry.clone().applyMatrix4(mesh.matrixWorld);
    g.computeBoundingBox();
    const b = g.boundingBox!, c = b.getCenter(new THREE.Vector3()), k = 1 / Math.max(...b.getSize(new THREE.Vector3()).toArray());
    g.translate(-c.x, -b.min.y, -c.z).scale(k, k, k);
    const r = new THREE.Mesh(g, mesh.material);
    (r.material as THREE.MeshStandardMaterial).color.multiplyScalar(0.4);
    r.castShadow = r.receiveShadow = true;
    rocks.push(r);
  });
  const dirA = Math.atan2(dir.x, dir.z);
  for (let i = 0; i < 18; i++) {
    const a = (i / 18) * Math.PI * 2 + rnd() * 0.25;
    // por detrás del torii no: ahí se ve el templo
    if (Math.abs(((a - dirA - Math.PI + Math.PI * 3) % (Math.PI * 2)) - Math.PI) < 0.35) continue;
    const rr = 9.5 + rnd() * 5, size = 1.4 + rnd() * 2.6;
    const m = rocks[(rnd() * rocks.length) | 0].clone();
    m.scale.setScalar(size);
    m.position.set(Math.sin(a) * rr, -size * 0.12, Math.cos(a) * rr);
    m.rotation.set((rnd() - 0.5) * 0.25, rnd() * Math.PI * 2, (rnd() - 0.5) * 0.25);
    group.add(m);
  }

  // la ciudad en el horizonte: siluetas con ventanas sueltas, por encima de la bruma
  const c = Object.assign(document.createElement('canvas'), { width: 2048, height: 256 }), x = c.getContext('2d')!;
  for (let px = 0; px < 2048; ) {
    const w = 14 + rnd() * 60, h = 30 + Math.pow(rnd(), 2) * 190;
    x.fillStyle = '#07070a';
    x.fillRect(px, 256 - h, w, h);
    for (let k = 0; k < (w * h) / 900; k++) {
      x.fillStyle = rnd() < 0.7 ? 'rgba(255,40,30,0.55)' : 'rgba(255,190,150,0.35)';
      x.fillRect(px + 2 + rnd() * (w - 4), 256 - h + 4 + rnd() * (h - 8), 1.5, 1.5);
    }
    px += w + rnd() * 6;
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = THREE.RepeatWrapping;
  t.repeat.x = 2;
  const city = new THREE.Mesh(
    new THREE.CylinderGeometry(34, 34, 7, 64, 1, true),
    new THREE.MeshBasicMaterial({ map: t, transparent: true, side: THREE.BackSide, fog: false, depthWrite: false, opacity: 0.85 }),
  );
  city.position.y = 2.6;
  city.renderOrder = -1;
  group.add(city);

  const neon0 = neon.color.clone(), ember0 = ember.color.clone(), cm = city.material as THREE.MeshBasicMaterial;
  return {
    group,
    /** Cuánto se apaga el fondo (0-1): en las estatuas, para que manden la estatua y sus estandartes. */
    dim(k: number) {
      neon.color.copy(neon0).multiplyScalar(1 - 0.75 * k);
      glow.intensity = 9 * (1 - 0.75 * k);
      ember.color.copy(ember0).multiplyScalar(1 - 0.6 * k);
      cm.opacity = 0.85 * (1 - 0.7 * k);
    },
    dispose() {
      disposeDeep(group);
    },
  };
}
