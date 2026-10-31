import * as THREE from 'three';
import { disposeDeep } from '../dispose';
import { governor, shadowType } from '../quality';
import { compileGently } from '../compile';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { SMAAPass } from 'three/examples/jsm/postprocessing/SMAAPass.js';
import { makeCaustics } from '../caustics';
import { makeBeam } from '../supper/atmosphere';
import { makeMask } from '../library/subject';
import { makeWater } from './water';
import { makeSurface, MURK } from './surface';
import type { ExitPose } from '../ritual/ritualScene';
import { Card, CLAUDE_CARD, presenceCard } from './card';
import type { Presence } from './presence';

/*
 * Los créditos: la máscara que ha caído en el ritual, bajo un agua casi negra. Flota de lado hasta
 * que haces scroll; con el scroll se hunde y pasan los créditos; al final, todo se oscurece.
 *
 * El ritual la carga y la compila mientras se reproduce su final, en el mismo renderer: al tocar la
 * máscara el suelo, esta escena toma el lienzo sin que haya que compilar nada.
 */

/** Lo que baja la máscara (m) de p = 0 a p = SINK_END. */
const DEPTH = 3.5, SINK_END = 0.85;
/** El fundido final a negro, en progreso de scroll. */
const DARK_FROM = 0.88;
const SNOW = 600;
/** Las fichas: delante de la máscara (a 0,75 m de la cámara) y cuándo pasa cada una, en progreso de scroll. */
const CARD_Z = 0.35, ROLL: [number, number][] = [[0.12, 0.5], [0.5, 0.82]];
/** La superficie del agua (el suelo del ritual, justo encima), por encima de donde flota la máscara (m). */
const SURFACE = 0.45;
/** La entrada: la máscara y la cámara llegan justo bajo la superficie y frenan hasta flotar, en ENTER s. */
const ENTER = 1.6, ENTRY = SURFACE - 0.06;

export class CreditsScene {
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(38, 1, 0.03, 40);
  readonly onFrame = new Set<(dt: number) => void>();
  /** La máscara (y su balanceo); dentro va la de `makeMask()`. */
  readonly mask = new THREE.Group();
  /** Las fichas de los créditos. */
  readonly cards = new THREE.Group();
  /** El scroll: progreso (0-1) y adónde va. */
  p = 0;
  aim = 0;
  t = 0;
  /** Al oscurecerse del todo (una vez). */
  onEnd?: () => void;
  private ended = false;
  private since = 0;
  /** Las dos fichas (s7lver y Claude) y el retrato de s7lver (el avatar de Discord de la web). */
  readonly me = new Card(presenceCard({ name: 's7lver', status: null, custom: null, activity: null, spotify: null }, new Image()));
  readonly claude = new Card(CLAUDE_CARD);
  readonly avatar = new Image();
  private presence: Presence = { name: 's7lver', status: null, custom: null, activity: null, spotify: null };
  private holders = [new THREE.Group(), new THREE.Group()];
  private lie = new THREE.Group();
  private face?: THREE.Group;
  // la luz de arriba: el pentagrama encendido, al otro lado de la superficie
  private sun = new THREE.DirectionalLight(0xff3a2a, 1.2);
  /*
   * y, por la misma luz, las cáusticas: un foco desde arriba que proyecta la red de luz de la
   * superficie, moviéndose sobre la máscara y las fichas; y los rayos que bajan desde ella entre la
   * turbiedad, como columnas que se pierden en lo hondo
   */
  private caustics = makeCaustics(this.opts.renderer);
  private glow = new THREE.SpotLight(0xff4a34, 0, 0, 0.25, 0.5, 0);
  private rays: THREE.Mesh<THREE.BufferGeometry, THREE.ShaderMaterial>[] = [];
  private cutAt = -9;
  private camY = 0;
  private water = makeWater();
  private snow?: THREE.Points;
  private surface = makeSurface(SURFACE);
  private composer?: EffectComposer;
  private canvas?: HTMLCanvasElement;
  private raf = 0;
  // si va lento, baja la resolución (ver quality.ts)
  private govern: (dt: number) => void = () => {};
  private last = 0;
  private disposed = false;

