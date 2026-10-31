import * as THREE from 'three';
import { disposeDeep } from '../dispose';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { SMAAPass } from 'three/examples/jsm/postprocessing/SMAAPass.js';
import { governor, shadowType } from '../quality';
import { compileGently } from '../compile';
import { N8AOPass } from 'n8ao';
import { Subject } from '../library/subject';
import { onUnlock, type Achievement } from '../achievements';
import { makeHall, makeLights, chair, glb, BG, TABLE } from './table';
import { SEATS, CENTER, HANDS, STANCES, LIFT, TILT, SEAT_Z, PERIOD, seatX, type Prop, type Seat } from './seats';
import { Frames } from './frames';
import { makeFeast } from './feast';
import { makeBeam, makeDust, makeFinish } from './atmosphere';
import { makeWeather } from './weather';

/*
 * La Última Cena: trece robots con la máscara detrás de la mesa. Doce se pelean a cámara muy lenta;
 * el del centro, sentado, con las manos en la mesa, te mira fijamente. Es en un ático: detrás, el
 * ventanal con la ciudad bajo la lluvia y, en los pilares, los logros en marcos de holograma (el del
 * final, con el oni, flota detrás del centro). Llega con el renderer y el lienzo de los créditos; la
 * cámara arranca pegada a la cara del centro y se aleja.
 */

/*
 * La cámara, baja, a la altura de la mesa: sale de un primer plano de la cara del centro y, según se
 * baja con la rueda, se aleja: primero hasta el plano del cuadro, en el que los de los extremos ya
 * se salen por los lados (FIT: el ancho, en m, que cabe a la altura de la mesa), y luego mucho más
 * atrás (BACK veces esa distancia), hasta ver la sala entera, la mesa pequeña bajo sus focos.
 */
const FROM = new THREE.Vector3(0, 1.12, 0.3), FROM_AT = new THREE.Vector3(0, 1.12, SEAT_Z);
const EYE = 0.98, AT = new THREE.Vector3(0, 1.2, -0.6), FIT = 3.8, BACK = 1.55;
/** Qué parte del recorrido lleva hasta el plano del cuadro; el resto es alejarse más. */
const MID = 0.5;
const ease = (k: number) => k * k * (3 - 2 * k);

// cómo se coge cada arma: tamaño (m de largo) y giro en el hueso de la mano (a ojo, sobre el maniquí)
/*
 * Las armas, en el espacio de su modelo: hacia dónde apunta el cañón, dónde está arriba y por dónde
 * se cogen (la empuñadura, en fracciones de su caja: 0 el mínimo y 1 el máximo de cada eje). La
 * pistola viene boca abajo: el cañón hacia -z y la corredera abajo. La granada no se orienta: va en la palma.
 */
const PROPS: Record<Prop, { url: string; len: number; muzzle?: THREE.Vector3; up?: THREE.Vector3; grip: [number, number, number] }> = {
  pistol: { url: '/models/supper/pistol.glb', len: 0.2, muzzle: new THREE.Vector3(0, 0, -1), up: new THREE.Vector3(0, -1, 0), grip: [0.5, 0.75, 0.85] },
  mp5: { url: '/models/supper/mp5.glb', len: 0.6, muzzle: new THREE.Vector3(1, 0, 0), up: new THREE.Vector3(0, 1, 0), grip: [0.42, 0.15, 0.5] },
  grenade: { url: '/models/supper/grenade.glb', len: 0.11, grip: [0.5, 0.5, 0.5] },
};

/**
 * Pone el arma en la mano derecha, cogida de verdad: la empuñadura en la palma, el cañón siguiendo
 * los nudillos (algo levantado hacia el pulgar, como al apuntar) y el meñique abajo. Se calcula con
 * los huesos de la mano del sujeto, así que vale para cualquier pose (va colgada de la mano).
 */
