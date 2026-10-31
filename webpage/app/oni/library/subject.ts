import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { clone as cloneSkinned } from 'three/examples/jsm/utils/SkeletonUtils.js';
import type { GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { subjectMaterial } from './subjectMaterial';

/*
 * El sujeto: el androide negro con la máscara oni. El cuerpo lo mueven los clips de Mixamo y,
 * encima de ellos, cada fotograma, los huesos que se tocan aquí: la cabeza y el torso que se
 * giran hacia algo, el brazo derecho que llega con IK a un sitio concreto, el lanzamiento de la
 * carta (que no tiene clip) y la pose congelada del tiempo parado.
 */

export type Clip = 'idle' | 'searching-files-high' | 'reaching-out' | 'taking-item' | 'picking-up-object'
  | 'looking-behind' | 'left-turn' | 'nervously-look-around' | 'rummaging' | 'walking' | (string & {});

const HEIGHT = 1.8, MASK_H = 0.36;

/**
 * Una pose hecha a mano, encima de lo que deje el clip (de pie: idle). Las posiciones van en el
 * espacio del sujeto (m; +z delante, +x su izquierda, y desde el suelo) o, con `face`, en el de la
 * máscara (su unidad: media máscara, unos 18 cm; -z hacia delante, +y arriba).
 * - `turn`: giros del cuerpo en los ejes del propio sujeto, en grados: [adelante, a su izquierda,
 *   inclinarse a su derecha]. De padre a hijo (cadera, columna, cuello, cabeza, hombros): cada uno
 *   arrastra a los de debajo. Es lo que hace que una pose sea de todo el cuerpo.
 * - `bones`: giros locales (grados, XYZ) que se suman al hueso: los dedos.
 * - `hips`: cuánto se desplaza la cadera (el peso a una pierna, arrodillarse).
 * - `ik`: a dónde va cada mano o pie (dos huesos, analítica), con su polo (hacia dónde dobla el codo o
 *   la rodilla) y, en las manos, `aim`: hacia dónde apuntan los dedos.
 */
export interface Pose {
  turn?: Partial<Record<string, [number, number, number]>>;
  bones?: Partial<Record<string, [number, number, number]>>;
  hips?: [number, number, number];
  ik?: Partial<Record<Limb, { at: [number, number, number]; pole: [number, number, number]; face?: boolean; aim?: [number, number, number] }>>;
}
type Limb = 'RightHand' | 'LeftHand' | 'RightFoot' | 'LeftFoot';
const CHAIN: Record<Limb, [string, string, string]> = {
  RightHand: ['RightArm', 'RightForeArm', 'RightHand'],
  LeftHand: ['LeftArm', 'LeftForeArm', 'LeftHand'],
  RightFoot: ['RightUpLeg', 'RightLeg', 'RightFoot'],
  LeftFoot: ['LeftUpLeg', 'LeftLeg', 'LeftFoot'],
};
// ranuras de los ojos de la máscara normalizada a 2 y girada 180° (public/models/oni-mask.eyes.json)
const EYES: { p: [number, number, number]; r: [number, number, number] }[] = [
  { p: [0.232, -0.103, -0.15], r: [0, -0.68, 0.23] },
  { p: [-0.232, -0.103, -0.15], r: [0, 0.68, -0.23] },
];
// el modelo y la máscara se cargan una vez: cada sujeto más (las estatuas del ritual) es un clon
// que comparte geometrías, texturas y clips
const gltfs = new Map<string, Promise<GLTF>>();
const gltf = (url: string) => {
  if (!gltfs.has(url)) gltfs.set(url, new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).loadAsync(url));
  return gltfs.get(url)!;
};
// los clips extra ya clavados en su sitio (ver load)
const pinned = new WeakSet<THREE.AnimationClip>();
// la curva de giro sacada de left-turn: el clip compartido se modifica una sola vez
const curves = new WeakMap<THREE.AnimationClip, { times: ArrayLike<number>; yaw: ArrayLike<number>; total: number }>();

const up = new THREE.Vector3(0, 1, 0);
const _v = new THREE.Vector3(), _w = new THREE.Vector3(), _q = new THREE.Quaternion(), _p = new THREE.Quaternion();

