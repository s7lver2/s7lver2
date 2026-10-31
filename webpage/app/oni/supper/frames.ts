import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { ACHIEVEMENTS, has, type Achievement, type AchievementId } from '../achievements';
import { makeMask } from '../library/subject';
import { PILLARS, PILLAR_FRONT, GLASS } from './penthouse';

/*
 * Los logros: marcos de holograma, de la misma luz roja que los estandartes del ritual (líneas de
 * barrido que dejan ver a través, un parpadeo a saltos y bandas que se corren de lado). Cada marco es
 * un filo de luz con cuatro escuadras en las esquinas y, detrás, una pantalla apenas visible. Dentro,
 * su icono: una pieza en 3D hecha para ese logro (una puerta entreabierta, unas gafas de realidad
 * virtual, un pentagrama...), girando despacio. Conseguido, el icono es sólido y brilla; sin
 * conseguir, solo se ven sus aristas, apagadas. El del final, más grande y delante del cristal,
 * lleva el oni. Al pasar el puntero, la escena avisa (`pick`) y la página saca el popup.
 */

const BAND = 0.012;
// cómo se pinta cada pieza: el oni (casi solo el borde), el filo del marco, la pantalla de detrás,
// el icono sólido y las aristas (sin normales: luz plana)
const MODE = { rim: 0, edge: 1, screen: 2, solid: 3, line: 4 } as const;

const holo = new THREE.ShaderMaterial({
  uniforms: {
    uTime: { value: 0 }, uShow: { value: 1 }, uGlitch: { value: 0 }, uMode: { value: 1 },
    uColor: { value: new THREE.Color(0xff1f1f).multiplyScalar(1.6) },
  },
  vertexShader: `
    uniform float uTime, uGlitch; varying vec3 vW, vN;
    float h1(float n) { return fract(sin(n * 12.9898) * 43758.5453); }
    void main() {
      vec4 wp = modelMatrix * vec4(position, 1.0);
      // con el fallo, cada banda se corre a un lado (hasta 3 cm)
      float band = floor(wp.y / ${BAND});
      wp.x += (h1(band + floor(uTime * 24.0)) * 2.0 - 1.0) * 0.03 * uGlitch * step(0.6, h1(band));
      vW = wp.xyz;
      vN = mat3(modelMatrix) * normal;
      gl_Position = projectionMatrix * viewMatrix * wp;
    }`,
  fragmentShader: `
    uniform float uTime, uShow, uMode; uniform vec3 uColor; varying vec3 vW, vN;
    float h1(float n) { return fract(sin(n * 12.9898) * 43758.5453); }
    void main() {
      float scan = 0.3 + 0.7 * smoothstep(0.35, 0.65, fract(vW.y * 140.0 - uTime * 0.6));
      float flick = 1.0 - 0.1 * step(0.9, h1(floor(uTime * 18.0)));
      float body;
      if (uMode > 3.5) body = 0.9;
      else if (uMode > 1.5 && uMode < 2.5) body = 0.05;
      else {
        vec3 v = normalize(cameraPosition - vW);
        float rim = pow(max(0.0, 1.0 - abs(dot(normalize(vN), v))), 2.0);
        body = uMode < 0.5 ? 0.03 + rim * 0.55 : uMode < 1.5 ? 0.7 + rim * 0.3 : 0.1 + rim * 0.6;
      }
      gl_FragColor = vec4(uColor * body * scan * flick * uShow, 1.0);
    }`,
  transparent: true,
  blending: THREE.AdditiveBlending,
  depthWrite: false,
});
const mat = (mode: number) => {
  const m = holo.clone();
  m.uniforms.uMode.value = mode;
  return m;
};

/* ── los iconos: cada uno, piezas sencillas unidas en una sola malla, centrada y de 1 de alto/ancho */

const flat = (g: THREE.BufferGeometry) => (g.index ? g.toNonIndexed() : g);
const ext = (s: THREE.Shape, depth = 0.16) =>
  new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: true, bevelThickness: 0.025, bevelSize: 0.025, bevelSegments: 2, curveSegments: 28 }).translate(0, 0, -depth / 2);
