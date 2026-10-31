import * as THREE from 'three';
import { disposeDeep } from '../dispose';
import { governor, shadowType } from '../quality';
import { compileGently } from '../compile';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { SMAAPass } from 'three/examples/jsm/postprocessing/SMAAPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { CctvShader } from '../room/cctvPass';
import { FullScreenQuad } from 'three/examples/jsm/postprocessing/Pass.js';
import { CctvLensShader, cctvOsd } from './cctvLens';
import { Comic } from '../comic';
import { CameraRig } from './shots';
import { dress } from './dressing';
import { canvas, normalFrom, seeded, tex } from '../room/surfaces';
import { makeBook } from './books';
import type { Paper } from './papers';
import { atmosphere } from './atmosphere';
import { Subject } from './subject';
import { makeCard } from './card';
import { crackOverlay } from './crack';
import { LibraryAudio } from './libraryAudio';
import { makeSheets, placeSheets } from './sheets';

/** Algo que cae: libros y hojas. Las hojas planean (drag) y se mecen (flutter). */
export interface Body { o: THREE.Object3D; v: THREE.Vector3; w: THREE.Vector3; half: number; rest?: boolean; drag?: number; flutter?: number; flat?: (o: THREE.Object3D) => void }

// el tiempo parado: el color se enfría y se apaga un poco, y los bordes se cierran
const StillShader = {
  uniforms: { tDiffuse: { value: null as THREE.Texture | null }, uAmt: { value: 0 } },
  vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
  fragmentShader: `uniform sampler2D tDiffuse; uniform float uAmt; varying vec2 vUv;
    void main() {
      vec3 c = texture2D(tDiffuse, vUv).rgb;
      float l = dot(c, vec3(0.3, 0.59, 0.11));
      vec3 g = mix(c, vec3(l) * vec3(0.86, 0.94, 1.12), 0.55);
      vec2 v = vUv - 0.5;
      g *= 1.0 - dot(v, v) * 0.9;
      gl_FragColor = vec4(mix(c, g, uAmt), 1.0);
    }`,
};

// la señal cortada: estática que tapa la imagen de la cámara de seguridad
const staticMaterial = () =>
  new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uAmt: { value: 0 } },
    vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `uniform float uTime, uAmt; varying vec2 vUv;
      float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
      void main() {
        float t = floor(uTime * 30.0);
        float n = hash(floor(vUv * vec2(240.0, 180.0)) + t * 13.1);
        float band = smoothstep(0.08, 0.0, abs(fract(vUv.y * 0.7 - uTime * 0.3) - 0.5));
        gl_FragColor = vec4(vec3(pow(n, 1.6) * 0.95 + band * 0.25), uAmt);
      }`,
    transparent: true,
    depthTest: false,
    depthWrite: false,
  });

/*
 * La biblioteca de noche. La carcasa del modelo de anaroeto (paredes, ventanas altas, la
 * entreplanta con su barandilla) y, dentro, un bloque de estanterías hecho aquí: un pasillo
 * largo y estrecho entre dos filas, con más filas detrás que se pierden en la oscuridad, y al
 * fondo la zona de lectura con sus lámparas. Luz de luna fría desde arriba, que deja las
 * sombras de las baldas en el suelo; lo único cálido son las lámparas.
 *
 * No tiene renderer propio: usa el que le dan. Mientras es una grabación, la sala la pinta en
 * `feed` desde la cámara de seguridad; luego `takeOver` la pinta a pantalla completa.
 */

const M = '/models/library/';
// el pasillo: a lo largo de x, con su centro en z = AISLE_Z; las estanterías miden 2.4 × 0.53
export const AISLE_Z = 2.4, AISLE_W = 1.9, SHELF_W = 2.4, SHELF_D = 0.53;
export const AISLE_X0 = -9.6, AISLE_X1 = AISLE_X0 + 6 * SHELF_W;
/** Altura de la base de cada balda (la de abajo, 0.21). */
export const SHELF_LEVELS = [0.21, 0.6, 1.0, 1.4, 1.8, 2.21];
// el tiempo parado: dónde se queda él (más o menos) y desde dónde se le mira, casi en el suelo
// el tiempo parado, de frente: él viene hacia la luz de la sala de lectura y la cámara le espera
// allí, mirando atrás, con la máscara en el tercio de arriba y las hojas en la otra mitad
const STILL_AT = new THREE.Vector3(-4.0, 0, AISLE_Z - 0.55);
const STILL_POS = new THREE.Vector3(-1.75, 1.05, AISLE_Z + 0.3), STILL_LOOK = new THREE.Vector3(-4.2, 1.42, AISLE_Z - 0.35);

// en vertical, más ángulo para que el pasillo siga entrando
const fovFor = (aspect: number) => THREE.MathUtils.clamp(THREE.MathUtils.radToDeg(2 * Math.atan(Math.tan(THREE.MathUtils.degToRad(21)) / Math.min(1, aspect / 1.4))), 42, 75);

interface Sheet { mesh: THREE.Mesh; paper: Paper; base: THREE.Vector3; q: THREE.Quaternion; h: number; want: number; from?: THREE.Vector3; at?: number; spin: THREE.Vector3 }

