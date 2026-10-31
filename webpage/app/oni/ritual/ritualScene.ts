import * as THREE from 'three';
import { disposeDeep } from '../dispose';
import { governor, shadowType } from '../quality';
import { compileGently } from '../compile';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { SMAAPass } from 'three/examples/jsm/postprocessing/SMAAPass.js';
import type { SocialC } from '../../lib/content-constants';
import { Subject } from '../library/subject';
import { POSES, type PoseName } from './poses';
import { atmosphere } from '../library/atmosphere';
import { makeMist } from './mist';
import { Hologram } from './hologram';
import { slots } from './socials';
import { shape, shotAt, stationShot, type Stage } from './stations';
import { makePentagram } from './pentagram';
import { CameraRig } from '../library/shots';
import { makeFx } from './fx';
import { makeHall } from './hall';

/*
 * El ritual: después de la biblioteca, a oscuras. La sombra nos manda callar; cuatro estatuas suyas
 * en las puntas de un pentagrama, con las redes sociales como hologramas del oni; una quinta
 * sombra se arrodilla en el centro, el pentagrama se enciende y la máscara cae.
 *
 * Todo lo que se va a ver (figuras, luces, materiales) existe desde load() y se compila ahí: a mitad
 * de escena no se crea nada que obligue a compilar un shader.
 */

/** La orientación de la máscara y de la cámara en el último fotograma del ritual. */
export interface ExitPose { mask: THREE.Quaternion; camera: THREE.Quaternion }

/** Radio de las puntas de la estrella (m). */
export const RING_R = 3.2;
/** La pose de cada estatua, de la punta 1 a la 4. */
export const STATUES: PoseName[] = ['mask', 'crossed', 'think', 'point'];
/** Medio lado del cuadrado que forman las estatuas juntas, espalda con espalda (m). */
const SQUARE = 0.75;
/** Dónde va cada holograma respecto a su estatua (m, en su espacio): a ±HOLO_X del eje. */
const HOLO_X = 0.45, HOLO_Y = 1.45, HOLO_Z = 0;
/** Tamaño de los estandartes (en vertical, menos). */
const HOLO_SIZE = 1.1;
/** Lo rápido que sigue la cámara al scroll en cada tramo (0→1, 1→2, 2→3, 3→4, 4→5). */
const RATE = [3.6, 2.4, 4.4, 2.2, 1.7];

export class RitualScene {
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(40, 1, 0.03, 60);
  readonly onFrame = new Set<(dt: number) => void>();
  /** Desarrollo: salta hasta ese momento. */
  skip?: 'statues' | 'top' | 'finale';
  /**
   * Las cinco puntas de la estrella, en el suelo. La 0 es la libre (por ella entra la quinta
   * sombra) y las 1-4 llevan estatua. La estrella está invertida respecto a la entrada: la punta 0
   * queda hacia +z, la de "abajo" vista desde la entrada.
   */
  readonly ring = {
    center: new THREE.Vector3(),
    points: Array.from({ length: 5 }, (_, i) => {
      const a = (i / 5) * Math.PI * 2;
      return new THREE.Vector3(Math.sin(a) * RING_R, 0, Math.cos(a) * RING_R);
    }),
  };
  /** La sombra (la del silencio, que luego vuelve como quinta sombra) y las cuatro estatuas. */
  readonly shadow = new Subject();
  readonly statues = Array.from({ length: 4 }, () => new Subject());
  /** Dos por estatua: el 2i a su derecha y el 2i+1 a su izquierda (redes en el orden del panel). */
  readonly holograms: Hologram[] = [];
  t = 0;
  /** Desarrollo: la cámara la mueve otro (OrbitControls, pruebas). */
  manual = false;
  /** Al asentarse arriba (la cenital) 0,6 s: arranca el final. */
  onSummit?: () => void;
  /** Cada vez que la cámara llega (o pasa) a otra estación: el rótulo de la página cuenta con ella. */
  onStation?: (n: number) => void;
  private station = -1;
  /** El scroll: progreso (0-5), adónde va, y si ya responde (tras el gesto) o ya acabó. */
  p = 0;
  private aim = 0;
  private quiet = 0;
  private ready = false;
  /** Esperando el primer scroll (ya mandó callar y aún no te has movido): el indicador se enciende. */
  get idle() {
    return this.ready && this.p < 0.04 && !this.directing;
  }
  private ended = false;
  private atTop = 0;
  // cuánto lleva la cámara quieta en la estación (el zoom lento)
  private dwell = 0;
  private since = 0;
  // con movimiento reducido: la estación en pantalla y el fundido a negro entre cortes
  private shown = 0;
  private fade = 1;
  private stage!: Stage;
  private holo: (dt: number) => void = () => {};
  private rig: CameraRig;
  private key = new THREE.SpotLight(0xb8c6ea, 60, 18, 0.62, 0.55, 1.2);
  private fill = new THREE.HemisphereLight(0x8090b0, 0x000000, 0.12);
  // la luz de la cámara: fría, blanda y sin sombras; la de arriba deja las estatuas a contraluz y,
  // de frente, sin ella una pose es solo una mancha negra
  private eyeLight = new THREE.SpotLight(0x9fb0d8, 14, 9, 0.35, 0.8, 1.2);
  // el contraluz: detrás de la estatua que se mira, alto, le perfila el contorno contra el cielo
  private rim = new THREE.SpotLight(0xd4def5, 90, 9, 0.55, 0.8, 1.4);
  // el aire: un haz de luz cayendo sobre cada estatua, con polvo que solo se ve dentro, y niebla a ras de suelo
  private air?: ReturnType<typeof atmosphere>;
  // los haces sobre el cuadrado (antes de separarse)
  private airSq?: ReturnType<typeof atmosphere>;
  private fx = makeFx();
  private hall?: Awaited<ReturnType<typeof makeHall>>;
  /** El pentagrama del suelo (se enciende en el final). */
  pentagram!: ReturnType<typeof makePentagram>;
  // la luz roja del pentagrama, en el centro: existe desde la carga (a 0) para no recompilar nada
  private red = new THREE.PointLight(0xff2a1a, 0, 7, 1.6);
  /** Cómo queda el plano al acabar el final (la máscara y la cámara, en el mundo): los créditos lo siguen. */
  exit?: ExitPose;
  /** Desarrollo: las veces que el final ha terminado (debe ser una). */
  done = 0;
  // en el final, la cámara la lleva el guion, no el scroll
  private directing = false;
  /** El cursor en pantalla (-1 a 1); lo pone el componente. Mueve la cámara y los estandartes en las redes. */
  readonly pointer = new THREE.Vector2();
  private pointerNow = new THREE.Vector2();
  // lo rápido que gira la cámara (para los efectos) y su ángulo del fotograma anterior
  private speed = 0;
  private lastAz?: number;
  // cada estatua: en el cuadrado y en su punta del pentagrama
  private spots: { sq: { pos: THREE.Vector3; yaw: number }; star: { pos: THREE.Vector3; yaw: number } }[] = [];
  private mist?: ReturnType<typeof makeMist>;
  private composer?: EffectComposer;
  private canvas?: HTMLCanvasElement;
  private raf = 0;
  // si va lento, baja la resolución (ver quality.ts)
  private govern: (dt: number) => void = () => {};
  private last = 0;
  private disposed = false;
  private frozen = false;

