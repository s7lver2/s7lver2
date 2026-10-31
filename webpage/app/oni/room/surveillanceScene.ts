import * as THREE from 'three';
import { disposeDeep } from '../dispose';
import { gsap } from 'gsap';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { SMAAPass } from 'three/examples/jsm/postprocessing/SMAAPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';

// algún modelo trae normales rotas: un solo píxel NaN y el bloom lo convierte en un bloque negro
const Sanitize = {
  uniforms: { tDiffuse: { value: null } },
  vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
  fragmentShader: 'uniform sampler2D tDiffuse; varying vec2 vUv; void main() { vec4 c = texture2D(tDiffuse, vUv); if (any(isnan(c)) || any(isinf(c))) c = vec4(0.0, 0.0, 0.0, 1.0); gl_FragColor = min(c, vec4(2.5)); }',
};
import type { Channel } from './channels';
import { createScreenMaterial } from './screenMaterial';
import { TV_MODELS, WALL_Z, layoutWall, type TvModel } from './wall';
import { makeFillers, type Filler } from './fillers';
import { broadcastFor, type BroadcastDef } from './broadcasts';
import { clutter, dust, hangingCables, shelving } from './props';
import { CctvShader } from './cctvPass';
import { buildShell } from './shell';
import { compileGently } from '../compile';
import { shadowType } from '../quality';
import { buildDesk } from './desk';
import { CCTV_FONT, CCTV_H, CCTV_W, gradeCctv, stampCctv } from '../pc/cctv';
import { REMOTE_BUTTONS, buttonAt, type RemoteButton } from './remote';
import { makeWallShows, type WallShow } from './wallShows';
import { makeClock } from '../clock3d';

/*
 * La sala de videovigilancia: un muro de teles viejas en arco, cables por el suelo, una
 * consola con el mando encima y luz roja tenue. Cada canal es una tele.
 */

export interface Screen {
  mesh: THREE.Mesh;
  mat: THREE.ShaderMaterial;
  channel?: Channel;
  center: THREE.Vector3;
  right: THREE.Vector3;
  up: THREE.Vector3;
  size: THREE.Vector2;
  /** Canales: su emisión pintada en un lienzo para la textura. */
  paint?: { canvas: HTMLCanvasElement; tex: THREE.CanvasTexture; def: BroadcastDef };
  /** Lo que enseña en directo (su canal o un relleno). */
  live?: { tex: THREE.Texture | null; mono: number; mode: number };
  /** Un vídeo o una imagen que no cargó: la tele da estática y el encuadre usa la tarjeta. */
  failed?: boolean;
  video?: HTMLVideoElement;
  model?: TvModel;
}

const FRONT_ROT: Record<'+z' | '-z' | '+x', number> = { '+z': 0, '-z': Math.PI, '+x': -Math.PI / 2 };
export const DESK_Y = 0.76, DESK_Z = -0.95;
const ROOM_H = 2.95;
const HOME_POS = new THREE.Vector3(0, 1.5, 2.05), HOME_LOOK = new THREE.Vector3(0, 1.32, WALL_Z);
// al hacer scroll te acercas a la mesa, por la derecha de la silla, hasta tener el mando delante
const DESK_POS = new THREE.Vector3(0.78, 1.2, -0.2), DESK_LOOK = new THREE.Vector3(0.62, 0.78, -0.74);
// con el mando en la mano, sentado en la silla mirando al muro
const SEAT_POS = new THREE.Vector3(0.15, 1.16, -0.22), SEAT_LOOK = new THREE.Vector3(0.05, 1.12, WALL_Z);

type Display = 'feeds' | 'arrow' | 'live' | WallShow;

export class SurveillanceScene {
  readonly screens: Screen[] = [];
  remote = new THREE.Group();
  readonly renderer: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(45, 1, 0.02, 40);
  private composer: EffectComposer;
  private cctv: ShaderPass;
  private raf = 0;
  private t0 = performance.now();
  private loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
  private disposed = false;
  private fillers: Filler[] = [];
  private lastPaint = 0;
  private ticks: ((t: number, dt: number) => void)[] = [];
  private screenLights: THREE.PointLight[] = [];
  /** Dónde está y adónde mira la cámara; cada fotograma le suma una respiración leve. */
  readonly camPos = HOME_POS.clone();
  readonly camLook = HOME_LOOK.clone();
  private sway = 1;
  private display: Display = 'live';
  private wall?: ReturnType<typeof makeWallShows>;
  // sentado, el muro cambia solo de programa: canales, la máscara gigante, la lluvia
  private seated = false;
  private progAt = 0;
  private progLen = 0;
  private lastWall = 0;
  private cams: { canvas: HTMLCanvasElement; base: ImageData; tex: THREE.CanvasTexture }[] = [];
  private lastStamp = 0;
  private intro?: gsap.core.Tween;
  private timers: number[] = [];
  private ray = new THREE.Raycaster();
  /** Acercamiento a la mesa (0 plano general, 1 el mando delante): el que pide el scroll y el suavizado. */
  approach = 0;
  private near = 0;
  introDone = false;
  /** Precargada mientras el virus sigue en pantalla: no pinta hasta que le toca. */
  paused = false;
  /** Con el mando en la mano, la cámara ya no la lleva el scroll sino los canales. */
  holding = false;
  private aiming = false;
  private travel?: gsap.core.Tween;
  private hold?: gsap.core.Tween;
  // el botón hundido: un brillo en su rectángulo de la textura, pintado en un mapa emisivo
  private press = Object.assign(document.createElement('canvas'), { width: 256, height: 256 });
  private pressTex = new THREE.CanvasTexture(this.press);
  private pressTimer = 0;
  private frustum = new THREE.Frustum();
  // la tele encuadrada pinta su emisión en un lienzo grande, para leerse bien de cerca
  private hi = Object.assign(document.createElement('canvas'), { width: 1024, height: 768 });
  private hiTex = new THREE.CanvasTexture(this.hi);
  private focused = -1;
  private noise?: gsap.core.Tween;
  private clock = makeClock(0.2);
  readonly lights: THREE.Light[] = [];
  /** Con todo apagado, las luces de las pantallas ya no tiemblan. */
  private dark = false;
  /** Lo que se ejecuta en cada fotograma antes de pintar (lo añaden las tareas de arriba). */
  readonly onFrame = new Set<(t: number, dt: number) => void>();