export class LibraryScene {
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(42, 1, 0.03, 60);
  readonly cctvCam = new THREE.PerspectiveCamera(58, 4 / 3, 0.05, 60);
  readonly feed = new THREE.WebGLRenderTarget(640, 480, { type: THREE.HalfFloatType });
  readonly renderer: THREE.WebGLRenderer;
  /** Lo que se ejecuta en cada fotograma antes de pintar (la cámara libre de desarrollo, la secuencia). */
  readonly onFrame = new Set<(dt: number) => void>();
  /** Los libros sueltos de la balda donde busca el sujeto: los que saca y tira. */
  readonly loose: THREE.Mesh[] = [];
  readonly subject = new Subject();
  readonly audio: LibraryAudio;
  /** 'cctv' mientras es una grabación (se pinta desde cctvCam), 'inside' ya dentro. */
  view: 'cctv' | 'inside' = 'cctv';
  onView?: (v: 'cctv' | 'inside') => void;
  /** El tiempo parado: no se mueve nada salvo la cámara (y el temblor de la cabeza del sujeto). */
  frozen = false;
  /** Lo que cae y lo que ya está en el suelo. */
  readonly bodies: Body[] = [];
  /** Lo que se lanza en el frenesí además de los libros (las hojas). */
  onEject?: (from: THREE.Vector3) => void;
  private jobs: { at: number; dur: number; step?: (k: number) => void; res: () => void }[] = [];
  // la carta: un grupo vacío hasta que la máscara está cargada y se puede dibujar el joker
  private card = new THREE.Group();
  private cardKit?: ReturnType<typeof makeCard>;
  private crackCanvas = canvas(1024, 768);
  private crack = crackOverlay(this.crackCanvas);
  private crackTex = new THREE.CanvasTexture(this.crackCanvas);
  private glassPlane = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: this.crackTex, transparent: true, depthTest: false, depthWrite: false, toneMapped: false }));
  private staticPlane = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), staticMaterial());
  private fadePlane = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0, depthTest: false, depthWrite: false }));
  private renderPass?: RenderPass;
  private cctvPass?: ShaderPass;
  // la lente de la cámara de seguridad: el render limpio va a `raw` y de ahí, por la lente, a `feed`
  private raw = new THREE.WebGLRenderTarget(640, 480, { type: THREE.HalfFloatType });
  // la grabación con el cómic encima, antes de pasar por la lente
  private rawC = new THREE.WebGLRenderTarget(640, 480, { type: THREE.HalfFloatType });
  /** El toque cómic sobre el sujeto: en el giro y el lanzamiento, y en todo el tiempo parado. */
  readonly comic: Comic;
  /** La cámara de dentro, por planos. */
  readonly rig: CameraRig;
  // los libros que la grabación tira de una balda del fondo
  private fallers: { book: THREE.Object3D; half: number; facing: number }[] = [];
  private osd = cctvOsd(7);
  private lens = new FullScreenQuad(new THREE.ShaderMaterial({ ...CctvLensShader, uniforms: THREE.UniformsUtils.clone(CctvLensShader.uniforms) }));
  private lensPass?: ShaderPass;
  // una cámara de vigilancia graba a 12,5 imágenes por segundo, no a 60
  private shotAt = -1;
  private stillPass?: ShaderPass;
  private frenzy?: { next: number; n: number; max: number };
  // los libros de verdad de las dos estanterías donde busca: uno a uno (instanciados), para que los
  // que saca salgan de su hueco y no de la nada
  private shelved: { mesh: THREE.InstancedMesh; i: number; size: [number, number, number]; m: THREE.Matrix4; taken?: boolean }[] = [];
  private sheets: Sheet[] = [];
  /** Cuándo se para el tiempo: las hojas que salen en el frenesí llegan a su sitio justo entonces. */
  private freezeAt = 0;
  private stillLight = new THREE.PointLight(0x9fb4e6, 0, 5, 1.6);
  private flash = new THREE.PointLight(0xff4a36, 0, 8, 1.4);
  // el rayo: cintas de cara a la cámara (tronco y ramas), aditivas; la geometría se rehace en cada descarga
  private bolt = new THREE.Mesh(
    new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(new Array(9).fill(0), 3)).setAttribute('color', new THREE.Float32BufferAttribute(new Array(9).fill(0), 3)),
    new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }),
  );
  // el perfil frío que le recorta del fondo: siempre detrás de él, visto desde la cámara que mira
  private rim = new THREE.SpotLight(0xa9c3ff, 32, 5, 0.22, 0.7, 1.4);
  private air?: ReturnType<typeof atmosphere>;
  // el reloj del aire: se para con el tiempo
  private airT = 0;
  spine?: THREE.Texture;
  private loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
  private composer?: EffectComposer;
  private canvas?: HTMLCanvasElement;
  private raf = 0;
  // si va lento, baja la resolución (ver quality.ts)
  private govern: (dt: number) => void = () => {};
  private last = 0;
  private t = 0;
  /** Lo que avanza el reloj de la escena por segundo de verdad (la cámara lenta de la carta). */
  timeScale = 1;
  // el reloj de verdad: el ruido de la cámara y sus 12,5 fps no van a cámara lenta
  private realT = 0;
  private lamps: { light: THREE.PointLight; base: number; seed: number }[] = [];
  private disposed = false;

  constructor(private opts: { renderer: THREE.WebGLRenderer; papers: Paper[]; reduced: boolean; ctx?: AudioContext }) {
    this.renderer = opts.renderer;
    this.audio = new LibraryAudio(opts.ctx);
    this.comic = new Comic(this.renderer, { reduced: opts.reduced });
    this.rig = new CameraRig(this.camera, { reduced: opts.reduced });
    this.comic.targets = [this.subject.root];
    this.comic.setSize(640, 480);
    this.subject.stepped = (t) => this.comic.drawFrame(t);
    // delante de la cámara de seguridad, el cristal roto y la estática; delante de la de dentro, el fundido
    this.crackTex.colorSpace = THREE.SRGBColorSpace;
    this.glassPlane.renderOrder = 10;
    this.staticPlane.renderOrder = 11;
    this.fadePlane.renderOrder = 12;
    this.cctvCam.add(this.glassPlane, this.staticPlane);
    this.camera.add(this.fadePlane);
    this.scene.add(this.cctvCam, this.camera);
    this.fitOverlays();
    this.scene.background = new THREE.Color(0x040304);
    this.scene.fog = new THREE.FogExp2(0x05050a, 0.05);
    this.feed.texture.colorSpace = THREE.LinearSRGBColorSpace;
    // la vista de dentro, de momento: baja y a un lado del pasillo
    this.camera.position.set(-2.6, 0.95, AISLE_Z + 0.45);
    this.camera.lookAt(-5, 1.2, AISLE_Z - 0.4);
  }

  get papers() {
    return this.opts.papers;
  }

  private glb(url: string) {
    return new Promise<THREE.Object3D>((res, rej) => this.loader.load(url, (g) => res(g.scene), undefined, rej));
  }

  async load() {
    const [[shell, shelf, table, chair, desklamp, ceilinglamp, door, cam]] = await Promise.all([
      Promise.all(['shell', 'shelf', 'table', 'chair', 'desklamp', 'ceilinglamp', 'door'].map((n) => this.glb(M + n + '.glb')).concat(this.glb('/models/surveilance_room/camera.glb'))),
      this.subject.load(),
    ]);
    if (this.disposed) return;
    const s = this.scene;
    // a trozos, soltando el hilo entre uno y otro: se carga mientras la sala sigue en pantalla
    const breathe = () => new Promise((r) => setTimeout(r));

    // la carcasa, con su suelo cambiado por uno de tablas con relieve
    shell.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh) return;
      m.receiveShadow = true;
      const mat = m.material as THREE.MeshStandardMaterial;
      if (mat.name === 'suelo') m.visible = false;
      // las ventanas traen un emisivo blanco de día: de noche, un azul de luna apagado
      if (mat.name === 'ventana') {
        mat.emissive.set(0x34456e);
        mat.emissiveIntensity = 0.7;
      }
    });
    s.add(shell);
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(34, 18), floorMaterial());
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(-0.3, 0, 2.25);
    floor.receiveShadow = true;
    floor.material.userData.env = 0.4;
    s.add(floor);

    await breathe();
    this.stacks(shelf);
    await breathe();
    this.reading(table, chair, desklamp);
    // dos lámparas de techo colgando en el hueco de la entreplanta, apagadas: solo siluetas
    ceilinglamp.traverse((o) => {
      const m = (o as THREE.Mesh).material as THREE.MeshStandardMaterial | undefined;
      if (m?.name.includes('bombilla')) m.emissiveIntensity = 0;
    });
    for (const x of [-3, 4]) {
      const l = ceilinglamp.clone();
      l.position.set(x, 13 - 7.93, 2.2);
      s.add(l);
    }
    door.position.set(16.0, 0, 6.5);
    door.rotation.y = -Math.PI / 2;
    s.add(door);

    // la cámara de seguridad, encima de la cabecera del pasillo, mirando a lo largo de él
    cam.updateMatrixWorld(true);
    const kb = new THREE.Box3().setFromObject(cam);
    cam.scale.setScalar(0.3 / Math.max(...kb.getSize(new THREE.Vector3()).toArray()));
    cam.position.set(AISLE_X0 - 0.12, 3.34, AISLE_Z - 0.2);
    const aim = new THREE.Vector3(AISLE_X0 + 5.6, 0.7, AISLE_Z);
    cam.lookAt(aim);
    cam.rotateY(-Math.PI / 2); // el modelo mira por su +x, no por su +z
    s.add(cam);
    cam.updateMatrixWorld(true);
    // su soporte: un tubo negro desde lo alto de la estantería de cabecera hasta la base
    const base = new THREE.Box3().setFromObject(cam.getObjectByProperty('name', 'SecurityCameraBase_Team3_Sanchez_SecurityCameraBase_0') ?? cam);
    const bc = base.getCenter(new THREE.Vector3()), top = 3.06;
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, bc.y - top), new THREE.MeshStandardMaterial({ color: 0x111112, roughness: 0.5, metalness: 0.6 }));
    pole.position.set(bc.x, (bc.y + top) / 2, bc.z);
    pole.castShadow = true;
    s.add(pole);
    // la cámara de verdad, justo delante del cristal del objetivo
    const lensMesh = cam.getObjectByProperty('name', 'SecurityCamera_Team3_Sanchez_SecuruityCameraLens_0') ?? cam;
    const lens = new THREE.Box3().setFromObject(lensMesh).getCenter(new THREE.Vector3());
    this.cctvCam.position.copy(lens).addScaledVector(aim.clone().sub(lens).normalize(), 0.03);
    this.cctvCam.lookAt(aim);

    // el sujeto, en el pasillo, de cara a la fila de la izquierda (la de z menor)
    const sb = this.subject.root;
    // a un brazo de la balda: más lejos no llegaba a ningún libro y estiraba el brazo a lo tieso
    sb.position.set(-4.6, 0, AISLE_Z - 0.55);
    sb.rotation.y = Math.PI;
    s.add(sb);

    await breathe();
    this.cardKit = makeCard(this.subject.face!, this.renderer);
    this.card.add(this.cardKit.mesh);
    // la carta espera oculta hasta que la saca
    this.card.visible = false;
    s.add(this.card);
    this.lights();
    await breathe();
    this.placePapers();
    await breathe();
    this.scene.environment = this.reflections();
    s.traverse((o) => {
      for (const m of ([] as THREE.Material[]).concat((o as THREE.Mesh).material ?? []))
        if ((m as THREE.MeshStandardMaterial).isMeshStandardMaterial) (m as THREE.MeshStandardMaterial).envMapIntensity = m.userData.env ?? 0.35;
    });
    // compilar ya (también lo oculto: la carta, la estática, las hojas), para que el primer fotograma
    // de la grabación no se trabe; poco a poco, que mientras tanto la sala sigue pintando
    await compileGently(this.renderer, s, this.cctvCam, (fn) => this.lit(fn));
    await breathe();
    // y un fotograma de la grabación, que compila lo que solo se ve pintando (los mapas de sombra),
    // con el cómic encendido para que su máscara y su pasada también estén ya compiladas
    this.comic.amount = 1;
    this.renderFeed(true);
    this.comic.amount = 0;
  }

  /*
   * Cada material se compila para un estado concreto del renderer (sombras, tipo de sombra, si pinta
   * a un render target). El renderer llega de la sala, sin sombras: si la biblioteca se compilara o se
   * pintara con otro estado, el navegador recompilaría todos sus shaders a mitad de la transición.
   * Así que siempre con el mismo: sombras suaves y a un render target, como la grabación y el composer.
   */
  private lit<T>(fn: () => T) {
    const r = this.renderer, sm = r.shadowMap, was = { on: sm.enabled, type: sm.type, rt: r.getRenderTarget() };
    sm.enabled = true;
    sm.type = shadowType(r);
    if (!was.rt) r.setRenderTarget(this.feed);
    try {
      return fn();
    } finally {
      sm.enabled = was.on;
      sm.type = was.type;
      r.setRenderTarget(was.rt);
    }
  }

  // las estanterías: instanciadas (cada malla del modelo, una sola llamada para todas)
  private stacks(shelf: THREE.Object3D) {
    const rand = seeded(7);
    const mats: THREE.Matrix4[] = [];
    const put = (x: number, z: number, faceZ: 1 | -1 | 0) => {
      const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), [Math.PI, Math.PI / 2, 0][faceZ + 1] + (rand() - 0.5) * 0.02);
      mats.push(new THREE.Matrix4().compose(new THREE.Vector3(x + (rand() - 0.5) * 0.05, 0, z + (rand() - 0.5) * 0.04), q, new THREE.Vector3(1, 1, 1)));
    };
    const zA = AISLE_Z - AISLE_W / 2 - SHELF_D / 2, zB = AISLE_Z + AISLE_W / 2 + SHELF_D / 2;
    // las dos estanterías de delante de él (la 1 y la 2 de la fila del pasillo): sus libros van sueltos
    const real: number[] = [];
    // el pasillo y, espalda con espalda, las filas de detrás; luego un pasillo más a cada lado
    for (let i = 0; i < 6; i++) {
      const x = AISLE_X0 + SHELF_W * (i + 0.5);
      if (i === 1 || i === 2) real.push(mats.length);
      put(x, zA, 1);
      put(x, zB, -1);
      put(x, zA - SHELF_D, -1);
      put(x, zB + SHELF_D, 1);
      if (i > 0) {
        put(x, zA - SHELF_D - AISLE_W - SHELF_D, 1);
        put(x, zB + SHELF_D + AISLE_W + SHELF_D, -1);
      }
    }
    // el pasillo no tiene salida por ese lado: lo cierra una estantería de cabecera
    put(AISLE_X0 - SHELF_D / 2, AISLE_Z, 0);
    shelf.updateMatrixWorld(true);
    const insts: THREE.InstancedMesh[] = [];
    shelf.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh) return;
      if ((m.material as THREE.MeshStandardMaterial).name.includes('lomos1')) this.spine ??= (m.material as THREE.MeshStandardMaterial).map ?? undefined;
      const inst = new THREE.InstancedMesh(m.geometry, m.material, mats.length);
      mats.forEach((w, i) => inst.setMatrixAt(i, w.clone().multiply(m.matrixWorld)));
      inst.castShadow = inst.receiveShadow = true;
      inst.computeBoundingSphere();
      this.scene.add(inst);
      insts.push(inst);
    });
    if (this.spine)
      this.fallers = dress(this.scene, {
        shelves: insts,
        spine: this.spine,
        rand: seeded(23),
        rows: [{ front: AISLE_Z - AISLE_W / 2, facing: 1 }, { front: AISLE_Z + AISLE_W / 2, facing: -1 }],
        x0: AISLE_X0,
        bay: SHELF_W,
        bays: 6,
        levels: SHELF_LEVELS,
        floorZ: [AISLE_Z - AISLE_W / 2 + 0.2, AISLE_Z + AISLE_W / 2 - 0.2],
      }).fallers;

    // libros sueltos en la balda donde busca: sobresalen un poco, ladeados, de colores distintos
    if (!this.spine) return;
    const r2 = seeded(11);
    const front = zA + SHELF_D / 2 - 0.08;
    const gaps: [number, number, number][] = []; // [balda, desde x, hasta x]: ahí no va un libro de la hilera
    for (const [lvl, x0] of [[3, -5.1], [3, -4.62], [4, -4.9], [2, -4.4], [4, -4.25], [3, -3.95]] as const) {
      const w = 0.035 + r2() * 0.03, h = 0.24 + r2() * 0.08, d = 0.17 + r2() * 0.05;
      const b = makeBook(this.spine, [w, h, d]);
      b.position.set(x0, SHELF_LEVELS[lvl] + h / 2 + 0.002, front);
      b.rotation.z = (r2() - 0.5) * 0.12;
      this.scene.add(b);
      this.loose.push(b);
      gaps.push([lvl, x0 - w / 2 - 0.012, x0 + w / 2 + 0.012]);
    }
    this.fillShelves(insts, real, gaps);
  }

  /*
   * Los lomos del modelo son un bloque por balda (una caja con la foto de los libros). En las dos
   * estanterías de delante de él, el bloque se quita y su sitio se llena de libros uno a uno, de
   * alturas y gruesos distintos, en unas pocas mallas instanciadas.
   */
  private fillShelves(insts: THREE.InstancedMesh[], real: number[], gaps: [number, number, number][]) {
    const r = seeded(31), zero = new THREE.Matrix4().makeScale(0, 0, 0), m = new THREE.Matrix4(), box = new THREE.Box3();
    const BASE: [number, number, number] = [0.045, 0.28, 0.2];
    const kinds = Array.from({ length: 6 }, () => makeBook(this.spine!, BASE));
    const slots: { kind: number; m: THREE.Matrix4; size: [number, number, number]; tint: number }[] = [];
    for (const inst of insts) {
      const name = (inst.material as THREE.Material).name;
      if (!name.includes('lomos') && !name.includes('hojas')) continue;
      inst.geometry.computeBoundingBox();
      for (const i of real) {
        inst.getMatrixAt(i, m);
        if (name.includes('lomos')) {
          box.copy(inst.geometry.boundingBox!).applyMatrix4(m);
          const lvl = SHELF_LEVELS.findIndex((y) => Math.abs(y - box.min.y) < 0.12);
          const H = box.max.y - box.min.y, D = box.max.z - box.min.z;
          for (let x = box.min.x; ; ) {
            const w = 0.028 + r() * 0.04;
            if (x + w > box.max.x) break;
            const cx = x + w / 2;
            x += w + 0.001;
            if (gaps.some(([l, a, b]) => l === lvl && cx > a && cx < b)) continue;
            const h = H * (0.74 + r() * 0.2), d = D * (0.9 + r() * 0.08);
            const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), (r() - 0.5) * 0.03);
            const at = new THREE.Vector3(cx, box.min.y + h / 2 + 0.002, box.max.z - d / 2 - 0.004);
            slots.push({ kind: (r() * kinds.length) | 0, m: new THREE.Matrix4().compose(at, q, new THREE.Vector3(w / BASE[0], h / BASE[1], d / BASE[2])), size: [w, h, d], tint: 0.72 + r() * 0.45 });
          }
        }
        inst.setMatrixAt(i, zero);
      }
      inst.instanceMatrix.needsUpdate = true;
      inst.computeBoundingSphere();
    }
    const c = new THREE.Color();
    kinds.forEach((k, kind) => {
      const mine = slots.filter((s) => s.kind === kind);
      const mesh = new THREE.InstancedMesh(k.geometry, k.material, mine.length);
      mine.forEach((s, i) => {
        mesh.setMatrixAt(i, s.m);
        mesh.setColorAt(i, c.setScalar(s.tint));
        this.shelved.push({ mesh, i, size: s.size, m: s.m });
      });
      mesh.castShadow = mesh.receiveShadow = true;
      mesh.computeBoundingSphere();
      this.scene.add(mesh);
    });
  }

  /** Saca de su hueco un libro de la estantería, cerca de x y entre esas alturas: el libro, ya suelto. */
  private pull(x: number, y0: number, y1: number) {
    const p = new THREE.Vector3(), q = new THREE.Quaternion(), sc = new THREE.Vector3();
    const near = this.shelved.filter((b) => {
      if (b.taken) return false;
      p.setFromMatrixPosition(b.m);
      return Math.abs(p.x - x) < 0.35 && p.y > y0 && p.y < y1;
    });
    const b = near[(Math.random() * near.length) | 0];
    if (!b || !this.spine) return null;
    b.taken = true;
    b.mesh.setMatrixAt(b.i, new THREE.Matrix4().makeScale(0, 0, 0));
    b.mesh.instanceMatrix.needsUpdate = true;
    const book = makeBook(this.spine, b.size);
    b.m.decompose(p, q, sc);
    book.position.copy(p);
    book.quaternion.copy(q);
    this.scene.add(book);
    return book;
  }

  // al fondo del pasillo, la zona de lectura: mesas largas con sus lámparas encendidas
  private reading(table: THREE.Object3D, chair: THREE.Object3D, desklamp: THREE.Object3D) {
    const s = this.scene;
    const spots: [number, number, number][] = [[AISLE_X1 + 1.6, AISLE_Z, 0], [AISLE_X1 + 4.3, AISLE_Z - 0.4, 0], [AISLE_X1 + 4.3, AISLE_Z + 3.6, 0]];
    spots.forEach(([x, z], i) => {
      const t = table.clone();
      t.position.set(x, 0, z);
      t.traverse((o) => ((o as THREE.Mesh).castShadow = (o as THREE.Mesh).receiveShadow = true));
      s.add(t);
      for (const dz of [-0.9, 0.2, 1.0]) {
        const c = chair.clone();
        c.position.set(x + (dz > 0 ? 0.65 : -0.65), 0, z + dz);
        c.rotation.y = dz > 0 ? -Math.PI / 2 : Math.PI / 2;
        c.rotation.y += (Math.sin(i * 7 + dz * 5) * 0.25);
        s.add(c);
      }
      const l = desklamp.clone();
      l.traverse((o) => {
        const m = (o as THREE.Mesh).material as THREE.MeshStandardMaterial | undefined;
        if (m?.name.includes('bombilla')) m.emissiveIntensity = 3;
      });
      l.position.set(x + 0.1, 0.97, z - 0.9);
      l.rotation.y = Math.PI / 2;
      s.add(l);
      const p = new THREE.PointLight(0xffa25a, 25, 7, 1.7);
      p.position.set(x + 0.1, 1.28, z - 0.9);
      p.castShadow = i === 0;
      p.shadow.mapSize.set(512, 512);
      s.add(p);
      this.lamps.push({ light: p, base: 25, seed: i * 3.1 });
    });
    // un montón de libros en la primera mesa
    if (!this.spine) return;
    const r = seeded(5);
    let y = 0.97;
    for (let i = 0; i < 5; i++) {
      const h = 0.03 + r() * 0.035, b = makeBook(this.spine, [h, 0.22 + r() * 0.06, 0.16 + r() * 0.04]);
      b.rotation.set(0, (r() - 0.5) * 0.5, Math.PI / 2);
      b.position.set(spots[0][0] - 0.15, y + h / 2, spots[0][1] + 0.55);
      y += h;
      s.add(b);
    }
  }

  private lights() {
    const s = this.scene;
    // poco relleno: las sombras tienen que ser sombras; lo que se ve lo pone una luz que manda
    s.add(new THREE.HemisphereLight(0x1a2236, 0x080506, 0.3));
    /*
     * La luna entra por los lucernarios del techo (y = 13) y deja en el pasillo la forma de cada
     * uno: un foco lejano, casi paralelo, con su silueta por delante (cookie). Cae empinada, raya
     * en diagonal los lomos de la fila de enfrente y pinta manchas en el suelo; fuera de ellas no
     * llega, así que las estanterías no quedan bañadas por igual.
     */
    const dir = new THREE.Vector3(-0.12, -0.93, -0.35).normalize();
    const moon = new THREE.SpotLight(0x8ea4d4, 22, 0, 0.36, 0, 0);
    moon.map = windowCookie();
    moon.target.position.set(-4.5, 0, AISLE_Z - 0.45);
    moon.position.copy(moon.target.position).addScaledVector(dir, -24);
    moon.castShadow = true;
    moon.shadow.mapSize.set(2048, 2048);
    moon.shadow.camera.near = 12;
    moon.shadow.camera.far = 40;
    moon.shadow.bias = -0.0002;
    moon.shadow.normalBias = 0.02;
    s.add(moon, moon.target);
    moon.target.updateMatrixWorld();
    moon.updateMatrixWorld();
    moon.shadow.updateMatrices(moon);
    // un hilo de luz fría a lo largo del pasillo, para que la grabación no se quede en negro
    const fill = new THREE.SpotLight(0x6f84b8, 45, 18, 0.45, 0.8, 1.4);
    fill.position.set(AISLE_X0 + 0.5, 5.6, AISLE_Z);
    fill.target.position.set(AISLE_X0 + 7, 0, AISLE_Z);
    s.add(fill, fill.target);
    // la del tiempo parado y el destello del rayo: apagadas hasta su momento
    s.add(this.stillLight, this.flash, this.rim, this.rim.target);
    this.bolt.visible = false;
    this.bolt.frustumCulled = false;
    s.add(this.bolt);
    // los haces: de cada lucernario hasta su mancha en el suelo del pasillo
    this.air = atmosphere(s, {
      shafts: WINDOWS.map((u) => {
        const p = new THREE.Vector3(u * 2 - 1, 0, 0.5).unproject(moon.shadow.camera), d = p.sub(moon.position).normalize();
        const to = moon.position.clone().addScaledVector(d, -moon.position.y / d.y);
        return { from: to.clone().addScaledVector(d, -13 / -d.y), to, radius: 0.5 };
      }),
      dustBox: new THREE.Box3(new THREE.Vector3(AISLE_X0 + 0.2, 0.1, AISLE_Z - 0.9), new THREE.Vector3(2, 3.4, AISLE_Z + 0.9)),
      reduced: this.opts.reduced,
    });
  }

  // el perfil: detrás de él respecto a la cámara activa, alto, apuntando al pecho
  private rimStep() {
    const cam = this.view === 'cctv' ? this.cctvCam : this.camera, p = this.subject.root.position;
    const away = p.clone().sub(cam.getWorldPosition(new THREE.Vector3())).setY(0).normalize();
    this.rim.position.copy(p).addScaledVector(away, 2.2).setY(1.8);
    // sin salirse del pasillo: metida entre las estanterías, las quemaba en vez de recortarle a él
    this.rim.position.z = THREE.MathUtils.clamp(this.rim.position.z, AISLE_Z - 0.75, AISLE_Z + 0.75);
    // al torso, no a la cabeza: la máscara es clara y con el perfil encima se quemaba
    this.rim.target.position.copy(p).setY(1.0);
  }

  // lo que se refleja: las ventanas altas en azul de noche y los puntos cálidos de las lámparas
  private reflections() {
    const env = new THREE.Scene();
    env.background = new THREE.Color(0x030305);
    for (const [x, z, ry] of [[0, -6, 0], [0, 10.5, Math.PI], [-16.6, 2, Math.PI / 2], [16, 2, -Math.PI / 2]] as const) {
      const w = new THREE.Mesh(new THREE.PlaneGeometry(20, 4), new THREE.MeshBasicMaterial({ color: 0x1b2540 }));
      w.position.set(x, 5.5, z);
      w.rotation.y = ry;
      env.add(w);
    }
    for (const l of this.lamps) {
      const b = new THREE.Mesh(new THREE.SphereGeometry(0.25), new THREE.MeshBasicMaterial({ color: 0xffa060 }));
      b.position.copy(l.light.position);
      env.add(b);
    }
    const pm = new THREE.PMREMGenerator(this.renderer);
    const rt = pm.fromScene(env, 0.03, 0.1, 40);
    pm.dispose();
    return rt.texture;
  }

  update(dt: number) {
    this.realT += dt;
    dt *= this.timeScale;
    this.t += dt;
    if (!this.frozen) this.airT += dt;
    this.air?.update(this.airT, this.renderer.getPixelRatio());
    this.rimStep();
    if (!this.frozen) {
      // las lámparas viejas zumban y tiemblan un poco
      for (const l of this.lamps) l.light.intensity = l.base * (0.94 + 0.06 * Math.sin(this.t * 9.1 + l.seed) * Math.sin(this.t * 3.3 + l.seed));
      // la del medio falla de verdad: a ratos, unos tirones casi a oscuras
      const bad = this.lamps[1], ph = (this.t * 0.37) % 1;
      if (bad && ph > 0.82) bad.light.intensity *= Math.sin(this.t * 53) > 0.1 ? 0.12 : 0.9;
      this.physics(dt);
      this.frenzyStep();
      this.flySheets();
    }
    this.hoverStep(dt);
    this.subject.update(dt);
    this.rig.update(dt);
    (this.staticPlane.material as THREE.ShaderMaterial).uniforms.uTime.value = this.realT;
    if (this.cctvPass) this.cctvPass.uniforms.uTime.value = this.realT;
    // las esperas y los tweens de la secuencia van con este reloj: con la pestaña oculta, se paran
    for (const j of [...this.jobs]) {
      const k = Math.min(1, (this.t - j.at) / j.dur);
      j.step?.(k);
      if (k >= 1) {
        this.jobs.splice(this.jobs.indexOf(j), 1);
        j.res();
      }
    }
    for (const f of this.onFrame) f(dt);
  }

  wait(sec: number) {
    if (this.skip) return Promise.resolve();
    return new Promise<void>((res) => this.jobs.push({ at: this.t, dur: sec, res }));
  }

  tween(sec: number, step: (k: number) => void) {
    if (this.skip) return Promise.resolve(step(1));
    return new Promise<void>((res) => this.jobs.push({ at: this.t, dur: Math.max(sec, 1e-4), step, res }));
  }

  /** Desarrollo: con `skip` puesto, las esperas no esperan hasta llegar al momento que se llame igual. */
  skip?: 'throw' | 'inside' | 'still' | 'bolt';
  private mark(name: 'throw' | 'inside' | 'still' | 'bolt') {
    if (this.skip === name) this.skip = undefined;
  }

  setView(v: 'cctv' | 'inside') {
    this.view = v;
    if (this.renderPass) this.renderPass.camera = v === 'cctv' ? this.cctvCam : this.camera;
    if (this.cctvPass) this.cctvPass.enabled = v === 'cctv';
    if (this.lensPass) this.lensPass.enabled = v === 'cctv';
    // el cristal y la estática van pegados a la cámara de seguridad: desde fuera no se ven
    this.glassPlane.visible = this.staticPlane.visible = v === 'cctv';
    this.onView?.(v);
  }

  // los planos pegados a las cámaras llenan su vista justo detrás del plano cercano
  private fitOverlays() {
    for (const [cam, planes] of [[this.cctvCam, [this.glassPlane, this.staticPlane]], [this.camera, [this.fadePlane]]] as const) {
      const d = cam.near * 1.5, h = 2 * d * Math.tan(THREE.MathUtils.degToRad(cam.fov / 2));
      for (const p of planes) {
        p.position.set(0, 0, -d);
        p.scale.set(h * cam.aspect * 1.02, h * 1.02, 1);
      }
    }
  }

  // caída con rebote contra el suelo; las estanterías del pasillo paran lo que se va hacia ellas
  private physics(dt: number) {
    const zMin = AISLE_Z - AISLE_W / 2 + 0.06, zMax = AISLE_Z + AISLE_W / 2 - 0.06;
    for (const b of this.bodies) {
      if (b.rest) continue;
      const p = b.o.position;
      b.v.y -= 9.8 * dt;
      if (b.drag) {
        b.v.multiplyScalar(Math.exp(-b.drag * dt));
        b.v.x += Math.sin(this.t * 3.1 + p.z * 7) * (b.flutter ?? 0) * dt;
        b.v.z += Math.cos(this.t * 2.3 + p.x * 5) * (b.flutter ?? 0) * dt;
      }
      p.addScaledVector(b.v, dt);
      b.o.rotation.x += b.w.x * dt;
      b.o.rotation.y += b.w.y * dt;
      b.o.rotation.z += b.w.z * dt;
      if (p.z < zMin || p.z > zMax) {
        p.z = THREE.MathUtils.clamp(p.z, zMin, zMax);
        b.v.z *= -0.3;
      }
      if (p.y < b.half) {
        p.y = b.half;
        b.v.y *= -0.25;
        b.v.x *= 0.5;
        b.v.z *= 0.5;
        b.w.multiplyScalar(0.4);
        if (Math.abs(b.v.y) < 0.4) {
          // se queda tumbado en el suelo, con el giro que llevaba
          b.rest = true;
          const yaw = b.o.rotation.y;
          b.o.rotation.set(0, yaw, 0);
          if (b.flat) b.flat(b.o);
          else b.o.rotateZ(Math.PI / 2);
          p.y = b.half;
        }
      }
    }
  }

  /** Lanza un objeto que ya está en la escena desde donde está, hacia el pasillo. */
  private eject(o: THREE.Object3D, half: number) {
    const r = Math.random;
    this.bodies.push({
      o,
      half,
      v: new THREE.Vector3(-0.2 + r() * 1.5, 1.4 + r() * 1.1, 1.6 + r() * 1.4),
      w: new THREE.Vector3((r() - 0.5) * 14, (r() - 0.5) * 10, (r() - 0.5) * 14),
    });
  }

  // un libro del fondo se escurre de su balda y cae al pasillo, de lado
  private drop(i: number) {
    const f = this.fallers[i];
    if (!f) return;
    this.bodies.push({ o: f.book, half: f.half, v: new THREE.Vector3((Math.random() - 0.5) * 0.2, 0.15, f.facing * 0.7), w: new THREE.Vector3(f.facing * 4, (Math.random() - 0.5) * 2, 0), flat: (o) => o.rotateZ(Math.PI / 2) });
  }

  // el frenesí: cada poco saca un libro, lo tira y la mano salta a otro
  private frenzyStep() {
    const f = this.frenzy;
    if (!f || this.t < f.next || !this.spine) return;
    f.next = this.t + 0.28 + Math.random() * 0.12;
    if (f.n++ >= f.max) return;
    const lvl = 2 + ((Math.random() * 3) | 0), front = AISLE_Z - AISLE_W / 2 - 0.08;
    const hand = this.subject.root.position.x + 0.07;
    const book = this.loose.shift() ?? this.pull(hand, SHELF_LEVELS[2], SHELF_LEVELS[5]) ?? makeBook(this.spine, [0.035 + Math.random() * 0.03, 0.24 + Math.random() * 0.08, 0.17 + Math.random() * 0.05]);
    if (!book.parent) {
      // al alcance de su mano derecha (mira a la balda: su derecha es +x)
      book.position.set(this.subject.root.position.x - 0.2 + Math.random() * 0.55, SHELF_LEVELS[lvl] + 0.15, front);
      this.scene.add(book);
    }
    this.subject.reachTo(book.position.clone(), true);
    this.eject(book, 0.02);
    this.onEject?.(book.position.clone());
    // con cada libro salen hojas, las que toquen para que todas estén fuera antes de pararse
    const per = Math.ceil(this.sheets.length / f.max);
    for (const sh of this.sheets.filter((x) => x.at === undefined).slice(0, per)) {
      sh.from = book.position.clone().add(new THREE.Vector3((Math.random() - 0.5) * 0.3, (Math.random() - 0.5) * 0.2, 0.05));
      sh.at = this.t;
      sh.mesh.visible = true;
    }
    if (f.n % 3 === 0) this.audio.books(2);
  }

  // las hojas, en el encuadre del tiempo parado: entre él y la cámara del suelo y, si son muchas,
  // también más allá de él. Ninguna se pisa en pantalla ni queda detrás de su silueta.
  private placePapers() {
    for (const { mesh, paper } of makeSheets(this.opts.papers)) {
      const sh: Sheet = { mesh, paper, base: new THREE.Vector3(), q: new THREE.Quaternion(), h: 0, want: 0, spin: new THREE.Vector3(Math.random() * 6, Math.random() * 4, Math.random() * 8) };
      mesh.visible = false;
      this.scene.add(mesh);
      this.sheets.push(sh);
    }
    this.layout(this.stillEye());
  }

  // la cámara del tiempo parado, ya en su sitio (las hojas se colocan para ella antes de que llegue)
  private stillEye() {
    const aspect = innerWidth / Math.max(1, innerHeight), eye = new THREE.PerspectiveCamera(fovFor(aspect), aspect, 0.03, 60);
    eye.position.copy(STILL_POS);
    eye.lookAt(STILL_LOOK);
    return eye;
  }

  /*
   * Dónde quedan las hojas vistas desde `eye`: entre la cámara y él, del lado del pasillo que
   * él no ocupa, sin taparle. Con el tiempo parado se vuelve a hacer al cambiar el tamaño de la
   * ventana (girar el móvil), y las hojas saltan a su nuevo sitio.
   */
  private layout(eye: THREE.Camera) {
    eye.updateMatrixWorld(true);
    const n = this.sheets.length;
    const area = new THREE.Box3(new THREE.Vector3(STILL_AT.x + 0.45, 0.35, AISLE_Z - 0.2), new THREE.Vector3(Math.min(STILL_POS.x - 1.1, STILL_AT.x + 0.45 + Math.max(0.9, n * 0.12)), Math.min(2.2, 1.5 + n * 0.03), AISLE_Z + 0.75));
    // su silueta (de pie, más o menos donde se para) como obstáculo en pantalla
    const him = new THREE.Box2(), v = new THREE.Vector3();
    const at = this.frozen ? this.subject.root.position : STILL_AT;
    for (const dx of [-0.3, 0.3]) for (const y of [0, 1.85]) for (const dz of [-0.25, 0.25]) {
      v.set(at.x + dx, y, at.z + dz).project(eye);
      him.expandByPoint(new THREE.Vector2(v.x, v.y));
    }
    // y el indicador del scroll, abajo en el centro (unos 60 x 140 px)
    const meter = new THREE.Box2(new THREE.Vector2(-60 / innerWidth, -1), new THREE.Vector2(60 / innerWidth, -1 + 280 / innerHeight));
    placeSheets(this.sheets, area, eye, [him, meter]);
    for (const sh of this.sheets) {
      sh.base.copy(sh.mesh.position);
      sh.q.copy(sh.mesh.quaternion);
    }
  }

  // en el aire: de la balda a su sitio, revoloteando, y llegan cuando el tiempo se para
  private flySheets() {
    const e = new THREE.Euler(), mid = new THREE.Vector3();
    for (const sh of this.sheets) {
      if (sh.at === undefined || !sh.from) continue;
      const u = THREE.MathUtils.clamp((this.t - sh.at) / Math.max(0.3, this.freezeAt - sh.at), 0, 1);
      mid.copy(sh.from).lerp(sh.base, 0.5).add(new THREE.Vector3(0, 0.7, 0.2));
      const a = (1 - u) * (1 - u), b = 2 * u * (1 - u), c = u * u;
      sh.mesh.position.set(0, 0, 0).addScaledVector(sh.from, a).addScaledVector(mid, b).addScaledVector(sh.base, c);
      e.set(this.t * sh.spin.x, this.t * sh.spin.y, this.t * sh.spin.z);
      sh.mesh.quaternion.setFromEuler(e).slerp(sh.q, u * u * (3 - 2 * u));
    }
  }

  /** La hoja bajo el puntero (coordenadas de -1 a 1), solo con el tiempo parado. */
  sheetAt(ndc: THREE.Vector2): Paper | null {
    if (!this.frozen) return null;
    const ray = new THREE.Raycaster();
    ray.setFromCamera(ndc, this.camera);
    const hit = ray.intersectObjects(this.sheets.map((s) => s.mesh), true)[0];
    if (!hit) return null;
    let o: THREE.Object3D | null = hit.object;
    while (o && !this.sheets.some((s) => s.mesh === o)) o = o.parent;
    return this.sheets.find((s) => s.mesh === o)?.paper ?? null;
  }

  /** La hoja señalada se aclara y se acerca 4 cm a la cámara; lo demás sigue quieto. */
  hover(paper: Paper | null) {
    for (const s of this.sheets) s.want = s.paper === paper ? 1 : 0;
    this.onHover?.(paper);
  }
  /** La hoja que se señala (o null): el rótulo del archivo la enseña. */
  onHover?: (paper: Paper | null) => void;

  private hoverStep(dt: number) {
    const k = Math.min(1, dt / 0.2), toward = new THREE.Vector3();
    for (const s of this.sheets) {
      if (s.h === s.want && s.h === 0) continue;
      s.h += Math.sign(s.want - s.h) * Math.min(Math.abs(s.want - s.h), k);
      if (!this.frozen) continue;
      toward.copy(this.camera.position).sub(s.base).normalize();
      s.mesh.position.copy(s.base).addScaledVector(toward, 0.06 * s.h);
      (s.mesh.material as THREE.MeshStandardMaterial).emissiveIntensity = 0.08 + 0.4 * s.h;
    }
  }

  /** El tiempo vuelve: las hojas siguen cayendo y él se va en un rayo rojo. Se resuelve al acabar. */
  async resume() {
    const s = this.subject, reduced = this.opts.reduced;
    this.hover(null);
    this.frozen = false;
    s.freeze(false);
    this.comicTo(0, 0.5);
    this.audio.bolt();
    // lo que estaba en el aire sigue cayendo, ahora planeando como papel
    for (const sh of this.sheets) {
      sh.from = undefined; // ya no vuelan a su sitio: caen
      if (sh.mesh.position.y < 0.02) continue;
      this.bodies.push({ o: sh.mesh, half: 0.003, v: new THREE.Vector3((Math.random() - 0.5) * 0.4, -0.2, (Math.random() - 0.5) * 0.4), w: new THREE.Vector3((Math.random() - 0.5) * 3, (Math.random() - 0.5) * 2, (Math.random() - 0.5) * 3), drag: 2.2, flutter: 2.5, flat: (o) => o.rotateX(-Math.PI / 2) });
    }
    const sp = this.stillPass?.uniforms.uAmt;
    const back = this.tween(0.5, (k) => {
      if (sp) sp.value = 1 - k;
      this.stillLight.intensity = 1.1 * (1 - k);
    });
    if (reduced) {
      // sin rayo ni destello: un fundido a negro y, mientras, él ya no está
      await this.fade(1, 0.6);
      s.root.visible = false;
    } else {
      await this.wait(0.25);
      const flash = this.flash, bolt = this.bolt, mat = bolt.material as THREE.MeshBasicMaterial;
      flash.position.copy(s.root.position).setY(1.2);
      this.shapeBolt();
      bolt.visible = true;
      let again = true;
      await this.tween(0.3, (k) => {
        // crece de los pies al techo; a mitad, otra descarga distinta (el parpadeo del rayo)
        if (again && k > 0.5) (again = false), this.shapeBolt();
        const op = Math.sin(k * Math.PI);
        mat.opacity = op;
        bolt.geometry.setDrawRange(0, Math.ceil(bolt.geometry.attributes.position.count * Math.min(1, k * 2.5) / 6) * 6);
        flash.intensity = 14 * op;
        if (k > 0.45) s.root.visible = false;
      });
      flash.intensity = 0;
      bolt.visible = false;
    }
    await back;
    await this.closing();
  }

  /*
   * El cierre: la carta se suelta del cristal de la cámara rota y cae dando vueltas hasta el
   * suelo, boca arriba; la cámara baja con ella. Al final, a negro (de ahí sale el ritual).
   */
  private async closing() {
    const c = this.card, reduced = this.opts.reduced;
    c.updateMatrixWorld(true);
    this.scene.attach(c);
    const from = c.position.clone(), look = from.clone();
    const side = new THREE.Vector3(1, 0, 0.18);
    const start = from.clone().addScaledVector(side, 1.4).setY(from.y - 0.35);
    // la cabecera del pasillo está a oscuras: la luz fría del tiempo parado se viene encima de la carta
    const light = this.stillLight;
    light.position.set(from.x + 0.25, 1.2, from.z + 0.1);
    if (reduced) {
      // ya en el suelo: un plano fijo, sin caída
      c.position.set(from.x + 0.05, 0.002, from.z);
      c.rotation.set(-Math.PI / 2, 0, 0.5);
      light.intensity = 1.6;
      this.rig.cut({ pos: c.position.clone().add(new THREE.Vector3(0.1, 0.27, 0.05)), look: c.position });
      await this.fade(0, 0.6);
      await this.wait(1.2);
      await this.fade(1, 0.6);
      return;
    }
    this.rig.cut({ pos: start, look: from });
    this.bodies.push({ o: c, half: 0.002, v: new THREE.Vector3(0.15, 0.4, 0.05), w: new THREE.Vector3(3.2, 1.1, 5.4), drag: 1.3, flutter: 1.1, flat: (o) => o.rotateX(-Math.PI / 2) });
    const end = new THREE.Vector3(), over = new THREE.Vector3(0.1, 0.27, 0.05);
    await this.tween(1.6, (k) => {
      // la mirada sigue a la carta con un poco de retraso; la cámara baja con ella y acaba casi
      // encima, a unos 30 cm, para que el joker se lea (la carta mide 6 x 9 cm)
      look.lerp(c.position, 0.18);
      const e = k * k * (3 - 2 * k);
      end.copy(c.position).setY(0).add(over);
      this.rig.cut({ pos: start.clone().lerp(end, e), look });
      light.position.copy(c.position).setY(1.1).add(over);
      light.intensity = 1.6 * e;
    });
    await this.wait(0.5);
    await this.fade(1, 0.5);
  }

  // una descarga nueva: un tronco quebrado del suelo al techo, en el sitio del sujeto, y tres ramas
  private shapeBolt() {
    const eye = this.camera.position, base = this.subject.root.position;
    const pos: number[] = [], col: number[] = [], d = new THREE.Vector3(), n = new THREE.Vector3();
    const halo = new THREE.Color(1.3, 0.1, 0.06), core = new THREE.Color(3.2, 1.5, 1.3);
    const path = (p0: THREE.Vector3, dir: THREE.Vector3, len: number, steps: number, jag: number) => {
      const pts = [p0.clone()];
      for (let i = 0; i < steps; i++)
        pts.push(pts[i].clone().addScaledVector(dir, len / steps).add(new THREE.Vector3((Math.random() - 0.5) * jag, 0, (Math.random() - 0.5) * jag)));
      return pts;
    };
    // cada tramo, dos cintas (el halo rojo y el núcleo casi blanco), de abajo arriba
    const ribbon = (pts: THREE.Vector3[], w: number) => {
      for (let i = 0; i < pts.length - 1; i++) {
        const p = pts[i], q = pts[i + 1];
        for (const [width, c] of [[w, halo], [w * 0.28, core]] as const) {
          n.subVectors(q, p).cross(d.subVectors(eye, p)).normalize().multiplyScalar(width / 2);
          const v = [p.clone().sub(n), p.clone().add(n), q.clone().add(n), q.clone().sub(n)];
          for (const k of [0, 1, 2, 0, 2, 3]) pos.push(v[k].x, v[k].y, v[k].z), col.push(c.r, c.g, c.b);
        }
      }
    };
    const trunk = path(base.clone().setY(0), new THREE.Vector3(0, 1, 0), 3.5, 14, 0.2);
    ribbon(trunk, 0.1);
    for (let i = 0; i < 3; i++) {
      const at = trunk[4 + ((Math.random() * 7) | 0)], sx = Math.random() < 0.5 ? -1 : 1;
      ribbon(path(at, new THREE.Vector3(sx * 0.8, 0.55, (Math.random() - 0.5) * 0.6).normalize(), 0.5 + Math.random() * 0.4, 5, 0.12), 0.055);
    }
    const g = this.bolt.geometry;
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    g.setDrawRange(0, 0);
  }

  /** Pasos 3 y 4: busca, se pone nervioso, se gira, lanza. Se resuelve con la señal cortada. */
  async recording() {
    const s = this.subject, lens = this.cctvCam.position.clone();
    this.setView('cctv');
    this.audio.hum(true);
    s.to('searching-files-high');
    s.reachTo(this.loose[1].getWorldPosition(new THREE.Vector3()), true);
    await this.wait(1.6);
    this.drop(0);
    await this.wait(2.9);
    s.reachTo(null);
    s.to('nervously-look-around', { fade: 0.6 });
    await this.wait(2.4);
    this.mark('throw');
    // se gira hacia la cámara: aquí la máscara se presenta (el cómic, fundido con el CCTV)
    this.comicTo(1, 0.4, 0.5);
    await s.turn();
    s.lookAt(lens, { snap: true });
    await this.wait(0.45);
    let hit: Promise<void> = Promise.resolve();
    await s.drawAndThrow(this.card, lens, (from) => (hit = this.flyCard(from)));
    await hit;
    this.comicTo(0, 0.3);
  }

  /*
   * La carta vuela al objetivo con efecto: una curva que se abre hacia un lado (0,42 m) y vuelve,
   * girando sobre su eje largo a unas 9 vueltas por segundo, con las vueltas justas para que al
   * entrar en la cámara lenta el joker ya mire a la lente. A 0,12 m del cristal el tiempo baja a 0,15 durante 0,45 s
   * de verdad (se lee la carta) y vuelve de golpe en el impacto: grieta, cristal y, 0,35 s
   * después, la estática. Con movimiento reducido, recta, sin cámara lenta y la estática en fundido.
   */
  private async flyCard(from: THREE.Vector3) {
    const c = this.card, cam = this.cctvCam, reduced = this.opts.reduced, dir = cam.getWorldDirection(new THREE.Vector3());
    const right = new THREE.Vector3().crossVectors(dir, cam.up).normalize();
    const end = cam.position.clone().addScaledVector(dir, 0.16).addScaledVector(right, 0.02).addScaledVector(cam.up, 0.012);
    const start = from.clone();
    this.audio.whoosh();
    // la orientación: de cara a la lente, girada `turn` vueltas sobre su eje largo
    const face = (turn: number) => {
      c.lookAt(cam.position);
      c.rotateY(turn * Math.PI * 2);
    };
    const slow = 0.12, last = 0.45 * 0.15;
    if (reduced) {
      await this.tween(0.4, (k) => (c.position.lerpVectors(start, end, k), face(0)));
    } else {
      const side = right.clone().multiplyScalar(0.42);
      const curve = new THREE.CubicBezierCurve3(start, start.clone().lerp(end, 0.33).add(side), end.clone().lerp(start, 0.3).addScaledVector(side, 0.5).addScaledVector(cam.up, 0.05), end);
      const len = curve.getLength(), uSlow = 1 - slow / len, fly = 0.55;
      // vueltas enteras (unas 9 por segundo) que acaban justo al entrar en la cámara lenta: ahí ya
      // está de cara, y en el último tramo solo se asienta, con el joker mirando a la lente
      const turns = Math.round(9 * fly);
      await this.tween(fly, (k) => (c.position.copy(curve.getPointAt(k * uSlow)), face(turns * k)));
      this.timeScale = 0.15;
      await this.tween(last, (k) => (c.position.copy(curve.getPointAt(uSlow + k * (1 - uSlow))), face(-0.06 * (1 - k) * (1 - k))));
      this.timeScale = 1;
    }
    c.rotateX(0.35);
    this.crack.hit(0.53 + (Math.random() - 0.5) * 0.06, 0.47 + (Math.random() - 0.5) * 0.06);
    this.crackTex.needsUpdate = true;
    this.audio.glass();
    await this.wait(0.35);
    const st = (this.staticPlane.material as THREE.ShaderMaterial).uniforms.uAmt;
    await this.tween(reduced ? 0.8 : 0.25, (k) => (st.value = k));
  }

  private fade(to: number, sec: number) {
    const m = this.fadePlane.material as THREE.MeshBasicMaterial, from = m.opacity;
    return this.tween(sec, (k) => (m.opacity = from + (to - from) * k));
  }

  /** Pasos 5 a 7: dentro, el frenesí y el tiempo que se para. Se resuelve con todo congelado. */
  async inside() {
    const s = this.subject, reduced = this.opts.reduced, lens = this.cctvCam.position.clone();
    this.mark('inside');
    if (reduced) await this.fade(1, 0.01);
    this.setView('inside');
    this.audio.hum(false);
    // 1. por encima del hombro de la cámara rota, de tres cuartos y fuera de la línea de la lente:
    // la carta clavada en el cristal, asomando por el borde y con el joker hacia aquí, en primer
    // término; al fondo, el pasillo y él, en la luz, donde los libros empiezan a caer
    const cc = this.cctvCam, dir = cc.getWorldDirection(new THREE.Vector3()), right = new THREE.Vector3().crossVectors(dir, cc.up).normalize();
    const at = (r: number, u: number, f: number) => lens.clone().addScaledVector(right, r).addScaledVector(cc.up, u).addScaledVector(dir, f);
    const eye = at(0.24, 0.1, -0.34);
    const c = this.card;
    c.position.copy(at(0.06, 0.03, 0.04));
    c.lookAt(eye);
    c.rotateZ(0.42);
    this.rig.cut({ pos: eye, look: at(0.05, -0.35, 2.4), drift: 0.025, breathe: 0.002 });
    s.lookAt(null);
    s.place(new THREE.Vector3(-4.6, 0, AISLE_Z - 0.55), Math.PI);
    s.to('rummaging', { speed: 1.6, cut: true });
    this.frenzy = { next: this.t + 0.4, n: 0, max: reduced ? 6 : 14 };
    // lo que tarda en pararse el tiempo desde aquí (las esperas de abajo, en orden)
    this.freezeAt = this.t + (reduced ? 0.6 : 0) + 1.7 + (reduced ? 0.8 : 1.3) + 2.1 + 0.85;
    if (reduced) await this.fade(0, 0.6);
    await this.wait(1.7);
    // 2. por el pasillo hasta él: bajo y de lado, sin ponerse de frente
    const near = new THREE.Vector3(-3.25, 0.82, AISLE_Z + 0.7), nearLook = new THREE.Vector3(-4.6, 1.3, AISLE_Z - 0.55);
    if (reduced) {
      await this.fade(1, 0.4);
      this.rig.cut({ pos: near, look: nearLook });
      await this.fade(0, 0.4);
    } else await this.rig.go({ pos: near, look: nearLook, drift: 0.04, breathe: 0.003 }, 1.3);
    await this.wait(2.1);
    // 3. se da la vuelta y se va por el pasillo, hacia la luz
    this.mark('still');
    this.frenzy = undefined;
    s.reachTo(null);
    // echa a andar mientras gira: el paso y el giro van a la vez, sin pivotar en el sitio
    s.to('walking', { fade: 0.4 });
    s.steer(Math.PI / 2 - s.root.rotation.y, 0.6);
    await this.wait(0.85);
    // 4. el tiempo se para; la cámara le espera delante, en la luz, y él viene hacia ella
    this.frozen = true;
    s.freeze(true, 0.012);
    this.audio.stopTime();
    // con él donde se ha parado de verdad, las hojas se recolocan sin taparle; las que aún no
    // hubieran llegado, ya en su sitio
    this.layout(this.stillEye());
    for (const sh of this.sheets) {
      sh.mesh.visible = true;
      sh.mesh.position.copy(sh.base);
      sh.mesh.quaternion.copy(sh.q);
    }
    const sp = this.stillPass?.uniforms.uAmt;
    // una luz fría y baja junto a la cámara, para que las hojas se lean
    this.stillLight.position.copy(STILL_POS).add(new THREE.Vector3(0.6, 0.9, 0.3));
    this.comicTo(1, 0.6);
    await Promise.all([
      this.rig.go({ pos: STILL_POS, look: STILL_LOOK, breathe: 0.0015 }, reduced ? 1.2 : 2.2),
      this.tween(0.6, (k) => {
        if (sp) sp.value = k;
        this.stillLight.intensity = 1.1 * k;
      }),
    ]);
  }

  // ¿toca imagen nueva? a 12,5 por segundo
  private due() {
    if (this.realT - this.shotAt < 0.08 && this.realT >= this.shotAt) return false;
    this.shotAt = this.realT;
    this.osd.draw();
    return true;
  }

  renderFeed(force = false) {
    if (!this.due() && !force) return;
    const r = this.renderer, prev = r.getRenderTarget(), m = this.lens.material as THREE.ShaderMaterial;
    let src = this.raw;
    this.lit(() => {
      r.setRenderTarget(this.raw);
      r.render(this.scene, this.cctvCam);
      if (this.comic.amount > 0) {
        this.comic.renderMask(this.scene, this.cctvCam, this.noMask());
        this.comic.pass.render(r, this.rawC, this.raw, 0, false);
        src = this.rawC;
      }
    });
    m.uniforms.tDiffuse.value = src.texture;
    m.uniforms.tOsd.value = this.osd.tex;
    r.setRenderTarget(this.feed);
    this.lens.render(r);
    r.setRenderTarget(prev);
  }

  takeOver(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.govern = governor(this.renderer, () => this.resize());
    const r = this.renderer;
    r.shadowMap.enabled = true;
    r.shadowMap.type = shadowType(r);
    r.toneMapping = THREE.ACESFilmicToneMapping;
    r.toneMappingExposure = 1.05;
    const c = (this.composer = new EffectComposer(r));
    c.addPass((this.renderPass = new RenderPass(this.scene, this.view === 'cctv' ? this.cctvCam : this.camera)));
    // el cómic, antes de la lente: la lente curva la imagen y su máscara no
    c.addPass(this.comic.pass);
    c.addPass((this.lensPass = new ShaderPass(CctvLensShader)));
    this.lensPass.uniforms.tOsd.value = this.osd.tex;
    this.lensPass.enabled = this.view === 'cctv';
    c.addPass(new UnrealBloomPass(new THREE.Vector2(1, 1), 0.7, 0.5, 0.6));
    c.addPass((this.stillPass = new ShaderPass(StillShader)));
    c.addPass(new OutputPass());
    c.addPass(new SMAAPass(1, 1));
    // sin la sala, la grabación se ve a pantalla completa con el mismo aspecto de cámara barata
    c.addPass((this.cctvPass = new ShaderPass(CctvShader)));
    this.cctvPass.uniforms.uMove.value = this.opts.reduced ? 0 : 1;
    this.cctvPass.uniforms.tComic.value = this.comic.mask;
    this.cctvPass.enabled = this.view === 'cctv';
    this.resize();
    // la última pasada pinta en pantalla y cambia según haya filtro CCTV o no: las dos versiones se
    // compilan ya: un fotograma al revés y, encima, el bueno, antes de que el navegador enseñe nada
    this.cctvPass.enabled = !this.cctvPass.enabled;
    c.render();
    this.cctvPass.enabled = !this.cctvPass.enabled;
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
    this.camera.fov = fovFor(w / h);
    this.camera.updateProjectionMatrix();
    // a pantalla completa, la cámara de seguridad también toma el aspecto de la ventana
    this.cctvCam.aspect = w / h;
    this.cctvCam.updateProjectionMatrix();
    this.cctvPass?.uniforms.uRes.value.set(w, h);
    const pr = this.renderer.getPixelRatio();
    this.comic.setSize(w * pr, h * pr);
    // la lente trabaja a la resolución del sensor, no a la de la ventana
    this.lensPass?.uniforms.uRes.value.set((480 * w) / h, 480);
    if (this.frozen && this.view === 'inside') this.layout(this.stillEye());
    this.fitOverlays();
  };

  private frame = (now: number) => {
    if (this.disposed) return;
    this.raf = requestAnimationFrame(this.frame);
    // el primer fotograma trae una marca de tiempo anterior a takeOver: sin dt negativo (el reloj iría hacia atrás)
    const dt = THREE.MathUtils.clamp((now - this.last) / 1000, 0, 0.1);
    this.last = now;
    this.govern(dt);
    this.update(dt);
    // la grabación, a su ritmo de cámara de vigilancia; ya dentro, a todo lo que dé
    if (this.view === 'cctv' && !this.due()) return;
    const cm = this.comic;
    if (cm.amount > 0) cm.renderMask(this.scene, this.view === 'cctv' ? this.cctvCam : this.camera, this.noMask());
    if (this.cctvPass) this.cctvPass.uniforms.uComicCctv.value = cm.cctv * cm.amount;
    this.composer!.render();
  };

  /** Desarrollo: la carta delante de la cámara de dentro, para mirarla de cerca. */
  debugCard(back = false) {
    const c = this.card, cam = this.camera;
    c.visible = true;
    c.position.copy(cam.position).addScaledVector(cam.getWorldDirection(new THREE.Vector3()), 0.16);
    c.quaternion.copy(cam.quaternion);
    if (back) c.rotateY(Math.PI);
  }

  // lo que no tapa al sujeto en la máscara del cómic: los haces, el polvo y los planos pegados a las cámaras
  private noMask() {
    const o: THREE.Object3D[] = [this.glassPlane, this.staticPlane, this.fadePlane];
    return this.air ? [...o, this.air.group] : o;
  }

  // el cómic sube o baja hasta `to` en `sec` s
  private comicTo(to: number, sec: number, cctv = 0) {
    const c = this.comic, from = c.amount;
    if (to > 0) c.cctv = cctv;
    this.tween(sec, (k) => (c.amount = from + (to - from) * k));
  }

  /** No desecha el renderer: es prestado (o lo desecha quien lo creó). */
  dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.raf);
    window.removeEventListener('resize', this.resize);
    this.feed.dispose();
    this.raw.dispose();
    this.rawC.dispose();
    this.comic.dispose();
    this.osd.dispose();
    this.lens.dispose();
    (this.lens.material as THREE.Material).dispose();
    this.jobs.length = 0;
    this.audio.dispose();
    this.crackTex.dispose();
    this.cardKit?.dispose();
    this.subject.dispose();
    this.scene.environment?.dispose();
    disposeDeep(this.scene);
    this.composer?.dispose();
  }
}