  constructor(private opts: { renderer: THREE.WebGLRenderer; reduced: boolean }) {}

  get renderer() {
    return this.opts.renderer;
  }

  async load() {
    const s = this.scene;
    // agua casi negra, con un frío mínimo
    s.background = MURK;
    s.fog = new THREE.FogExp2(MURK, 0.35);
    // una luz fría y débil desde arriba (la superficie, lejos) y casi nada más
    this.sun.position.set(0.3, 6, 0.6);
    // y un relleno frío y débil, el agua misma, que deja leer la máscara por delante
    const fill = new THREE.DirectionalLight(0x6f8790, 0.5);
    fill.position.set(-1, 0.5, 3);
    s.add(this.sun, this.sun.target, fill, new THREE.HemisphereLight(0x1a262c, 0x000000, 0.4));
    // el foco de las cáusticas (su textura necesita la sombra: la proyecta con ella)
    this.glow.map = this.caustics.texture;
    this.glow.castShadow = true;
    this.glow.shadow.mapSize.setScalar(512);
    this.glow.shadow.bias = -0.0005;
    s.add(this.glow, this.glow.target);
    for (const [x, z, r, tilt] of [[-0.9, -1.6, 0.5, 0.12], [0.35, -2.2, 0.7, -0.08], [1.2, -1.2, 0.35, -0.16], [-0.2, -3, 0.9, 0.05]] as const) {
      const b = makeBeam(0, 1.2, -DEPTH - 2.5, r, 0xff4a34);
      b.position.set(x, b.position.y, z);
      b.rotation.z = tilt;
      b.material.uniforms.uK.value = 0.22;
      this.rays.push(b);
      s.add(b);
    }

    // la máscara de lado, como quedó al caer (en su propio grupo: la de makeMask ya va girada)
    this.face = await makeMask();
    this.lie.add(this.face);
    this.lie.rotation.set(0.15, -0.35, 0.45);
    this.mask.add(this.lie);
    s.add(this.mask, this.cards, this.surface.group);
    [this.me, this.claude].forEach((c, i) => this.cards.add(this.holders[i].add(c.mesh)));
    this.avatar.onload = () => this.setPresence(this.presence);
    this.avatar.src = '/api/avatar/discord';

    // nieve marina: motas que caen despacio alrededor del camino de la cámara
    const pos = new Float32Array(SNOW * 3);
    for (let i = 0; i < SNOW; i++) pos.set([(Math.random() - 0.5) * 5, 1 - Math.random() * (DEPTH + 3), -3 + Math.random() * 4], i * 3);
    const g = new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(pos, 3));
    this.snow = new THREE.Points(g, new THREE.PointsMaterial({ color: 0x8a9aa3, size: 2, sizeAttenuation: false, transparent: true, opacity: 0.35, depthWrite: false }));
    s.add(this.snow);