// gira un hueso en el espacio del mundo (q delante de su rotación actual) y lo deja en local
function turnWorld(b: THREE.Object3D, q: THREE.Quaternion) {
  b.getWorldQuaternion(_q);
  b.parent!.getWorldQuaternion(_p);
  b.quaternion.copy(_p.invert().multiply(q).multiply(_q));
  b.updateMatrixWorld(true);
}

// dos huesos (brazo y antebrazo, muslo y pierna) para que el extremo llegue a `goal`, doblando hacia `pole`
function twoBone(u: THREE.Bone, l: THREE.Bone, e: THREE.Bone, goal: THREE.Vector3, pole: THREE.Vector3) {
  const S = u.getWorldPosition(new THREE.Vector3()), E = l.getWorldPosition(new THREE.Vector3()), H = e.getWorldPosition(new THREE.Vector3());
  const a = S.distanceTo(E), c = E.distanceTo(H), toG = goal.clone().sub(S);
  const d = THREE.MathUtils.clamp(toG.length(), Math.abs(a - c) + 1e-3, (a + c) * 0.995), dir = toG.normalize();
  const perp = pole.clone().addScaledVector(dir, -pole.dot(dir)).normalize();
  const cos = (a * a + d * d - c * c) / (2 * a * d), sin = Math.sqrt(Math.max(0, 1 - cos * cos));
  const mid = S.clone().addScaledVector(dir, a * cos).addScaledVector(perp, a * sin);
  turnWorld(u, new THREE.Quaternion().setFromUnitVectors(E.sub(S).normalize(), mid.sub(S).normalize()));
  const E2 = l.getWorldPosition(new THREE.Vector3()), H2 = e.getWorldPosition(new THREE.Vector3());
  turnWorld(l, new THREE.Quaternion().setFromUnitVectors(H2.sub(E2).normalize(), S.addScaledVector(dir, d).sub(E2).normalize()));
}

/**
 * La máscara oni con sus ojos, mirando a +z, en el origen y a su tamaño en la cara. Cada una con su
 * geometría y sus materiales (el glb está en caché: desechar una escena no rompe la de otra).
 */
export async function makeMask() {
  const m = (await gltf('/models/oni-mask.glb')).scene.clone(), box = new THREE.Box3().setFromObject(m), size = box.getSize(new THREE.Vector3());
  const k = 2 / Math.max(size.x, size.y, size.z);
  m.scale.setScalar(k);
  m.position.sub(box.getCenter(new THREE.Vector3()).multiplyScalar(k));
  m.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    if (!mesh.geometry.attributes.normal) mesh.geometry.computeVertexNormals();
    mesh.geometry = mesh.geometry.clone();
    const mat = (mesh.material = (mesh.material as THREE.MeshStandardMaterial).clone());
    mat.roughnessMap = null;
    mat.metalnessMap = null;
    // mate: con brillo, cada luz de la escena le dejaba destellos blancos y el bloom la quemaba
    mat.roughness = 0.65;
    mat.metalness = 0.05;
    mat.userData.env = 0.12;
    mesh.castShadow = true;
  });
  const pivot = new THREE.Group();
  pivot.add(m);
  pivot.rotation.y = Math.PI; // la máscara viene mirando hacia -z
  const eyeMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(6, 0.12, 0.06), toneMapped: false });
  for (const e of EYES) {
    const eye = new THREE.Mesh(new THREE.BoxGeometry(0.21, 0.028, 0.01), eyeMat);
    eye.position.set(...e.p);
    eye.rotation.set(...e.r);
    pivot.add(eye);
  }
  pivot.scale.setScalar(MASK_H / 2);
  return pivot;
}