// dónde cae cada lucernario en la cookie de la luna (u, de 0 a 1): tres, a lo largo del pasillo
const WINDOWS = [0.33, 0.5, 0.67];

// la silueta de los lucernarios: cuatro paños con su cruz de hierro, bordes algo blandos
function windowCookie() {
  const N = 512, c = canvas(N), x = c.getContext('2d')!;
  x.fillStyle = '#000';
  x.fillRect(0, 0, N, N);
  x.filter = 'blur(3px)';
  x.fillStyle = '#fff';
  const w = 36, h = 44, bar = 3;
  for (const u of WINDOWS) {
    const x0 = u * N - w / 2, y0 = N / 2 - h / 2;
    for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) x.fillRect(x0 + i * (w / 2 + bar / 2), y0 + j * (h / 2 + bar / 2), w / 2 - bar / 2, h / 2 - bar / 2);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// tablas de roble oscuro barnizado: cada tabla de su tono, juntas hundidas, el barniz gastado
// en manchas (más mate) y algún arañazo; un lienzo cubre 2 × 2 m
function floorMaterial() {
  const N = 1024, PX = N / 2; // píxeles por metro
  const col = canvas(N), hgt = canvas(N), rgh = canvas(N);
  const c = col.getContext('2d')!, h = hgt.getContext('2d')!, r = rgh.getContext('2d')!;
  const rand = seeded(21);
  h.fillStyle = '#9a9a9a';
  h.fillRect(0, 0, N, N);
  r.fillStyle = '#8a8a8a';
  r.fillRect(0, 0, N, N);
  const bw = 0.16 * PX; // tablas de 16 cm, a lo largo de x
  for (let y = 0; y < N; y += bw) {
    let x = -rand() * PX;
    while (x < N) {
      const len = (0.9 + rand() * 1.1) * PX, k = 0.75 + rand() * 0.4;
      c.fillStyle = `rgb(${(52 * k) | 0},${(34 * k) | 0},${(22 * k) | 0})`;
      c.fillRect(x, y, len, bw);
      // la veta: líneas largas que ondulan
      for (let v = 0; v < 9; v++) {
        const gy = y + rand() * bw, a = 0.05 + rand() * 0.12;
        c.strokeStyle = `rgba(${rand() > 0.5 ? '20,12,8' : '90,62,40'},${a})`;
        c.lineWidth = 0.6 + rand() * 1.4;
        c.beginPath();
        c.moveTo(x, gy);
        for (let s = 0; s <= len; s += 24) c.lineTo(x + s, gy + Math.sin(s * 0.013 + v) * 2.2 * rand());
        c.stroke();
      }
      // juntas: la del final de la tabla y la de su lado
      for (const [ctx, color] of [[c, 'rgba(8,5,3,0.9)'], [h, '#202020']] as const) {
        ctx.fillStyle = color;
        ctx.fillRect(x, y, 2, bw);
        ctx.fillRect(x, y, len, 2);
      }
      x += len;
    }
  }
  // el barniz gastado: manchas más mates y algo más claras; arañazos finos
  for (let i = 0; i < 26; i++) {
    const x = rand() * N, y = rand() * N, rad = 40 + rand() * 160;
    const g = r.createRadialGradient(x, y, 0, x, y, rad);
    g.addColorStop(0, 'rgba(200,200,200,0.55)');
    g.addColorStop(1, 'rgba(200,200,200,0)');
    r.fillStyle = g;
    r.fillRect(x - rad, y - rad, rad * 2, rad * 2);
  }
  for (let i = 0; i < 40; i++) {
    const x = rand() * N, y = rand() * N, a = rand() * Math.PI, l = 8 + rand() * 40;
    for (const [ctx, color] of [[c, 'rgba(24,15,10,0.25)'], [h, 'rgba(120,120,120,0.3)'], [r, 'rgba(170,170,170,0.3)']] as const) {
      ctx.strokeStyle = color;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l);
      ctx.stroke();
    }
  }
  const rep: [number, number] = [17, 9];
  return new THREE.MeshStandardMaterial({ map: tex(col, rep, true), normalMap: normalFrom(hgt, 4, rep), roughnessMap: tex(rgh, rep, false), roughness: 1 });
}
