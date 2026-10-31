import * as THREE from 'three';

/*
 * La sala del ritual: un santuario en ruinas a las afueras de la ciudad, de noche. Detrás del
 * silencio, un torii de piedra negra con un filo de neón rojo; alrededor del círculo, cinco
 * faroles de piedra (tōrō) con la lumbre roja; más lejos, monolitos rotos que se pierden en la
 * bruma; y en el horizonte, la ciudad. Sin luces de three: los brillos son materiales emisivos,
 * así no cambia ningún shader del resto de la escena.
 */
const NEON = new THREE.Color(6, 0.14, 0.08);

export function makeHall(o: { radius: number; entrance: THREE.Vector3 }) {
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

  // el torii, detrás de la figura del silencio (al fondo del primer plano), de cara al círculo
  const torii = new THREE.Group();
  for (const s of [-1, 1]) {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.19, 0.23, 4.6, 20), stone);
    post.position.set(s * 2.1, 2.3, 0);
    post.castShadow = true;
    torii.add(post);
    // el neón por la cara de dentro de cada pilar
    const strip = box(0.025, 3.9, 0.025, neon);
    strip.position.set(s * 1.9, 2.05, 0);
    torii.add(strip);
  }
  const kasagi = box(5.8, 0.3, 0.5);
  kasagi.position.y = 4.75;
  const shimaki = box(5.2, 0.2, 0.38);
  shimaki.position.y = 4.5;
  const nuki = box(4.8, 0.18, 0.22);
  nuki.position.y = 3.75;
  const gaku = box(0.18, 0.55, 0.16);
  gaku.position.y = 4.1;
  const lip = box(5.0, 0.025, 0.025, neon);
  lip.position.set(0, 4.39, 0.2);
  torii.add(kasagi, shimaki, nuki, gaku, lip);
  const dir = o.entrance.clone().setY(0).normalize();
  torii.position.copy(dir).multiplyScalar(-9.5);
  torii.rotation.y = Math.atan2(dir.x, dir.z);
  group.add(torii);

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

  // los monolitos rotos, lejos y en la bruma, con alguna veta de neón
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 11; i++) {
    const a = (i / 11) * Math.PI * 2 + rnd() * 0.3, r = 11 + rnd() * 3, h = 3 + rnd() * 6;
    const m = box(0.6 + rnd() * 0.5, h, 0.6 + rnd() * 0.5);
    m.position.set(Math.sin(a) * r, h / 2 - 0.2, Math.cos(a) * r);
    m.rotation.set((rnd() - 0.5) * 0.12, rnd() * 3, (rnd() - 0.5) * 0.12);
    group.add(m);
    if (rnd() < 0.45) {
      const v = box(0.02, h * 0.7, 0.02, neon);
      v.position.set(0.31, -h * 0.1, 0.31);
      m.add(v);
    }
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
      ember.color.copy(ember0).multiplyScalar(1 - 0.6 * k);
      cm.opacity = 0.85 * (1 - 0.7 * k);
    },
    dispose() {
      group.traverse((m) => (m as THREE.Mesh).geometry?.dispose());
      for (const m of [stone, neon, ember, city.material]) m.dispose();
      t.dispose();
    },
  };
}