export class Subject {
  readonly root = new THREE.Group();
  private mixer?: THREE.AnimationMixer;
  private actions = new Map<Clip, THREE.AnimationAction>();
  private current?: THREE.AnimationAction;
  private bones: Record<string, THREE.Bone> = {};
  // lo que es "delante" (+z del modelo) en el espacio de cada hueso que mira
  private fwd = new Map<THREE.Bone, THREE.Vector3>();
  private look = { target: null as THREE.Vector3 | null, amt: 0, speed: 4, on: false };
  private reach = { target: null as THREE.Vector3 | null, cur: new THREE.Vector3(), amt: 0, on: false, glide: false };
  private frozen = false;
  private drift = 0;
  private walk?: { a: THREE.AnimationAction; speed: number };
  private t = 0;
  // el giro de la cadera que traía `left-turn`, sacado del clip: lo hace la raíz, fotograma a fotograma
  private turnCurve: { times: ArrayLike<number>; yaw: ArrayLike<number>; total: number } = { times: [], yaw: [], total: 0 };
  private turning?: { k: number; y0: number } | { from: number; to: number; t0: number; sec: number };
  /** La máscara (con sus ojos), ya cargada: la carta la dibuja a partir de ella. */
  face?: THREE.Group;
  /** Respiración (pecho y cuello) y balanceo de peso (cadera), sobre el clip; 0-1. */
  layers = { breath: 1, sway: 1 };
  /** Desarrollo: el mayor salto por fotograma (giro en rad de cadera y cabeza, posición en m de la cadera) desde la última lectura. */
  jump = { rot: 0, pos: 0 };
  private prev?: { hips: THREE.Quaternion; head: THREE.Quaternion; pos: THREE.Vector3 };
  // la pose hecha a mano y su peso (0-1), y la pose que había debajo para mezclar
  private held?: { p: Pose; k: number | ((bone: string) => number) };
  private under = new Map<THREE.Bone, THREE.Quaternion>();
  private hipsUnder?: THREE.Vector3;
  /** Lo que avanza el clip `walking` en el sitio: así los pies no patinan. */
  static WALK_SPEED = 1.25;

  /** `extra`: otro glb con más clips del mismo esqueleto de Mixamo (los de la cena), que se suman. */
  async load(extra?: string) {
    const g = await gltf('/models/library/bot.glb');
    const more = extra ? (await gltf(extra)).animations : [];
    // los clips de la cena se quedan en su sitio: la cadera no avanza (unos echan a andar, y se
    // meterían en la mesa o en la pared); el clip compartido se modifica una sola vez
    for (const c of more) {
      const hips = c.tracks.find((t) => t.name.endsWith('Hips.position'));
      if (!hips || pinned.has(c)) continue;
      pinned.add(c);
      const v = hips.values;
      for (let i = 0; i < v.length; i += 3) (v[i] = v[0]), (v[i + 2] = v[2]);
    }
    const body = cloneSkinned(g.scene);
    let skinned!: THREE.SkinnedMesh;
    body.traverse((o) => {
      const s = o as THREE.SkinnedMesh;
      if (s.isSkinnedMesh) skinned = s;
      if ((o as THREE.Bone).isBone) this.bones[o.name.replace('mixamorig', '')] = o as THREE.Bone;
    });
    skinned.material = subjectMaterial(skinned);
    skinned.castShadow = true;
    skinned.frustumCulled = false; // la caja de la pose de reposo no sigue a los clips
    body.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(body), k = HEIGHT / (box.max.y - box.min.y);
    body.scale.setScalar(k);
    body.position.y = -box.min.y * k;
    this.root.add(body);
    this.root.updateMatrixWorld(true);

    for (const name of ['Hips', 'Spine2', 'Neck', 'Head']) {
      const b = this.bones[name];
      b.getWorldQuaternion(_q);
      this.fwd.set(b, new THREE.Vector3(0, 0, 1).applyQuaternion(_q.invert()));
    }
    await this.mask();

    this.mixer = new THREE.AnimationMixer(body);
    for (const clip of g.animations.concat(more)) {
      if (clip.name === 'left-turn') this.stripYaw(clip);
      this.actions.set(clip.name as Clip, this.mixer.clipAction(clip));
    }
  }

  // la máscara, colocada sobre la cara en la pose de reposo y luego colgada del hueso de la cabeza
  private async mask() {
    const pivot = await makeMask();
    // la cara: un poco por encima del hueso de la cabeza y delante de la cápsula
    this.bones.Head.getWorldPosition(_v);
    pivot.position.copy(_v).add(new THREE.Vector3(0, 0.11, 0.06));
    this.root.add(pivot);
    this.root.updateMatrixWorld(true);
    this.bones.Head.attach(pivot);
    this.face = pivot;
  }