const box = (w: number, h: number, d: number, x = 0, y = 0, z = 0, rz = 0) => new THREE.BoxGeometry(w, h, d).rotateZ(rz).translate(x, y, z);
// una barra de a hasta b (en el plano), de grosor t
const bar = (a: [number, number], b: [number, number], t = 0.06) =>
  box(Math.hypot(b[0] - a[0], b[1] - a[1]) + t, t, t, (a[0] + b[0]) / 2, (a[1] + b[1]) / 2, 0, Math.atan2(b[1] - a[1], b[0] - a[0]));
// píxeles en cubos: cada X de las filas, un cubo
const voxels = (rows: string[], s = 0.1) =>
  rows.flatMap((r, y) => [...r].flatMap((c, x) => (c === 'X' ? [box(s, s, s, x * s, -y * s, 0)] : [])));
const rect = (w: number, h: number, x = 0, y = 0) =>
  new THREE.Path().moveTo(x - w / 2, y - h / 2).lineTo(x + w / 2, y - h / 2).lineTo(x + w / 2, y + h / 2).lineTo(x - w / 2, y + h / 2).closePath();

const ICON: Record<Exclude<AchievementId, 'end'>, () => THREE.BufferGeometry[]> = {
  // una puerta entreabierta en su marco, y el fluorescente encima
  backrooms: () => {
    const frame = new THREE.Shape(rect(0.62, 1.04).getPoints());
    frame.holes.push(rect(0.48, 0.94, 0, -0.05));
    const door = box(0.46, 0.92, 0.03).translate(0.23, 0, 0).rotateY(-0.75).translate(-0.24, -0.05, 0);
    const knob = new THREE.SphereGeometry(0.035, 12, 8).translate(0.38, -0.05, 0.03).rotateY(-0.75).translate(-0.24, 0, 0);
    return [ext(frame, 0.1), door, knob, box(0.7, 0.035, 0.05, 0, 0.66, 0)];
  },
  // unas gafas de realidad virtual: el visor, las dos lentes y la cinta por detrás
  vrchat: () => {
    const s = new THREE.Shape();
    s.moveTo(-0.45, -0.1).lineTo(-0.45, 0.1).quadraticCurveTo(-0.45, 0.24, -0.3, 0.24).lineTo(0.3, 0.24).quadraticCurveTo(0.45, 0.24, 0.45, 0.1);
    s.lineTo(0.45, -0.1).quadraticCurveTo(0.45, -0.24, 0.3, -0.24).lineTo(0.1, -0.24).quadraticCurveTo(0, -0.12, -0.1, -0.24).lineTo(-0.3, -0.24).quadraticCurveTo(-0.45, -0.24, -0.45, -0.1);
    const lens = (x: number) => new THREE.CylinderGeometry(0.11, 0.11, 0.06, 24).rotateX(Math.PI / 2).translate(x, 0, 0.16);
    const strap = new THREE.TorusGeometry(0.44, 0.025, 6, 32, Math.PI).rotateX(-Math.PI / 2).translate(0, 0, -0.08);
    return [ext(s, 0.24), lens(-0.21), lens(0.21), strap];
  },
  // el pentagrama: cinco barras y su círculo
  lucy: () => {
    const p = (i: number): [number, number] => {
      const a = Math.PI / 2 + (i * Math.PI * 2) / 5;
      return [Math.cos(a) * 0.5, Math.sin(a) * 0.5];
    };
    return [...[0, 1, 2, 3, 4].map((i) => bar(p(i), p(i + 2), 0.045)), new THREE.TorusGeometry(0.55, 0.03, 8, 48)];
  },
  // la luna menguante, gruesa
  silver: () => {
    // el borde de fuera (r 0,5) y el hueco (r 0,425, corrido a la derecha) se cortan en ±0,99 rad
    const s = new THREE.Shape();
    s.absarc(0, 0, 0.5, 0.992, Math.PI * 2 - 0.992, false);
    s.absarc(0.2, 0, 0.425, -1.397, 1.397, true);
    return [ext(s, 0.14)];
  },
  // un pico, en cubos
  minecraft: () =>
    voxels([
      '..XXXXX...',
      '.X....XX..',
      '......XXX.',
      '.....X.XX.',
      '....X...X.',
      '...X....X.',
      '..X.......',
      '.X........',
      'X.........',
    ]),
  // el portal: el marco de cubos y, dentro, el remolino
  nether: () => {
    const swirl = new THREE.CatmullRomCurve3(
      Array.from({ length: 40 }, (_, i) => {
        const a = i * 0.45, r = 0.03 + i * 0.0055;
        return new THREE.Vector3(Math.cos(a) * r * 0.75, Math.sin(a) * r * 1.1, 0);
      }),
    );
    const ring = voxels(['XXXX', 'X..X', 'X..X', 'X..X', 'X..X', 'XXXX'], 0.17).map((g) => g.translate(-0.255, 0.425, 0));
    return [...ring, new THREE.TubeGeometry(swirl, 120, 0.014, 5)];
  },
  // la estrella de cuatro puntas, tachada
  gemini: () => {
    const s = new THREE.Shape();
    s.moveTo(0, 0.5).quadraticCurveTo(0.04, 0.04, 0.5, 0).quadraticCurveTo(0.04, -0.04, 0, -0.5).quadraticCurveTo(-0.04, -0.04, -0.5, 0).quadraticCurveTo(-0.04, 0.04, 0, 0.5);
    return [ext(s, 0.12), bar([-0.42, 0.42], [0.42, -0.42], 0.06)];
  },
  // el bocadillo de conversación (hueco) y los tres puntos de «escribiendo»
  whatsapp: () => {
    const s = new THREE.Shape();
    s.absarc(0, 0.05, 0.45, -Math.PI * 0.62, Math.PI * 1.32, false);
    s.lineTo(-0.36, -0.46).closePath();
    s.holes.push(new THREE.Path().absarc(0, 0.05, 0.36, 0, Math.PI * 2, true));
    const dot = (x: number) => new THREE.SphereGeometry(0.055, 12, 8).translate(x, 0.05, 0);
    return [ext(s, 0.1), dot(-0.15), dot(0), dot(0.15)];
  },
};

