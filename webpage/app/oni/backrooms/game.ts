import * as THREE from 'three';
import { GLTFLoader, type GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { compileGently } from '../compile';
import { CELL, generateMaze } from './maze';
import { World, center } from './world';
import { Input } from './input';
import { Player } from './player';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { FilmShader, VhsShader } from './vhsPass';
import { GameAudio } from './audio';
import { Items, type Target } from './items';
import { Entity, type Kind } from './entity';
import { Shatter } from './shatter';
import { TvRoom } from './tvRoom';
import { unlock } from '../achievements';

/** Lo que enseña el inventario. */
export interface Inv {
  hand: 'none' | 'camera' | 'gun';
  left: 'none' | 'flashlight';
  belt: 'none' | 'camera' | 'gun';
  stamina: number;
  sanity: number;
  escaped: boolean;
  camera: boolean;
  gun: boolean;
  ammo: number;
  spare: number;
  tapes: number;
  photos: number;
  thumbs: string[];
  flashOn: boolean;
  battery: number;
}

/** Lo que el OSD enseña, leído desde React diez veces por segundo. */
export interface Hud {
  bag: boolean;
  hint: string | null;
  inv: Inv;
  aiming: boolean;
  zoom: number;
  focus: boolean;
  tapes: number;
  photos: number;
  ammo: number | null; // en el cargador; null sin el rifle
  spare: number;
  battery: number; // 0–1
  time: number; // segundos de grabación
}

/*
 * Las backrooms: el juego de juegos/backrooms.exe. Sin React; el caparazón (Backrooms.tsx) lo carga,
 * lo arranca y lee su estado para el OSD.
 */

const DIR = '/models/backrooms/';
export const MODELS = ['hazmat', 'bacteria', 'partygoer', 'balloon', 'camcorder', 'vhs', 'gun', 'flashlight', 'elevator', 'vent', 'socket', 'exit', 'door', 'armchair'] as const;
export type ModelName = (typeof MODELS)[number];
export const TEXTURES = ['wall', 'carpet', 'ceiling'] as const;

export interface Assets {
  gltf: Record<ModelName, GLTF>;
  tex: Record<(typeof TEXTURES)[number], THREE.Texture>;
}

/** Descarga todo, con el progreso en bytes (aproximado: lo que diga cada respuesta). */
export async function loadAssets(progress: (f: number) => void): Promise<Assets> {
  const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
  const urls = [...MODELS.map((m) => DIR + m + '.glb'), ...TEXTURES.map((t) => DIR + 'tex/' + t + '.webp')];
  const got = new Map<string, number>(), total = new Map<string, number>();
  const tick = () => {
    let a = 0, b = 0;
    for (const u of urls) {
      const t = total.get(u) ?? 1;
      b += t;
      a += Math.min(t, got.get(u) ?? 0);
    }
    progress(a / b);
  };
  const on = (u: string) => (e: ProgressEvent) => {
    if (e.lengthComputable) total.set(u, e.total);
    got.set(u, e.loaded);
    tick();
  };
  const gltf = {} as Assets['gltf'], tex = {} as Assets['tex'];
  const tl = new THREE.TextureLoader();
  await Promise.all([
    ...MODELS.map((m) => loader.loadAsync(DIR + m + '.glb', on(DIR + m + '.glb')).then((g) => void (gltf[m] = g))),
    ...TEXTURES.map((t) =>
      tl.loadAsync(DIR + 'tex/' + t + '.webp').then((x) => {
        x.wrapS = x.wrapT = THREE.RepeatWrapping;
        x.colorSpace = THREE.SRGBColorSpace;
        x.anisotropy = 4;
        tex[t] = x;
        got.set(DIR + 'tex/' + t + '.webp', 1);
        tick();
      }),
    ),
  ]);
  return { gltf, tex };
}

/**
 * El juego. `load` lo descarga todo y compila los materiales con un laberinto de prueba (los de cada
 * partida comparten programas: no se vuelve a compilar al darle a Play); `start` monta una partida.
 */
export class BackroomsGame {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(70, 1, 0.05, 60);
  assets?: Assets;
  world?: World;
  // las luces, siempre las mismas (cambiar cuántas hay recompilaría todo): el cielo, la linterna y
  // cuatro puntos que se van a las lámparas más cercanas
  // (la luz del mapa va horneada: ver lightmap.ts; estas alumbran a los personajes y lo que se recoge)
  readonly hemi = new THREE.HemisphereLight(0xfff1c4, 0x3a2c0c, 0.22);
  readonly flash = new THREE.SpotLight(0xfff6e0, 0, 14, 0.45, 0.5, 1.6);
  readonly points = Array.from({ length: 4 }, () => new THREE.PointLight(0xffefc6, 3, 7, 1.8));
  private clock = new THREE.Clock(false);
  private t = 0;
  readonly input: Input;
  readonly composer: EffectComposer;
  readonly vhs = new ShaderPass(VhsShader);
  readonly film = new ShaderPass(FilmShader);
  // el polvo del aire: una caja de 8 m que va con la cámara (cada mota da la vuelta al salirse); brilla
  // dentro del haz de la linterna y apenas se ve fuera
  private dust = new THREE.Points(
    new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(Array.from({ length: 600 * 3 }, () => Math.random() * 8), 3)),
    new THREE.ShaderMaterial({
      uniforms: { uCam: { value: new THREE.Vector3() }, uTime: { value: 0 }, uBeam: { value: 1 }, uPx: { value: 1 } },
      vertexShader: /* glsl */ `
        uniform vec3 uCam;
        uniform float uTime, uBeam, uPx;
        varying float vA;
        void main() {
          // a la deriva, lenta, y siempre en una caja de 8 m centrada en la cámara
          vec3 p = position + vec3(sin(uTime * 0.13 + position.y) * 0.4, -uTime * 0.03, cos(uTime * 0.11 + position.x) * 0.4);
          p = mod(p - uCam + 4.0, 8.0) - 4.0 + uCam;
          vec4 mv = modelViewMatrix * vec4(p, 1.0);
          float d = length(mv.xyz);
          // el haz: el cono de la linterna (mira al frente desde la cámara), más fuerte cerca
          float beam = smoothstep(0.86, 0.97, dot(normalize(mv.xyz), vec3(0.0, -0.05, -1.0))) * uBeam * smoothstep(7.0, 1.0, d);
          vA = 0.025 + 0.55 * beam;
          gl_PointSize = uPx * 0.9 / max(d, 1.2); // las de muy cerca, no como pelotas
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: /* glsl */ `
        varying float vA;
        void main() {
          float r = length(gl_PointCoord - 0.5);
          gl_FragColor = vec4(vec3(1.0, 0.93, 0.78) * vA * smoothstep(0.5, 0.1, r), 1.0);
        }`,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    }),
  );
  audio?: GameAudio;
  private stepAcc = 0;
  corruption = 0;
  player?: Player;
  items?: Items;
  onWin?: () => void;
  private black = 0;
  private winning = false;
  entities: Entity[] = [];
  private shatters: Shatter[] = [];
  private balloons: THREE.Object3D[] = [];
  /** Segundos desde que se muere (-1: vivo). */
  private dying = -1;
  private killer?: Entity;
  private god = false;
  onDeath?: () => void;
  private snap?: THREE.WebGLRenderTarget;
  // la camcorder que sale volando al morir: la vista es ella
  private fly?: { pos: THREE.Vector3; vel: THREE.Vector3; q: THREE.Quaternion; spin: THREE.Vector3; bounced: boolean };
  onPause?: () => void;
  private offs: (() => void)[] = [];
  private paused = false;
  bagOpen = false;
  // la sala de la tele, mientras carga
  tv?: TvRoom;
  private tvProgress = 0;
  tvFailed = false;
  private tvDone?: () => void;
  private froze = false;

  constructor(readonly canvas: HTMLCanvasElement, readonly opts: { low: boolean; reduced: boolean }) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 0.78; // sin la cinta encima, el amarillo quema
    // la sombra de la linterna, solo en escritorio
    this.renderer.shadowMap.enabled = !opts.low;
    this.flash.castShadow = !opts.low;
    this.flash.shadow.mapSize.set(512, 512);
    this.flash.shadow.camera.near = 0.2;
    this.flash.shadow.bias = -0.002;
    this.input = new Input(canvas);
    // la imagen: escena, el halo de los fluorescentes (no en calidad baja), color de pantalla, el grano y,
    // mirando por la cámara, la cinta encima
    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    if (!opts.low) this.composer.addPass(new UnrealBloomPass(new THREE.Vector2(256, 256), 0.55, 0.6, 0.92));
    this.composer.addPass(new OutputPass());
    this.composer.addPass(this.film);
    this.composer.addPass(this.vhs);
    this.film.uniforms.uMove.value = opts.reduced ? 0 : 1;
    const u = this.vhs.uniforms;
    u.uMove.value = opts.reduced ? 0 : 1;
    u.uLow.value = opts.low ? 1 : 0;
    u.tPrev.value = new THREE.DataTexture(new Uint8Array([0, 0, 0, 255]), 1, 1);
    u.tPrev.value.needsUpdate = true;
    this.scene.background = new THREE.Color(0x17130a);
    this.scene.fog = new THREE.Fog(0x17130a, 3, 22);
    this.scene.add(this.hemi, this.camera, this.dust, ...this.points);
    this.dust.frustumCulled = false;
    this.camera.add(this.flash, this.flash.target);
    // sale de la lente de la linterna (en la mano izquierda), hacia el centro de la vista
    this.flash.position.set(-0.13, -0.16, -0.5);
    this.flash.target.position.set(0, -0.3, -6);
    const resize = () => {
      // como mucho a 1080 líneas (y a la mitad en calidad baja): el grano y la cinta lo ablandan igual
      const w = canvas.clientWidth || innerWidth, h = canvas.clientHeight || innerHeight, pr = Math.min(devicePixelRatio, 1080 / h) * (opts.low ? 0.6 : 1);
      this.renderer.setPixelRatio(pr);
      this.renderer.setSize(w, h, false);
      this.composer?.setPixelRatio(pr);
      this.composer?.setSize(w, h);
      this.vhs?.uniforms.uRes.value.set(w * pr, h * pr);
      if (this.vhs) this.vhs.uniforms.uAspect.value = w / h;
      this.film?.uniforms.uRes.value.set(w * pr, h * pr);
      this.tv?.resize(w / h);
      this.camera.aspect = w / h;
      this.camera.updateProjectionMatrix();
      if (this.paused) this.composer?.render(0); // el lienzo se borra al cambiar de tamaño: que la pausa no quede en negro
    };
    resize();
    addEventListener('resize', resize);
    this.offs.push(() => removeEventListener('resize', resize));
  }

  /** La sala de la tele: se pinta sola mientras carga (ver load) hasta que nos metemos dentro (diveIntoTv). */
  showTv() {
    const tv = (this.tv = new TvRoom(this.opts.reduced));
    tv.resize(this.camera.aspect);
    this.clock.start();
    this.renderer.setAnimationLoop(() => {
      const dt = Math.min(this.clock.getDelta(), 0.05);
      this.t += dt;
      tv.update(dt, this.t, this.tvProgress, this.tvFailed);
      this.renderer.render(tv.scene, tv.camera);
      if (this.tvDone && tv.near && tv.dive(dt, this.opts.reduced ? 0.2 : 1.3)) {
        this.renderer.setAnimationLoop(null);
        tv.dispose();
        this.tv = undefined;
        this.t = 0;
        this.tvDone();
      }
    });
  }

  /** Meterse en la tele (resuelve cuando la pantalla llena la vista). */
  diveIntoTv() {
    return new Promise<void>((r) => (this.tv ? (this.tvDone = r) : r()));
  }

  async load(progress: (f: number) => void) {
    const report = progress;
    progress = (f) => ((this.tvProgress = f), report(f));
    this.assets = await loadAssets((f) => progress(f * 0.8));
    // compilar con un laberinto cualquiera y el jugador con todo en las manos, en la pantalla de carga
    // (en Firefox, sin paralelo, es lento)
    const w = new World(generateMaze(1), this.assets), p = new Player(w, this.assets, this.camera, this.flash, true);
    for (const it of Object.values(p.items)) it.visible = true;
    this.scene.add(w.root);
    p.spawn(center(w.maze.start), 0);
    p.update(0, this.input.read());
    // las dos entidades (con piel) y sus trozos al reventar (sin piel)
    const es = (['bacteria', 'partygoer'] as Kind[]).map((k, i) => new Entity(k, w, this.assets!, w.maze.spawns[i] ?? w.maze.start));
    es.forEach((e) => e.update(0, p.pos, this.camera.position, true, true));
    w.root.add(Shatter.warm(es.map((e) => e.rig.root)));
    new Items(w, this.assets, p, this.camera); // y lo que se recoge (cintas, cámara y rifle en el suelo)
    await compileGently(this.renderer, this.scene, this.camera, undefined, (f) => progress(0.8 + f * 0.2));
    // y las pasadas (con todo lo de antes ya compilado): con y sin VHS, que la última pinta a pantalla y es otro programa
    this.vhs.enabled = false;
    this.composer.render(0);
    this.vhs.enabled = true;
    this.composer.render(0);
    es.forEach((e) => e.dispose());
    p.dispose();
    w.dispose();
    progress(1);
  }

  start(seed: number) {
    this.player?.dispose();
    this.world?.dispose();
    this.black = 0;
    this.winning = false;
    this.dying = -1;
    this.killer = undefined;
    this.outT = -1;
    this.nextOut = 70 + Math.random() * 50;
    this.audio?.power(1);
    this.bagOpen = false;
    this.input.suspend = false;
    this.vhs.uniforms.uCorrupt.value = 0;
    // desarrollo: &god, inmortal
    this.god = process.env.NODE_ENV === 'development' && new URLSearchParams(location.search).has('god');
    const w = (this.world = new World(generateMaze(seed), this.assets!));
    this.scene.add(w.root);
    const m = w.maze, s = m.start;
    const p = (this.player = new Player(w, this.assets!, this.camera, this.flash, this.opts.reduced));
    // mirando hacia el primer lado abierto (con yaw = 0 se mira a -z)
    const side = [[1, 0], [-1, 0], [0, 1], [0, -1]].find(([dx, dy]) => m.open[(s.y + dy) * m.w + s.x + dx]) ?? [0, -1];
    p.spawn(center(s), Math.atan2(-side[0], -side[1]));
    p.onFall = () => this.die();
    this.audio ??= new GameAudio();
    const it = (this.items = new Items(w, this.assets!, p, this.camera, this.audio));
    it.onWin = () => this.win();
    // al empezar, una de cada: la bacteria y el partygoer, en los arranques más lejanos
    this.entities = (['bacteria', 'partygoer'] as Kind[]).map((k, i) => new Entity(k, w, this.assets!, m.spawns[i] ?? m.spawns[0]));
    it.targets = this.entities;
    it.onKill = (t, from) => this.kill(t as Entity, from);
    this.input.begin();
    this.audio.start();
    this.t = 0;
    this.paused = false;
    this.clock.start();
    this.renderer.setAnimationLoop(() => this.frame());
  }

  private frame() {
    const dt = Math.min(this.clock.getDelta(), 0.05);
    if (this.paused) return;
    const c = this.input.read();
    // el inventario: E lo abre y lo cierra (Escape también lo cierra, sin pausar)
    if (this.dying < 0 && !this.winning && c.bag) {
      if (this.bagOpen) this.closeBag();
      else this.openBag();
    }
    if (c.pause && this.dying < 0 && !this.winning) {
      if (this.bagOpen) (this.bagOpen = false), (this.input.suspend = false); // una pausa de verdad también lo cierra
      return this.pause();
    }
    this.t += dt;
    this.player?.update(dt, c);
    if (c.flash && this.dying < 0) this.audio?.click();
    if (this.dying < 0) this.items?.update(this.t, dt, c);
    this.monsters(dt);
    if (this.dying >= 0) this.dyingFrame(dt);
    // pasos: uno cada ~0,7 m andando (algo más largos corriendo), si se pisa suelo
    const p = this.player;
    if (p && p.speed > 0 && p.pos.y === 0) {
      this.stepAcc += p.speed * dt;
      const len = p.speed > 2 ? 1.1 : 0.7;
      if (this.stepAcc > len) (this.stepAcc -= len), this.audio?.step(p.speed > 2);
    }
    if (this.world) {
      this.world.update(this.t, dt);
      this.blackouts(dt);
      const near = this.world.lightsNear(this.camera.position);
      near.forEach((l, i) => (this.points[i].position.copy(l.pos), (this.points[i].intensity = 3 * l.level)));
      // el zumbido: el del tubo que tienes encima (y nada en un apagón)
      this.audio?.power((near[0]?.level ?? 0) * (0.4 + 0.6 * THREE.MathUtils.clamp(1 - Math.sqrt(near[0]?.d ?? 99) / 6, 0, 1)));
      if (p) this.audio?.ambient(dt, this.openness(p.pos), 1 - p.sanity);
      const du = (this.dust.material as THREE.ShaderMaterial).uniforms;
      du.uCam.value.copy(this.camera.position);
      du.uTime.value = this.t;
      du.uBeam.value = p?.lightOn ? 1 : 0;
      du.uPx.value = this.renderer.getDrawingBufferSize(new THREE.Vector2()).y * 0.02;
    }
    // la cinta solo se ve mirando por la cámara (y al morir y en el ascensor, que es la grabación la que se corta)
    this.vhs.enabled = !!p?.aiming || this.dying >= 0 || this.winning;
    const u = this.vhs.uniforms;
    u.uTime.value = this.film.uniforms.uTime.value = this.t;
    u.uFlash.value = this.items?.flash ?? 0;
    if (this.winning) this.black = Math.min(1, this.black + dt / 1.5);
    u.uBlack.value = this.black;
    // la foto: se pinta el fotograma del flash y se queda congelado un instante
    const it = this.items;
    if (it && it.freeze > 0) {
      it.freeze -= dt;
      if (this.froze) return;
      this.froze = true;
    } else this.froze = false;
    // la foto: primero el fotograma sin flash, a una miniatura para el inventario
    if (it?.snap) {
      it.snap = false;
      u.uFlash.value = 0;
      this.composer.render(dt);
      it.thumbs.push(this.thumb());
      u.uFlash.value = it.flash;
    }
    this.composer.render(dt);
  }

  private thumbCv?: HTMLCanvasElement;
  /** Lo que hay ahora en el lienzo, a 160×120 en jpeg. */
  private thumb() {
    const c = (this.thumbCv ??= Object.assign(document.createElement('canvas'), { width: 160, height: 120 }));
    const src = this.renderer.domElement, x = c.getContext('2d')!, k = Math.max(160 / src.width, 120 / src.height);
    x.drawImage(src, (160 - src.width * k) / 2, (120 - src.height * k) / 2, src.width * k, src.height * k);
    return c.toDataURL('image/jpeg', 0.7);
  }

  get hud(): Hud {
    const p = this.player;
    const battery = Math.max(0.15, 1 - this.t / 900);
    const inv: Inv = { left: p?.left ?? 'flashlight', belt: p?.belt ?? 'none', stamina: p?.stamina ?? 1, sanity: p?.sanity ?? 1, escaped: this.winning, hand: p?.hand ?? 'none', camera: !!p?.has.camera, gun: !!p?.has.gun, ammo: p?.ammo ?? 0, spare: p?.spare ?? 0, tapes: this.items?.tapes ?? 0, photos: this.items?.photos ?? 0, thumbs: this.items?.thumbs ?? [], flashOn: !!p?.flashOn, battery };
    return { bag: this.bagOpen, hint: this.items?.hint ?? null, inv, aiming: !!p?.aiming, zoom: p?.zoom ?? 1, focus: !!this.items?.focus, tapes: this.items?.tapes ?? 0, photos: this.items?.photos ?? 0, ammo: p?.has.gun ? p.ammo : null, spare: p?.spare ?? 0, battery, time: this.t };
  }

  /** Lo abierto que es el sitio: las celdas libres en 7 × 7 alrededor (0–1). */
  private openness(at: THREE.Vector3) {
    const m = this.world!.maze, cx = Math.floor(at.x / CELL), cz = Math.floor(at.z / CELL);
    let n = 0;
    for (let y = cz - 3; y <= cz + 3; y++) for (let x = cx - 3; x <= cx + 3; x++) n += x >= 0 && y >= 0 && x < m.w && y < m.h ? m.open[y * m.w + x] : 0;
    return n / 49;
  }

  // los apagones: cada minuto o dos las luces tiemblan, se van unos segundos y vuelven con un golpe
  private nextOut = 70 + Math.random() * 50;
  private outT = -1;
  private blackouts(dt: number) {
    const w = this.world!;
    if (this.outT < 0) {
      if (this.t > this.nextOut && this.dying < 0 && !this.winning) this.outT = 0;
      return;
    }
    const was = w.power;
    this.outT += dt;
    const T = this.outT, down = 1.4, dark = 4.5;
    if (T < down) w.power = Math.random() < 0.5 ? 1 : 0.1; // tiembla
    else if (T < down + dark) w.power = 0;
    else if (T < down + dark + 0.5) w.power = Math.random() < 0.6 ? 1 : 0;
    else (w.power = 1), (this.outT = -1), (this.nextOut = this.t + 60 + Math.random() * 70);
    if (was > 0.5 !== w.power > 0.5 && Math.random() < 0.5) this.audio?.clunk(w.power > 0.5);
  }

  /** Las entidades, sus trozos, los globos sueltos y lo que se oye de ellas. */
  private monsters(dt: number) {
    const p = this.player!, eye = this.camera.position, near = { bacteria: Infinity, partygoer: Infinity };
    for (const e of this.entities) {
      if (!e.alive) continue;
      if (e.update(dt, p.pos, eye, p.lightOn, this.god) && this.dying < 0) this.die(e);
      near[e.kind] = Math.min(near[e.kind], e.pos.distanceTo(p.pos));
    }
    if (this.dying < 0) {
      this.audio?.near('bacteria', near.bacteria);
      this.audio?.near('partygoer', near.partygoer);
      // la cordura: a la luz se recupera; a oscuras se va (más deprisa sin linterna) y cerca de ellas, más
      const m = this.world!.maze, lit = this.world!.power > 0.5 && m.lit[Math.floor(p.pos.z / CELL) * m.w + Math.floor(p.pos.x / CELL)];
      const close = Math.min(near.bacteria, near.partygoer);
      const d = (lit ? 1 / 90 : p.lightOn ? -1 / 240 : -1 / 70) - (close < 10 ? (1 - close / 10) / 20 : 0);
      p.sanity = THREE.MathUtils.clamp(p.sanity + d * dt, 0, 1);
    }
    this.film.uniforms.uMad.value = this.dying < 0 ? 1 - (p.sanity) : 0;
    this.shatters = this.shatters.filter((s) => s.update(dt));
    this.balloons = this.balloons.filter((b) => {
      b.position.y += dt * 1.6;
      b.rotation.z = Math.sin(b.position.y * 2) * 0.3;
      if (b.position.y < 9) return true;
      b.removeFromParent();
      return false;
    });
  }

  /** Un tiro que mata: revienta, «Good job idiot, now what?» y otra del tipo contrario, más dura. */
  private kill(e: Entity, from: THREE.Vector3) {
    const s = new Shatter(e.rig.root, from);
    this.world!.root.add(s.root);
    this.shatters.push(s);
    if (e.balloon) this.balloons.push(e.balloon), (e.balloon = undefined);
    e.dispose();
    unlock('idiot');
    // la siguiente, en el arranque más lejano del jugador: 15 % más rápida y un tiro más
    const m = this.world!.maze, p = this.player!.pos;
    const far = [...m.spawns].sort((a, b) => center(b).distanceTo(p) - center(a).distanceTo(p))[0];
    this.entities.push(new Entity(e.kind === 'bacteria' ? 'partygoer' : 'bacteria', this.world!, this.assets!, far, Math.min(1.2, e.speed * 1.1), e.hp0 + 1));
  }

  /** Te pillan o te caes: la cámara al suelo, la entidad baila, la cinta se come y el cuelgue falso. */
  private die(e?: Entity) {
    if (this.dying >= 0 || this.winning || (this.god && e)) return;
    this.dying = 0;
    this.killer = e;
    this.fly = undefined;
    this.player!.frozen = true;
    if (e) this.player!.dead = true;
    this.player!.aiming = false; // fuera el visor de la camcorder
    this.player!.zoom = 1;
    if (this.items) this.items.freeze = 0;
    if (this.bagOpen) (this.bagOpen = false), (this.input.suspend = false);
    this.input.unlock();
    // un fotograma de ahora, para los trozos congelados de la corrupción
    const size = this.renderer.getDrawingBufferSize(new THREE.Vector2());
    this.snap = new THREE.WebGLRenderTarget(size.x / 2, size.y / 2);
    this.renderer.setRenderTarget(this.snap);
    this.renderer.render(this.scene, this.camera);
    this.renderer.setRenderTarget(null);
    this.vhs.uniforms.tPrev.value = this.snap.texture;
  }

  private dyingFrame(dt: number) {
    const t = (this.dying += dt), e = this.killer, p = this.player!, cam = this.camera;
    const look = (from: THREE.Vector3, to: THREE.Vector3) => new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().lookAt(from, to, new THREE.Vector3(0, 1, 0)));
    if (e) {
      const head = e.rig.bone('Head')?.getWorldPosition(new THREE.Vector3()) ?? e.pos.clone().setY(e.height * 0.9);
      if (t < 0.4) {
        // se lanza a la lente: la vista se clava en su cara, se abre de golpe y tiembla
        const k = t / 0.4;
        cam.quaternion.slerp(look(cam.position, head), Math.min(1, dt * 14));
        cam.fov = THREE.MathUtils.lerp(70, 100, k * k);
        if (!this.opts.reduced) cam.position.set(p.pos.x + (Math.random() - 0.5) * 0.08 * k, p.pos.y + 1.62 + (Math.random() - 0.5) * 0.08 * k, p.pos.z + (Math.random() - 0.5) * 0.08 * k);
      } else {
        // la camcorder sale volando de las manos, dando vueltas, y cae de lado al suelo
        if (!this.fly) {
          const away = cam.position.clone().sub(e.pos).setY(0).normalize();
          const side = new THREE.Vector3(-away.z, 0, away.x).multiplyScalar((Math.random() - 0.5) * 2);
          this.fly = { pos: cam.position.clone(), vel: away.multiplyScalar(3).add(side).setY(2.6), q: cam.quaternion.clone(), spin: new THREE.Vector3(9, 6, 11).multiplyScalar(Math.random() < 0.5 ? -1 : 1), bounced: false };
        }
        const f = this.fly, w = this.world!;
        f.vel.y -= 9.8 * dt;
        const nx = f.pos.x + f.vel.x * dt, nz = f.pos.z + f.vel.z * dt;
        if (w.solid(nx, f.pos.z)) f.vel.x *= -0.4;
        else f.pos.x = nx;
        if (w.solid(f.pos.x, nz)) f.vel.z *= -0.4;
        else f.pos.z = nz;
        f.pos.y += f.vel.y * dt;
        if (f.pos.y < 0.12) {
          f.pos.y = 0.12;
          f.vel.y = Math.abs(f.vel.y) * 0.3;
          f.vel.x *= 0.55;
          f.vel.z *= 0.55;
          f.spin.multiplyScalar(0.4);
          if (!f.bounced) (f.bounced = true), this.audio?.step(true);
        }
        const still = f.bounced && f.vel.length() < 0.6;
        if (!still) f.q.multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(f.spin.x * dt, f.spin.y * dt, f.spin.z * dt)));
        else {
          // quieta en el suelo, de lado, grabando el cuerpo y lo que baila encima
          const lie = look(f.pos, p.corpse.setY(0.5)).multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), 1.35));
          f.q.slerp(lie, Math.min(1, dt * 6));
        }
        cam.position.copy(f.pos);
        cam.quaternion.copy(f.q);
        cam.fov = THREE.MathUtils.lerp(cam.fov, 62, Math.min(1, dt * 4));
      }
      cam.updateProjectionMatrix();
      // y baila encima del cuerpo
      if (t > 1.5 && e.state === 'attack') {
        e.pos.copy(p.corpse);
        e.dance(p.pos);
      }
    } else this.black = THREE.MathUtils.clamp((t - 0.6) / 2.4, 0, 1); // al vacío: se cae a negro
    this.corrupt(THREE.MathUtils.clamp((t - 0.8) / 3.8, 0, 1));
    if (t > 4.8 && this.dying < 100) {
      this.dying = 100; // una vez
      this.renderer.setAnimationLoop(null); // la imagen se queda congelada: el cuelgue
      this.onDeath?.();
    }
  }

  /** Dentro del ascensor: las puertas se cierran, la grabación se corta a negro y «Noclip». */
  private win() {
    this.winning = true;
    this.player!.frozen = true;
    this.bagOpen = false;
    unlock('backrooms');
    setTimeout(() => this.onWin?.(), 2500);
  }

  // desarrollo: dos dianas quietas delante del inicio, para probar fotos y tiros sin entidades
  fakeEntities() {
    const p = this.player!, f = new THREE.Vector3(-Math.sin(p.yaw), 0, -Math.cos(p.yaw));
    const mk = (d: number): Target => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(0.6, 1.8, 0.6), new THREE.MeshStandardMaterial({ color: 0xaa2222 }));
      m.position.copy(p.pos).addScaledVector(f, d).setY(0.9);
      this.world!.root.add(m);
      const t = { pos: m.position.clone().setY(0), height: 1.8, alive: true, hit: () => ((t.alive = false), (m.visible = false), true) };
      return t;
    };
    this.items!.targets = [...this.entities, mk(2.5), mk(4.5)];
  }

  /** La cinta se rompe (0–1): la imagen y el sonido. */
  corrupt(f: number) {
    this.corruption = f;
    this.vhs.uniforms.uCorrupt.value = f;
    this.audio?.corrupt(f);
  }

  /** Abre el inventario: el puntero queda suelto para hacer clic; la partida sigue. */
  openBag() {
    this.bagOpen = true;
    this.input.clear(); // el joystick y RUN del táctil se desmontan sin soltar
    this.input.suspend = true;
    this.input.unlock();
  }
  closeBag() {
    this.bagOpen = false;
    this.input.suspend = false;
    this.input.lock();
  }

  /** Congela la partida (el último fotograma se queda) y avisa al caparazón. */
  pause() {
    if (this.paused) return;
    this.paused = true;
    this.input.active = false;
    this.input.clear();
    this.input.unlock();
    this.onPause?.();
  }
  resume() {
    this.paused = false;
    this.input.active = true;
    this.input.lock();
    this.clock.getDelta();
  }

  dispose() {
    this.renderer.setAnimationLoop(null);
    for (const off of this.offs) off();
    this.input.dispose();
    this.tv?.dispose();
    this.entities.forEach((e) => e.dispose());
    this.shatters.forEach((s) => s.dispose());
    this.snap?.dispose();
    this.audio?.dispose();
    this.composer.dispose();
    this.player?.dispose();
    this.world?.dispose();
    this.renderer.dispose();
    this.renderer.forceContextLoss();
  }
}