  /*
   * El giro de `left-turn` va en la cadera: al acabar el clip, el cuerpo queda girado respecto a la
   * raíz y pasar a otro clip lo devuelve de golpe. Así que al cargar se le quita ese giro (el de
   * cada fotograma respecto al primero, alrededor del eje vertical) y se guarda la curva: durante
   * el giro la raíz la sigue, y el clip que viene detrás ya parte de una cadera de frente.
   */
  private stripYaw(clip: THREE.AnimationClip) {
    const done = curves.get(clip);
    if (done) return void (this.turnCurve = done);
    const tr = clip.tracks.find((t) => t.name.endsWith('Hips.quaternion'))!;
    const v = tr.values, n = tr.times.length, yaw = new Float32Array(n), q = new THREE.Quaternion(), tw = new THREE.Quaternion();
    const angle = (i: number) => 2 * Math.atan2(v[i * 4 + 1], v[i * 4 + 3]);
    let prev = angle(0), acc = 0;
    for (let i = 0; i < n; i++) {
      // el ángulo de la torsión en y, desenrollado
      let d = angle(i) - prev;
      d -= Math.round(d / (Math.PI * 2)) * Math.PI * 2;
      acc += i ? d : 0;
      prev = angle(i);
      yaw[i] = acc;
      q.fromArray(v, i * 4);
      tw.setFromAxisAngle(up, -acc).multiply(q).toArray(v, i * 4);
    }
    this.turnCurve = { times: tr.times, yaw, total: acc };
    curves.set(clip, this.turnCurve);
  }

  private yawAt(time: number) {
    const { times, yaw } = this.turnCurve;
    let i = 1;
    while (i < times.length - 1 && times[i] < time) i++;
    const k = THREE.MathUtils.clamp((time - times[i - 1]) / (times[i] - times[i - 1]), 0, 1);
    return THREE.MathUtils.lerp(yaw[i - 1], yaw[i], k);
  }

  /**
   * Girarse `yaw` rad (por defecto, lo que gira el clip) en `sec` s. Hacia el lado del clip lo hace
   * con `left-turn` (pies incluidos); hacia el otro, en el sitio, con la raíz. Acaba en idle.
   */
  async turn(yaw = this.turnCurve.total, sec = 1) {
    const r = this.root;
    if (Math.sign(yaw) === Math.sign(this.turnCurve.total)) {
      const a = this.actions.get('left-turn')!;
      this.turning = { k: yaw / this.turnCurve.total, y0: r.rotation.y };
      await this.to('left-turn', { loop: false, fade: 0.25, speed: a.getClip().duration / sec });
    } else {
      this.to('idle', { fade: 0.3 });
      this.turning = { from: r.rotation.y, to: r.rotation.y + yaw, t0: this.t, sec };
      await new Promise<void>((res) => {
        const check = () => (this.turning ? requestAnimationFrame(check) : res());
        check();
      });
    }
    this.turning = undefined;
    this.to('idle', { fade: 0.45 });
  }

  /** Ponerlo en otro sitio de golpe (solo en un corte de cámara, donde no se ve). */
  place(p: THREE.Vector3, yaw: number) {
    this.root.position.copy(p);
    this.root.rotation.y = yaw;
    this.turning = undefined;
    // en el corte tampoco arrastra la mirada ni el brazo de antes
    this.look.amt = this.reach.amt = 0;
    this.look.on = this.reach.on = false;
    this.prev = undefined;
  }

  /** Girar la raíz `yaw` rad en `sec` s, suave, sin tocar el clip que suena (p. ej. al echar a andar). */
  steer(yaw: number, sec: number) {
    const y = this.root.rotation.y;
    this.turning = { from: y, to: y + yaw, t0: this.t, sec };
  }

  /**
   * Pasa a `clip` siempre con un fundido cruzado (nunca menos de 0,2 s: un corte es un salto). Con
   * `sync`, el nuevo empieza en la misma fase que el anterior (caminar e idle no tropiezan). Si ya
   * está sonando y es en bucle, solo cambia la velocidad. Sin bucle, resuelve al acabar.
   */
  to(clip: Clip, o: { fade?: number; loop?: boolean; speed?: number; sync?: boolean; cut?: boolean } = {}) {
    const a = this.actions.get(clip)!, loop = o.loop ?? true, prev = this.current;
    if (prev === a && loop) {
      a.timeScale = o.speed ?? 1;
      return Promise.resolve();
    }
    a.reset();
    a.setLoop(loop ? THREE.LoopRepeat : THREE.LoopOnce, Infinity);
    a.clampWhenFinished = !loop;
    a.timeScale = o.speed ?? 1;
    if (o.sync && prev) a.time = (prev.time / prev.getClip().duration) * a.getClip().duration;
    // con `cut` (solo en un corte de cámara) no hay nada que fundir: empieza ya en su pose
    if (o.cut) this.mixer!.stopAllAction();
    else if (prev && prev !== a) a.crossFadeFrom(prev, Math.max(0.2, o.fade ?? 0.3), false);
    a.play();
    this.current = a;
    if (clip === 'walking') this.walk = { a, speed: o.speed ?? 1 };
    if (loop) return Promise.resolve();
    return new Promise<void>((res) => {
      const done = (e: { action: THREE.AnimationAction }) => {
        if (e.action !== a) return;
        this.mixer!.removeEventListener('finished', done);
        res();
      };
      this.mixer!.addEventListener('finished', done);
    });
  }