  constructor(readonly opts: { renderer: THREE.WebGLRenderer; socials: SocialC[]; reduced: boolean }) {
    const s = this.scene;
    // el cielo: casi negro, pero un poco más claro que las figuras, para que se recorten contra él
    s.background = sky();
    // el círculo se pierde en la bruma del mismo tono que el horizonte
    s.fog = new THREE.FogExp2(0x16171c, 0.07);
    s.add(this.camera);
    this.rig = new CameraRig(this.camera, { reduced: opts.reduced });
  }

  get renderer() {
    return this.opts.renderer;
  }

  async load() {
    const s = this.scene, { center, points } = this.ring;
    // el suelo: piedra negra pulida a trozos, que recibe las sombras y, más adelante, el pentagrama
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(40, 40).rotateX(-Math.PI / 2), floorMaterial());
    floor.receiveShadow = true;
    s.add(floor);
    this.hall = await makeHall({ radius: RING_R, entrance: points[0] });
    s.add(this.hall.group);
    this.pentagram = makePentagram(points, RING_R);
    s.add(this.pentagram.mesh);
    this.red.position.set(center.x, 0.35, center.z);
    s.add(this.red);
    this.onFrame.add(() => this.pentagram.update(this.t));
    // una sola luz dura y fría, desde arriba, sobre el círculo; nada de luz ambiente plana
    this.key.position.set(0, 9, 1.5);
    this.key.target.position.copy(center);
    this.key.castShadow = true;
    this.key.shadow.mapSize.set(2048, 2048);
    this.key.shadow.bias = -0.0004;
    s.add(this.key, this.key.target, this.fill);
    this.eyeLight.position.set(0.6, 0.5, 0);
    this.eyeLight.target.position.set(0, -0.2, -3);
    this.camera.add(this.eyeLight, this.eyeLight.target);
    s.add(this.rim, this.rim.target);
    this.backlight(0);
    // lo que reflejan las placas: sin esto la laca negra solo devuelve puntitos de luz
    s.environment = studio(this.renderer);