function iconGeo(id: Exclude<AchievementId, 'end'>) {
  const g = mergeGeometries(ICON[id]().map((x) => flat(x).deleteAttribute('uv') as THREE.BufferGeometry))!;
  g.computeBoundingBox();
  const b = g.boundingBox!, size = b.getSize(new THREE.Vector3());
  g.translate(...b.getCenter(new THREE.Vector3()).negate().toArray());
  return g.scale(...(new THREE.Vector3().setScalar(1 / Math.max(size.x, size.y)).toArray() as [number, number, number]));
}

/** El marco: un filo fino (rectángulo con su hueco) y cuatro escuadras por fuera de las esquinas. */
function frameGeo(w: number, h: number) {
  const b = w * 0.016, s = new THREE.Shape(rect(w + 2 * b, h + 2 * b).getPoints());
  s.holes.push(rect(w, h));
  const parts: THREE.BufferGeometry[] = [new THREE.ExtrudeGeometry(s, { depth: 0.004, bevelEnabled: false })];
  const o = w * 0.045, l = w * 0.2, t = w * 0.03;
  for (const sx of [-1, 1])
    for (const sy of [-1, 1]) {
      const x = sx * (w / 2 + o), y = sy * (h / 2 + o);
      parts.push(box(l, t, 0.008, x - (sx * (l - t)) / 2, y, 0), box(t, l, 0.008, x, y - (sy * (l - t)) / 2, 0));
    }
  return mergeGeometries(parts.map((p) => flat(p).deleteAttribute('uv') as THREE.BufferGeometry))!;
}

interface Item {
  a: Achievement;
  /** La pantalla de detrás: también es lo que recibe el puntero. */
  screen: THREE.Mesh;
  solid: THREE.Object3D;
  lines?: THREE.LineSegments;
  icon: THREE.Object3D;
  mats: THREE.ShaderMaterial[];
  seed: number;
}