  /** Cabeza y torso hacia `target` (null suelta). Con `snap`, el último tramo es un tirón seco. */
  lookAt(target: THREE.Vector3 | null, o: { snap?: boolean } = {}) {
    this.look.target = target ? target.clone() : this.look.target;
    this.look.speed = o.snap ? 14 : 4;
    this.look.on = !!target;
  }

  /** El brazo derecho hacia `target` con IK (null suelta). */
  /** La mano derecha a `target` (null: la suelta). Con `glide`, de un objetivo al siguiente se desliza en vez de saltar. */
  reachTo(target: THREE.Vector3 | null, glide = false) {
    if (target) this.reach.target = target.clone();
    this.reach.on = !!target;
    this.reach.glide = glide;
  }

  /** El lanzamiento de la carta: brazo atrás, latigazo de muñeca y seguimiento. */
  /**
   * Saca la carta y la lanza a `target` como un tahúr. La mano va al pecho (0,25 s) y la carta
   * aparece entre el índice y el corazón, pegada a la mano; el brazo se recoge y suelta un latigazo
   * seco de muñeca y antebrazo, y a los 0,15 s del latigazo la suelta (`onRelease`, con la carta ya
   * en el mundo). Luego el brazo acompaña y vuelve.
   */
  async drawAndThrow(card: THREE.Object3D, target: THREE.Vector3, onRelease: (from: THREE.Vector3, dir: THREE.Vector3) => void) {
    this.lookAt(target, { snap: true });
    const b = this.bones, home = card.parent!, sh = new THREE.Vector3();
    const at = (side: number, upw: number, fwd: number) => {
      b.RightArm.getWorldPosition(sh);
      const f = _w.copy(target).sub(sh).setY(0).normalize();
      const r = new THREE.Vector3().crossVectors(f, up);
      return sh.clone().addScaledVector(r, side).addScaledVector(up, upw).addScaledVector(f, fwd);
    };
    const go = (to: THREE.Vector3, s: number) =>
      new Promise<void>((res) => {
        const from = (this.reach.target ?? to).clone(), t0 = this.t;
        this.reachTo(from);
        const step = () => {
          const k = Math.min(1, (this.t - t0) / s);
          this.reach.target!.lerpVectors(from, to, k * k * (3 - 2 * k));
          if (k < 1) requestAnimationFrame(step);
          else res();
        };
        step();
      });
    // la mano al pecho, cruzada: ahí sale la carta
    await go(at(-0.25, 0.05, 0.15), 0.25);
    this.root.updateMatrixWorld(true);
    const i = b.RightHandIndex1.getWorldPosition(new THREE.Vector3()), m = b.RightHandMiddle1.getWorldPosition(new THREE.Vector3());
    const wrist = b.RightHand.getWorldPosition(new THREE.Vector3()), mid = i.clone().add(m).multiplyScalar(0.5);
    // entre los dos dedos, asomando por delante de la mano y enseñada a la cámara, como un tahúr
    card.position.copy(mid).addScaledVector(mid.clone().sub(wrist).normalize(), 0.03);
    card.lookAt(target);
    card.visible = true;
    b.RightHand.attach(card);
    // se recoge hacia atrás y suelta el latigazo
    await go(at(-0.34, 0.14, 0.08), 0.14);
    await go(at(0.15, 0.08, 0.55), 0.15);
    home.attach(card);
    onRelease(card.position.clone(), target.clone().sub(card.position).normalize());
    await go(at(0.35, -0.2, 0.4), 0.3);
    this.reachTo(null);
  }