    this.camera.position.set(0, 0, 1);
    this.camera.lookAt(0, 0, 0);
    // compilar ya, con las sombras encendidas como en el ritual (cambiarlas obligaría a recompilar):
    // la escena para el destino intermedio del compositor, poco a poco (ver compileGently; mientras,
    // el ritual sigue pintando), y el paso del agua (su material, en un plano suelto) para la pantalla
    const r = this.renderer;
    r.shadowMap.enabled = true;
    r.shadowMap.type = shadowType(r);
    await compileGently(r, s, this.camera);
    const quad = new THREE.Scene().add(new THREE.Mesh(new THREE.PlaneGeometry(1, 1), this.water.material));
    await r.compileAsync(quad, this.camera);
    (quad.children[0] as THREE.Mesh).geometry.dispose();
  }

  /** Lo último de Discord: redibuja la ficha de s7lver. */
  setPresence(p: Presence) {
    this.presence = p;
    this.me.set(presenceCard(p, this.avatar));
  }

  /**
   * Sigue el plano del ritual: la máscara con la misma orientación respecto a la cámara que en su
   * último fotograma. Todo se gira alrededor de la vertical para que la cámara mire hacia -z (el
   * agua está montada mirando hacia ahí); la vertical no cambia, así que el plano es el mismo.
   */
  enter(pose: ExitPose) {
    const f = new THREE.Vector3(0, 0, -1).applyQuaternion(pose.camera);
    const turn = new THREE.Quaternion().setFromAxisAngle(THREE.Object3D.DEFAULT_UP, Math.PI - Math.atan2(f.x, f.z));
    this.lie.rotation.set(0, 0, 0);
    this.face!.quaternion.copy(turn.multiply(pose.mask));
  }

  /**
   * Toma el lienzo. El plano sigue el del ritual: la máscara y la cámara acaban de cruzar el suelo
   * y siguen cayendo, frenando en el agua hasta flotar.
   */
  takeOver(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.govern = governor(this.renderer, () => this.resize());
    this.since = 0;
    const r = this.renderer;
    r.toneMapping = THREE.ACESFilmicToneMapping;
    r.toneMappingExposure = 1;
    r.setRenderTarget(null);
    const c = (this.composer = new EffectComposer(r));
    c.addPass(new RenderPass(this.scene, this.camera));
    c.addPass(new UnrealBloomPass(new THREE.Vector2(1, 1), 0.45, 0.35, 0.9));
    c.addPass(new OutputPass());
    c.addPass(this.water);
    // antialiasing al final, como en la habitación
    c.addPass(new SMAAPass(1, 1));
    this.resize();
    this.step(0);
    c.render();
    window.addEventListener('resize', this.resize);
    this.last = performance.now();
    cancelAnimationFrame(this.raf);
    this.raf = requestAnimationFrame(this.frame);
  }

  /** Scroll, en progreso (positivo hacia abajo). Reversible: se puede volver al principio. */
  push(d: number) {
    this.aim = THREE.MathUtils.clamp(this.aim + d, 0, 1);
  }

  /** El corte de entrada: unas bandas que saltan durante 0,12 s (sin movimiento reducido). */
  cut() {
    this.cutAt = this.t;
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

  private step(dt: number) {
    const reduced = this.opts.reduced;
    this.since += dt;
    this.p += (this.aim - this.p) * (1 - Math.exp(-dt * 2.2));
    if (Math.abs(this.aim - this.p) < 1e-4) this.p = this.aim;
    // la máscara se hunde con el scroll y, sin movimiento reducido, se balancea con el agua
    // entra desde arriba frenando (el agua la para) y, con el scroll, se hunde
    const e = reduced ? 1 : Math.min(1, this.since / ENTER), entry = ENTRY * (1 - e) * (1 - e) * (1 - e);
    const s = Math.min(1, this.p / SINK_END), sink = s * s * (3 - 2 * s), base = -DEPTH * sink, y = base + entry;
    // el balanceo entra poco a poco, para no mover el primer fotograma
    const sway = reduced ? 0 : e;
    this.mask.position.set(0, y + Math.sin(this.t * 1.26) * 0.04 * sway, 0);
    this.mask.rotation.z = Math.sin(this.t * 0.9) * THREE.MathUtils.degToRad(3) * sway;
    // la cámara baja con ella, como en la caída del ritual: a 1,1 m, 5 cm por encima, en
    // horizontal; la bajada se nota en la nieve que sube y en la superficie, que se queda arriba
    this.camY = dt === 0 ? y : this.camY + (y - this.camY) * (1 - Math.exp(-dt * 10));
    this.camera.position.set(0, this.camY + 0.05, 1.1);
    this.camera.lookAt(0, this.camY + 0.05, 0);
    this.surface.update(this.t, SURFACE - this.camY, reduced);
    // las fichas, como unos créditos: delante de la máscara, una detrás de otra, subiendo despacio;
    // del tamaño que quepa en pantalla (en pantallas estrechas, en su forma alta)
    const tall = this.camera.aspect < 0.8, dist = 1.1 - CARD_Z, half = dist * Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2));
    [this.me, this.claude].forEach((c, i) => {
      const [from, to] = ROLL[i], k = THREE.MathUtils.clamp((this.p - from) / (to - from), 0, 1);
      const show = THREE.MathUtils.smoothstep(k, 0, 0.2) * (1 - THREE.MathUtils.smoothstep(k, 0.8, 1));
      const h = this.holders[i];
      h.visible = show > 0;
      c.layout(tall);
      c.update(this.t, show, reduced);
      const w = tall ? 0.8 : 1.6;
      h.scale.setScalar(Math.min((2 * half * this.camera.aspect * 0.86) / w, (2 * half * 0.62) / 0.8));
      // en vertical, por encima de la máscara (en el agua oscura), que llena el centro del plano
      h.position.set(0, this.camY + 0.05 + half * (tall ? THREE.MathUtils.lerp(0.15, 0.5, k) : THREE.MathUtils.lerp(-0.18, 0.18, k)), CARD_Z);
    });
    this.sun.intensity = 1.2 * (1 - 0.75 * sink);
    // las cáusticas se apagan con lo hondo (la red se deshace lejos de la superficie)
    this.glow.intensity = 8 * (1 - 0.85 * sink);
    this.glow.position.set(0.2, y + 4, 0.9);
    this.glow.target.position.set(0, y, 0);
    this.caustics.update(reduced ? 0 : this.t);
    for (const b of this.rays) b.material.uniforms.uTime.value = reduced ? 0 : this.t;
    this.sun.position.set(0.3, y + 6, 0.6);
    this.sun.target.position.set(0, y, 0);
    // la nieve cae y vuelve a empezar arriba
    if (this.snow && !reduced) {
      const a = this.snow.geometry.attributes.position as THREE.BufferAttribute;
      for (let i = 0; i < SNOW; i++) {
        let v = a.getY(i) - dt * 0.03;
        if (v < -DEPTH - 2) v += DEPTH + 3;
        a.setY(i, v);
      }
      a.needsUpdate = true;
    }
    const u = this.water.uniforms;
    u.uTime.value = reduced ? 0 : this.t;
    u.uCut.value = reduced ? 0 : Math.max(0, 1 - (this.t - this.cutAt) / 0.12);
    const d = THREE.MathUtils.clamp((this.p - DARK_FROM) / (1 - DARK_FROM), 0, 1);
    u.uDark.value = d * d * (3 - 2 * d);
    if (!this.ended && this.p > 0.999) {
      this.ended = true;
      this.onEnd?.();
    }
  }

  /** Deja de pintar (ya a oscuras, al pasar el lienzo a la cena: que no le quite GPU mientras carga). */
  halt() {
    cancelAnimationFrame(this.raf);
  }

  private frame = (now: number) => {
    if (this.disposed) return;
    this.raf = requestAnimationFrame(this.frame);
    // con la pestaña oculta no hay fotogramas, y al volver el salto se recorta: el reloj se pausa
    const dt = THREE.MathUtils.clamp((now - this.last) / 1000, 0, 0.1);
    this.last = now;
    this.govern(dt);
    this.t += dt;
    this.step(dt);
    for (const f of this.onFrame) f(dt);
    this.composer!.render();
  };

  /** No desecha el renderer: es prestado (o lo desecha quien lo creó). */
  dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.raf);
    window.removeEventListener('resize', this.resize);
    this.onFrame.clear();
    disposeDeep(this.scene);
    this.water.dispose();
    this.caustics.dispose();
    this.me.dispose();
    this.claude.dispose();
    this.composer?.dispose();
  }
}