export class Frames {
  readonly group = new THREE.Group();
  private items: Item[] = [];
  private t = 0;

  /** Los marcos (el del final, con su oni, cuando llega la máscara). */
  async load() {
    // [x, y, z, ancho]: el del final delante del cristal; los demás en los pilares, arriba y abajo
    const spots: [number, number, number, number][] = [[0, 2.25, GLASS + 0.35, 0.56]];
    const order = [1, 2, 0, 3];
    ACHIEVEMENTS.slice(1).forEach((_, i) => spots.push([PILLARS[order[i % 4]], i < 4 ? 2.62 : 2.0, PILLAR_FRONT + 0.03, 0.34]));
    const face = await makeMask();
    ACHIEVEMENTS.forEach((a, i) => {
      const [x, y, z, w] = spots[i], h = w * 1.25;
      const em = mat(MODE.edge), sm = mat(MODE.screen), mats = [em, sm];
      const screen = new THREE.Mesh(new THREE.PlaneGeometry(w, h), sm);
      screen.userData.a = a;
      const icon = new THREE.Group();
      icon.position.z = 0.07;
      let solid: THREE.Object3D, lines: THREE.LineSegments | undefined;
      if (a.id === 'end') {
        // el oni: la máscara en holograma
        const om = mat(MODE.rim);
        mats.push(om);
        solid = face.clone();
        solid.quaternion.identity();
        solid.rotation.y = Math.PI;
        solid.scale.setScalar(h * 0.33);
        solid.traverse((o) => {
          const m = o as THREE.Mesh;
          if (m.isMesh) (m.material = om), (m.castShadow = false);
        });
      } else {
        const geo = iconGeo(a.id), om = mat(MODE.solid), lm = mat(MODE.line);
        mats.push(om, lm);
        solid = new THREE.Mesh(geo, om);
        lines = new THREE.LineSegments(new THREE.EdgesGeometry(geo, 28), lm);
        icon.scale.setScalar(w * 0.6);
        icon.add(lines);
      }
      icon.add(solid);
      const group = new THREE.Group().add(screen, new THREE.Mesh(frameGeo(w, h), em), icon);
      group.position.set(x, y, z);
      group.traverse((o) => void (o.renderOrder = 6));
      this.group.add(group);
      this.items.push({ a, screen, solid, lines, icon, mats, seed: Math.random() * 10 });
    });
    this.refresh();
  }

  /** Vuelve a mirar qué logros hay: los conseguidos, sólidos; los demás, solo aristas. */
  refresh() {
    for (const it of this.items) it.solid.visible = has(it.a.id) || !it.lines;
  }

  /** El marco bajo el rayo (el del puntero), o null. */
  pick(ray: THREE.Raycaster): Achievement | null {
    const hit = ray.intersectObjects(this.items.map((it) => it.screen), false)[0];
    return (hit?.object.userData.a as Achievement) ?? null;
  }

  /** `glitch`: el fallo de la máscara de la escena, a la vez en todos. */
  update(dt: number, reduced: boolean, glitch: number) {
    this.t += dt;
    for (const it of this.items) {
      const got = has(it.a.id);
      // sin conseguir: apagado, latiendo despacio
      const show = got ? 1 : 0.3 + (reduced ? 0 : 0.1 * Math.sin(this.t * 1.3 + it.seed));
      for (const m of it.mats) {
        m.uniforms.uTime.value = reduced ? 0 : this.t + it.seed;
        m.uniforms.uShow.value = show;
        m.uniforms.uGlitch.value = glitch;
      }
      // el icono se mece de lado a lado, despacio
      if (!reduced) it.icon.rotation.y = Math.sin(this.t * 0.35 + it.seed) * 0.6;
    }
  }

  dispose() {
    for (const it of this.items) {
      for (const m of it.mats) m.dispose();
      it.screen.geometry.dispose();
      it.lines?.geometry.dispose();
    }
    // el resto de mallas (marcos, iconos) las desecha la escena al recorrerse
  }
}