  /** Congela la pose; `drift` es un avance lentísimo (m/s) en la dirección en que mira. */
  freeze(on: boolean, drift = 0) {
    this.frozen = on;
    this.drift = drift;
  }

  /** Si existe, el clip no corre: va y vuelve entre `from` y `to` (s) cada `period` s. */
  scrub: { from: number; to: number; period: number; phase: number; at?: number } | null = null;

  /** Lo que dura un clip (s), y los que hay. */
  duration(clip: Clip) {
    return this.actions.get(clip)?.getClip().duration ?? 0;
  }
  clips() {
    return [...this.actions.keys()];
  }

  /** Si existe, el sujeto entero (clip, raíz y capas) solo se pone al día cuando devuelve true. */
  stepped: ((t: number) => boolean) | null = null;
  private owed = 0;

  update(dt: number) {
    this.t += dt;
    if (!this.mixer) return;
    // a saltos: el tiempo se acumula y se aplica de golpe en el fotograma que toca
    this.owed += dt;
    if (this.stepped && !this.stepped(this.t)) return;
    dt = this.owed;
    this.owed = 0;
    const r = this.root;
    // lo que la pose cambió el fotograma anterior vuelve a como lo dejó el clip: los huesos que el
    // clip no anima (sus pistas constantes no se exportan) no se resetean solos, y la pose se sumaba
    for (const [bone, q] of this.under) bone.quaternion.copy(q);
    if (this.hipsUnder) this.bones.Hips.position.copy(this.hipsUnder);
    if (this.frozen) {
      r.translateZ(this.drift * dt);
    } else if (this.scrub && this.current) {
      // un trozo del clip, de ida y vuelta, frenando en los extremos (la cámara lenta de la cena)
      // `at` (0-1) lo fija en un punto: para revisar a mano cada extremo del trozo
      const s = this.scrub, k = s.at ?? 0.5 - 0.5 * Math.cos(((this.t + s.phase) / s.period) * Math.PI * 2);
      this.current.time = s.from + (s.to - s.from) * k;
      this.mixer.update(0);
    } else {
      this.mixer.update(dt);
      // el avance sigue al peso del clip de caminar: entra y sale con su fundido, sin patinar
      const w = this.walk;
      if (w) {
        const k = w.a.getEffectiveWeight();
        if (k > 0.001) r.translateZ(Subject.WALK_SPEED * w.speed * k * dt);
        else if (this.current !== w.a) this.walk = undefined;
      }
      const tn = this.turning;
      if (tn && 'k' in tn) r.rotation.y = tn.y0 + tn.k * this.yawAt(this.actions.get('left-turn')!.time);
      else if (tn) {
        const k = Math.min(1, (this.t - tn.t0) / tn.sec);
        r.rotation.y = THREE.MathUtils.lerp(tn.from, tn.to, k * k * k * (k * (6 * k - 15) + 10));
        if (k >= 1) this.turning = undefined;
      }
    }
    r.updateMatrixWorld(true);
    this.applyPose();
    this.applyLayers();
    this.applyLook(dt);
    this.applyReach(dt);
    // en el tiempo parado, la cabeza tiembla un poco, como un motor que no se apaga
    if (process.env.NODE_ENV === 'development') this.measure();
    if (this.frozen) {
      const h = this.bones.Head;
      h.rotation.x += Math.sin(this.t * 41) * 0.004 + (Math.random() - 0.5) * 0.003;
      h.rotation.y += Math.sin(this.t * 29) * 0.003;
      h.updateMatrixWorld(true);
    }
  }

  // vivo aunque el clip esté quieto: el pecho respira y el peso pasa de un pie a otro, despacio
  private applyLayers() {
    if (this.frozen) return;
    const { breath, sway } = this.layers, b = this.bones, t = this.t;
    if (breath) {
      const k = Math.sin(t * 1.6) * 0.012 * breath;
      b.Spine2.rotateX(-k);
      b.Neck.rotateX(k * 0.6);
    }
    if (sway) b.Hips.rotateZ(Math.sin(t * 0.55) * 0.012 * sway);
    if (breath || sway) this.root.updateMatrixWorld(true);
  }

  /**
   * Una pose a mano encima del clip, con peso `k` (0-1, animable para entrar en ella); null la quita.
   * `k` puede ser un peso por hueso (por nombre, sin mixamorig): cada parte entra a su ritmo.
   */
  pose(p: Pose | null, k: number | ((bone: string) => number) = 1) {
    this.held = p ? { p, k } : undefined;
  }