function hold(g: THREE.Object3D, p: (typeof PROPS)[Prop], bone: (n: string) => THREE.Object3D) {
  const at = (n: string) => bone(n).getWorldPosition(new THREE.Vector3());
  const hand = bone('RightHand'), wrist = at('RightHand'), index = at('RightHandIndex1'), pinky = at('RightHandPinky1');
  const knuckles = index.clone().add(pinky).multiplyScalar(0.5);
  const fingers = knuckles.clone().sub(wrist).normalize(), down = pinky.clone().sub(index);
  down.addScaledVector(fingers, -down.dot(fingers)).normalize();
  const palm = wrist.clone().lerp(knuckles, 0.6);
  // la caja del modelo, sin transformar, y su tamaño en el mundo
  g.position.set(0, 0, 0);
  g.quaternion.identity();
  g.scale.setScalar(1);
  g.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(g), size = box.getSize(new THREE.Vector3()), k = p.len / Math.max(size.x, size.y, size.z);
  const grip = new THREE.Vector3(...p.grip).multiply(size).add(box.min);
  const q = new THREE.Quaternion();
  if (p.muzzle && p.up) {
    const aim = fingers.clone().addScaledVector(down, -0.3).normalize(), up = down.clone().negate();
    up.addScaledVector(aim, -up.dot(aim)).normalize();
    const model = new THREE.Matrix4().makeBasis(p.muzzle, p.up, p.muzzle.clone().cross(p.up));
    const world = new THREE.Matrix4().makeBasis(aim, up, aim.clone().cross(up));
    q.setFromRotationMatrix(world.multiply(model.transpose()));
  }
  // en el mundo: la empuñadura en la palma; luego, al espacio de la mano
  const pos = palm.sub(grip.multiplyScalar(k).applyQuaternion(q));
  const hq = hand.getWorldQuaternion(new THREE.Quaternion()), hk = hand.getWorldScale(new THREE.Vector3()).x;
  g.quaternion.copy(hq.invert().multiply(q));
  g.scale.setScalar(k / hk);
  g.position.copy(hand.worldToLocal(pos));
  hand.add(g);
}

export class SupperScene {
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(36, 1, 0.05, 400);
  readonly onFrame = new Set<(dt: number) => void>();
  readonly bots = SEATS.map(() => new Subject());
  readonly frames = new Frames();
  /** Los sitios, que se pueden retocar en vivo (?supper&edit) sin tocar SEATS. */
  readonly seats: Seat[] = SEATS.map((x) => ({ ...x, win: [...x.win] as [number, number] }));
  private chairs: THREE.Object3D[] = [];
  private hall?: Awaited<ReturnType<typeof makeHall>>;
  /** Revisión: el sitio que se mira de cerca (o null) y el punto fijo de los trozos (0-1, o null). */
  private solo: number | null = null;
  private peekAt: number | null = null;
  /** El zoom out que pide la página (0 a 1, con la rueda) y por dónde va la cámara, que lo sigue suave. */
  pull = 0;
  pulled = 0;
  /** El cuadro que hay bajo el puntero (o null al salir), con dónde está el puntero (px de pantalla). */
  onHover?: (a: Achievement | null, x: number, y: number) => void;
  private ray = new THREE.Raycaster();
  private hovered: Achievement | null = null;
  private feast?: Awaited<ReturnType<typeof makeFeast>>;
  private dust = makeDust(260);
  private beams: THREE.Mesh<THREE.BufferGeometry, THREE.ShaderMaterial>[] = [];
  private finish = makeFinish();
  private weather?: ReturnType<typeof makeWeather>;
  // el fallo de la máscara: cuándo toca el siguiente y cuánto dura el que hay
  private glitch = { next: 3, until: 0 };
  private t = 0;
  private pointer = new THREE.Vector2();
  private look = new THREE.Vector3();
  // los puntos del recorrido de la cámara, reutilizados en cada fotograma
  private farP = new THREE.Vector3();
  private backP = new THREE.Vector3();
  private composer?: EffectComposer;
  private canvas?: HTMLCanvasElement;
  private raf = 0;
  private last = 0;
  private govern: (dt: number) => void = () => {};
  private off?: () => void;
  private disposed = false;