    // las estatuas empiezan juntas en un cuadrado, espalda con espalda, cada una mirando a su
    // esquina; al final se separan hasta su punta del pentagrama (girando lo mínimo)
    this.spots = this.statues.map((_, i) => {
      const a = Math.PI / 4 + (i * Math.PI) / 2, p = points[i + 1];
      return {
        sq: { pos: new THREE.Vector3(Math.sin(a), 0, Math.cos(a)).multiplyScalar(SQUARE * Math.SQRT2).add(center), yaw: a },
        star: { pos: p.clone(), yaw: Math.atan2(p.x - center.x, p.z - center.z) },
      };
    });
    // cada haz baja del cielo, desde detrás de su estatua (del lado del centro), hasta sus pies:
    // un juego para el cuadrado y otro para las puntas, y se cruzan al separarse
    const shafts = (ps: THREE.Vector3[]) =>
      ps.map((p) => {
        const toC = center.clone().sub(p).normalize();
        return { from: p.clone().addScaledVector(toC, 2.6).setY(11), to: p.clone().addScaledVector(toC, -0.3), radius: 0.7 };
      });
    this.airSq = atmosphere(s, {
      shafts: shafts(this.spots.map((x) => x.sq.pos)),
      dustBox: new THREE.Box3(new THREE.Vector3(-2.5, 0.05, -2.5), new THREE.Vector3(2.5, 4.5, 2.5)),
      reduced: this.opts.reduced,
      color: 0xb4c2e4,
      taper: 0.18,
      edge: 3,
      near: 2.4,
    });
    this.air = atmosphere(s, {
      shafts: shafts(points.slice(1)),
      dustBox: new THREE.Box3(new THREE.Vector3(-RING_R - 1.5, 0.05, -RING_R - 1.5), new THREE.Vector3(RING_R + 1.5, 4.5, RING_R + 1.5)),
      reduced: this.opts.reduced,
      color: 0xb4c2e4,
      // de una fuente estrecha en lo alto, abriéndose; blando de lado y sin taparnos de cerca
      taper: 0.18,
      edge: 3,
      near: 2.4,
    });
    this.air.amount = 0;
    this.airSq.amount = 1.5;
    this.mist = makeMist({ radius: RING_R + 6, reduced: this.opts.reduced });
    s.add(this.mist.group);
    this.onFrame.add(() => {
      this.air!.update(this.t, this.renderer.getPixelRatio());
      this.airSq!.update(this.t, this.renderer.getPixelRatio());
      this.mist!.update(this.t);
    });

    await Promise.all([this.shadow, ...this.statues].map((f) => f.load()));
    // las estatuas, en el cuadrado, mirando hacia fuera (la cámara gira por fuera y las ve de frente)
    this.statues.forEach((st, i) => {
      st.pose(POSES[STATUES[i]]);
      this.stand(st, this.spots[i].sq.pos, this.spots[i].sq.yaw);
    });
    // la sombra del silencio, en el centro, mirando hacia la entrada; ella sí está viva: respira y
    // pasa el peso de un pie a otro, despacio
    this.stand(this.shadow, center, Math.atan2(points[0].x, points[0].z));
    this.shadow.layers = { breath: 1, sway: 0.6 };
    for (const f of [this.shadow, ...this.statues]) s.add(f.root);

    // los hologramas: a cada lado de su estatua, flanqueando la cabeza y un poco por detrás (en el
    // plano de busto, por delante se salían del encuadre)
    const nets = slots(this.opts.socials), home = new THREE.Vector3(), right = new THREE.Vector3(), face = new THREE.Vector3();
    const holo = (dt: number) =>
      this.holograms.forEach((h, n) => {
        const st = this.statues[n >> 1].root, m = st.matrixWorld;
        // en vertical no caben a los lados a la altura de la cabeza: uno arriba a un lado y otro
        // abajo al otro, más cerca del eje, con el estandarte más corto
        const tall = this.camera.aspect < 0.8;
        if (tall) home.set(n % 2 ? 0.34 : -0.34, n % 2 ? 1.2 : 1.86, HOLO_Z);
        else home.set((n % 2 ? 1 : -1) * HOLO_X, HOLO_Y, HOLO_Z);
        home.applyMatrix4(m);
        h.flag.scale.y = tall ? 0.5 : 1;
        h.size = tall ? 1 : HOLO_SIZE;
        right.set(1, 0, 0).transformDirection(m);
        h.update(dt, this.t, home, st.rotation.y, right, this.opts.reduced);
      });
    for (const st of this.statues)
      for (let j = 0; j < 2; j++) {
        const h = new Hologram(st.face!, nets[this.holograms.length]);
        // con movimiento reducido ya están; si no, surgen al llegar a su estatua
        if (this.opts.reduced) h.appear(st.face!.getWorldPosition(face), true);
        s.add(h.group);
        this.holograms.push(h);
      }
    holo(0);
    this.holo = holo;

    // dónde queda su máscara al mandar callar (el primer plano la encuadra ya en el gesto)
    this.shadow.pose(POSES.silence);
    this.shadow.update(1 / 60);
    this.shadow.face!.getWorldPosition(face);
    this.shadow.pose(POSES.silence, 0);
    this.stage = {
      center,
      silence: { yaw: this.shadow.root.rotation.y, face: face.clone() },
      statues: this.statues.map((st) => ({ pos: st.root.position.clone(), yaw: st.root.rotation.y })),
      radius: RING_R,
      aspect: 1,
    };
    this.onFrame.add(this.walk);