  /** Un hueso por nombre (sin mixamorig): para medir poses. */
  bone(name: string) {
    return this.bones[name];
  }

  private applyPose() {
    const h = this.held;
    if (!h || (typeof h.k === 'number' && h.k <= 0)) return;
    const { p } = h, b = this.bones, m = this.root.matrixWorld;
    const k = typeof h.k === 'number' ? () => h.k as number : h.k;
    // lo que dejó el clip, para mezclar al final
    this.under.clear();
    const keep = (bone: THREE.Bone) => !this.under.has(bone) && this.under.set(bone, bone.quaternion.clone());
    const hipsAt = (this.hipsUnder = b.Hips.position.clone());
    if (p.hips) {
      const w = b.Hips.getWorldPosition(new THREE.Vector3()).add(new THREE.Vector3(...p.hips).applyMatrix3(new THREE.Matrix3().setFromMatrix4(m)));
      b.Hips.position.copy(b.Hips.parent!.worldToLocal(w));
    }
    this.root.updateMatrixWorld(true);
    // los giros del cuerpo, en los ejes del sujeto: q del mundo = raíz · q · raíz⁻¹
    const rq = this.root.getWorldQuaternion(new THREE.Quaternion());
    for (const [name, e] of Object.entries(p.turn ?? {})) {
      const bone = b[name];
      if (!bone || !e) continue;
      keep(bone);
      const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(...(e.map(THREE.MathUtils.degToRad) as [number, number, number]), 'YXZ'));
      turnWorld(bone, rq.clone().multiply(q).multiply(rq.clone().invert()));
    }
    for (const [name, e] of Object.entries(p.bones ?? {})) {
      const bone = b[name];
      if (!bone || !e) continue;
      keep(bone);
      bone.quaternion.multiply(_q.setFromEuler(new THREE.Euler(...e.map(THREE.MathUtils.degToRad) as [number, number, number])));
    }
    this.root.updateMatrixWorld(true);
    const face = this.face!.matrixWorld;
    for (const [limb, t] of Object.entries(p.ik ?? {}) as [Limb, NonNullable<Pose['ik']>[Limb]][]) {
      if (!t) continue;
      const [u, l, e] = CHAIN[limb].map((n) => b[n]);
      keep(u), keep(l), keep(e);
      const goal = new THREE.Vector3(...t.at).applyMatrix4(t.face ? face : m);
      const pole = new THREE.Vector3(...t.pole).transformDirection(m);
      twoBone(u, l, e, goal, pole);
      if (t.aim) {
        // los dedos (de la muñeca a la base del índice) hacia `aim`
        const tip = b[limb === 'RightHand' ? 'RightHandIndex1' : 'LeftHandIndex1'];
        const from = tip.getWorldPosition(new THREE.Vector3()).sub(e.getWorldPosition(new THREE.Vector3())).normalize();
        turnWorld(e, new THREE.Quaternion().setFromUnitVectors(from, new THREE.Vector3(...t.aim).transformDirection(m)));
      }
    }
    for (const [bone, q] of this.under) {
      const w = k(bone.name.replace('mixamorig', ''));
      if (w < 1) bone.quaternion.slerpQuaternions(q, bone.quaternion.clone(), w);
    }
    const wh = k('Hips');
    if (wh < 1) b.Hips.position.lerpVectors(hipsAt, b.Hips.position.clone(), wh);
    this.root.updateMatrixWorld(true);
  }

  takeJump() {
    const j = { rot: +this.jump.rot.toFixed(3), pos: +this.jump.pos.toFixed(3) };
    this.jump = { rot: 0, pos: 0 };
    return j;
  }

  private measure() {
    const b = this.bones, now = { hips: b.Hips.getWorldQuaternion(new THREE.Quaternion()), head: b.Head.getWorldQuaternion(new THREE.Quaternion()), pos: b.Hips.getWorldPosition(new THREE.Vector3()) };
    const p = this.prev;
    if (p) {
      this.jump.rot = Math.max(this.jump.rot, p.hips.angleTo(now.hips), p.head.angleTo(now.head));
      this.jump.pos = Math.max(this.jump.pos, p.pos.distanceTo(now.pos));
    }
    this.prev = now;
  }

  // cabeza, cuello y pecho se reparten el giro; el total no pasa de lo humano (±80°)
  private applyLook(dt: number) {
    const l = this.look;
    const want = l.on ? 1 : 0;
    l.amt += (want - l.amt) * Math.min(1, dt * l.speed);
    if (!l.target || l.amt < 0.001) return;
    for (const [name, share] of [['Spine2', 0.3], ['Neck', 0.3], ['Head', 1]] as const) {
      const b = this.bones[name];
      b.getWorldQuaternion(_q);
      const f = _v.copy(this.fwd.get(b)!).applyQuaternion(_q).normalize();
      const to = b.getWorldPosition(_w).sub(l.target).negate().normalize();
      const ang = Math.min(f.angleTo(to), THREE.MathUtils.degToRad(80));
      const axis = new THREE.Vector3().crossVectors(f, to);
      if (axis.lengthSq() < 1e-8) continue;
      turnWorld(b, new THREE.Quaternion().setFromAxisAngle(axis.normalize(), ang * share * l.amt));
    }
  }

  // IK por CCD de dos huesos (brazo y antebrazo), unas pocas pasadas: llega la muñeca al objetivo
  /*
   * El brazo a por algo: IK de dos huesos, exacta. El hombro, el codo y la mano forman un
   * triángulo de lados fijos (brazo y antebrazo); el codo cae en el plano que marca un polo hacia
   * abajo, hacia fuera (su derecha) y un poco atrás, como un brazo de verdad. Antes era un CCD
   * libre: el codo se doblaba al revés o se metía en la estantería.
   */
  private applyReach(dt: number) {
    const rc = this.reach;
    rc.amt += ((rc.on ? 1 : 0) - rc.amt) * Math.min(1, dt * 6);
    if (!rc.target || rc.amt < 0.001) return;
    // al empezar, desde el objetivo; luego, si se desliza, lo sigue sin teletransportar la mano
    if (rc.amt < 0.02 || !rc.glide) rc.cur.copy(rc.target);
    else rc.cur.lerp(rc.target, 1 - Math.exp(-dt * 6));
    const arm = this.bones.RightArm, fore = this.bones.RightForeArm, hand = this.bones.RightHand;
    const S = arm.getWorldPosition(new THREE.Vector3()), E = fore.getWorldPosition(new THREE.Vector3()), H = hand.getWorldPosition(new THREE.Vector3());
    const a = S.distanceTo(E), c = E.distanceTo(H);
    const toG = H.clone().lerp(rc.cur, rc.amt).sub(S);
    // nunca del todo estirado: un brazo recto como un palo es lo que delata la IK
    const d = THREE.MathUtils.clamp(toG.length(), Math.abs(a - c) + 1e-3, (a + c) * 0.93), dir = toG.normalize();
    // el polo del codo, en los ejes del cuerpo (mira hacia +z: su derecha es -x)
    const pole = new THREE.Vector3(0, -1, 0)
      .addScaledVector(new THREE.Vector3(-1, 0, 0).transformDirection(this.root.matrixWorld), 0.6)
      .addScaledVector(new THREE.Vector3(0, 0, -1).transformDirection(this.root.matrixWorld), 0.3);
    const perp = pole.addScaledVector(dir, -pole.dot(dir)).normalize();
    const cos = (a * a + d * d - c * c) / (2 * a * d), sin = Math.sqrt(Math.max(0, 1 - cos * cos));
    const elbow = S.clone().addScaledVector(dir, a * cos).addScaledVector(perp, a * sin);
    turnWorld(arm, new THREE.Quaternion().setFromUnitVectors(E.sub(S).normalize(), elbow.sub(S).normalize()));
    const E2 = fore.getWorldPosition(new THREE.Vector3()), H2 = hand.getWorldPosition(new THREE.Vector3());
    const goal = S.clone().addScaledVector(dir, d);
    turnWorld(fore, new THREE.Quaternion().setFromUnitVectors(H2.sub(E2).normalize(), goal.sub(E2).normalize()));
  }

  dispose() {
    this.mixer?.stopAllAction();
    this.root.traverse((o) => {
      const m = o as THREE.Mesh;
      m.geometry?.dispose();
      for (const mat of ([] as THREE.Material[]).concat(m.material ?? [])) mat.dispose();
    });
  }
}