  constructor(private opts: { renderer: THREE.WebGLRenderer; reduced: boolean; low: boolean }) {}

  get renderer() {
    return this.opts.renderer;
  }

  async load() {
    const s = this.scene, { reduced, low } = this.opts;
    s.background = BG;
    s.fog = new THREE.FogExp2(BG, 0.045);
    const [hall, feast] = await Promise.all([makeHall(low), makeFeast(), this.frames.load(), ...this.bots.map((b) => b.load('/models/supper/fight.glb'))]);
    this.hall = hall;
    // los reflejos: el mármol, el metal y las armas devuelven la ciudad y el calor de los focos
    s.environment = hall.environment(this.renderer);
    this.feast = feast;
    s.add(hall.group, makeLights(low), this.frames.group, feast.group, this.dust.points);
    this.weather = makeWeather(this.renderer, { reduced, low });
    s.add(this.weather.group);
    // los haces de los tres focos
    for (const [x, r] of [[0, 0.9], [-2.1, 1.25], [2.1, 1.25]] as const) {
      const b = makeBeam(x, 4.2, 0.75, r, x ? 0xff9a6a : 0xffc58a);
      this.beams.push(b);
      s.add(b);
    }
    // el espejo del suelo no refleja los haces, el polvo ni la lluvia de fuera: reflejados, son
    // manchas blancas en el suelo
    const mirror = hall.mirror;
    if (mirror) {
      const draw = mirror.onBeforeRender, skip = [...this.beams, this.dust.points, this.weather.rain];
      mirror.onBeforeRender = (...a) => {
        for (const o of skip) o.visible = false;
        draw.apply(mirror, a);
        for (const o of skip) o.visible = true;
      };
    }

    await Promise.all(SEATS.map(async (seat, i) => {
      const b = this.bots[i];
      const c = await chair();
      this.chairs[i] = c;
      s.add(c, b.root);
      this.place(i, true);
      if (seat.prop) {
        b.root.updateMatrixWorld(true);
        hold(await glb(PROPS[seat.prop].url), PROPS[seat.prop], (n) => b.bone(n));
      }
      // en móvil y sin movimiento, los doce se quedan quietos y solo el del centro da sombra
      if (i !== CENTER && (low || reduced)) {
        b.freeze(true);
        b.root.traverse((o) => void (o.castShadow = false));
      }
    }));
    this.off = onUnlock(() => this.frames.refresh());

    this.frame0();
    const r = this.renderer;
    r.shadowMap.enabled = true;
    r.shadowMap.type = shadowType(r);
    await compileGently(r, s, this.camera);
  }

  /**
   * Pone a cada uno en su sitio según `seats`: la silla (en su sitio, apartada o volcada), la
   * raíz (subida a la silla, inclinada al caer), hacia quién se encara, su clip y su trozo, y la pose.
   */
  place(i: number, first = false) {
    const seat = this.seats[i], b = this.bots[i], c = this.chairs[i], center = i === CENTER, st = seat.stance;
    const x = seatX(i) + (seat.dx ?? 0);
    c.position.set(x, st === 'fall' ? 0.2 : 0, SEAT_Z - (st === 'chair' || center ? 0 : 0.25));
    c.rotation.set(st === 'fall' ? -1.1 : 0, center || st === 'chair' ? 0 : (i % 2 ? 1 : -1) * (st === 'fall' ? 0.4 : 0.35), 0);
    // se encara a su rival, a medias: el cuadro tiene que seguir leyéndose de frente
    const yaw = center ? 0 : Math.sign(seatX(seat.at) - seatX(i)) * (Math.PI / 2) * seat.turn;
    const z = (center || st === 'chair' ? SEAT_Z : st === 'lean' ? SEAT_Z + 0.14 : SEAT_Z + 0.06) + (seat.dz ?? 0);
    b.place(new THREE.Vector3(x, LIFT[st], z), yaw);
    b.root.rotation.x = TILT[st];
    b.to(seat.clip, { cut: true });
    const old = b.scrub;
    b.scrub = center ? null : { from: seat.win[0], to: seat.win[1], period: old?.period ?? PERIOD * (0.85 + Math.random() * 0.3), phase: old?.phase ?? Math.random() * PERIOD, at: this.peekAt ?? undefined };
    b.pose(center ? HANDS : STANCES[st]);
    if (!center) b.lookAt(this.bots[seat.at].root.position.clone().setY(1.5), { snap: true });
    if (first || this.opts.reduced) b.update(1 / 60);
  }