    // compilar ya, con las sombras puestas y exactamente en las variantes que se van a usar: la
    // escena, poco a poco (ver compileGently; mientras, la biblioteca sigue pintando), y luego el
    // compositor entero (bloom, SMAA, efectos) y las sombras, pintando un fotograma invisible de 64×64
    // en su propio destino; el último paso, que sí pinta en pantalla, aparte. Sin esto el primer
    // fotograma lo compila todo de golpe: en Firefox, que no compila en paralelo, la página se cuelga
    const r = this.renderer, hidden: THREE.Object3D[] = [];
    r.shadowMap.enabled = true;
    r.shadowMap.type = shadowType(r);
    await compileGently(r, s, this.camera);
    const before = r.getRenderTarget(), tm = r.toneMapping, te = r.toneMappingExposure;
    r.toneMapping = THREE.ACESFilmicToneMapping;
    r.toneMappingExposure = 1;
    s.traverse((o) => !o.visible && hidden.push(o));
    for (const o of hidden) o.visible = true;
    const c = (this.composer = new EffectComposer(r));
    c.addPass(new RenderPass(this.scene, this.camera));
    c.addPass(new UnrealBloomPass(new THREE.Vector2(1, 1), 0.45, 0.35, 0.9));
    c.addPass(new OutputPass());
    c.addPass(new SMAAPass(1, 1));
    c.addPass(this.fx);
    c.renderToScreen = false;
    c.setSize(64, 64);
    c.render(0);
    r.setRenderTarget(null);
    const quad = new THREE.Scene().add(new THREE.Mesh(new THREE.PlaneGeometry(1, 1), this.fx.material));
    r.compile(quad, this.camera);
    (quad.children[0] as THREE.Mesh).geometry.dispose();
    r.setRenderTarget(before);
    r.toneMapping = tm;
    r.toneMappingExposure = te;
    for (const o of hidden) o.visible = false;
  }

  /** El contraluz, detrás de la estatua `i` (0-3), donde esté: hacia el centro, alto, apuntando a su torso. */
  backlight(i: number) {
    const p = this.statues[i].root.position, toC = this.ring.center.clone().sub(p).normalize();
    this.rim.position.copy(p).addScaledVector(toC, 1.6).setY(3.6);
    this.rim.target.position.copy(p).setY(1.5);
    this.rim.target.updateMatrixWorld();
  }

  // de pie y quieto: el primer fotograma de idle, sin respirar (una estatua no respira)
  private stand(f: Subject, p: THREE.Vector3, yaw: number) {
    f.place(p, yaw);
    f.layers = { breath: 0, sway: 0 };
    f.to('idle', { cut: true });
    f.update(1 / 60);
  }

  /** Scroll, en estaciones (positivo hacia delante). Un gesto mueve como mucho una estación. */
  push(d: number) {
    if (!this.ready || this.ended) return;
    const near = Math.round(this.p);
    this.aim = THREE.MathUtils.clamp(this.aim + d, Math.max(0, near - 1), Math.min(5, near + 1));
    this.quiet = 0;
  }

  /** Ir a una estación (la lista de redes con el teclado). */
  goTo(n: number) {
    if (!this.ready || this.ended) return;
    this.aim = n;
    this.quiet = 1;
  }

  /**
   * El final, una vez, con el reloj de la escena (con la pestaña oculta se para): la quinta sombra
   * entra caminando desde la oscuridad hasta el centro, se arrodilla, el pentagrama se enciende,
   * los hologramas se apagan y la máscara cae; en el primer golpe contra el suelo, negro.
   */
  async finale() {
    this.directing = true;
    const sh = this.shadow, st = this.stage, { center, points } = this.ring, cam = this.camera, o = this.opts;
    const during = (sec: number, fn: (k: number, dt: number) => void) =>
      new Promise<void>((res) => {
        let t = 0;
        const f = (dt: number) => {
          t += dt;
          const k = Math.min(1, t / sec);
          fn(k, dt);
          if (k >= 1) this.onFrame.delete(f), res();
        };
        this.onFrame.add(f);
      });
    const until = (ok: (dt: number) => boolean) =>
      new Promise<void>((res) => {
        const f = (dt: number) => ok(dt) && (this.onFrame.delete(f), res());
        this.onFrame.add(f);
      });
    const V = () => new THREE.Vector3();
    const top = () => this.rig.cut(stationShot(5, { ...st, aspect: cam.aspect }));
    // a su lado: a 1,6 m a su derecha (su derecha es -x), mirándole el pecho
    const beside = (h: number, d = 1.6) => {
      const p = sh.root.position, r = V().set(-1, 0, 0).applyQuaternion(sh.root.quaternion);
      this.rig.cut({ pos: p.clone().addScaledVector(r, d).setY(h), look: p.clone().setY(h * 0.85 + 0.1), fov: 42, breathe: 0.002 });
    };
    // la máscara: del primer plano bajo, cerca del suelo
    const low = (at: THREE.Vector3) => {
      const away = V().set(-1, 0, 0.6).normalize().applyQuaternion(sh.root.quaternion);
      this.rig.cut({ pos: at.clone().addScaledVector(away, 1).setY(0.3), look: at.clone().setY(0.06), fov: 38 });
    };
    // boca arriba: la cara de la máscara (su +z) mirando al cielo
    const faceUp = (q: THREE.Quaternion) => {
      const fwd = V().set(0, 0, 1).applyQuaternion(q);
      return new THREE.Quaternion().setFromUnitVectors(fwd, V().set(0, 1, 0)).multiply(q);
    };
    const lightUp = (k: number) => {
      this.pentagram.set(k);
      this.red.intensity = 3 * k;
      for (const h of this.holograms) h.power = 1 - k;
    };
    // en el primer golpe acaba: la escena se queda en ese fotograma y los créditos toman el lienzo
    const end = () => {
      this.exit = { mask: sh.face!.getWorldQuaternion(new THREE.Quaternion()), camera: this.camera.quaternion.clone() };
      // deja de pintar: el lienzo se queda con este fotograma hasta que los créditos lo toman
      cancelAnimationFrame(this.raf);
      this.frozen = true;
      this.done++;
    };

    if (o.reduced) {
      // sin movimiento: ya arrodillado en el centro, con el pentagrama encendido; luego la máscara en el suelo
      sh.place(center, Math.atan2(points[0].x, points[0].z));
      sh.pose(POSES.kneel);
      sh.to('idle', { cut: true });
      sh.root.visible = true;
      sh.update(1 / 60);
      lightUp(1);
      beside(0.8);
      await during(1.2, () => {});
      const face = sh.face!;
      this.scene.attach(face);
      face.position.copy(sh.root.position).addScaledVector(V().set(0, 0, 1).applyQuaternion(sh.root.quaternion), 0.4).setY(0.06);
      face.quaternion.copy(faceUp(face.quaternion));
      low(face.position);
      await during(1.2, () => {});
      return end();
    }

    // 1. desde la cenital: aparece más allá de la punta libre y camina hacia el centro
    const dir = points[0].clone().sub(center).normalize();
    sh.pose(null);
    sh.layers = { breath: 0.6, sway: 0 };
    sh.place(center.clone().addScaledVector(dir, 5.6), Math.atan2(-dir.x, -dir.z));
    sh.to('walking', { cut: true });
    sh.root.visible = true;
    top();
    await during(1.8, () => {});
    // 2. corte a su lado; al pasar entre las estatuas de las puntas 1 y 4, sus hologramas parpadean
    const follow = { h: 1.25 };
    const track = () => beside(follow.h);
    this.onFrame.add(track);
    for (const i of [0, 3]) {
      const ps = this.statues[i].root.position;
      until(() => sh.root.position.distanceTo(ps) < 2.4).then(() => {
        this.holograms[i * 2].blinkAt = this.holograms[i * 2 + 1].blinkAt = this.t;
      });
    }
    await until(() => sh.root.position.distanceTo(center) < 0.45);
    // 3. frena y se arrodilla: baja deprisa y se asienta; la cámara baja con él
    sh.to('idle', { fade: 0.3 });
    await during(0.3, () => {});
    await during(1.1, (k) => {
      const e = 1 - Math.pow(1 - k, 3);
      sh.pose(POSES.kneel, e);
      follow.h = 1.25 - 0.45 * e;
    });
    await during(0.4, () => {});
    this.onFrame.delete(track);
    // 4. corte a la cenital: se enciende el pentagrama y se apagan los hologramas
    top();
    await during(2.3, (k) => lightUp(k));
    // 5. la cabeza baja un poco más y la máscara se suelta
    await during(0.3, (k) => {
      const e = k * k * (3 - 2 * k);
      sh.pose({ ...POSES.kneel, turn: { ...POSES.kneel.turn, Neck: [12 + 8 * e, 0, 0], Head: [22 + 14 * e, 0, 0] } });
    });
    const face = sh.face!;
    this.scene.attach(face);
    // cae de lado: sale hacia delante y hacia su izquierda, y acaba boca arriba pero ladeada
    const fwd = V().set(0, 0, 1).applyQuaternion(sh.root.quaternion), lft = V().set(1, 0, 0).applyQuaternion(sh.root.quaternion);
    const q0 = face.quaternion.clone(), q1 = new THREE.Quaternion().setFromAxisAngle(fwd, -0.5).multiply(faceUp(q0));
    const v = V().set(0, 0.4, 0).addScaledVector(fwd, 0.3).addScaledVector(lft, 0.28);
    // la cámara cae con ella, mirándola en horizontal: a 1,1 m, del lado hacia el que cae (y algo
    // por delante, para verle la cara), a su altura
    const side = lft.clone().multiplyScalar(0.8).addScaledVector(fwd, 0.6).normalize();
    const watch = () =>
      this.rig.cut({ pos: face.position.clone().addScaledVector(side, 1.1).setY(face.position.y + 0.05), look: face.position.clone().setY(face.position.y + 0.05), fov: 38 });
    watch();
    // cae con gravedad, a cámara lenta (el 40 % del tiempo real), girando hacia boca arriba y
    // ladeándose. No se para en el suelo: lo atraviesa, y la cámara detrás de ella; el final acaba
    // justo cuando la cámara cruza el suelo (al otro lado, el agua: los créditos siguen el plano)
    let t = 0;
    const fall = (real: number) => {
      const dt = real * 0.4;
      t += dt;
      v.y -= 9.8 * dt;
      face.position.addScaledVector(v, dt);
      const k = Math.min(1, t / 0.42);
      face.quaternion.slerpQuaternions(q0, q1, k * k * (3 - 2 * k));
      watch();
      // los últimos centímetros antes del suelo, la imagen se funde al agua de los créditos
      this.fx.uniforms.uSink.value = THREE.MathUtils.smoothstep(0.45 - this.camera.position.y, 0, 0.43);
    };
    this.onFrame.add(fall);
    await until(() => this.camera.position.y <= 0.02);
    this.onFrame.delete(fall);
    end();
  }

  /** El holograma activo bajo el puntero (coordenadas de -1 a 1), o null. */
  pick(ndc: THREE.Vector2) {
    const on = this.holograms.filter((h) => h.active);
    if (!on.length) return null;
    const ray = new THREE.Raycaster();
    ray.setFromCamera(ndc, this.camera);
    const hit = ray.intersectObjects(on.flatMap((h) => h.hits), true)[0];
    return hit ? on.find((h) => h.hits.some((o) => o === hit.object || o.getObjectById(hit.object.id))) ?? null : null;
  }

  // cada fotograma: la entrada del silencio, el scroll, la cámara y quién responde
  private walk = (dt: number) => {
    const o = this.opts, st = this.stage;
    this.since += dt;
    // la entrada: la luz sube desde negro (0,8 s) y luego él nos manda callar (0,9 s); hasta que
    // acaba el gesto, el scroll no responde
    if (!this.ready) {
      const lit = o.reduced ? 1 : Math.min(1, this.since / 0.8), g = o.reduced ? 9 : this.since - 0.8;
      this.key.intensity = 60 * lit;
      this.shadow.pose(POSES.silence, silenceWeights(g));
      if (g >= 1.5) this.ready = true;
    }
    // el objetivo se asienta en la estación más cercana tras 250 ms sin tocar nada
    if ((this.quiet += dt) > 0.25) this.aim = Math.round(this.aim);
    let c: number;
    if (o.reduced) {
      // cortes con un fundido a negro de 0,25 s, sin giros
      this.p = this.aim;
      const want = Math.round(this.aim);
      if (want !== this.shown) {
        this.fade = Math.max(0, this.fade - dt / 0.125);
        if (this.fade === 0) this.shown = want;
      } else this.fade = Math.min(1, this.fade + dt / 0.125);
      this.renderer.toneMappingExposure = this.fade;
      c = this.shown;
    } else {
      // cada tramo con su ritmo: entrar a la primera estatua, rápido; el giro largo, más pausado;
      // subir a la cenital, lento
      const seg = Math.min(4, Math.floor(Math.min(this.p, this.aim) + 1e-6));
      this.p += (this.aim - this.p) * (1 - Math.exp(-dt * RATE[seg]));
      if (Math.abs(this.aim - this.p) < 1e-4) this.p = this.aim;
      c = shape(this.p);
    }

    // de la última estatua a la cenital, se separan del cuadrado hasta sus puntas, y los haces con ellas
    const out = THREE.MathUtils.clamp((c - 4) / 0.7, 0, 1), e = out * out * (3 - 2 * out);
    this.statues.forEach((x, i) => {
      const { sq, star } = this.spots[i];
      x.root.position.lerpVectors(sq.pos, star.pos, e);
      x.root.rotation.y = THREE.MathUtils.lerp(sq.yaw, star.yaw, e);
      x.root.updateMatrixWorld(true);
    });
    this.airSq!.amount = 1.5 * (1 - e);
    this.air!.amount = 1.5 * e;
    this.holo(dt);

    // la figura del silencio se va al apartarse la cámara (y vuelve en el final)
    if (!this.ended) this.shadow.root.visible = c < 0.5;
    if (this.shadow.root.visible) this.shadow.update(dt);
    // el contraluz va con la estatua que se mira
    const at = Math.round(c);
    if (at !== this.station) this.onStation?.((this.station = at));
    this.rim.intensity = at >= 1 && at <= 4 ? 90 : 0;
    if (at >= 1 && at <= 4) this.backlight(at - 1);

    // los hologramas: surgen al llegar a su estatua; responden solo los de la que se mira, quietos
    const settled = Math.abs(this.p - Math.round(this.p)) < 0.08 && !this.ended;
    const face = new THREE.Vector3();
    this.holograms.forEach((h, n) => {
      const s = (n >> 1) + 1;
      if (Math.abs(c - s) < 0.3) h.appear(this.statues[s - 1].face!.getWorldPosition(face));
      h.active = settled && Math.round(this.p) === s;
      if (!h.active) h.hover = h.pinned = false;
      // el de la estatua que se mira se vuelve hacia el cursor según dónde quede respecto a él
      if (h.active && !o.reduced) {
        const at = h.group.position.clone().project(this.camera);
        // (con el lienzo aún sin tamaño la proyección da NaN, y un NaN se quedaría para siempre)
        const x = (this.pointer.x - at.x) * 1.2;
        h.lean = Number.isFinite(x) ? THREE.MathUtils.clamp(x, -1, 1) : 0;
      } else h.lean = 0;
    });

    // arriba del todo (la cámara ya en la cenital, sin esperar a que el scroll acabe de llegar), 0,6 s: el final, una vez
    if (!this.ended && this.ready && Math.round(this.aim) === 5 && c > 4.999) {
      if ((this.atTop += dt) >= 0.6) {
        this.ended = true;
        this.onSummit?.();
      }
    } else this.atTop = 0;

    this.fx.uniforms.uTime.value = this.t;
    this.fx.uniforms.uSpeed.value = o.reduced ? 0 : this.speed;
    // en las estatuas el fondo cede: niebla más densa, la sala más apagada, la viñeta más cerrada
    const focus = this.directing ? 0 : Math.max(0, 1 - Math.abs(c - THREE.MathUtils.clamp(Math.round(c), 1, 4)) * 2.5);
    (this.scene.fog as THREE.FogExp2).density = 0.07 + 0.11 * focus;
    this.hall?.dim(focus);
    this.fx.uniforms.uFocus.value = focus;
    if (this.manual || this.directing) return;
    st.aspect = this.camera.aspect;
    // quieta en una estación, la cámara se va acercando despacio (y vuelve al arrancar el giro)
    const still = Math.abs(c - Math.round(c)) < 1e-3;
    this.dwell = still ? this.dwell + dt : Math.max(0, this.dwell - dt * 4);
    const shot = shotAt(c, st), z = o.reduced ? 0 : 1 - Math.exp(-this.dwell / 5);
    shot.pos.lerp(shot.look, z * 0.1);
    shot.fov = shot.fov! - z * 2.5;
    // en las estatuas, la cámara sigue un poco al cursor (se desliza de lado y sube o baja)
    this.pointerNow.lerp(this.pointer, 1 - Math.exp(-dt * 3));
    const near = at >= 1 && at <= 4 && !o.reduced ? Math.max(0, 1 - Math.abs(c - at) * 4) : 0;
    if (near > 0) {
      const fwd = shot.look.clone().sub(shot.pos).normalize(), side = fwd.clone().cross(THREE.Object3D.DEFAULT_UP).normalize();
      shot.pos.addScaledVector(side, this.pointerNow.x * 0.16 * near).y += this.pointerNow.y * 0.08 * near;
      shot.look.addScaledVector(side, this.pointerNow.x * 0.05 * near);
    }
    this.rig.cut(shot);
    this.rig.update(dt);
    // la velocidad de giro alrededor del centro (rad/s), suavizada: de ella viven los efectos
    const az = Math.atan2(this.camera.position.x - st.center.x, this.camera.position.z - st.center.z);
    if (this.lastAz !== undefined && dt > 0) {
      let d = az - this.lastAz;
      d -= Math.round(d / (Math.PI * 2)) * Math.PI * 2;
      const w = THREE.MathUtils.clamp(Math.abs(d) / dt / 14, 0, 1);
      this.speed += (w - this.speed) * (1 - Math.exp(-dt * 10));
    }
    this.lastAz = az;
  };

  takeOver(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.govern = governor(this.renderer, () => this.resize());
    const r = this.renderer;
    r.shadowMap.enabled = true;
    r.shadowMap.type = shadowType(r);
    r.toneMapping = THREE.ACESFilmicToneMapping;
    r.toneMappingExposure = 1;
    r.setRenderTarget(null);
    // el compositor ya está montado (y compilado) desde load()
    const c = this.composer!;
    c.renderToScreen = true;
    this.resize();
    // desarrollo: saltar a las estatuas o arriba
    if (this.skip) {
      this.ready = true;
      this.p = this.aim = this.shown = this.skip === 'statues' ? 1 : 5;
      this.key.intensity = 60;
      this.shadow.pose(POSES.silence);
    } else this.key.intensity = 0;
    this.walk(0);
    c.render();
    window.addEventListener('resize', this.resize);
    this.last = performance.now();
    cancelAnimationFrame(this.raf);
    this.raf = requestAnimationFrame(this.frame);
  }

  resize = () => {
    const c = this.canvas;
    if (!c) return;
    const w = c.clientWidth, h = c.clientHeight;
    this.renderer.setSize(w, h, false);
    this.composer?.setPixelRatio(this.renderer.getPixelRatio());
    this.composer?.setSize(w, h);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  };

  private frame = (now: number) => {
    if (this.disposed || this.frozen) return;
    this.raf = requestAnimationFrame(this.frame);
    // con la pestaña oculta no hay fotogramas, y al volver el salto se recorta: el reloj se pausa
    const dt = THREE.MathUtils.clamp((now - this.last) / 1000, 0, 0.1);
    this.last = now;
    this.govern(dt);
    this.t += dt;
    for (const f of this.onFrame) f(dt);
    this.composer!.render();
  };

  /** No desecha el renderer: es prestado (o lo desecha quien lo creó). */
  dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.raf);
    window.removeEventListener('resize', this.resize);
    this.onFrame.clear();
    for (const f of [this.shadow, ...this.statues]) f.dispose();
    for (const h of this.holograms) h.dispose();
    this.air?.dispose();
    this.airSq?.dispose();
    this.hall?.dispose();
    this.pentagram?.dispose();
    this.fx.dispose();
    this.mist?.dispose();
    disposeDeep(this.scene);
    this.scene.environment?.dispose();
    this.composer?.dispose();
  }
}

