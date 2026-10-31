import * as THREE from 'three';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';

/*
 * El toque cómic (dosis 2), solo sobre lo que hace acto de presencia (la máscara, el sujeto):
 * tintas descuadradas 1,5 px, trama de puntos en las sombras, un contorno fino de tinta y, si
 * el dueño lo usa, la pose a saltos de 12 fps mientras el resto sigue fluido.
 *
 * Qué es "lo marcado" lo dice una máscara de objeto a media resolución: la escena entera en negro
 * (para que lo que tape al objeto lo tape también aquí) y encima `targets` en blanco.
 * La pasada va antes del OutputPass: trabaja en lineal.
 */
const ComicShader = {
  uniforms: {
    tDiffuse: { value: null as THREE.Texture | null },
    tMask: { value: null as THREE.Texture | null },
    uRes: { value: new THREE.Vector2(1, 1) },
    uAmt: { value: 0 },
    uMis: { value: 1.5 },
    uDot: { value: 0.55 },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse, tMask;
    uniform vec2 uRes;
    uniform float uAmt, uMis, uDot;
    varying vec2 vUv;
    void main() {
      vec4 s = texture2D(tDiffuse, vUv);
      vec2 px = 1.0 / uRes;
      float m = texture2D(tMask, vUv).r;
      // el contorno: donde la máscara cambia, a 1,25 px a cada lado
      vec2 e = px * 1.25;
      float gx = texture2D(tMask, vUv + vec2(e.x, 0.0)).r - texture2D(tMask, vUv - vec2(e.x, 0.0)).r;
      float gy = texture2D(tMask, vUv + vec2(0.0, e.y)).r - texture2D(tMask, vUv - vec2(0.0, e.y)).r;
      float ink = smoothstep(0.25, 0.7, length(vec2(gx, gy)));
      if (m < 0.01 && ink < 0.01) { gl_FragColor = s; return; }
      // descuadre: el rojo y el azul, un poco fuera de sitio
      float r = texture2D(tDiffuse, vUv + px * vec2(uMis, -uMis * 0.5)).r;
      float b = texture2D(tDiffuse, vUv - px * vec2(uMis * 0.7, -uMis * 0.7)).b;
      vec3 col = vec3(r, s.g, b);
      // trama: puntos que crecen en la sombra (la luz, en gamma, por debajo de 0,45)
      float l = pow(max(dot(s.rgb, vec3(0.299, 0.587, 0.114)), 0.0), 1.0 / 2.2);
      vec2 f = fract(mat2(0.69, -0.72, 0.72, 0.69) * (vUv * uRes) / 5.5) - 0.5;
      float shade = smoothstep(0.45, 0.05, l);
      float dotm = 1.0 - smoothstep(shade * 0.62 - 0.06, shade * 0.62 + 0.06, length(f));
      col = mix(col, vec3(0.002, 0.001, 0.004), dotm * uDot * shade);
      col = mix(s.rgb, col, m);
      col = mix(col, vec3(0.0015, 0.001, 0.0015), ink);
      gl_FragColor = vec4(mix(s.rgb, col, uAmt), s.a);
    }`,
};

export class Comic {
  readonly pass = new ShaderPass(ComicShader);
  /** Lo que recibe el tratamiento. */
  targets: THREE.Object3D[] = [];
  /** 0-1: cuánto ceden el grano y las líneas del filtro CCTV sobre lo marcado. */
  cctv = 0;
  /** Imágenes por segundo de lo marcado (0 = fluido; siempre 0 con movimiento reducido). */
  step: number;
  private rt = new THREE.WebGLRenderTarget(1, 1);
  private black = new THREE.MeshBasicMaterial({ color: 0x000000 });
  private white = new THREE.MeshBasicMaterial({ color: 0xffffff });
  private shown = -1;
  private amt = 0;

  constructor(private renderer: THREE.WebGLRenderer, o: { reduced: boolean }) {
    this.step = o.reduced ? 0 : 12;
    this.pass.uniforms.tMask.value = this.rt.texture;
    this.pass.enabled = false;
  }

  /** La máscara de objeto, para el filtro CCTV. */
  get mask() {
    return this.rt.texture;
  }

  get amount() {
    return this.amt;
  }

  /** 0-1. Con 0 la pasada se apaga del todo, no solo se queda transparente. */
  set amount(v: number) {
    this.amt = v;
    this.pass.uniforms.uAmt.value = v;
    this.pass.enabled = v > 0;
  }

  /** ¿Toca dibujo en este fotograma? Con `t` del reloj del dueño, no del de pared. */
  drawFrame(t: number) {
    if (!this.step || this.amt <= 0) return true;
    const k = Math.floor(t * this.step);
    if (k === this.shown) return false;
    this.shown = k;
    return true;
  }

  /** La silueta de `targets`, tapada por lo que tengan delante. `skip`: lo que no tapa (haces, polvo). */
  renderMask(scene: THREE.Scene, camera: THREE.Camera, skip: THREE.Object3D[] = []) {
    const r = this.renderer, prev = r.getRenderTarget(), over = scene.overrideMaterial, bg = scene.background, fog = scene.fog;
    // las sombras ya están pintadas este fotograma: aquí no hacen falta
    const shadows = r.shadowMap.autoUpdate;
    r.shadowMap.autoUpdate = false;
    const hidden = skip.filter((o) => o.visible);
    for (const o of hidden) o.visible = false;
    const cc = r.getClearColor(new THREE.Color()), ca = r.getClearAlpha();
    r.setRenderTarget(this.rt);
    r.setClearColor(0x000000, 1);
    r.clear();
    r.setClearColor(cc, ca);
    scene.overrideMaterial = this.black;
    scene.background = null;
    scene.fog = null;
    r.render(scene, camera);
    scene.overrideMaterial = over;
    scene.background = bg;
    scene.fog = fog;
    for (const o of hidden) o.visible = true;
    // encima, lo marcado en blanco: pasa el test de profundidad donde está a la vista
    const saved: [THREE.Mesh, THREE.Material | THREE.Material[]][] = [];
    for (const t of this.targets)
      t.traverse((o) => {
        const m = o as THREE.Mesh;
        if (m.isMesh && m.visible) saved.push([m, m.material]), (m.material = this.white);
      });
    const auto = r.autoClear;
    r.autoClear = false;
    for (const t of this.targets) if (t.visible) r.render(t, camera);
    r.autoClear = auto;
    for (const [m, mat] of saved) m.material = mat;
    r.shadowMap.autoUpdate = shadows;
    r.setRenderTarget(prev);
  }

  /** Tamaño, en píxeles de verdad, de la imagen sobre la que va la pasada. */
  setSize(w: number, h: number) {
    this.rt.setSize(Math.max(1, Math.round(w / 2)), Math.max(1, Math.round(h / 2)));
    this.pass.uniforms.uRes.value.set(w, h);
  }

  dispose() {
    this.rt.dispose();
    this.black.dispose();
    this.white.dispose();
    this.pass.dispose();
  }
}