  /** Revisión (desarrollo): cambia un sitio y lo vuelve a colocar. */
  tune(i: number, patch: Partial<Seat>) {
    Object.assign(this.seats[i], patch);
    this.place(i);
  }

  /** Revisión: la cámara de cerca sobre un sitio (null: el plano del cuadro). */
  focus(i: number | null) {
    this.solo = i;
  }

  /** Revisión: todos los trozos parados en un punto (0: el principio; 1: el final; null: en marcha). */
  peek(k: number | null) {
    this.peekAt = k;
    for (const b of this.bots) if (b.scrub) b.scrub.at = k ?? undefined;
  }

  /** El plano del cuadro: FIT m caben a lo ancho en cualquier pantalla. */
  private far() {
    const half = Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2));
    const d = FIT / 2 / (half * this.camera.aspect);
    return this.farP.set(0, EYE, AT.z + Math.max(d, 3.4));
  }

  /** La cámara en el punto `pull` del zoom out (0: pegada a la cara del centro; 1: el plano del cuadro). */
  private frame0() {
    if (this.solo !== null) {
      // de cerca, un poco desde arriba y de lado, para ver si atraviesa la mesa o la pared
      const p = this.bots[this.solo].root.position;
      this.camera.position.set(p.x + 1.1, 1.5, p.z + 2.2);
      this.camera.lookAt(p.x, 1.0, p.z);
      return;
    }
    const k = this.pulled, a = ease(Math.min(1, k / MID)), b = ease(Math.max(0, (k - MID) / (1 - MID)));
    const far = this.far(), back = this.backP.set(0, EYE + 0.35, AT.z + (far.z - AT.z) * BACK);
    this.camera.position.lerpVectors(FROM, far, a).lerp(back, b);
    this.camera.lookAt(this.look.lerpVectors(FROM_AT, AT, a).setY(AT.y + 0.2 * b));
  }

  /** Toma el lienzo y empieza a pintar. */
  takeOver(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.govern = governor(this.renderer, () => this.resize());
    const r = this.renderer;
    r.toneMapping = THREE.ACESFilmicToneMapping;
    r.toneMappingExposure = 0.85;
    r.setRenderTarget(null);
    const c = (this.composer = new EffectComposer(r));
    // sombra de contacto (oclusión ambiental): los robots se asientan en la mesa y el suelo; sin ella,
    // flotan. A media resolución: la escena ya es cara
    const ao = new N8AOPass(this.scene, this.camera, 1, 1);
    ao.configuration.aoRadius = 0.5;
    ao.configuration.distanceFalloff = 0.6;
    ao.configuration.intensity = 3;
    ao.configuration.halfRes = true;
    ao.configuration.gammaCorrection = false;
    ao.setQualityMode('Low');
    c.addPass(ao);
    c.addPass(new UnrealBloomPass(new THREE.Vector2(1, 1), 0.7, 0.55, 0.7));
    c.addPass(new OutputPass());
    // antialiasing sobre la imagen ya en sRGB (N8AO pinta sin MSAA), como en la habitación
    c.addPass(new SMAAPass(1, 1));
    c.addPass(this.finish);
    this.resize();
    window.addEventListener('resize', this.resize);
    window.addEventListener('pointermove', this.move);
    this.last = performance.now();
    cancelAnimationFrame(this.raf);
    this.raf = requestAnimationFrame(this.frame);
  }

  /** Dónde cae en pantalla (px del lienzo) un punto de la escena: el email va sobre el mantel. */
  toScreen(p: THREE.Vector3) {
    const v = p.clone().project(this.camera), c = this.canvas!;
    return { x: (v.x * 0.5 + 0.5) * c.clientWidth, y: (-v.y * 0.5 + 0.5) * c.clientHeight };
  }

  private move = (e: PointerEvent) => {
    this.pointer.set((e.clientX / innerWidth) * 2 - 1, (e.clientY / innerHeight) * 2 - 1);
    // los cuadros: qué hay bajo el puntero, en el lienzo (que se va hacia arriba al bajar al footer)
    const c = this.canvas;
    if (!c || !this.onHover) return;
    const r = c.getBoundingClientRect();
    this.ray.setFromCamera(new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1), this.camera);
    const a = e.clientY < r.bottom ? this.frames.pick(this.ray) : null;
    if (a || a !== this.hovered) this.onHover(a, e.clientX, e.clientY);
    this.hovered = a;
    c.style.cursor = a ? 'help' : '';
  };

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

  /*
   * El fallo de la máscara: cada pocos segundos, unos fotogramas de bandas en toda la imagen; a la
   * vez, alguna de las cosas que flotan desaparece un instante. Sin movimiento, nunca.
   */
  /** Un fallo largo, ya (al aceptar el reto del contacto). Sin movimiento, nada. */
  jolt() {
    if (this.opts.reduced) return;
    this.glitch.until = this.t + 0.45;
    this.glitch.next = this.t + 3;
    this.finish.uniforms.uSeed.value = Math.random() * 100;
  }

  private flicker() {
    const g = this.glitch, t = this.t;
    if (!this.opts.reduced && t > g.next) {
      g.until = t + 0.08 + Math.random() * 0.18;
      g.next = t + 2.5 + Math.random() * 5;
      this.finish.uniforms.uSeed.value = Math.random() * 100;
    }
    const on = t < g.until;
    this.finish.uniforms.uGlitch.value = on ? 0.6 + Math.random() * 0.4 : 0;
    this.finish.uniforms.uTime.value = t;
  }

  private frame = (now: number) => {
    if (this.disposed) return;
    this.raf = requestAnimationFrame(this.frame);
    const dt = THREE.MathUtils.clamp((now - this.last) / 1000, 0, 0.1);
    this.last = now;
    this.t += dt;
    this.govern(dt);
    // la cámara sigue a la rueda con un poco de retraso (sin movimiento, sin él)
    this.pulled = this.opts.reduced ? this.pull : THREE.MathUtils.damp(this.pulled, this.pull, 3, dt);
    this.frame0();
    // el del centro mira fijamente a la cámara, siempre
    this.bots[CENTER].lookAt(this.camera.position);
    this.frames.update(dt, this.opts.reduced, this.finish.uniforms.uGlitch.value);
    this.hall?.update(this.t, this.opts.reduced, this.weather?.update(this.t, dt) ?? 0);
    for (const b of this.bots) b.update(dt);
    this.feast?.update(this.t, dt, this.opts.reduced, this.finish.uniforms.uGlitch.value > 0);
    if (!this.opts.reduced) this.dust.update(this.t);
    for (const b of this.beams) b.material.uniforms.uTime.value = this.t;
    this.flicker();
    for (const f of this.onFrame) f(dt);
    this.composer!.render();
  };

  /** No desecha el renderer: es prestado (o lo desecha quien lo creó). */
  dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.raf);
    this.off?.();
    window.removeEventListener('resize', this.resize);
    window.removeEventListener('pointermove', this.move);
    this.onFrame.clear();
    for (const b of this.bots) b.dispose();
    this.frames.dispose();
    disposeDeep(this.scene);
    this.finish.dispose();
    this.weather?.dispose();
    this.composer?.dispose();
  }
}