// losas de piedra negra de 1,2 m, cada una de un tono y un pulido algo distinto, con juntas mates
// y charcos (donde casi es espejo): la luz de arriba deja un brillo roto, no un círculo liso
function floorMaterial() {
  const m = new THREE.MeshStandardMaterial({ color: 0x0e0e10, roughness: 1, metalness: 0, envMapIntensity: 0.12 });
  m.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec2 vFloor;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvFloor = (modelMatrix * vec4(position, 1.0)).xz;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
        varying vec2 vFloor;
        float fh(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
        float fn(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
          return mix(mix(fh(i), fh(i + vec2(1, 0)), f.x), mix(fh(i + vec2(0, 1)), fh(i + vec2(1, 1)), f.x), f.y); }`)
      .replace('#include <color_fragment>', `#include <color_fragment>
        vec2 q = vFloor / 1.2 + vec2(0.5 * step(1.0, mod(floor(vFloor.y / 1.2), 2.0)), 0.0);
        vec2 g = abs(fract(q) - 0.5);
        float seam = smoothstep(0.488, 0.497, max(g.x, g.y));
        float slab = fh(floor(q));
        diffuseColor.rgb *= (0.75 + slab * 0.5) * (1.0 - seam * 0.7);`)
      .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
        float wet = smoothstep(0.55, 0.7, fn(vFloor * 0.7) * 0.7 + fn(vFloor * 2.3) * 0.3);
        roughnessFactor = mix(mix(0.5, 0.8, slab), 0.18, wet);
        roughnessFactor = mix(roughnessFactor, 1.0, seam);`);
  };
  m.customProgramCacheKey = () => 'ritual-floor';
  return m;
}