  constructor(private opts: { canvas: HTMLCanvasElement; channels: Channel[]; feeds: ImageBitmap[]; reduced: boolean; onReady: () => void; onError?: () => void }) {
    const r = (this.renderer = new THREE.WebGLRenderer({ canvas: opts.canvas, antialias: false, powerPreference: 'high-performance' }));
    r.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
    r.toneMapping = THREE.ACESFilmicToneMapping;
    r.toneMappingExposure = 1.0;
    r.shadowMap.type = shadowType(r);
    r.setClearColor(0x070303, 1);
    this.scene.fog = new THREE.FogExp2(0x070303, 0.07);


    this.composer = new EffectComposer(r);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    this.composer.addPass(new ShaderPass(Sanitize));
    this.composer.addPass(new UnrealBloomPass(new THREE.Vector2(1, 1), 0.85, 0.55, 0.5));
    this.composer.addPass(new OutputPass());
    this.composer.addPass(new SMAAPass(1, 1));
    this.cctv = new ShaderPass(CctvShader);
    this.cctv.uniforms.uMove.value = opts.reduced ? 0 : 1;
    this.cctv.uniforms.uAmt.value = 0;
    this.composer.addPass(this.cctv);

    this.camera.position.copy(this.camPos);
    this.camera.lookAt(this.camLook);
    this.scene.add(this.camera); // el mando, una vez cogido, va colgado de ella
    this.pressTex.flipY = false;
    this.hiTex.colorSpace = THREE.SRGBColorSpace;
    this.hiTex.anisotropy = 4;
    this.resize();
    window.addEventListener('resize', this.resize);
    // compilada antes del primer fotograma: si no, en Firefox la entrada a la sala colgaba la página
    this.load().then(() => (this.disposed ? undefined : compileGently(r, this.scene, this.camera))).then(() => {
      if (this.disposed) return;
      this.raf = requestAnimationFrame(this.frame);
      opts.onReady();
    }).catch(() => {
      // un modelo que no llega (la red): sin salida, el virus se quedaba encima para siempre
      if (!this.disposed) opts.onError?.();
    });
  }