/*
 * El gesto del silencio por partes, como lo haría alguien: el peso cambia de pierna y el torso se
 * inclina primero; el brazo sube un poco después, se pasa un pelo y vuelve; los dedos se cierran
 * al final, con el índice ya delante de la boca. `g`: segundos desde que empieza el gesto.
 */
const ease = (x: number) => {
  const k = THREE.MathUtils.clamp(x, 0, 1);
  return k * k * k * (k * (6 * k - 15) + 10);
};
// sale de la curva con un 6 % de más y vuelve (el brazo que llega con impulso)
const settle = (x: number) => {
  const k = THREE.MathUtils.clamp(x, 0, 1);
  return ease(k) + Math.sin(Math.PI * Math.min(1, k * 1.25)) * 0.06 * k;
};
function silenceWeights(g: number) {
  const body = ease(g / 0.9), arm = settle((g - 0.2) / 0.95), fingers = ease((g - 0.75) / 0.55), other = ease((g - 0.1) / 1.1);
  return (bone: string) =>
    /^RightHand./.test(bone) ? fingers : /^Right(Shoulder|Arm|ForeArm|Hand)$/.test(bone) ? arm : /^Left(Shoulder|Arm|ForeArm|Hand)/.test(bone) ? other : body;
}

// un estudio a oscuras, como el de una foto de producto: una caja de luz grande y fría encima (la
// del haz que cae sobre cada estatua) y una franja tenue alrededor, algo por encima del horizonte,
// que perfila los costados venga de donde venga la cámara. Todo lo demás, negro.
function studio(r: THREE.WebGLRenderer) {
  const box = new THREE.Scene();
  const lamp = (color: number, k: number) => new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(k), side: THREE.DoubleSide });
  const top = new THREE.Mesh(new THREE.CircleGeometry(2.2, 48).rotateX(Math.PI / 2), lamp(0xc4d0ee, 4));
  top.position.y = 4;
  const band = new THREE.Mesh(new THREE.CylinderGeometry(5, 5, 0.9, 64, 1, true), lamp(0x8e9ab8, 0.7));
  band.position.y = 1.4;
  box.add(top, band);
  const pm = new THREE.PMREMGenerator(r);
  const env = pm.fromScene(box, 0.02).texture;
  pm.dispose();
  box.traverse((o) => {
    const m = o as THREE.Mesh;
    m.geometry?.dispose();
    (m.material as THREE.Material | undefined)?.dispose();
  });
  return env;
}

// el fondo: un degradado vertical de bruma (más claro en el horizonte, más oscuro arriba y en el
// suelo); en el contrapicado es lo que queda detrás de las cabezas
function sky() {
  const c = Object.assign(document.createElement('canvas'), { width: 4, height: 512 }), x = c.getContext('2d')!;
  const g = x.createLinearGradient(0, 0, 0, 512);
  g.addColorStop(0, '#07080a');
  g.addColorStop(0.35, '#121318');
  g.addColorStop(0.5, '#2a2b31');
  g.addColorStop(0.62, '#16171c');
  g.addColorStop(1, '#050505');
  x.fillStyle = g;
  x.fillRect(0, 0, 4, 512);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