  // la sala se cierra alrededor del muro: paredes, techo y suelo de cemento oscuro
  private buildRoom(x0: number, x1: number) {
    const s = this.scene;
    const shell = buildShell(s, this.renderer, { x0, x1, back: WALL_Z - 0.75, front: 3.4, ceil: ROOM_H }, this.opts.reduced);
    this.ticks.push(...shell.ticks);
    const rug = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 1.9), new THREE.MeshStandardMaterial({ color: 0x2a0d0b, roughness: 1 }));
    rug.rotation.x = -Math.PI / 2;
    rug.position.set(0, 0.004, 0.05);
    s.add(rug);

    // luz: la de las pantallas (blanca, delante del muro), un rojo tenue de fondo y el flexo
    const amb = new THREE.HemisphereLight(0x4a100c, 0x0a0505, 0.7);
    s.add(amb);
    this.lights.push(amb);
    for (const x of [-1.7, 0, 1.7]) {
      const p = new THREE.PointLight(0xdedcdc, 1.3, 4.2, 1.6);
      p.position.set(x, 1.55, WALL_Z + 0.55);
      s.add(p);
      this.screenLights.push(p);
      this.lights.push(p);
    }
    const red = new THREE.SpotLight(0xc4221a, 24, 7, 0.7, 0.9, 1.6);
    red.position.set(-3.0, 2.6, 2.2);
    red.target.position.set(0, 0.6, -1);
    s.add(red, red.target);
    this.lights.push(red);
    // el rincón del rack, con su propio resplandor rojo
    const corner = new THREE.PointLight(0xff3a26, 1.1, 4, 1.6);
    corner.position.set(-2.4, 2.3, WALL_Z + 1.7);
    s.add(corner);
    this.lights.push(corner);
  }

  // la mesa larga y el flexo
  private glb(url: string) {
    return new Promise<THREE.Object3D>((res, rej) => this.loader.load(url, (g) => res(g.scene), undefined, rej));
  }
  // los de licencia Sketchfab no van en el repo (ver .gitignore): si no están, la sala sigue sin ellos
  // (devuelve null aunque el tipo de quien lo usa diga Object3D: crt y rack se comprueban a mano)
  private maybe(url: string) {
    return this.glb(url).catch(() => null);
  }

  // coloca un modelo: su lado más largo mide `fit` metros, apoyado en `at`
  private place(o: THREE.Object3D, fit: number, rotY: number, at: [number, number, number]) {
    // los emisivos de los modelos vienen pensados para otra luz: aquí, a oscuras, queman
    o.traverse((m) => {
      const mat = (m as THREE.Mesh).material as THREE.MeshStandardMaterial | undefined;
      if (mat?.emissiveIntensity) mat.emissiveIntensity = Math.min(mat.emissiveIntensity, 0.35);
    });
    o.rotation.y = rotY;
    o.updateMatrixWorld(true);
    const b = new THREE.Box3().setFromObject(o), sz = b.getSize(new THREE.Vector3());
    const k = fit / Math.max(sz.x, sz.y, sz.z);
    o.scale.multiplyScalar(k);
    const c = b.getCenter(new THREE.Vector3());
    o.position.set(at[0] - c.x * k, at[1] - b.min.y * k, at[2] - c.z * k);
    this.scene.add(o);
    return o;
  }

  private async load() {
    const models = Object.keys(TV_MODELS) as TvModel[];
    const R = '/models/room/';
    const S = '/models/surveilance_room/';
    const [tpl, [cables, chair, keyboard, mouse, rack, tower, recorder, router, poster], [remote, cam, frame, tux, pi, server]] = await Promise.all([
      Promise.all(models.map((m) => ((m === 'crt' ? this.maybe(TV_MODELS[m].url) : this.glb(TV_MODELS[m].url)) as Promise<THREE.Object3D>))),
      Promise.all(['cables', 'chair', 'keyboard', 'mouse', 'rack', 'tower', 'recorder', 'router', 'poster'].map((n) => ((n === 'rack' ? this.maybe(R + n + '.glb') : this.glb(R + n + '.glb')) as Promise<THREE.Object3D>))),
      Promise.all(['remote', 'camera', 'frame', 'tux', 'pi', 'server'].map((n) => this.glb(S + n + '.glb'))),
    ]);
    const byModel = Object.fromEntries(models.map((m, i) => [m, tpl[i]])) as Record<TvModel, THREE.Object3D>;
    const missing = models.filter((m) => !byModel[m]);
    // la simplificación de antennatv dejó normales degeneradas: se rehacen
    byModel.antennatv.traverse((o) => (o as THREE.Mesh).isMesh && (o as THREE.Mesh).geometry.computeVertexNormals());
    const slots = layoutWall(this.opts.channels.length, 7, missing);
    // montar la sala son ~2 s de trabajo seguido: a trozos, soltando el hilo entre uno y otro, para
    // que lo que haya en pantalla (el virus, que la está precargando) no se congele
    const breathe = () => new Promise((r) => setTimeout(r));
    for (const slot of slots) {
      this.addTv(byModel[slot.model], slot.model, slot.position, slot.rotY, slot.scale);
      await breathe();
    }
    this.opts.channels.forEach((ch, i) => this.screens[i] && (this.screens[i].channel = ch));

    const xs = slots.map((s) => s.position[0]);
    // la sala es más ancha que el muro: a los lados se ve la pared del fondo con sus ventanas
    const x0 = Math.min(-5, Math.min(...xs) - 2.4), x1 = Math.max(5, Math.max(...xs) + 2.4);
    this.buildRoom(x0, x1);
    await breathe();
    const deskW = 4.2;
    this.lights.push(buildDesk(this.scene, deskW, DESK_Y, DESK_Z));
    shelving(this.scene, slots, ROOM_H);
    hangingCables(this.scene, slots, DESK_Z);
    this.ticks.push(...clutter(this.scene, DESK_Y, DESK_Z, deskW, -3.4, 3.4, ROOM_H));
    if (!this.opts.reduced) this.ticks.push(dust(this.scene, x0, x1, WALL_Z));


    // el atrezo es el de la habitación: el mismo dueño
    this.place(chair, 1.2, Math.PI, [0.15, 0, -0.05]);
    this.place(keyboard, 0.44, 0, [-0.1, DESK_Y + 0.004, DESK_Z + 0.18]);
    this.place(mouse, 0.12, 0, [0.28, DESK_Y + 0.004, DESK_Z + 0.2]);
    // lo de encima de la mesa: la foto, tux, la raspberry con su piloto y el servidor con su consola
    this.place(frame, 0.24, 0.35, [-0.82, DESK_Y, DESK_Z - 0.18]);
    this.place(tux, 0.17, 0.45, [-0.5, DESK_Y, DESK_Z - 0.26]);
    this.place(pi, 0.09, -0.4, [0.95, DESK_Y, DESK_Z - 0.12]);
    this.place(server, 0.5, -0.25, [1.3, DESK_Y, DESK_Z - 0.12]);
    this.place(recorder, 0.42, -0.3, [deskW / 2 - 0.35, DESK_Y, DESK_Z - 0.1]);
    this.place(tower, 0.5, 0, [deskW / 2 - 0.45, 0, DESK_Z - 0.05]);
    if (rack) this.place(rack, 1.6, 0.2, [-2.75, 0, WALL_Z - 0.4]);
    this.place(router, 0.24, 0.3, [-2.75, 1.62, WALL_Z - 0.4]);
    this.place(poster, 0.55, 0, [2.75, 1.45, WALL_Z - 0.73]);
    for (let i = 0; i < 6; i++) this.place(cables.clone(), 1 + Math.random() * 0.5, Math.random() * 6.3, [(i - 2.5) * 0.8, 0, -0.5 + Math.random() * 1.6]);

    // el mando, tumbado en la mesa con los botones hacia arriba. Su textura trae casi todo con
    // alfa 0 (venía como calcomanía): se pinta opaco
    remote.traverse((m) => {
      const mat = (m as THREE.Mesh).material as THREE.MeshStandardMaterial | undefined;
      if (!mat) return;
      mat.transparent = false;
      mat.alphaTest = 0;
      mat.opacity = 1;
      mat.depthWrite = true;
      mat.emissive = new THREE.Color(0xff5a46);
      mat.emissiveMap = this.pressTex;
      mat.emissiveIntensity = 1.6;
    });
    // los botones vienen con huesos y la piel se dibuja a otra escala que su caja: para estar quieto
    // en la mesa basta una malla normal
    const skinned: THREE.SkinnedMesh[] = [];
    remote.traverse((o) => (o as THREE.SkinnedMesh).isSkinnedMesh && skinned.push(o as THREE.SkinnedMesh));
    for (const sk of skinned) {
      const m = new THREE.Mesh(sk.geometry, sk.material);
      m.position.copy(sk.position);
      m.quaternion.copy(sk.quaternion);
      m.scale.copy(sk.scale);
      sk.parent!.add(m);
      sk.removeFromParent();
    }
    remote.updateMatrixWorld(true); // sin esto la caja sale en las unidades cuantizadas de meshopt
    const rb = new THREE.Box3().setFromObject(remote);
    const rs = rb.getSize(new THREE.Vector3());
    const rk = 0.24 / Math.max(rs.x, rs.y, rs.z);
    remote.scale.setScalar(rk);
    remote.rotation.x = Math.PI / 2;
    const rc = rb.getCenter(new THREE.Vector3());
    remote.position.set(-rc.x * rk, 0, -rc.y * rk);
    this.remote.add(remote);
    this.remote.position.set(0.62, DESK_Y + 0.012, DESK_Z + 0.22);
    this.remote.rotation.y = -0.15;
    this.scene.add(this.remote);
    // cada pantalla sabe hacia dónde queda el mando, para su flechita
    const rp = this.remote.getWorldPosition(new THREE.Vector3());
    for (const sc of this.screens) {
      const d = rp.clone().sub(sc.center);
      sc.mat.uniforms.uDir.value.set(d.dot(sc.right), d.dot(sc.up)).normalize();
      sc.mat.uniforms.uDist.value = d.length();
    }

    // el reloj de la sala, en la mesa junto a la foto, girado hacia la silla
    this.clock.group.position.set(-0.3, DESK_Y, DESK_Z - 0.26);
    this.clock.group.rotation.y = 0.15;
    this.scene.add(this.clock.group);

    // la cámara de seguridad, en la esquina del techo, mirando a la silla
    cam.updateMatrixWorld(true);
    const kb = new THREE.Box3().setFromObject(cam);
    cam.scale.setScalar(0.32 / Math.max(...kb.getSize(new THREE.Vector3()).toArray()));
    cam.position.set(x1 - 0.3, ROOM_H - 0.25, 2.6);
    cam.lookAt(0, 0.9, 0);
    this.scene.add(cam);

    // lo que enseñan las teles: su canal, o un relleno (cámaras, terminales, mapa) y algo de estática
    this.fillers = makeFillers();
    let f = 0;
    const fail = (sc: Screen) => {
      sc.failed = true;
      sc.live = { tex: null, mono: 0, mode: 0 };
      if (this.display === 'live') this.setDisplay('live');
    };
    for (const sc of this.screens) {
      const b = sc.channel?.broadcast;
      if (b?.kind === 'video') {
        const v = (sc.video = Object.assign(document.createElement('video'), { src: b.src, muted: true, loop: true, playsInline: true, crossOrigin: 'anonymous' }));
        const tex = new THREE.VideoTexture(v);
        tex.colorSpace = THREE.SRGBColorSpace;
        sc.live = { tex, mono: 0, mode: 1 };
        v.onerror = () => fail(sc);
        v.play().catch(() => {});
      } else if (b?.kind === 'image') {
        const tex = new THREE.TextureLoader().load(b.src, undefined, undefined, () => fail(sc));
        tex.colorSpace = THREE.SRGBColorSpace;
        sc.live = { tex, mono: 0, mode: 1 };
      } else if (sc.channel) {
        const c = Object.assign(document.createElement('canvas'), { width: 512, height: 384 });
        const tex = new THREE.CanvasTexture(c);
        tex.colorSpace = THREE.SRGBColorSpace;
        sc.paint = { canvas: c, tex, def: broadcastFor(sc.channel) };
        sc.live = { tex, mono: 0, mode: 1 };
      } else if ((f++ * 7) % 10 < 7) {
        const fl = this.fillers[f % this.fillers.length];
        sc.live = { tex: fl.tex, mono: fl.mono ? 1 : 0, mode: 1 };
      } else sc.live = { tex: null, mono: 0, mode: 0 };
    }

    // los programas del muro se proyectan desde la silla
    this.wall = makeWallShows(this.camera.aspect);
    this.aimWall();

    await breathe();
    // las cámaras de la habitación, reveladas igual que en el virus, con su rótulo
    this.cams = [];
    for (const b of this.opts.feeds) {
      const canvas = Object.assign(document.createElement('canvas'), { width: CCTV_W, height: CCTV_H });
      const tex = new THREE.CanvasTexture(canvas);
      tex.colorSpace = THREE.SRGBColorSpace;
      this.cams.push({ canvas, base: gradeCctv(b), tex });
      await breathe();
    }
    this.stampCams();
    this.setDisplay('live');

    // reflejos: todo refleja un poco el muro y las ventanas; el suelo y la mesa, de verdad
    this.scene.environment = this.reflections(x0, x1);
    this.scene.traverse((o) => {
      for (const m of ([] as THREE.Material[]).concat((o as THREE.Mesh).material ?? []))
        if ((m as THREE.MeshStandardMaterial).isMeshStandardMaterial) (m as THREE.MeshStandardMaterial).envMapIntensity = m.userData.env ?? 0.3;
    });
  }

  // lo que se refleja: la banda de teles encendidas, las dos ventanas y el flexo, a lo bruto
  private reflections(x0: number, x1: number) {
    const env = new THREE.Scene();
    env.background = new THREE.Color(0x040202);
    const c = Object.assign(document.createElement('canvas'), { width: 256, height: 64 }), x = c.getContext('2d')!;
    x.fillStyle = '#080303';
    x.fillRect(0, 0, 256, 64);
    for (let i = 0; i < 16; i++)
      for (let j = 0; j < 4; j++) {
        x.fillStyle = ['#7a1510', '#c4221a', '#6a6a6a', '#2a0605'][(Math.random() * 4) | 0];
        x.fillRect(i * 16 + 2, j * 16 + 2, 12, 11);
      }
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    const band = new THREE.Mesh(new THREE.PlaneGeometry(6, 1.9), new THREE.MeshBasicMaterial({ map: t }));
    band.position.set(0, 1.35, WALL_Z);
    env.add(band);
    for (const wx of [x0 + 1.1, x1 - 1.1]) {
      const win = new THREE.Mesh(new THREE.PlaneGeometry(1.25, 1.45), new THREE.MeshBasicMaterial({ color: 0x1c2638 }));
      win.position.set(wx, 1.7, WALL_Z - 0.75);
      env.add(win);
    }
    const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.08), new THREE.MeshBasicMaterial({ color: 0xffa070 }));
    lamp.position.set(-1.65, DESK_Y + 0.4, DESK_Z - 0.1);
    env.add(lamp);
    const pm = new THREE.PMREMGenerator(this.renderer);
    const rt = pm.fromScene(env, 0.02, 0.1, 40);
    pm.dispose();
    t.dispose();
    return rt.texture;
  }

  private stampCams() {
    const time = new Date().toLocaleTimeString('en-GB');
    this.cams.forEach((c, k) => {
      const x = c.canvas.getContext('2d')!;
      x.putImageData(c.base, 0, 0);
      stampCctv(x, k + 1, time, CCTV_FONT);
      c.tex.needsUpdate = true;
    });
  }


  // ── qué enseñan las teles: las cámaras (llegada), la flecha (hasta coger el mando) o en directo

  setDisplay(d: Display) {
    if (d === 'feeds' && !this.cams.length) d = 'live';
    this.display = d;
    if (d === 'mask' || d === 'rain') this.wall?.set(d);
    this.screens.forEach((sc, i) => {
      const u = sc.mat.uniforms;
      if (d === 'live') {
        u.tFeed.value = sc.live?.tex ?? null;
        u.uMono.value = sc.live?.mono ?? 0;
        u.uMode.value = sc.live?.mode ?? 0;
      } else if (d === 'mask' || d === 'rain') {
        u.tWall.value = this.wall!.tex;
        u.uMode.value = 3;
        u.uMono.value = 0;
      } else if (d === 'feeds') {
        // tu habitación sale solo en la pantalla 0 (la CAM 03 del virus); en las demás, la máscara
        // o animaciones sueltas
        const fl = i % 3 === 1 ? this.fillers[0] : this.fillers[1 + ((i * 7) % (this.fillers.length - 1))];
        u.tFeed.value = i === 0 ? this.cams[Math.min(2, this.cams.length - 1)].tex : fl.tex;
        u.uMono.value = i === 0 || !fl.mono ? 0 : 1;
        u.uMode.value = 1;
      } else u.uMode.value = 2;
      u.uCctv.value = d === 'feeds' && i === 0 ? 1 : 0;
      u.uFocus.value = 0;
      u.uSteady.value = 0;
    });
    this.focused = -1;
  }

  /**
   * La llegada: la cámara empieza tan pegada a la pantalla 0 que la llena como la imagen
   * final del virus, y retrocede 3.5 s hasta el plano general. A los 2 s, la flecha.
   */
  startIntro(): Promise<void> {
    const sc = this.screens[0];
    this.setDisplay('feeds');
    this.cctv.uniforms.uAmt.value = this.display === 'feeds' ? 1 : 0;
    if (!sc || this.display !== 'feeds') {
      this.setDisplay('arrow');
      return Promise.resolve();
    }
    const normal = new THREE.Vector3().crossVectors(sc.right, sc.up).normalize();
    const fov = THREE.MathUtils.degToRad(this.camera.fov);
    const visH = Math.min(sc.size.y, sc.size.x / this.camera.aspect) * 0.995;
    const d = visH / 2 / Math.tan(fov / 2);
    const from = sc.center.clone().addScaledVector(normal, d), look0 = sc.center.clone();
    const u = sc.mat.uniforms;
    const set = (p: number) => {
      this.camPos.lerpVectors(from, HOME_POS, p);
      this.camLook.lerpVectors(look0, HOME_LOOK, p);
      u.uFlat.value = 1 - Math.min(1, p * 2.5);
      // al salir de la pantalla deja de verse a través de la cámara
      this.cctv.uniforms.uAmt.value = 1 - THREE.MathUtils.smoothstep(p, 0.05, 0.4);
      this.sway = p;
    };
    return new Promise((res) => {
      const arrow = () => {
        this.introDone = true;
        this.timers.push(window.setTimeout(() => (this.setDisplay('arrow'), res()), 2000));
      };
      if (this.opts.reduced) {
        set(1);
        return arrow();
      }
      set(0);
      const st = { p: 0 };
      this.intro = gsap.to(st, { p: 1, duration: 5.5, delay: 1.6, ease: 'power2.inOut', onUpdate: () => set(st.p), onComplete: arrow });
    });
  }

  /** ¿Está el puntero (coordenadas -1..1) encima del mando? */
  hitRemote(ndc: THREE.Vector2) {
    this.ray.setFromCamera(ndc, this.camera);
    return this.ray.intersectObject(this.remote, true).length > 0;
  }

  // abajo a la derecha de la vista, de pie y algo inclinado hacia ti, como en la mano
  private holdPos() {
    const z = 0.33, h = z * Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2));
    return new THREE.Vector3(h * this.camera.aspect * 0.66, -h * 0.25, -z);
  }

  /** Coger el mando: viaja de la mesa a la mano en 0.6 s y las teles pasan a sus canales. */
  pickUp() {
    if (this.holding) return;
    this.holding = true;
    this.camera.updateMatrixWorld();
    this.camera.attach(this.remote);
    const p0 = this.remote.position.clone(), q0 = this.remote.quaternion.clone();
    const p1 = this.holdPos(), q1 = new THREE.Quaternion().setFromEuler(new THREE.Euler(1.2, 0, 0.12));
    const st = { p: 0 };
    const set = () => {
      this.remote.position.lerpVectors(p0, p1, st.p);
      this.remote.quaternion.slerpQuaternions(q0, q1, st.p);
    };
    if (this.opts.reduced) (st.p = 1), set();
    else this.hold = gsap.to(st, { p: 1, duration: 0.6, ease: 'power2.out', onUpdate: set });
    this.seat();
  }

  /** Volver a la silla; ya sentado, el muro se pone a cambiar de programa solo. */
  seat() {
    this.noise?.kill();
    this.seated = false;
    this.setDisplay('live');
    this.travelTo(SEAT_POS, SEAT_LOOK, 1.4, () => {
      this.seated = true;
      this.nextProgram(performance.now());
    });
  }

  // la vista desde la silla, con la lente de la cámara: cada tele saca de ahí su trozo del programa
  private aimWall() {
    const eye = this.camera.clone(false); // sin el mando colgado
    eye.position.copy(SEAT_POS);
    eye.lookAt(SEAT_LOOK);
    eye.updateMatrixWorld();
    const vp = new THREE.Matrix4().multiplyMatrices(eye.projectionMatrix, eye.matrixWorldInverse);
    for (const sc of this.screens) sc.mat.uniforms.uWallVP.value.copy(vp);
    this.wall?.resize(this.camera.aspect);
  }

  private nextProgram(now: number) {
    const all: Display[] = ['live', 'mask', 'rain'];
    const next = all.filter((d) => d !== this.display);
    const d = next[(Math.random() * next.length) | 0];
    this.progAt = now;
    this.progLen = d === 'live' ? 10000 : 8000;
    this.setDisplay(d);
    this.burst();
  }

  // al cambiar de programa, todo el muro da un golpe de estática a la vez
  private burst() {
    if (this.opts.reduced) return;
    this.noise?.kill();
    this.noise = gsap.fromTo(this.screens.map((sc) => sc.mat.uniforms.uFocus), { value: 1 }, { value: 0, duration: 0.4, ease: 'power2.in' });
  }

  // la cámara viaja a otro sitio; si llega otro viaje a mitad, gana el último
  private travelTo(to: THREE.Vector3, look: THREE.Vector3, dur: number, done: () => void) {
    this.travel?.kill();
    this.aiming = true;
    const p0 = this.camPos.clone(), l0 = this.camLook.clone();
    const st = { p: 0 };
    const set = () => {
      this.camPos.lerpVectors(p0, to, st.p);
      this.camLook.lerpVectors(l0, look, st.p);
    };
    if (this.opts.reduced) return (st.p = 1), set(), done();
    this.travel = gsap.to(st, { p: 1, duration: dur, ease: 'power2.inOut', onUpdate: set, onComplete: done });
  }

  /** El botón bajo el puntero (con el mando en la mano), y lo hunde: brillo 120 ms. */
  pressAt(ndc: THREE.Vector2): RemoteButton | null {
    if (!this.holding) return null;
    this.ray.setFromCamera(ndc, this.camera);
    const uv = this.ray.intersectObject(this.remote, true)[0]?.uv;
    if (process.env.NODE_ENV === 'development' && uv) console.debug('[mando] uv', uv.x.toFixed(3), uv.y.toFixed(3));
    const b = uv ? buttonAt(uv) : null;
    if (b) this.light(b);
    return b;
  }

  /** Enciende el botón un instante (también cuando lo pulsas con el teclado). */
  light(b: RemoteButton) {
    const r = REMOTE_BUTTONS.find((x) => x.id === b)!.uv, x = this.press.getContext('2d')!, W = this.press.width;
    x.clearRect(0, 0, W, W);
    x.fillStyle = '#fff';
    x.fillRect(r[0] * W, r[1] * W, (r[2] - r[0]) * W, (r[3] - r[1]) * W);
    this.pressTex.needsUpdate = true;
    clearTimeout(this.pressTimer);
    this.pressTimer = window.setTimeout(() => {
      x.clearRect(0, 0, W, W);
      this.pressTex.needsUpdate = true;
    }, 120);
  }

  /**
   * Ir a la tele i: 1.2 s de viaje hasta tenerla de frente ocupando el 70 % del alto, con
   * estática mientras tanto. Si llega otra petición a mitad, gana la última.
   */
  focus(i: number, onArrive: () => void) {
    const sc = this.screens[i];
    if (!sc) return;
    this.noise?.kill();
    this.seated = false;
    this.setDisplay('live');
    const u = sc.mat.uniforms;
    u.uFocus.value = 1;
    u.uSteady.value = 1;
    const normal = new THREE.Vector3().crossVectors(sc.right, sc.up).normalize();
    const fov = THREE.MathUtils.degToRad(this.camera.fov);
    const visH = Math.max(sc.size.y / 0.7, sc.size.x / 0.8 / this.camera.aspect);
    const to = sc.center.clone().addScaledVector(normal, visH / 2 / Math.tan(fov / 2));
    const done = () => {
      // su emisión, en grande (un vídeo que no cargó enseña aquí la tarjeta); el ruido se va
      if (sc.channel && (sc.paint || sc.failed)) {
        this.focused = i;
        this.paintHi(0);
        u.tFeed.value = this.hiTex;
        u.uMode.value = 1;
        u.uMono.value = 0;
      }
      if (this.opts.reduced) u.uFocus.value = 0;
      else this.noise = gsap.to(u.uFocus, { value: 0, duration: 0.45, ease: 'power2.in' });
      onArrive();
    };
    this.travelTo(to, sc.center, 1.2, done);
  }

  private hugs = new Map<string, Float32Array>();
  private addTv(tpl: THREE.Object3D, model: TvModel, pos: [number, number, number], rotY: number, width: number) {
    const def = TV_MODELS[model];
    const group = new THREE.Group();
    const inner = tpl.clone(true);
    // la transmisión del cristal de old_tv da píxeles infinitos (y no aporta nada a oscuras)
    inner.traverse((o) => {
      const m = (o as THREE.Mesh).material as THREE.MeshPhysicalMaterial | undefined;
      if (!m) return;
      if (m.transmission) m.transmission = 0;
      m.emissiveIntensity = Math.min(m.emissiveIntensity ?? 0, 1); // el piloto de antennatv viene a x50
    });
    inner.rotation.y = FRONT_ROT[def.front];
    inner.updateMatrixWorld(true);
    const b0 = new THREE.Box3().setFromObject(inner), s0 = b0.getSize(new THREE.Vector3()), c0 = b0.getCenter(new THREE.Vector3());
    const k = width / s0.x;
    inner.scale.setScalar(k);
    inner.position.set(-c0.x * k, -b0.min.y * k, -c0.z * k);
    group.add(inner);
    group.position.set(...pos);
    group.rotation.y = rotY;
    this.scene.add(group);

    if (def.screens instanceof RegExp) {
      const re = def.screens;
      inner.traverse((o) => {
        const m = o as THREE.Mesh;
        if (m.isMesh && re.test((m.material as THREE.Material).name)) {
          m.material = createScreenMaterial();
          this.screens.push({ ...this.frameOf(m), model });
        }
      });
    } else {
      const m0 = Math.max(s0.x, s0.y, s0.z);
      def.screens.forEach((r, i) => {
        const mat = createScreenMaterial();
        const plane = new THREE.Mesh(new THREE.PlaneGeometry(r.s[0] * m0 * k, r.s[1] * m0 * k, 12, 12), mat);
        plane.position.set((c0.x + r.c[0] * m0) * k + inner.position.x, (c0.y + r.c[1] * m0) * k + inner.position.y, (c0.z + (r.c[2] + 0.004) * m0) * k + inner.position.z);
        group.add(plane);
        // ajustarse al cristal son 169 rayos contra todo el modelo: se hace una vez por modelo y
        // las demás teles iguales lo copian (todo escala con k), o el muro tardaba segundos en montarse
        const pos = plane.geometry.getAttribute('position') as THREE.BufferAttribute, key = `${model}:${i}`, hug = this.hugs.get(key);
        if (hug) pos.array.set(hug.map((v) => v * k));
        else {
          this.hugGlass(plane, inner);
          this.hugs.set(key, Float32Array.from(pos.array, (v) => v / k));
        }
        pos.needsUpdate = true;
        plane.geometry.computeBoundingSphere();
        this.screens.push({ ...this.frameOf(plane), model });
      });
    }
  }

  /*
   * El rectángulo medido a ojo es plano y el cristal del tubo es abombado: en las esquinas
   * quedaba 4 cm por delante, y visto de lado se notaba la imagen flotando. Cada vértice se
   * empuja hacia dentro hasta el cristal del modelo, y queda a 2 mm de él.
   */
  private hugGlass(plane: THREE.Mesh, model: THREE.Object3D) {
    plane.updateWorldMatrix(true, false);
    model.updateWorldMatrix(false, true);
    const n = new THREE.Vector3(0, 0, 1).transformDirection(plane.matrixWorld);
    const ray = new THREE.Raycaster(), back = n.clone().negate(), inv = plane.matrixWorld.clone().invert();
    const pos = plane.geometry.getAttribute('position') as THREE.BufferAttribute, v = new THREE.Vector3();
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i).applyMatrix4(plane.matrixWorld);
      ray.set(v.clone().addScaledVector(n, 0.05), back);
      const hit = ray.intersectObject(model, true)[0];
      if (hit) pos.setXYZ(i, ...hit.point.addScaledVector(n, 0.002).applyMatrix4(inv).toArray());
    }
    pos.needsUpdate = true;
    plane.geometry.computeBoundingSphere();
  }

  private paintHi(t: number) {
    const sc = this.screens[this.focused];
    const paint = sc?.channel && broadcastFor(sc.channel).paint;
    if (!paint) return;
    paint(this.hi.getContext('2d')!, sc.channel!, t);
    this.hiTex.needsUpdate = true;
  }

  // centro, ejes y tamaño de una pantalla en el mundo, a partir de sus vértices
  private frameOf(m: THREE.Mesh): Screen {
    m.updateWorldMatrix(true, false);
    const pos = m.geometry.getAttribute('position'), nrm = m.geometry.getAttribute('normal');
    const nm = new THREE.Matrix3().getNormalMatrix(m.matrixWorld);
    const normal = new THREE.Vector3(), v = new THREE.Vector3(), pts: THREE.Vector3[] = [];
    for (let i = 0; i < pos.count; i++) {
      pts.push(v.fromBufferAttribute(pos, i).applyMatrix4(m.matrixWorld).clone());
      if (nrm) normal.add(v.fromBufferAttribute(nrm, i).applyMatrix3(nm));
    }
    if (normal.lengthSq() < 1e-6) normal.set(0, 0, 1).applyQuaternion(m.getWorldQuaternion(new THREE.Quaternion()));
    normal.y = 0;
    normal.normalize();
    const right = new THREE.Vector3(0, 1, 0).cross(normal).normalize();
    const up = new THREE.Vector3().crossVectors(normal, right);
    const c = pts.reduce((a, p) => a.add(p), new THREE.Vector3()).divideScalar(pts.length);
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity, z1 = -Infinity;
    for (const p of pts) {
      const d = p.clone().sub(c);
      const x = d.dot(right), y = d.dot(up), z = d.dot(normal);
      x0 = Math.min(x0, x);
      x1 = Math.max(x1, x);
      y0 = Math.min(y0, y);
      y1 = Math.max(y1, y);
      z1 = Math.max(z1, z);
    }
    const center = c.add(right.clone().multiplyScalar((x0 + x1) / 2)).add(up.clone().multiplyScalar((y0 + y1) / 2)).add(normal.clone().multiplyScalar(z1));
    const mat = m.material as THREE.ShaderMaterial;
    const size = new THREE.Vector2(x1 - x0, y1 - y0);
    mat.uniforms.uCenter.value.copy(center);
    mat.uniforms.uRight.value.copy(right);
    mat.uniforms.uUp.value.copy(up);
    mat.uniforms.uSize.value.copy(size);
    return { mesh: m, mat, center, right, up, size };
  }

  /** El rectángulo de la pantalla i en la ventana, en píxeles CSS. */
  screenRect(i: number): DOMRect | null {
    const sc = this.screens[i];
    if (!sc) return null;
    const r = this.opts.canvas.getBoundingClientRect();
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const [a, b] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
      const p = sc.center.clone().addScaledVector(sc.right, (a * sc.size.x) / 2).addScaledVector(sc.up, (b * sc.size.y) / 2).project(this.camera);
      const x = r.left + ((p.x + 1) / 2) * r.width, y = r.top + ((1 - p.y) / 2) * r.height;
      x0 = Math.min(x0, x);
      x1 = Math.max(x1, x);
      y0 = Math.min(y0, y);
      y1 = Math.max(y1, y);
    }
    return new DOMRect(x0, y0, x1 - x0, y1 - y0);
  }

  resize = () => {
    const c = this.opts.canvas, w = c.clientWidth, h = c.clientHeight;
    this.renderer.setSize(w, h, false);
    this.composer.setSize(w, h);
    this.cctv?.uniforms.uRes.value.set(w, h);
    this.camera.aspect = w / h;
    // en vertical, más ángulo para que el muro siga entrando
    this.camera.fov = THREE.MathUtils.clamp(THREE.MathUtils.radToDeg(2 * Math.atan(Math.tan(THREE.MathUtils.degToRad(24)) / Math.min(1, w / h / 1.4))), 45, 80);
    this.camera.updateProjectionMatrix();
    if (this.holding && !this.hold?.isActive()) this.remote.position.copy(this.holdPos());
    if (this.wall) this.aimWall();
  };

  private last = performance.now();
  private frame = (now: number) => {
    this.raf = requestAnimationFrame(this.frame);
    if (this.paused) return void (this.last = now);
    const t = (now - this.t0) / 1000, dt = Math.min(0.1, (now - this.last) / 1000);
    this.last = now;
    for (const sc of this.screens) sc.mat.uniforms.uTime.value = t;
    this.cctv.uniforms.uTime.value = t;
    // rellenos y emisiones a la vista a 10 fps; las que quedan fuera del encuadre, a 2
    if (now - this.lastPaint > 100) {
      this.lastPaint = now;
      const slow = ((now / 100) | 0) % 5 === 0;
      for (const f of this.fillers) f.update?.(t);
      this.frustum.setFromProjectionMatrix(new THREE.Matrix4().multiplyMatrices(this.camera.projectionMatrix, this.camera.matrixWorldInverse));
      for (const sc of this.screens)
        if (sc.paint?.def.paint && (slow || this.frustum.containsPoint(sc.center))) {
          sc.paint.def.paint(sc.paint.canvas.getContext('2d')!, sc.channel!, t);
          sc.paint.tex.needsUpdate = true;
        }
      if (this.focused >= 0) this.paintHi(t);
      if (this.display === 'mask' || this.display === 'rain') {
        this.wall?.update(t, Math.min(0.25, (now - (this.lastWall || now)) / 1000));
        this.lastWall = now;
      }
    }
    if (this.seated && now - this.progAt > this.progLen) this.nextProgram(now);
    for (const f of this.ticks) f(t, dt);
    if (this.introDone && !this.aiming) {
      this.near += (this.approach - this.near) * (this.opts.reduced ? 1 : 1 - Math.exp(-dt * 4));
      const e = this.near * this.near * (3 - 2 * this.near);
      this.camPos.lerpVectors(HOME_POS, DESK_POS, e);
      this.camLook.lerpVectors(HOME_LOOK, DESK_LOOK, e);
    }
    // la luz de las pantallas tiembla un poco, como ellas
    if (!this.dark) this.screenLights.forEach((l, i) => (l.intensity = 1.3 * (0.88 + 0.12 * Math.sin(t * 7.3 + i * 2.1) * Math.sin(t * 2.9 + i))));
    this.camera.position.copy(this.camPos);
    if (!this.opts.reduced) this.camera.position.add(new THREE.Vector3(Math.sin(t * 0.31) * 0.012, Math.sin(t * 0.47) * 0.008, 0).multiplyScalar(this.sway));
    if (this.display === 'feeds' && now - this.lastStamp > 1000) {
      this.lastStamp = now;
      this.stampCams();
    }

    this.camera.lookAt(this.camLook);
    for (const f of this.onFrame) f(t, dt);
    this.composer.render();
  };

  /** Apagarlo todo: cada tele se aplasta en una línea y en un punto, con su desfase; las luces caen. */
  powerOff() {
    this.dark = true;
    this.seated = false;
    this.noise?.kill();
    this.travel?.kill();
    this.setDisplay('live');
    this.focused = -1;
    const dur = 0.45;
    for (const sc of this.screens) {
      sc.mat.uniforms.uFocus.value = 0;
      gsap.to(sc.mat.uniforms.uOff, { value: 1, duration: dur, delay: Math.random() * 0.12, ease: 'power1.in' });
    }
    for (const l of this.lights) gsap.to(l, { intensity: 0, duration: dur + 0.12, ease: 'power2.in' });
    return new Promise<void>((res) => this.timers.push(window.setTimeout(res, (dur + 0.15) * 1000)));
  }

  /** La tele más centrada del muro, la que se enciende sola (sin antenas que crucen la imagen). */
  centerScreen() {
    const d = (sc: Screen) => Math.abs(sc.center.x) + Math.abs(sc.center.y - 1.35) + (sc.model === 'antennatv' ? 9 : 0);
    let best = 0;
    this.screens.forEach((sc, i) => d(sc) < d(this.screens[best]) && (best = i));
    return best;
  }

  /**
   * Una sola tele vuelve a encenderse con `tex` (imagen de cámara de seguridad) y la cámara se le
   * acerca despacio hasta que la pantalla llena la vista. `onFrame` va en cada fotograma.
   */
  showFeed(i: number, tex: THREE.Texture, onFrame: (dt: number) => void) {
    const sc = this.screens[i], u = sc.mat.uniforms;
    // a oscuras ya no hacen falta el mando en la mano ni los cables colgando delante de la tele
    this.remote.visible = false;
    this.scene.traverse((o) => o.name === 'cable' && (o.visible = false));
    u.tFeed.value = tex;
    u.uMode.value = 1;
    u.uMono.value = 0;
    u.uCctv.value = 0.45; // la grabación ya trae su grano: aquí, poco más
    u.uSteady.value = 1;
    u.uGain.value = 7; // llega en lineal y oscura: en el tubo, más viva
    gsap.to(u.uOff, { value: 0, duration: 0.3, ease: 'power2.out' });
    // su luz, fría, sobre la mesa y la silla: una de las de pantalla, ya apagada (una luz nueva
    // cambiaría cuántas hay y recompilaría todos los shaders de la sala)
    const glow = this.screenLights[1];
    const normal = new THREE.Vector3().crossVectors(sc.right, sc.up).normalize();
    glow.color.set(0xb8c4e0);
    glow.distance = 3.5;
    glow.position.copy(sc.center).addScaledVector(normal, 0.4);
    gsap.to(glow, { intensity: 1.2, duration: 0.6 });
    this.onFrame.add((_t, dt) => onFrame(dt));
    // hasta tener la pantalla de lado a lado, despacio, mientras dura la grabación
    const fov = THREE.MathUtils.degToRad(this.camera.fov);
    const visH = Math.min(sc.size.y / 1.02, sc.size.x / 1.02 / this.camera.aspect);
    const to = sc.center.clone().addScaledVector(normal, visH / 2 / Math.tan(fov / 2));
    this.aiming = true;
    this.travel?.kill();
    const p0 = this.camPos.clone(), l0 = this.camLook.clone(), st = { k: 0 };
    this.travel = gsap.to(st, {
      k: 1,
      duration: this.opts.reduced ? 2 : 11,
      ease: 'power1.inOut',
      onUpdate: () => {
        this.camPos.lerpVectors(p0, to, st.k);
        this.camLook.lerpVectors(l0, sc.center, st.k);
      },
    });
    this.sway = 0;
  }

  /** Desecha la sala pero no el renderer ni su lienzo: siguen en la biblioteca. */
  release() {
    this.dispose(true);
    return { renderer: this.renderer, canvas: this.opts.canvas };
  }

  dispose(keepRenderer = false) {
    if (this.disposed) return;
    this.disposed = true;
    cancelAnimationFrame(this.raf);
    this.intro?.kill();
    this.travel?.kill();
    this.hold?.kill();
    this.noise?.kill();
    this.hiTex.dispose();
    this.clock.dispose();
    this.scene.environment?.dispose();
    clearTimeout(this.pressTimer);
    this.timers.forEach(clearTimeout);
    for (const sc of this.screens) sc.video?.pause();
    this.pressTex.dispose();
    window.removeEventListener('resize', this.resize);
    disposeDeep(this.scene);
    this.composer.dispose();
    if (!keepRenderer) this.renderer.dispose();
  }
}
