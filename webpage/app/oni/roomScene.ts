import * as THREE from 'three';
import { disposeDeep } from './dispose';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { SMAAPass } from 'three/examples/jsm/postprocessing/SMAAPass.js';
import { N8AOPass } from 'n8ao';
import { governor, shadowType } from './quality';
import { compileGently } from './compile';
import { RoomAudio } from './roomAudio';
import { Comic } from './comic';
import { makeClock } from './clock3d';
import { applyBake, exportBake } from './bake';

/*
 * La habitación de s7lver, de noche y con tormenta, vista desde la cama.
 * La ventana queda a la derecha, fuera de plano: solo se ve la luz que mete
 * (el neón de enfrente, los faros de algún coche, los relámpagos) con las gotas
 * resbalando proyectadas en el suelo. El scroll nos levanta de la cama hasta el
 * monitor: se enciende con estática, la silla se aparta, asoma la máscara y al
 * final la cámara se mete dentro de la pantalla.
 * Unidades en metros. La pared del fondo (la del PC) está en z = -BACK.
 */

type V3 = [number, number, number];
const W = 1.95; // media anchura de la habitación
const BACK = 2.4; // media profundidad
const H = 2.7;
const WIN_Z = 1.55; // la ventana, en la pared derecha a la altura de la almohada

// Ojos de la máscara (ver public/models/oni-mask.eyes.json)
const EYES: { p: V3; r: V3 }[] = [
  { p: [0.232, -0.103, -0.15], r: [0, -0.68, 0.23] },
  { p: [-0.232, -0.103, -0.15], r: [0, 0.68, -0.23] },
];

const ss = THREE.MathUtils.smoothstep;
const lerp = THREE.MathUtils.lerp;
const clamp = THREE.MathUtils.clamp;
const rand = (a: number, b: number) => a + Math.random() * (b - a);
const inOutCubic = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
/** Arranca lento y acaba lanzado: la cámara gana velocidad hasta la pantalla. */
const rush = (t: number) => 0.15 * t + 0.85 * t * t * t * t;
/** Apertura de los ojos en segundos: una rendija, un parpadeo, medio abiertos, otro cierre y del todo. */
const LIDS: [number, number][] = [[0, 0], [0.6, 0.2], [0.95, 0.02], [1.4, 0.05], [2.2, 0.55], [2.5, 0.38], [3.6, 1]];
function lids(t: number) {
  for (let i = 1; i < LIDS.length; i++) {
    const [t1, v1] = LIDS[i];
    const [t0, v0] = LIDS[i - 1];
    if (t < t1) return lerp(v0, v1, THREE.MathUtils.smootherstep(t, t0, t1));
  }
  return 1;
}

// ─────────────────────────────────────────── shaders

export const NOISE = /* glsl */ `
  float hash(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
  float vnoise(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f);
    return mix(mix(hash(i), hash(i+vec2(1,0)), f.x), mix(hash(i+vec2(0,1)), hash(i+vec2(1,1)), f.x), f.y); }
`;

export const QUAD_VS = /* glsl */ `
  varying vec2 vUv;
  void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;

// Pantalla del monitor: estática de canal vacío con la máscara asomando debajo
const screenShader = {
  uniforms: {
    tMask: { value: null as THREE.Texture | null },
    uTime: { value: 0 },
    uOn: { value: 0 }, // 0 apagada → 1 encendida (incluye el destello del tubo)
    uClear: { value: 0 }, // cuánto se deja ver la máscara entre el ruido
    uAspect: { value: 2.4 },
    uNear: { value: 0 },
    uLevel: { value: 0 }, // volumen de la radio: la imagen late con la música
    uCut: { value: 0 }, // entra una voz: la señal se rompe
    uFlash: { value: 0 }, // relámpago con la pantalla apagada
  },
  vertexShader: QUAD_VS,
  fragmentShader: /* glsl */ `
    uniform sampler2D tMask;
    uniform float uTime, uOn, uClear, uAspect, uNear, uLevel, uCut, uFlash;
    varying vec2 vUv;
    ${NOISE}
    void main(){
      // apagada: cristal negro; solo el reflejo de la ventana y un filo de luz en el borde
      vec3 glass = vec3(0.003, 0.003, 0.0035);
      glass += vec3(0.07, 0.01, 0.008) * smoothstep(0.75, 0.0, distance(vUv * vec2(uAspect, 1.0), vec2(uAspect * 0.86, 0.78))) ;
      glass += vec3(0.02) * smoothstep(0.985, 1.0, vUv.y);
      // el relámpago se refleja en el cristal apagado y, un instante, se ve la máscara dentro
      vec3 ghost = texture2D(tMask, vUv + vec2(0.006, 0.0)).rgb;
      glass += vec3(1.0, 0.18, 0.12) * dot(ghost, vec3(0.3, 0.6, 0.1)) * uFlash * 0.9 * (1.0 - smoothstep(0.0, 0.3, uOn));
      if (uOn <= 0.0) { gl_FragColor = vec4(glass, 1.0); return; }
      vec2 uv = vUv;
      // encendido de tubo: una línea que se abre en vertical
      float open = smoothstep(0.0, 0.45, uOn);
      float lineMask = step(abs(uv.y - 0.5) * 2.0, max(open, 0.012));
      if (lineMask < 0.5) { gl_FragColor = vec4(glass, 1.0); return; }

      float t = uTime;
      float row = floor(uv.y * 90.0);
      float tick = floor(t * 18.0);
      float tear = step(0.93 - uCut * 0.35, hash(vec2(row, tick))) * (hash(vec2(row, tick + 3.0)) - 0.5) * (0.12 + uCut * 0.3);
      vec2 muv = uv + vec2(tear + sin(uv.y * 30.0 + t * 20.0) * 0.003, 0.0);
      muv.y = fract(muv.y + sin(t * 0.37) * 0.02 * (1.0 - uClear));

      // nieve
      vec2 cell = floor(vec2(uv.x * 420.0 * uAspect, uv.y * 420.0));
      float snow = pow(hash(cell + fract(t * 13.37) * 117.0), 1.6);
      float bands = (0.75 + 0.25 * sin(uv.y * 8.0 - t * 6.0)) * (1.0 + uLevel * 0.45 + uCut * 0.5);

      vec3 mask = vec3(
        texture2D(tMask, muv + vec2(0.004, 0.0)).r,
        texture2D(tMask, muv).g,
        texture2D(tMask, muv - vec2(0.004, 0.0)).b);

      // la máscara aparece a golpes: momentos de señal limpia entre el ruido
      float gust = smoothstep(0.55, 0.95, vnoise(vec2(t * 1.7, 4.0)));
      float vis = clamp(uClear * (0.75 + 0.8 * gust) + uLevel * 0.3, 0.0, 1.0) * (1.0 - uCut * 0.85);
      vis = max(vis, uFlash * 0.95); // cada relámpago la deja ver entera un instante
      vec3 col = vec3(snow) * bands * (1.0 - vis * 0.82) * 0.85;
      col += mask * vis * 2.1;

      col *= 0.82 + 0.18 * sin(uv.y * 900.0);              // líneas de escaneo
      col *= smoothstep(0.75, 0.25, length(uv - 0.5));
      col += vec3(1.0, 0.97, 0.94) * (1.0 - smoothstep(0.0, 0.5, uOn)) * 3.0; // destello del encendido
      // de cerca: subpíxeles rojo, verde y azul, y la rendija negra entre filas
      vec2 pg = vUv * vec2(uAspect, 1.0) * 360.0;
      float fx = fract(pg.x);
      vec3 sub = vec3(step(fx, 0.333), step(0.333, fx) * step(fx, 0.666), step(0.666, fx));
      float rowGap = smoothstep(0.0, 0.14, fract(pg.y)) * smoothstep(1.0, 0.86, fract(pg.y));
      col *= mix(vec3(1.0), sub * rowGap * 2.6, uNear);
      gl_FragColor = vec4(col * lineMask * (1.35 + uNear * 0.8), 1.0);
    }`,
};

// Gotas y regueros en el cristal. No se pinta en el cristal (no se ve): se
// proyecta, así que las gotas resbalan por el suelo dentro de la luz.
export const cookieShader = {
  uniforms: { uTime: { value: 0 } },
  vertexShader: QUAD_VS,
  fragmentShader: /* glsl */ `
    uniform float uTime;
    varying vec2 vUv;
    ${NOISE}
    // x: sombra de la gota, y: brillo del borde (la gota hace de lente)
    vec2 layer(vec2 p, float t, float scale){
      vec2 g = p * scale;
      vec2 id = floor(g), f = fract(g) - 0.5;
      float h = hash(id);
      float y = fract(h * 13.0 + t * (0.08 + h * 0.22));
      vec2 c = vec2((h - 0.5) * 0.6, 0.45 - y * 0.9);
      float d = length((f - c) * vec2(1.0, 0.75));
      float on = step(0.4, h);
      float drop = smoothstep(0.11, 0.05, d) * on;
      float rim = smoothstep(0.13, 0.1, d) * smoothstep(0.06, 0.1, d) * on;
      float trail = smoothstep(0.045, 0.0, abs(f.x - c.x)) * step(c.y, f.y) * (1.0 - smoothstep(0.0, 0.45, f.y - c.y)) * on;
      return vec2(max(drop, trail * 0.55), rim);
    }
    void main(){
      vec2 p = vUv;
      vec2 a = layer(p, uTime, 9.0);
      vec2 b = layer(p + 0.37, uTime * 0.7, 15.0);
      float st = step(0.86, hash(floor(p * 40.0))) * smoothstep(0.32, 0.12, length(fract(p * 40.0) - 0.5));
      float shade = max(max(a.x, b.x * 0.8), st * 0.7);
      float rim = a.y + b.y * 0.7;
      // el agua que corre por el cristal hace temblar la luz
      float wave = 0.9 + 0.1 * vnoise(vec2(p.x * 6.0, p.y * 3.0 + uTime * 0.6));
      gl_FragColor = vec4(vec3(wave * (1.0 - shade * 0.65) + rim * 0.9), 1.0);
    }`,
};

// Haz de luz con polvo: el volumen del neón cruzando el cuarto
const shaftShader = {
  uniforms: { uTime: { value: 0 }, uColor: { value: new THREE.Color() }, uFlash: { value: 0 } },
  vertexShader: /* glsl */ `
    attribute float aT; varying float vT; varying vec3 vW;
    void main(){ vT = aT; vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
  fragmentShader: /* glsl */ `
    uniform float uTime, uFlash; uniform vec3 uColor;
    varying float vT; varying vec3 vW;
    ${NOISE}
    void main(){
      float n = 0.65 + 0.35 * vnoise(vW.xy * 3.0 + vec2(0.0, uTime * 0.15));
      float a = pow(1.0 - vT, 2.2) * n * 0.012;
      gl_FragColor = vec4(uColor * (1.0 + uFlash * 6.0) * a, 1.0);
    }`,
};

// Pasada final: desenfoque de primer plano, etalonaje, grano, viñeta y la zambullida
const lensShader = {
  uniforms: {
    tDiffuse: { value: null },
    uTime: { value: 0 },
    uDive: { value: 0 },
    uTilt: { value: 1 },
    uSpeed: { value: 0 },
    uNear: { value: 0 },
    uWake: { value: 1 },
    uRes: { value: new THREE.Vector2(1, 1) },
  },
  vertexShader: QUAD_VS,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse; uniform float uTime, uDive, uTilt, uSpeed, uNear, uWake; uniform vec2 uRes;
    varying vec2 vUv;
    float hash(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
    // disco de Vogel: 16 muestras repartidas, giradas por píxel para que no haya bandas
    vec3 blur(vec2 uv, float r){
      vec3 acc = vec3(0.0);
      float rot = hash(gl_FragCoord.xy) * 6.2831;
      for (int i = 0; i < 16; i++){
        float fi = float(i);
        float a = fi * 2.39996 + rot;
        vec2 o = vec2(cos(a), sin(a)) * sqrt((fi + 0.5) / 16.0) * r;
        acc += texture2D(tDiffuse, uv + o * vec2(uRes.y / uRes.x, 1.0)).rgb;
      }
      return acc / 16.0;
    }
    void main(){
      vec2 cc = vUv - 0.5;
      float k = uDive * uDive;
      float t = uTime;
      vec2 uv = vUv;

      // ── entrar en el ordenador
      // bloques de señal rota que saltan de lado
      vec2 blk = floor(vUv * vec2(5.0, 30.0));
      float tick = floor(t * 22.0);
      float rot = step(1.0 - uDive * 0.7, hash(blk + tick)) * step(0.05, uDive);
      uv.x += (hash(blk * 1.7 + tick) - 0.5) * 0.3 * rot * uDive;
      // la imagen se curva y se hunde hacia dentro, como caer por el tubo
      uv = 0.5 + (uv - 0.5) * (1.0 - k * 1.6 * dot(cc, cc)) * (1.0 - k * 0.35);
      // al final se pixela: estamos atravesando la rejilla del panel
      float px = mix(1.0, 28.0, smoothstep(0.55, 0.92, uDive));
      if (px > 1.5) uv = (floor(uv * uRes / px) + 0.5) * px / uRes;

      // cerca del panel y al entrar, el rojo, el verde y el azul se separan
      float ab = 0.0007 + dot(cc, cc) * 0.004 + uNear * 0.004 + k * 0.035;
      vec3 sharp = vec3(texture2D(tDiffuse, uv + cc * ab).r, texture2D(tDiffuse, uv).g, texture2D(tDiffuse, uv - cc * ab).b);
      // velocidad: los bordes se arrastran hacia el centro, el centro queda nítido
      float zs = max(uSpeed, uDive * 0.9);
      if (zs > 0.01) {
        vec3 zb = vec3(0.0);
        for (int i = 0; i < 10; i++) zb += texture2D(tDiffuse, uv - cc * (float(i) / 9.0) * zs * 0.12).rgb;
        sharp = mix(sharp, zb / 10.0, smoothstep(0.0, 0.25, zs) * smoothstep(0.06, 0.45, length(cc)));
      }

      // la manta de primer plano, fuera de foco: más cerca del borde de abajo, más blur
      float nearB = smoothstep(0.42, 0.02, vUv.y) * uTilt;
      float farB = smoothstep(0.9, 1.0, vUv.y) * uTilt * 0.4;
      float r = (nearB + farB) * 0.02 + (1.0 - uWake) * 0.018; // recién despierto, todo borroso
      vec3 col = r > 0.0005 ? mix(sharp, blur(uv, r), smoothstep(0.0, 0.004, r)) : sharp;

      // etalonaje: negros profundos con un punto cálido, luces limpias
      float l = dot(col, vec3(0.2126, 0.7152, 0.0722));
      col = mix(col, col * vec3(1.06, 0.97, 0.95), smoothstep(0.25, 0.0, l));
      col = col / (1.0 + col * 0.06);

      // pegados al monitor la imagen entera se vuelve pantalla: líneas de escaneo y color de fósforo
      float sl = 0.5 + 0.5 * sin(vUv.y * uRes.y * 3.14159);
      col *= 1.0 - uNear * 0.28 * (1.0 - sl);
      col = mix(col, vec3(dot(col, vec3(0.3, 0.59, 0.11))) * vec3(1.2, 0.86, 0.82), uNear * 0.4);
      // una barra de refresco que baja despacio
      col *= 1.0 - uNear * 0.12 * smoothstep(0.0, 0.1, 0.1 - abs(fract(vUv.y - t * 0.12) - 0.5));

      // al cruzar el cristal: destello rojo y franjas que barren
      float flash = smoothstep(0.6, 0.7, uDive) * (1.0 - smoothstep(0.7, 0.86, uDive));
      col += vec3(1.0, 0.16, 0.1) * flash * 1.4;
      col *= 1.0 - 0.45 * uDive * step(0.9, fract(vUv.y * 4.0 - t * 3.0));

      float g = hash(floor(vUv * uRes / 1.5) + fract(t * 9.0) * 51.0);
      col += (g - 0.5) * (0.022 + uNear * 0.03 + k * 0.5);
      col = mix(col, vec3(g) * vec3(1.0, 0.85, 0.82), smoothstep(0.78, 1.0, uDive) * 0.85); // dentro: solo señal
      col *= smoothstep(0.95, 0.2, length(cc) * (1.0 + k * 0.6 + uNear * 0.25));
      col *= 1.0 - smoothstep(0.94, 1.0, uDive);
      // párpados: una rendija con forma de ojo que se abre, parpadea y se abre del todo
      float ex = (vUv.x - 0.5) * 2.0;
      float lid = uWake * 1.6 * sqrt(max(0.0, 1.0 - ex * ex * 0.55));
      col *= 1.0 - smoothstep(lid - 0.22, lid, abs(vUv.y - 0.5) * 2.0);
      gl_FragColor = vec4(col, 1.0);
    }`,
};

// ─────────────────────────────────────────── materiales

const NOISE3 = /* glsl */ `
  varying vec3 vWPos; varying vec3 vWNrm;
  float h31(vec3 p){ return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453); }
  float n3(vec3 p){
    vec3 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f);
    return mix(mix(mix(h31(i), h31(i+vec3(1,0,0)), f.x), mix(h31(i+vec3(0,1,0)), h31(i+vec3(1,1,0)), f.x), f.y),
               mix(mix(h31(i+vec3(0,0,1)), h31(i+vec3(1,0,1)), f.x), mix(h31(i+vec3(0,1,1)), h31(i+vec3(1,1,1)), f.x), f.y), f.z);
  }
  float fbm3(vec3 p){ float v = 0.0, a = 0.5; for (int i = 0; i < 4; i++){ v += a * n3(p); p *= 2.07; a *= 0.5; } return v; }
  // relieve por derivadas: perturba la normal con una altura calculada en el shader
  vec3 bumpN(vec3 n, vec3 pos, float h, float s){
    vec3 dx = dFdx(pos), dy = dFdy(pos);
    vec3 r1 = cross(dy, n), r2 = cross(n, dx);
    float det = dot(dx, r1);
    vec3 grad = sign(det) * (dFdx(h) * r1 + dFdy(h) * r2);
    // vista muy de lado det → 0: sin esta guarda sale NaN y el bloom lo pinta como cuadrados negros
    vec3 b = abs(det) * n - grad * s;
    float l = length(b);
    return l > 1e-6 && abs(det) > 1e-9 ? b / l : n;
  }
`;

/** Tipos de superficie del shader: cada uno pone su relieve y su rugosidad. */
const KIND = { plastic: 0, fabric: 1, metal: 2, laminate: 3, plaster: 4, wood: 5 } as const;
type Kind = keyof typeof KIND;

interface SurfaceOpts {
  dim: number; // multiplica el albedo después de pasarlo a la paleta
  glow?: number; // lo muy saturado (RGB) emite en rojo
  kind?: Kind;
  bump?: number;
  dust?: number;
  refl?: boolean; // el suelo: reflejo plano del cuarto
}

const pixel = (r: number, g: number, b: number) => {
  const t = new THREE.DataTexture(new Uint8Array([r, g, b, 255]), 1, 1);
  t.needsUpdate = true;
  return t;
};
// blanco: multiplica por 1; plano: la normal de siempre
const NEUTRAL = { white: pixel(255, 255, 255), flat: pixel(128, 128, 255) };

/**
 * El shader de todos los materiales de la habitación:
 * - paleta: los colores se quedan en blanco y negro y lo muy saturado se vuelve rojo;
 * - rugosidad que varía despacio (manchas de uso, no ruido) y relieve solo en el yeso;
 * - polvo en las caras que miran hacia arriba;
 * - y en el suelo, el reflejo del cuarto distorsionado por las vetas.
 */
function surface(m: THREE.MeshStandardMaterial, o: SurfaceOpts, refl?: { tex: THREE.Texture; mat: THREE.Matrix4 }) {
  const kind = KIND[o.kind ?? 'plastic'];
  // el micro-relieve de alta frecuencia centellea con luces duras: solo lo lleva la pared
  const bump = kind === KIND.plaster ? (o.bump ?? 0) : 0;
  // transparente y de dos caras se pinta en dos pasadas, con un programa cada una: una basta
  m.forceSinglePass = true;
  // las mismas texturas en todos (las que faltan, neutras: no cambian nada), para que muchos
  // compartan programa: en Firefox cada programa son ~0,4 s de compilar. El suelo no: con el
  // reflejo y el relieve se pasaría de las 16 texturas
  if (!o.refl) {
    m.map ??= NEUTRAL.white;
    m.roughnessMap ??= NEUTRAL.white;
    m.metalnessMap ??= NEUTRAL.white;
    m.emissiveMap ??= NEUTRAL.white;
    m.aoMap ??= NEUTRAL.white;
    m.normalMap ??= NEUTRAL.flat;
  }
  m.envMapIntensity = 0.05; // el cuarto está a oscuras: el entorno de estudio casi no debe verse
  m.onBeforeCompile = (sh) => {
    // valores como uniformes, no escritos en el shader: un programa por estructura, no por material
    // (Firefox compila en el hilo principal y cada programa de más es un tirón)
    Object.assign(sh.uniforms, { uDim: { value: o.dim }, uDust: { value: o.dust ?? 0.35 }, uGlow: { value: o.glow ?? 0 }, uBump: { value: bump } });
    if (refl) {
      sh.uniforms.tRefl = { value: refl.tex };
      sh.uniforms.uReflMat = { value: refl.mat };
    }
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', `#include <common>\nvarying vec3 vWPos; varying vec3 vWNrm;${o.refl ? '\nuniform mat4 uReflMat; varying vec4 vRefl;' : ''}`)
      .replace(
        '#include <project_vertex>',
        `#include <project_vertex>
        vWPos = (modelMatrix * vec4(transformed, 1.0)).xyz;
        vWNrm = normalize(mat3(modelMatrix) * objectNormal);${o.refl ? '\n        vRefl = uReflMat * vec4(vWPos, 1.0);' : ''}`,
      );
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>\nuniform float uDim, uDust, uGlow, uBump;\n${NOISE3}${o.refl ? '\nuniform sampler2D tRefl; varying vec4 vRefl;' : ''}`)
      .replace(
        '#include <map_fragment>',
        `#include <map_fragment>
        vec3 gC = diffuseColor.rgb;
        float gLum = dot(gC, vec3(0.299, 0.587, 0.114));
        float gSat = max(gC.r, max(gC.g, gC.b)) - min(gC.r, min(gC.g, gC.b));
        diffuseColor.rgb = mix(vec3(gLum), vec3(gLum * 1.7, gLum * 0.1, gLum * 0.07), smoothstep(0.42, 0.8, gSat)) * uDim;
        float gUp = smoothstep(0.55, 0.95, vWNrm.y);
        float gDust = gUp * smoothstep(0.38, 0.8, fbm3(vWPos * 13.0)) * uDust;
        diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.11, 0.1, 0.1), gDust);`,
      )
      .replace(
        '#include <roughnessmap_fragment>',
        `#include <roughnessmap_fragment>
        float gR = fbm3(vWPos * 1.6);
        roughnessFactor = clamp(roughnessFactor * (0.9 + 0.2 * gR) + gDust * 0.25, 0.04, 1.0);${
          kind === KIND.plaster
            ? `
        // pared pintada: brillo a manchas grandes y pasadas verticales del rodillo
        float gRoll = n3(vec3((vWPos.x + vWPos.z) * 14.0, vWPos.y * 0.35, 0.0));
        roughnessFactor = clamp(roughnessFactor + (fbm3(vWPos * 0.7) - 0.5) * 0.45 + (gRoll - 0.5) * 0.18, 0.25, 1.0);`
            : ''
        }`,
      )
      .replace(
        '#include <normal_fragment_maps>',
        bump > 0
          ? `#include <normal_fragment_maps>
        // yeso: ondulación de la llana, piel de naranja fina y las pasadas del rodillo
        float gH = fbm3(vWPos * 2.5) + fbm3(vWPos * 11.0) * 0.22 + n3(vec3((vWPos.x + vWPos.z) * 14.0, vWPos.y * 0.35, 3.0)) * 0.35;
        normal = bumpN(normal, -vViewPosition, gH, uBump);`
          : '#include <normal_fragment_maps>',
      )
      .replace(
        '#include <emissivemap_fragment>',
        `#include <emissivemap_fragment>
        float gE = dot(totalEmissiveRadiance, vec3(0.299, 0.587, 0.114));
        totalEmissiveRadiance = vec3(gE * 1.6, gE * 0.1, gE * 0.07);
        totalEmissiveRadiance += vec3(1.0, 0.07, 0.04) * smoothstep(0.45, 0.8, gSat) * gLum * uGlow;`,
      );
    if (o.refl)
      sh.fragmentShader = sh.fragmentShader.replace(
        '#include <opaque_fragment>',
        `{
          // reflejo del cuarto en la cera del suelo: borroso donde está gastado
          vec2 ruv = vRefl.xy / vRefl.w + normal.xz * 0.018;
          float rr = 0.002 + roughnessFactor * 0.012;
          vec3 rc = vec3(0.0);
          for (int i = 0; i < 8; i++){
            float a = float(i) * 2.39996;
            rc += texture2D(tRefl, ruv + vec2(cos(a), sin(a)) * rr * sqrt((float(i) + 0.5) / 8.0)).rgb;
          }
          rc /= 8.0;
          float fres = 0.04 + 0.96 * pow(1.0 - clamp(dot(normal, normalize(vViewPosition)), 0.0, 1.0), 5.0);
          outgoingLight += rc * mix(0.25, 1.0, fres) * (1.0 - roughnessFactor) * 0.9;
        }
        #include <opaque_fragment>`,
      );
  };
  m.customProgramCacheKey = () => `surf-${kind === KIND.plaster ? 1 : 0}${bump > 0 ? 1 : 0}${o.refl ? 1 : 0}`;
  m.needsUpdate = true;
}

// ─────────────────────────────────────────── texturas pintadas

function canvasTex(w: number, h: number, draw: (x: CanvasRenderingContext2D) => void, srgb = true) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  draw(c.getContext('2d')!);
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 8;
  return t;
}

const wallTex = () =>
  canvasTex(1024, 1024, (x) => {
    x.fillStyle = '#060505';
    x.fillRect(0, 0, 1024, 1024);
    for (let i = 0; i < 60000; i++) {
      const v = Math.random() * 24 - 12;
      x.fillStyle = `rgba(${v > 0 ? '30,24,23' : '0,0,0'},${Math.abs(v) / 200})`;
      x.fillRect(Math.random() * 1024, Math.random() * 1024, 2, 2);
    }
    // manchas de humedad que bajan desde arriba
    for (let i = 0; i < 14; i++) {
      const g = x.createLinearGradient(0, 0, 0, rand(200, 700));
      g.addColorStop(0, 'rgba(0,0,0,0.16)');
      g.addColorStop(1, 'rgba(0,0,0,0)');
      x.fillStyle = g;
      x.fillRect(Math.random() * 1024, 0, rand(3, 30), 1024);
    }
  });

/** Tarima: color, relieve y rugosidad pintados a la vez para que las juntas y el desgaste coincidan. */
function floorTex() {
  const S = 2048;
  const mk = () => {
    const c = document.createElement('canvas');
    c.width = c.height = S;
    return c;
  };
  const [ca, cb, cr] = [mk(), mk(), mk()];
  const a = ca.getContext('2d')!, b = cb.getContext('2d')!, r = cr.getContext('2d')!;
  a.fillStyle = '#0d0a09';
  a.fillRect(0, 0, S, S);
  b.fillStyle = '#000';
  b.fillRect(0, 0, S, S);
  r.fillStyle = '#000';
  r.fillRect(0, 0, S, S);
  const plank = S / 10;
  for (let row = 0; row < 10; row++) {
    let px = -Math.random() * 600;
    while (px < S) {
      const len = rand(500, 1100);
      const v = rand(0.7, 1.2);
      const y0 = row * plank;
      a.fillStyle = `rgb(${24 * v},${18 * v},${16 * v})`;
      a.fillRect(px + 3, y0 + 3, len - 6, plank - 6);
      b.fillStyle = '#808080';
      b.fillRect(px + 3, y0 + 3, len - 6, plank - 6);
      // cada tabla tiene su cera: unas brillan, otras están gastadas
      const wax = rand(0.25, 0.6);
      r.fillStyle = `rgb(${wax * 255},${wax * 255},${wax * 255})`;
      r.fillRect(px, y0, len, plank);
      for (let k = 0; k < 26; k++) {
        const y = y0 + rand(8, plank - 8);
        const dy = rand(-6, 6);
        const path = (x: CanvasRenderingContext2D) => {
          x.beginPath();
          x.moveTo(px, y);
          x.bezierCurveTo(px + len * 0.3, y + dy, px + len * 0.6, y - dy, px + len, y + dy * 0.5);
          x.stroke();
        };
        const d = rand(0.05, 0.22);
        a.strokeStyle = `rgba(0,0,0,${d})`;
        a.lineWidth = rand(1, 3);
        path(a);
        b.strokeStyle = `rgba(0,0,0,${d * 0.8})`;
        b.lineWidth = a.lineWidth;
        path(b);
      }
      // arañazos y zonas pisadas
      for (let k = 0; k < 6; k++) {
        r.strokeStyle = `rgba(255,255,255,${rand(0.08, 0.25)})`;
        r.lineWidth = rand(1, 2);
        r.beginPath();
        const sx = px + rand(0, len), sy = y0 + rand(0, plank);
        r.moveTo(sx, sy);
        r.lineTo(sx + rand(-80, 80), sy + rand(-20, 20));
        r.stroke();
      }
      px += len;
    }
  }
  const tex = (c: HTMLCanvasElement, srgb: boolean) => {
    const t = new THREE.CanvasTexture(c);
    if (srgb) t.colorSpace = THREE.SRGBColorSpace;
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.anisotropy = 8;
    t.repeat.set(1.6, 1.6);
    return t;
  };
  return { map: tex(ca, true), bump: tex(cb, false), rough: tex(cr, false) };
}

/** Roble ahumado: vetas largas que serpentean, algún nudo, y el barniz más gastado donde se apoyan las manos. */
function woodTex() {
  const Wd = 2048, Hd = 1024;
  const mk = () => {
    const c = document.createElement('canvas');
    c.width = Wd;
    c.height = Hd;
    return c;
  };
  const [ca, cr] = [mk(), mk()];
  const a = ca.getContext('2d')!, r = cr.getContext('2d')!;
  a.fillStyle = '#16100d';
  a.fillRect(0, 0, Wd, Hd);
  r.fillStyle = 'rgb(110,110,110)';
  r.fillRect(0, 0, Wd, Hd);
  for (let i = 0; i < 420; i++) {
    const y = Math.random() * Hd;
    const amp = rand(2, 14);
    const freq = rand(0.002, 0.006);
    const ph = Math.random() * 6;
    const dark = Math.random() < 0.6;
    a.strokeStyle = dark ? `rgba(0,0,0,${rand(0.08, 0.3)})` : `rgba(70,50,40,${rand(0.05, 0.16)})`;
    a.lineWidth = rand(0.6, 3.2);
    a.beginPath();
    for (let x = 0; x <= Wd; x += 16) {
      const yy = y + Math.sin(x * freq + ph) * amp + Math.sin(x * freq * 3.1 + ph) * amp * 0.25;
      if (x === 0) a.moveTo(x, yy);
      else a.lineTo(x, yy);
    }
    a.stroke();
  }
  for (let i = 0; i < 4; i++) {
    const x = rand(100, Wd - 100), y = rand(60, Hd - 60);
    for (let k = 0; k < 9; k++) {
      a.strokeStyle = `rgba(0,0,0,${0.25 - k * 0.025})`;
      a.lineWidth = 2;
      a.beginPath();
      a.ellipse(x, y, 10 + k * 9, 4 + k * 3.2, 0, 0, Math.PI * 2);
      a.stroke();
    }
  }
  // desgaste del barniz: zona de las manos y el teclado, más mate
  const g = r.createRadialGradient(Wd * 0.5, Hd * 0.72, 40, Wd * 0.5, Hd * 0.72, Wd * 0.32);
  g.addColorStop(0, 'rgba(190,190,190,0.6)');
  g.addColorStop(1, 'rgba(190,190,190,0)');
  r.fillStyle = g;
  r.fillRect(0, 0, Wd, Hd);
  const tex = (c: HTMLCanvasElement, srgb: boolean) => {
    const t = new THREE.CanvasTexture(c);
    if (srgb) t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 8;
    return t;
  };
  return { map: tex(ca, true), rough: tex(cr, false) };
}

const termTex = () =>
  canvasTex(512, 1024, (x) => {
    x.fillStyle = '#050303';
    x.fillRect(0, 0, 512, 1024);
    x.font = '22px Consolas, monospace';
    const lines = [
      's7lver@oni:~$ ./wake --mask',
      '[ok] signal locked',
      '[ok] ch07 open',
      '[..] searching host',
      '',
      's7lver@oni:~$ cat todo',
      '- finish newpaper',
      '- sleep (maybe)',
      '- do not open ch07',
      '',
      's7lver@oni:~$ uptime',
      ' 03:17 up 41 days',
      '',
      's7lver@oni:~$ _',
    ];
    lines.forEach((l, i) => {
      x.fillStyle = l.startsWith('[ok]') || l.includes('ch07') ? '#ff3b2e' : '#d9d0cc';
      x.fillText(l, 24, 60 + i * 34);
    });
  });

// ─────────────────────────────────────────── escena

export interface HeroSceneOptions {
  canvas: HTMLCanvasElement;
  fontFamily: string;
  reducedMotion: boolean;
  onReady?: () => void;
  /** 0 → 1 según se van cargando los modelos, con el nombre del fichero que acaba de llegar. */
  onProgress?: (f: number, file: string) => void;
  /** Modo horneado (tools/bake_lighting.py): sin luz horneada previa, la escena se exporta tal cual. */
  bake?: boolean;
}

interface Placed {
  scale?: number;
  fit?: number; // o, en vez de escala, el lado más largo en metros
  rotY?: number;
  at: V3; // centro x/z de la caja y la base en y
}

/** La parte de la barra de carga que es descargar modelos; el resto es compilar. */
const LOAD_SHARE = 0.7;

/** Luz de fuera que entra por la ventana: sin caída con la distancia, sombras del marco y gotas proyectadas. */
export function windowLight(color: THREE.ColorRepresentation, angle: number, map: THREE.Texture, shadow: number) {
  const l = new THREE.SpotLight(color, 0, 0, angle, 0.35, 0);
  l.map = map;
  l.castShadow = true;
  l.shadow.mapSize.set(shadow, shadow);
  l.shadow.bias = -0.0005;
  l.shadow.normalBias = 0.02;
  l.shadow.camera.near = 0.5;
  l.shadow.camera.far = 30;
  return l;
}

export class HeroScene {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private cam = new THREE.PerspectiveCamera(40, 1, 0.02, 60);
  private composer: EffectComposer;
  private lens: ShaderPass;
  private loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
  private raf = 0;
  private clock?: ReturnType<typeof makeClock>;
  private t0 = performance.now();
  private last = performance.now();
  private visible = true;
  private progress = 0;
  private drawnProgress = -1;
  private reduced: boolean;
  private mouse = new THREE.Vector2();
  private smooth = new THREE.Vector2();
  private pending = 0;
  private total = 0;
  private loaded = 0;
  readonly audio = new RoomAudio();
  // la grabadora: se puede apagar con un clic y sus bobinas giran mientras suena
  private recorder?: THREE.Object3D;
  private reels: { mesh: THREE.Object3D; axis: THREE.Vector3 }[] = [];
  private reelSpeed = 1;
  private ray = new THREE.Raycaster();
  private hover = false;
  // quietos en la cama: la cámara respira; el cursor deja mirar un poco alrededor
  private lastMove = 0;
  private lookOff = new THREE.Vector2();
  private wakeT = -1;
  private woken = false;
  private wallMat!: THREE.MeshStandardMaterial;

  // reflejo del suelo
  private floor!: THREE.Mesh;
  private reflRT = new THREE.WebGLRenderTarget(512, 512, { type: THREE.HalfFloatType });
  private reflCam = new THREE.PerspectiveCamera();
  private reflMat = new THREE.Matrix4();

  // pantalla y máscara
  private maskScene = new THREE.Scene();
  private maskCam = new THREE.PerspectiveCamera(30, 2.4, 0.01, 50);
  private maskRig = new THREE.Group();
  private maskRT = new THREE.WebGLRenderTarget(1024, 432, { type: THREE.HalfFloatType });
  // el cómic de la máscara: la imagen limpia va a maskRaw y, con la pasada, a maskRT
  private maskRaw = new THREE.WebGLRenderTarget(1024, 432, { type: THREE.HalfFloatType });
  private comic!: Comic;
  // entra cuando la máscara sale de la estática (el scroll pasa de 0,6) y cuando se queda mirándote
  private comicAt = -1;
  private wasOut = false;
  private wasStare = false;
  private eyeMat = new THREE.MeshBasicMaterial({ color: 0x000000, toneMapped: false });
  // los ojos siguen el cursor y se entrecierran si lo pasas por la pantalla
  private eyes: { mesh: THREE.Mesh; base: THREE.Vector3 }[] = [];
  private screenMesh?: THREE.Mesh;
  private stare = 0;
  private cut = 0;
  private screenMat = new THREE.ShaderMaterial(screenShader);
  private screenCenter = new THREE.Vector3(-0.28, 1.24, -2.1);
  private screenSize = new THREE.Vector2(1.2, 0.5);
  private screenLight = new THREE.PointLight(0xfff2ea, 0, 6, 1.6);
  // el resplandor del neón: se crea con la escena (a 0) y se enciende cuando llega su modelo
  private glow = new THREE.PointLight(0xff2a1c, 0, 2.6, 1.8);
  // si va lento, baja la resolución (ver quality.ts)
  private govern: (dt: number) => void = () => {};
  private screenSpot = new THREE.SpotLight(0xfff2ea, 0, 7, 1.1, 0.6, 1.5);
  private on = 0;

  // silla
  private chair = new THREE.Group();
  private chairHome = new THREE.Vector3();
  private chairYaw = Math.PI; // de espaldas a nosotros, mirando a la pantalla

  // luz de fuera
  private cookieRT = new THREE.WebGLRenderTarget(256, 256);
  private cookieScene = new THREE.Scene();
  private cookieCam = new THREE.OrthographicCamera(-0.5, 0.5, 0.5, -0.5, 0, 1);
  private cookieMat = new THREE.ShaderMaterial(cookieShader);
  private winCenter = new THREE.Vector3(W, 1.65, WIN_Z);
  private neon = windowLight(0xff2a1c, 0.24, this.cookieRT.texture, 2048);
  private lightning = windowLight(0xf1eeee, 0.13, this.cookieRT.texture, 1024);
  private car = windowLight(0xffe2c4, 0.22, this.cookieRT.texture, 1024);
  // detrás y a la derecha, más alto que la ventana: la luz entra rasante hacia el escritorio
  private neonOrigin = new THREE.Vector3(W + 3.4, 4.4, WIN_Z + 4.2);
  private shaftMat = new THREE.ShaderMaterial({ ...shaftShader, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
  private dustMat?: THREE.ShaderMaterial;
  private aimed = false;

  // tormenta y calle: eventos sueltos, nada en bucle
  private flash = 0;
  private boltSeq: number[] = [];
  private nextBolt = 7;
  private carT = -1;
  private carDir = 1;
  private nextCar = 3.5;
  private streetPos = new THREE.Vector3(W + 3, 3.0, WIN_Z + 6); // la farola: alta y algo por detrás

  // cámara
  private path?: { pos: THREE.CatmullRomCurve3; look: THREE.CatmullRomCurve3 };
  private prevCam = new THREE.Vector3();
  private speed = 0;
  private baseFov = 40;

  constructor(private opts: HeroSceneOptions) {
    this.reduced = opts.reducedMotion;
    const r = (this.renderer = new THREE.WebGLRenderer({ canvas: opts.canvas, antialias: true, powerPreference: 'high-performance' }));
    r.setPixelRatio(Math.min(Math.max(window.devicePixelRatio, 1.25), 2));
    r.setClearColor(0x050404, 1);
    r.toneMapping = THREE.ACESFilmicToneMapping;
    r.toneMappingExposure = 1.1;
    r.shadowMap.enabled = true;
    r.shadowMap.type = shadowType(r);
    r.shadowMap.autoUpdate = false; // una vez por fotograma, no en cada render auxiliar

    const s = this.scene;
    s.environment = new THREE.PMREMGenerator(r).fromScene(new RoomEnvironment(), 0.04).texture;
    s.add(new THREE.HemisphereLight(0x3a3030, 0x080606, 0.03));

    this.cam.add(this.audio.listener);
    this.buildRoom();
    this.buildWindowLight();
    this.buildScreenLights();
    this.buildMask();
    s.add(this.glow);
    this.loadModels();
    this.buildPath();

    this.composer = new EffectComposer(r);
    const ao = new N8AOPass(s, this.cam, 1, 1);
    ao.configuration.aoRadius = 0.55;
    ao.configuration.distanceFalloff = 0.6;
    ao.configuration.intensity = 3.2;
    ao.configuration.halfRes = false;
    ao.configuration.gammaCorrection = false;
    ao.setQualityMode('Medium');
    this.composer.addPass(ao);
    this.composer.addPass(new UnrealBloomPass(new THREE.Vector2(1, 1), 0.8, 0.6, 0.85));
    this.lens = new ShaderPass(lensShader);
    this.composer.addPass(this.lens);
    this.composer.addPass(new OutputPass());
    // antialiasing al final, sobre la imagen ya en sRGB (N8AO pinta sin MSAA)
    this.composer.addPass(new SMAAPass(1, 1));

    this.resize();
    this.govern = governor(r, () => this.resize());
    window.addEventListener('resize', this.resize);
    window.addEventListener('pointermove', this.onPointer);
    opts.canvas.addEventListener('click', this.onClick);
    this.raf = requestAnimationFrame(this.frame);
    if (process.env.NODE_ENV !== 'production') (window as unknown as { __room: unknown }).__room = this;
  }

  // ── habitación

  private buildRoom() {
    const wt = wallTex();
    const wallMat = (rx: number, ry: number) => {
      const t = wt.clone();
      t.repeat.set(rx, ry);
      t.needsUpdate = true;
      // pintura negra satinada: la luz rasante saca la llana y las pasadas del rodillo
      const m = new THREE.MeshStandardMaterial({ map: t, roughness: 0.62, metalness: 0 });
      surface(m, { dim: 1, kind: 'plaster', bump: 0.03, dust: 0 });
      return m;
    };
    const ft = floorTex();
    const floorMat = new THREE.MeshStandardMaterial({ map: ft.map, bumpMap: ft.bump, bumpScale: 1.4, roughnessMap: ft.rough, roughness: 1, metalness: 0 });
    surface(floorMat, { dim: 1, kind: 'wood', bump: 0.002, dust: 0.15, refl: true }, { tex: this.reflRT.texture, mat: this.reflMat });
    this.floor = new THREE.Mesh(new THREE.BoxGeometry(W * 2, 0.1, BACK * 2), floorMat);
    this.floor.position.y = -0.05;
    const ceil = new THREE.Mesh(new THREE.BoxGeometry(W * 2, 0.1, BACK * 2), wallMat(2, 2));
    ceil.position.y = H + 0.05;
    const slab = (w: number, h: number, d: number, x: number, y: number, z: number) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), wallMat(Math.max(w, d) / 2.4, h / 2.4));
      m.position.set(x, y, z);
      return m;
    };
    const left = slab(0.1, H, BACK * 2, -W - 0.05, H / 2, 0);
    this.wallMat = left.material as THREE.MeshStandardMaterial;
    for (const m of [this.floor, ceil, left, slab(W * 2 + 0.2, H, 0.1, 0, H / 2, -BACK - 0.05), slab(W * 2 + 0.2, H, 0.1, 0, H / 2, BACK + 0.05)]) {
      m.receiveShadow = m.castShadow = true;
      this.scene.add(m);
    }
    // rodapiés: atrapan un filo de luz y dan escala
    const skirt = new THREE.MeshStandardMaterial({ color: 0x0b0909, roughness: 0.45 });
    surface(skirt, { dim: 1, kind: 'plastic', bump: 0.002 });
    for (const [w, d, x, z] of [
      [0.018, BACK * 2, -W + 0.009, 0],
      [W * 2, 0.018, 0, -BACK + 0.009],
    ] as const) {
      const b = new THREE.Mesh(new THREE.BoxGeometry(w, 0.08, d), skirt);
      b.position.set(x, 0.04, z);
      b.receiveShadow = true;
      this.scene.add(b);
    }
  }

  /** Pared derecha (x = +W) con el hueco exacto del marco de la ventana. */
  private buildWindowWall(hole: THREE.Box3) {
    const x = W + 0.05;
    const add = (z0: number, z1: number, y0: number, y1: number) => {
      if (z1 - z0 < 0.001 || y1 - y0 < 0.001) return;
      const m = new THREE.Mesh(new THREE.BoxGeometry(0.1, y1 - y0, z1 - z0), this.wallMat);
      m.position.set(x, (y0 + y1) / 2, (z0 + z1) / 2);
      m.castShadow = m.receiveShadow = true;
      this.scene.add(m);
    };
    add(-BACK, hole.min.z, 0, H);
    add(hole.max.z, BACK, 0, H);
    add(hole.min.z, hole.max.z, 0, hole.min.y);
    add(hole.min.z, hole.max.z, hole.max.y, H);
    hole.getCenter(this.winCenter);
    this.winCenter.x = W;
    this.aimWindowLights(hole);
  }

  // ── la luz de la ventana

  private buildWindowLight() {
    this.cookieScene.add(new THREE.Mesh(new THREE.PlaneGeometry(1, 1), this.cookieMat));
    for (const l of [this.neon, this.lightning, this.car]) this.scene.add(l, l.target);
    this.neon.position.copy(this.neonOrigin);
    this.lightning.position.set(W + 4, 10, WIN_Z + 14);
    // rebote de la luz de fuera en la pared: lo justo para leer la manta
    const bounce = new THREE.PointLight(0xff3a2a, 0.35, 3.2, 1.5);
    bounce.position.set(W - 0.5, 1.0, 0.7);
    // la ventana está junto a la cama: su luz roza la manta en diagonal y saca los pliegues
    const spill = new THREE.SpotLight(0xff5a48, 2.2, 3.2, 0.55, 1, 1.6);
    spill.position.set(W - 0.1, 1.5, WIN_Z - 0.1);
    spill.target.position.set(-0.6, 0.3, 1.0);
    this.scene.add(bounce, spill, spill.target);
  }

  /** Apunta las luces por el centro del hueco y construye el haz visible del neón. */
  private aimWindowLights(hole: THREE.Box3) {
    const c = this.winCenter;
    for (const l of [this.neon, this.lightning]) l.target.position.copy(c).multiplyScalar(2).sub(l.position);
    this.aimed = true;

    // haz: de las cuatro esquinas del hueco hasta donde tocan el suelo
    const o = this.neonOrigin;
    const corners = [
      [hole.min.z, hole.min.y],
      [hole.max.z, hole.min.y],
      [hole.max.z, hole.max.y],
      [hole.min.z, hole.max.y],
    ].map(([z, y]) => new THREE.Vector3(W, y, z));
    const ends = corners.map((p) => p.clone().add(p.clone().sub(o).multiplyScalar(Math.min(p.y / (o.y - p.y), 2.2))));
    const pos: number[] = [];
    const t: number[] = [];
    for (let i = 0; i < 4; i++) {
      const a = corners[i], b = corners[(i + 1) % 4], a2 = ends[i], b2 = ends[(i + 1) % 4];
      pos.push(...a.toArray(), ...b.toArray(), ...b2.toArray(), ...a.toArray(), ...b2.toArray(), ...a2.toArray());
      t.push(0, 0, 1, 0, 1, 1);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('aT', new THREE.Float32BufferAttribute(t, 1));
    this.scene.add(new THREE.Mesh(g, this.shaftMat));

    // polvo suspendido dentro del haz
    const N = 420;
    const dp = new Float32Array(N * 3);
    const seed = new Float32Array(N);
    for (let i = 0; i < N; i++) {
      const u = Math.random(), v = Math.random(), k = Math.pow(Math.random(), 0.8) * 0.85;
      const top = corners[0].clone().lerp(corners[1], u).lerp(corners[3].clone().lerp(corners[2], u), v);
      const bot = ends[0].clone().lerp(ends[1], u).lerp(ends[3].clone().lerp(ends[2], u), v);
      top.lerp(bot, k).toArray(dp, i * 3);
      seed[i] = Math.random();
    }
    const dg = new THREE.BufferGeometry();
    dg.setAttribute('position', new THREE.BufferAttribute(dp, 3));
    dg.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1));
    this.dustMat = new THREE.ShaderMaterial({
      uniforms: { uTime: { value: 0 }, uColor: this.shaftMat.uniforms.uColor, uFlash: this.shaftMat.uniforms.uFlash, uPx: { value: this.opts.canvas.clientHeight / 400 } },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      vertexShader: /* glsl */ `
        attribute float aSeed; uniform float uTime, uPx; varying float vA;
        void main(){
          vec3 p = position;
          float t = uTime * (0.03 + aSeed * 0.05);
          p += vec3(sin(t * 6.0 + aSeed * 40.0) * 0.05, sin(t * 4.0 + aSeed * 13.0) * 0.08 - fract(t + aSeed) * 0.04, cos(t * 5.0 + aSeed * 21.0) * 0.05);
          vec4 mv = modelViewMatrix * vec4(p, 1.0);
          gl_PointSize = min(uPx * (1.0 + aSeed * 2.0) * (2.2 / -mv.z), 4.0 * uPx);
          vA = (0.55 + 0.25 * sin(uTime * (0.5 + aSeed) + aSeed * 30.0)) * smoothstep(0.6, 1.6, -mv.z);
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: /* glsl */ `
        uniform vec3 uColor; uniform float uFlash; varying float vA;
        void main(){
          float d = length(gl_PointCoord - 0.5);
          gl_FragColor = vec4(uColor * (1.0 + uFlash * 4.0) * smoothstep(0.5, 0.0, d) * vA * 0.14, 1.0);
        }`,
    });
    const dust = new THREE.Points(dg, this.dustMat);
    dust.frustumCulled = false;
    this.scene.add(dust);
  }

  // ── pantalla

  private buildScreenLights() {
    const sp = this.screenSpot;
    sp.castShadow = true;
    sp.shadow.mapSize.set(1024, 1024);
    sp.shadow.bias = -0.0006;
    sp.shadow.camera.near = 0.05;
    this.scene.add(this.screenLight, sp, sp.target);
  }

  private buildMask() {
    this.maskCam.position.set(0, 0.05, 5.4);
    this.maskScene.background = new THREE.Color(0x020101);
    const key = new THREE.DirectionalLight(0xffffff, 0.55);
    key.position.set(3.5, 3, 1.5);
    const rim = new THREE.PointLight(0xff2a1a, 4, 12);
    rim.position.set(-2.4, 1.2, -1.8);
    this.maskScene.add(key, rim, this.maskRig);
    this.comic = new Comic(this.renderer, { reduced: this.reduced });
    this.comic.targets = [this.maskRig];
    this.comic.setSize(1024, 432);
    this.screenMat.uniforms.tMask.value = this.maskRT.texture;
    this.pending++;
    this.total++;
    this.loader.load(
      '/models/oni-mask.glb',
      (g) => {
        const m = g.scene;
        const box = new THREE.Box3().setFromObject(m);
        const k = 2 / Math.max(...box.getSize(new THREE.Vector3()).toArray());
        m.scale.setScalar(k);
        m.position.sub(box.getCenter(new THREE.Vector3()).multiplyScalar(k));
        m.traverse((o) => {
          const mesh = o as THREE.Mesh;
          if (!mesh.isMesh) return;
          if (!mesh.geometry.attributes.normal) mesh.geometry.computeVertexNormals();
          // el mapa de rugosidad de Trellis deja zonas casi espejo que se queman con el bloom
          const mat = mesh.material as THREE.MeshStandardMaterial;
          mat.roughnessMap = null;
          mat.metalnessMap = null;
          mat.roughness = 0.5;
          mat.metalness = 0.05;
          mat.needsUpdate = true;
        });
        const pivot = new THREE.Group();
        pivot.userData.dynamic = true;
        pivot.add(m);
        pivot.rotation.y = Math.PI; // Trellis exporta mirando hacia -Z
        for (const e of EYES) {
          const eye = new THREE.Mesh(new THREE.BoxGeometry(0.21, 0.028, 0.01), this.eyeMat);
          eye.position.set(...e.p);
          eye.rotation.set(...e.r);
          pivot.add(eye);
          this.eyes.push({ mesh: eye, base: eye.position.clone() });
        }
        this.maskRig.add(pivot);
        // el cómic, compilado ya: una vez encendido y se apaga
        this.comic.amount = 1;
        this.renderMask();
        this.comic.amount = 0;
        this.done('oni-mask.glb');
      },
      undefined,
      () => this.done('oni-mask.glb'),
    );
  }

  // ── modelos

  private load(name: string, p: Placed, tweak?: (m: THREE.MeshStandardMaterial, mesh: THREE.Mesh) => void): Promise<THREE.Object3D | null> {
    this.pending++;
    this.total++;
    return new Promise((res) => {
      this.loader.load(
        `/models/room/${name}.glb`,
        (g) => {
          const o = g.scene;
          o.name = name;
          o.rotation.y = p.rotY ?? 0;
          if (p.fit) {
            o.updateMatrixWorld(true);
            const sz = new THREE.Box3().setFromObject(o).getSize(new THREE.Vector3());
            o.scale.setScalar(p.fit / Math.max(sz.x, sz.y, sz.z));
          } else o.scale.setScalar(p.scale ?? 1);
          o.updateMatrixWorld(true);
          const b = new THREE.Box3().setFromObject(o);
          const c = b.getCenter(new THREE.Vector3());
          o.position.set(p.at[0] - c.x, p.at[1] - b.min.y, p.at[2] - c.z);
          o.traverse((x) => {
            const mesh = x as THREE.Mesh;
            if (!mesh.isMesh) return;
            mesh.castShadow = mesh.receiveShadow = true;
            const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
            for (const m of mats as THREE.MeshStandardMaterial[]) {
              m.envMapIntensity = 0.6;
              tweak?.(m, mesh);
            }
          });
          this.scene.add(o);
          res(o);
          // después de los .then(): lo que se carga encadenado cuenta antes de dar la escena por lista
          queueMicrotask(() => this.done(name + '.glb'));
        },
        undefined,
        () => {
          res(null); // un modelo opcional que falta no rompe la escena
          queueMicrotask(() => this.done(name + '.glb'));
        },
      );
    });
  }

  private loadModels() {
    const deskP: Placed = { scale: 0.3, rotY: -Math.PI / 2, at: [-0.3, 0, -BACK + 0.48] };

    // del modelo solo quedan monitor, torre, teclado y altavoces; tablero, patas y alfombrilla los hago yo
    const DESK_TOP = 'Material.001', DESK_FRAME = 'Material.002', DESK_PAD = 'Material';
    const DESK_KB = 'Material.003', DESK_MOUSE = 'Material.004';
    const DESK_PC = ['Material.011', 'Material.018', 'Material.019', 'Material.020'];
    const deskKinds: Record<string, SurfaceOpts> = { 'Material.010': { dim: 0.3, kind: 'plastic' } };
    this.load('desk', deskP, (m, mesh) => {
      if ([DESK_TOP, DESK_FRAME, DESK_PAD, DESK_KB, DESK_MOUSE, ...DESK_PC, 'Material.009'].includes(m.name)) mesh.visible = false; // la pantalla también la pongo yo
      if (m.name === 'screen.002') {
        m.map = termTex();
        m.emissiveMap = m.map;
        m.emissive = new THREE.Color(0.55, 0.45, 0.43);
        m.color.setScalar(0.1);
        return;
      }
      surface(m, deskKinds[m.name] ?? { dim: 0.32, glow: 2.5, kind: 'plastic' });
    }).then((desk) => {
      if (!desk) return;
      desk.updateMatrixWorld(true);
      const boxOf = (name: string) => {
        const b = new THREE.Box3();
        desk.traverse((x) => {
          const mesh = x as THREE.Mesh;
          if (mesh.isMesh && (mesh.material as THREE.Material).name === name) b.expandByObject(mesh);
        });
        return b;
      };
      this.buildDesk(boxOf(DESK_TOP), boxOf(DESK_PAD));
      this.placePeripherals(boxOf(DESK_KB), boxOf(DESK_MOUSE));
      const pc = boxOf(DESK_PC[0]);
      if (!pc.isEmpty()) {
        const c = pc.getCenter(new THREE.Vector3());
        this.load('tower', { fit: pc.max.y - pc.min.y, rotY: -Math.PI / 2, at: [c.x, pc.min.y, c.z] }, (m) => surface(m, { dim: 0.6, glow: 1.5, kind: 'plastic' }));
      }
      desk.traverse((x) => {
        const mesh = x as THREE.Mesh;
        if (mesh.isMesh && (mesh.material as THREE.Material).name === 'Material.009') {
          const b = new THREE.Box3().setFromObject(mesh);
          b.getCenter(this.screenCenter);
          this.screenCenter.z = b.max.z + 0.004;
          this.screenSize.set(b.max.x - b.min.x, b.max.y - b.min.y);
          this.placeScreen();
        }
      });
      // la silla salió del mismo fichero: misma transformación que la mesa
      this.load('chair', { ...deskP, at: [0, 0, 0] }, (m) => {
        if (m.name === 'chair_material') {
          m.color.set(0x1a1516);
          m.roughness = 0.55;
          surface(m, { dim: 1, kind: 'fabric', dust: 0.1 });
        } else if (m.name === 'plastic') {
          m.color.set(0x0c0b0b);
          m.roughness = 0.4;
          surface(m, { dim: 1, kind: 'plastic', bump: 0.0015 });
        } else if (m.name === 'white_metal') {
          m.color.set(0x5a1010);
          surface(m, { dim: 1, kind: 'plastic' });
        } else surface(m, { dim: 0.5, kind: 'metal', bump: 0.0015 });
      }).then((chair) => {
        if (!chair) return;
        chair.position.copy(desk.position);
        chair.updateMatrixWorld(true);
        const c = new THREE.Box3().setFromObject(chair).getCenter(new THREE.Vector3());
        this.chair.position.set(c.x, 0, c.z);
        this.chair.userData.dynamic = true;
        this.scene.add(this.chair);
        this.chair.attach(chair);
        this.chair.scale.setScalar(1.18); // respaldo alto: desde la cama tapa la pantalla entera
        this.chair.position.x = this.screenCenter.x - 0.04; // el respaldo, justo en la línea de la mirada
        this.chair.position.z += 0.12; // un palmo separada de la mesa
        this.chairHome.copy(this.chair.position);
      });
    });

    this.load('window', { scale: 0.62, rotY: -Math.PI / 2, at: [W, 0.72, WIN_Z] }, (m, mesh) => {
      if (m.name === 'material_1') mesh.visible = false; // sin cristal: las gotas van en la luz
      else surface(m, { dim: 0.35, kind: 'plastic' });
    }).then((win) => {
      const b = win ? new THREE.Box3().setFromObject(win) : new THREE.Box3(new THREE.Vector3(W, 0.72, WIN_Z - 0.73), new THREE.Vector3(W, 2.62, WIN_Z + 0.73));
      b.expandByScalar(-0.03);
      this.buildWindowWall(b);
    });

    // la cama contra la pared de delante: desde la almohada se mira el PC
    this.load('bed', { scale: 0.0082, rotY: Math.PI, at: [-0.28, 0, BACK - 0.95] }, (m) =>
      surface(m, { dim: m.name === 'Bed_Blanket' ? 0.55 : 0.6, kind: 'fabric', bump: 0.004, dust: 0 }),
    );
    this.load('bookshelf', { scale: 1, rotY: Math.PI / 2, at: [-W + 0.25, 0, -1.05] }, (m) => surface(m, { dim: 0.45, kind: 'wood', bump: 0.002, dust: 0.6 }));
    this.load('lamp', { scale: 0.32, at: [-0.28, H - 0.64, 1.5] }, (m) => surface(m, { dim: 0.5, kind: 'metal' }));
    this.load('poster', { scale: 0.26, rotY: -Math.PI, at: [W - 0.01, 1.45, 0.18] }, (m) => surface(m, { dim: 0.85, kind: 'laminate', dust: 0 }));
    this.load('steammachine', { scale: 0.012, rotY: -0.3, at: [0.95, 0, -BACK + 0.3] }, (m) => surface(m, { dim: 0.7, glow: 1.5, kind: 'plastic', bump: 0.0015 }));

    // easter eggs sobre la mesa y la estantería
    const top = 0.782;
    const g = (k: number): ((m: THREE.MeshStandardMaterial) => void) => (m) => surface(m, { dim: k, glow: 1, kind: 'plastic', bump: 0.001 });
    // el reloj de la mesa, con la hora de verdad
    this.clock = makeClock(0.17);
    this.clock.group.position.set(-1.4, top, -BACK + 0.5);
    this.clock.group.rotation.y = 0.4;
    this.scene.add(this.clock.group);
    this.load('flipper', { scale: 0.001, rotY: 0.4, at: [0.47, top, -BACK + 0.62] }, g(0.8));
    this.load('walkman', { scale: 0.45, rotY: 1.2, at: [-W + 0.3, 1.06, -0.72] }, g(0.8));
    this.load('lighter', { scale: 0.03, rotY: 0.8, at: [-0.97, top, -BACK + 0.72] }, g(0.8));
    this.load('blunt', { scale: 0.009, rotY: 1.2, at: [-0.87, top, -BACK + 0.62] }, g(0.8));
    this.load('steamframe', { scale: 1, rotY: 2.4, at: [-W + 0.25, 1.06, -1.0] }, g(0.8));
    this.load('blahaj', { scale: 5, rotY: 2.0, at: [-W + 0.3, 2.0, -1.05] }, g(0.5));
    this.loadMore(top, g);
  }

  /** Lo que el cuarto ha ido acumulando: el rack con la impresora, cacharros, cables y la puerta. */
  private loadMore(top: number, g: (k: number) => (m: THREE.MeshStandardMaterial) => void) {
    // la puerta, en negro
    this.load('door', { fit: 2.1, at: [W - 0.08, 0, -0.95] }, (m) => {
      const metal = /Latch|Screw|Handle/.test(m.name);
      m.color.set(metal ? 0x2a2525 : 0x070606);
      m.map = null;
      m.metalness = metal ? 0.75 : 0;
      m.roughness = metal ? 0.35 : 0.6;
      surface(m, { dim: 1, kind: metal ? 'metal' : 'laminate' });
    });

    // el rack en la esquina, con la impresora 3D encima
    const rackAt: V3 = [W - 0.42, 0, -BACK + 0.45];
    this.load('rack', { fit: 1.35, at: rackAt }, (m) => surface(m, { dim: 0.5, glow: 0.9, kind: 'metal', dust: 0.4 })).then((rack) => {
      const y = rack ? new THREE.Box3().setFromObject(rack).max.y : 0;
      this.load('printer', { fit: 0.42, rotY: -0.4, at: [rackAt[0], y, rackAt[2]] }, g(0.6));
    });

    // la torre en el suelo junto a la mesa, la gráfica suelta apoyada al lado, cables por el suelo
    this.load('gpu', { fit: 0.3, rotY: 0.6, at: [-1.22, 0, -1.6] }, g(0.7));
    this.load('cables', { fit: 0.9, at: [-0.2, 0, -BACK + 0.32] }, (m) => {
      m.color.set(0x0a0909);
      surface(m, { dim: 1, kind: 'plastic' });
    });

    // sobre la mesa
    this.load('router', { fit: 0.24, rotY: -0.3, at: [0.95, 0.25, -BACK + 0.28] }, g(0.6)); // encima de la Steam Machine
    this.load('stand', { fit: 0.27, rotY: -0.5, at: [0.6, top, -BACK + 0.62] }, g(0.5)).then((st) => {
      const y = st ? new THREE.Box3().setFromObject(st).max.y : top + 0.27;
      this.load('headphones', { fit: 0.2, rotY: -0.5, at: [0.6, y - 0.17, -BACK + 0.62] }, g(0.7));
    });
    this.load('disk', { fit: 0.12, rotY: 0.3, at: [0.12, top + 0.001, -BACK + 0.8] }, g(1));
    this.load('usb', { fit: 0.06, rotY: 1.1, at: [0.27, top, -BACK + 0.74] }, g(0.8));

    // la grabadora de bobinas: de aquí sale la música
    this.load('recorder', { fit: 0.42, rotY: 0.15, at: [-1.0, top, -BACK + 0.5] }, g(0.75)).then((rec) => {
      if (!rec) return;
      this.recorder = rec;
      rec.updateMatrixWorld(true);
      const wheels: [THREE.Group, THREE.Object3D][] = [];
      rec.traverse((o) => {
        const mesh = o as THREE.Mesh;
        if (!mesh.isMesh || !/WHEEL/i.test(mesh.name + (mesh.parent?.name ?? ''))) return;
        // pivote en el centro de la bobina (la geometría va comprimida: no se puede desplazar);
        // el eje de giro es su lado más fino, pasado a coordenadas del mundo
        const geo = mesh.geometry;
        geo.computeBoundingBox();
        const bb = geo.boundingBox!;
        const sz = bb.getSize(new THREE.Vector3());
        const local = sz.x < sz.y && sz.x < sz.z ? new THREE.Vector3(1, 0, 0) : sz.y < sz.z ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(0, 0, 1);
        const axis = local.transformDirection(mesh.matrixWorld);
        const pivot = new THREE.Group();
        pivot.userData.dynamic = true;
        pivot.position.copy(bb.getCenter(new THREE.Vector3()).applyMatrix4(mesh.matrixWorld));
        wheels.push([pivot, mesh]);
        this.reels.push({ mesh: pivot, axis });
      });
      for (const [pivot, mesh] of wheels) {
        this.scene.add(pivot);
        pivot.attach(mesh);
      }
      const c = new THREE.Box3().setFromObject(rec).getCenter(new THREE.Vector3());
      this.audio.recorder.position.copy(rec.worldToLocal(c));
      rec.add(this.audio.recorder);
    });

    // paneles acústicos a los lados del póster
    this.load('panel', { fit: 0.3, rotY: Math.PI / 2, at: [-1.25, 1.42, -BACK + 0.02] }, (m) => {
      m.color.set(0x2a2525);
      surface(m, { dim: 1, kind: 'fabric', dust: 0.3 });
    }).then((p) => {
      if (!p) return;
      // tela negra, y dos en rojo oscuro rompiendo la cuadrícula
      const red = new THREE.MeshStandardMaterial({ color: 0x3a0806, roughness: 0.95 });
      surface(red, { dim: 1, kind: 'fabric', dust: 0.3 });
      for (const [x, y] of [[-0.92, 1.42], [-1.25, 1.76], [-0.92, 1.76], [0.36, 1.42], [0.69, 1.42], [0.36, 1.76], [0.69, 1.76]]) {
        const c = p.clone();
        if ((x === -0.92 && y === 1.42) || (x === 0.69 && y === 1.76)) c.traverse((o) => ((o as THREE.Mesh).isMesh ? ((o as THREE.Mesh).material = red) : 0));
        c.position.x += x + 1.25;
        c.position.y += y - 1.42;
        this.scene.add(c);
      }
    });

    // un neón japonés en la pared del fondo, entre los paneles y el rack
    this.load('neon', { fit: 0.85, rotY: Math.PI / 2, at: [1.02, 1.32, -BACK + 0.05] }, (m) => {
      m.color.set(0x1a0202);
      m.emissive.set(0xff2a1c);
      m.emissiveIntensity = 2.4;
      m.roughness = 0.3;
    }).then((n) => {
      if (!n) return;
      // la luz ya existe (apagada): añadir una luz a mitad obliga a recompilar todos los materiales
      this.glow.position.copy(new THREE.Box3().setFromObject(n).getCenter(new THREE.Vector3())).add(new THREE.Vector3(0, 0, 0.3));
      this.glow.intensity = 1.6;
    });
  }

  /** Teclado y ratón reales, encajados donde estaban los del modelo de la mesa. */
  private placePeripherals(kb: THREE.Box3, mouse: THREE.Box3) {
    if (!kb.isEmpty()) {
      const c = kb.getCenter(new THREE.Vector3());
      const k = (kb.max.x - kb.min.x) / 0.78; // el ancho del teclado del modelo
      // la caja incluye el cable hacia atrás: el cuerpo queda 0.255 por delante de su centro
      this.load('keyboard', { scale: k, at: [c.x, kb.min.y, c.z - 0.255 * k] }, (m) => surface(m, { dim: 0.5, glow: 2.5, kind: 'plastic' }));
    }
    if (!mouse.isEmpty()) {
      const c = mouse.getCenter(new THREE.Vector3());
      this.load('mouse', { fit: 0.125, at: [c.x, mouse.min.y, c.z] }, (m) => {
        m.color.multiplyScalar(0.12);
        surface(m, { dim: 1, kind: 'plastic' });
      });
    }
  }

  /** Tablero de roble ahumado con barniz, patas de acero en O y una alfombrilla de tela. */
  private buildDesk(top: THREE.Box3, pad: THREE.Box3) {
    const ts = top.getSize(new THREE.Vector3());
    const tc = top.getCenter(new THREE.Vector3());
    const add = (geo: THREE.BufferGeometry, mat: THREE.Material, x: number, y: number, z: number) => {
      const m = new THREE.Mesh(geo, mat);
      m.position.set(x, y, z);
      m.castShadow = m.receiveShadow = true;
      this.scene.add(m);
      return m;
    };
    const wood = woodTex();
    const topMat = new THREE.MeshPhysicalMaterial({ map: wood.map, roughnessMap: wood.rough, roughness: 1, clearcoat: 0.3, clearcoatRoughness: 0.35, envMapIntensity: 0.05 });
    const thick = 0.03;
    add(new RoundedBoxGeometry(ts.x, thick, ts.z, 4, 0.006), topMat, tc.x, top.max.y - thick / 2, tc.z);

    const steel = new THREE.MeshStandardMaterial({ color: 0x0d0c0c, metalness: 0.8, roughness: 0.36, envMapIntensity: 0.05 });
    const legH = top.max.y - thick;
    const depth = ts.z - 0.1;
    const t = 0.045;
    const bar = (w: number, h: number, d: number, x: number, y: number, z: number) => add(new RoundedBoxGeometry(w, h, d, 2, 0.008), steel, x, y, z);
    for (const side of [-1, 1]) {
      const x = tc.x + side * (ts.x / 2 - 0.09);
      bar(t, legH, t, x, legH / 2, tc.z - depth / 2 + t / 2);
      bar(t, legH, t, x, legH / 2, tc.z + depth / 2 - t / 2);
      bar(t, t, depth, x, t / 2, tc.z);
      bar(t, t, depth, x, legH - t / 2, tc.z);
    }
    bar(ts.x - 0.18, 0.04, 0.022, tc.x, legH - 0.07, tc.z - depth / 2 + 0.03); // travesaño trasero

    if (!pad.isEmpty()) {
      const ps = pad.getSize(new THREE.Vector3());
      const pc = pad.getCenter(new THREE.Vector3());
      const felt = new THREE.MeshStandardMaterial({ color: 0x090808, roughness: 0.95, envMapIntensity: 0.05 });
      add(new RoundedBoxGeometry(ps.x, 0.004, ps.z, 2, 0.002), felt, pc.x, top.max.y + 0.002, pc.z);
    }
  }

  private placeScreen() {
    const screen = (this.screenMesh = new THREE.Mesh(new THREE.PlaneGeometry(this.screenSize.x * 0.985, this.screenSize.y * 0.97), this.screenMat));
    screen.position.copy(this.screenCenter);
    this.scene.add(screen);
    const aspect = this.screenSize.x / this.screenSize.y;
    this.screenMat.uniforms.uAspect.value = aspect;
    this.maskCam.aspect = aspect;
    this.maskCam.updateProjectionMatrix();
    this.maskRT.setSize(1024, Math.round(1024 / aspect));
    this.maskRaw.setSize(1024, Math.round(1024 / aspect));
    this.comic.setSize(1024, Math.round(1024 / aspect));

    this.screenLight.position.copy(this.screenCenter).add(new THREE.Vector3(0, 0, 0.25));
    this.screenSpot.position.copy(this.screenCenter).add(new THREE.Vector3(0, 0, 0.05));
    this.screenSpot.target.position.copy(this.screenCenter).add(new THREE.Vector3(0, -0.6, 3));
    this.buildPath();
  }

  /** De la almohada al monitor en línea recta: incorporarse, levantarse, acercarse. */
  private buildPath() {
    const sc = this.screenCenter;
    const x = sc.x;
    const pos = [
      new THREE.Vector3(x, 0.62, 1.6), // hundidos en la almohada: la manta llena más el primer plano
      new THREE.Vector3(x, 1.0, 0.95),
      new THREE.Vector3(x, 1.12, 0.1), // justo detrás del respaldo: tapa la pantalla entera
      new THREE.Vector3(x, sc.y + 0.02, sc.z + 1.1),
      new THREE.Vector3(x, sc.y, sc.z + 0.42),
    ];
    const look = [
      new THREE.Vector3(x, 0.7, -BACK),
      new THREE.Vector3(x, 0.98, -BACK),
      new THREE.Vector3(x, sc.y - 0.03, sc.z),
      new THREE.Vector3(x, sc.y, sc.z),
      new THREE.Vector3(x, sc.y, sc.z),
    ];
    this.path = { pos: new THREE.CatmullRomCurve3(pos, false, 'centripetal'), look: new THREE.CatmullRomCurve3(look, false, 'centripetal') };
  }

  private done(file: string) {
    this.loaded++;
    // la descarga es el 70 % de la barra; el resto, compilar (en Firefox es lo que más tarda): si la
    // barra llegara al 100 % con los modelos, se podría entrar con la escena aún sin pintar
    this.opts.onProgress?.((this.loaded / this.total) * LOAD_SHARE, file);
    if (--this.pending > 0) return;
    // el horneado cambia los materiales: hasta tenerlo no se pinta, o se compila todo dos veces
    this.pending = 1;
    (this.opts.bake ? Promise.resolve() : applyBake(this.scene)).then(() => this.warm()).then(() => this.opts.onReady?.());
  }

  /**
   * Antes de quitar la pantalla de carga: compila todos los materiales (poco a poco, ver
   * compileGently) y deja pasar dos fotogramas, que compilan el resto (sombras, compositor, reflejo)
   * detrás de la pantalla de carga. Mientras carga no se pinta: cada modelo que llegaba se compilaba
   * en el siguiente fotograma, y en Firefox cada uno colgaba la página uno o varios segundos.
   */
  private async warm() {
    const bar = (f: number) => this.opts.onProgress?.(LOAD_SHARE + (1 - LOAD_SHARE) * f * 0.98, 'compile');
    await compileGently(this.renderer, this.scene, this.cam, undefined, bar);
    await compileGently(this.renderer, this.maskScene, this.maskCam); // la máscara de la pantalla
    this.pending = 0;
    await new Promise((res) => requestAnimationFrame(() => requestAnimationFrame(res)));
  }

  // ── ciclo

  private resize = () => {
    const c = this.opts.canvas;
    const w = c.clientWidth, h = c.clientHeight;
    this.renderer.setSize(w, h, false);
    this.composer.setPixelRatio(this.renderer.getPixelRatio());
    this.composer.setSize(w, h);
    const aspect = w / h;
    this.cam.aspect = aspect;
    // en vertical se abre el ángulo para que la habitación siga contando la escena
    const vfov = THREE.MathUtils.radToDeg(2 * Math.atan(Math.tan(THREE.MathUtils.degToRad(30)) / aspect));
    this.baseFov = clamp(vfov, 36, 78);
    this.cam.fov = this.baseFov;
    this.cam.updateProjectionMatrix();
    const pr = this.renderer.getPixelRatio();
    this.reflRT.setSize(Math.round((w * pr) / 2), Math.round((h * pr) / 2));
    (this.lens.uniforms.uRes.value as THREE.Vector2).set(w, h);
    if (this.dustMat) this.dustMat.uniforms.uPx.value = h / 400;
  };

  private onPointer = (e: PointerEvent) => {
    this.mouse.set((e.clientX / window.innerWidth) * 2 - 1, -(e.clientY / window.innerHeight) * 2 + 1);
  };

  /** 0 → 1 a lo largo del tramo fijado del hero. */
  setProgress(p: number) {
    if (p !== this.progress) this.lastMove = performance.now() / 1000;
    this.progress = p;
  }

  /** La habitación montada y sus luces fijas, para hornear en Blender (ver bake.ts). */
  exportBake() {
    const lights: object[] = [];
    const v = () => new THREE.Vector3();
    this.scene.traverse((o) => {
      const l = o as THREE.SpotLight & THREE.PointLight;
      // lo que cambia (relámpagos, pantalla) se queda en tiempo real
      if (!l.isLight || l === this.lightning || l === this.screenLight || l === this.screenSpot) return;
      if ((l as unknown as THREE.HemisphereLight).isHemisphereLight) {
        lights.push({ type: 'world', color: l.color.toArray(), intensity: l.intensity });
        return;
      }
      // el coche, quieto, es la farola
      const pos = l === this.car ? this.streetPos.clone() : l.getWorldPosition(v());
      const target = l.isSpotLight ? (l === this.car ? this.winCenter.clone().multiplyScalar(2).sub(pos) : l.target.getWorldPosition(v())) : null;
      lights.push({
        type: l.isSpotLight ? 'spot' : 'point',
        color: l === this.car ? [0.82, 0.8, 0.8] : l.color.toArray(),
        intensity: l === this.neon ? 15 : l === this.car ? 7 : l.intensity,
        pos: pos.toArray(),
        target: target?.toArray() ?? null,
        angle: l.isSpotLight ? l.angle : null,
        penumbra: l.isSpotLight ? l.penumbra : null,
        decay: l.decay,
        distance: l.distance,
      });
    });
    return exportBake(this.scene, lights);
  }

  /** Fin de la carga: negro, y la habitación aparece al abrir los ojos. */
  wake() {
    this.woken = true; // se abren en el primer fotograma que se pinte, no antes: si no, a oscuras
  }

  private onClick = (e: MouseEvent) => {
    this.audio.unlock();
    if (!this.recorder) return;
    this.ray.setFromCamera(this.ndc(e), this.cam);
    if (this.ray.intersectObjects([this.recorder, ...this.reels.map((r) => r.mesh)], true).length) this.audio.toggle();
  };

  private ndc(e: { clientX: number; clientY: number }) {
    const r = this.opts.canvas.getBoundingClientRect();
    return new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
  }

  setVisible(v: boolean) {
    this.visible = v;
  }

  /**
   * Seis fotos de cámara de seguridad (480×360), desde las esquinas altas mirando hacia abajo.
   * La [2] es la CAM 03: la cama y el escritorio a la vez. Sin pase de lente (ni párpados ni
   * viñeta): se pinta la escena directa en el lienzo y se recorta 4:3 del centro.
   */
  cctv(): Promise<ImageBitmap[]> {
    const POSES: [V3, V3][] = [
      [[W - 0.12, H - 0.1, -BACK + 0.12], [-0.6, 0.4, 0.6]],
      [[-W + 0.12, H - 0.1, -BACK + 0.12], [0.6, 0.4, 0.8]],
      [[-W + 0.12, H - 0.1, BACK - 0.12], [0.3, 0.2, -0.2]], // CAM 03
      [[W - 0.12, H - 0.1, BACK - 0.12], [-0.5, 0.4, -0.6]],
      [[0, H - 0.08, BACK - 0.1], [-0.2, 0.6, -1.6]],
      [[W - 0.1, H - 0.1, 0], [-1.2, 0.5, -0.4]],
    ];
    const r = this.renderer, c = this.opts.canvas;
    const cam = new THREE.PerspectiveCamera(72, c.width / c.height, 0.02, 30);
    const sh = Math.min(c.height, (c.width * 3) / 4), sw = (sh * 4) / 3;
    const exp = r.toneMappingExposure;
    r.toneMappingExposure = 2.6; // una cámara barata tira de ganancia
    // a un destino intermedio, como el compositor, y de ahí al lienzo con el tono: pintar la escena
    // directamente en pantalla es otra variante de cada material, y recompilarlo todo colgaba Firefox
    const rt = new THREE.WebGLRenderTarget(c.width, c.height, { type: THREE.HalfFloatType }), out = Object.assign(new OutputPass(), { renderToScreen: true });
    // createImageBitmap copia el lienzo al llamarse: se pueden encadenar los seis renders
    const shots = POSES.map(([p, t]) => {
      cam.position.set(...p);
      cam.lookAt(...t);
      r.setRenderTarget(rt);
      r.render(this.scene, cam);
      out.render(r, null as unknown as THREE.WebGLRenderTarget, rt, 0, false);
      return createImageBitmap(c, (c.width - sw) / 2, (c.height - sh) / 2, sw, sh, { resizeWidth: 480, resizeHeight: 360 });
    });
    r.toneMappingExposure = exp;
    rt.dispose();
    out.dispose();
    return Promise.all(shots);
  }

  /** Relámpagos: dos o tres golpes seguidos, muy de vez en cuando. */
  private storm(T: number, dt: number) {
    if (this.reduced) return 0;
    if (T > this.nextBolt && this.boltSeq.length === 0) {
      let at = T;
      for (let i = 0, n = Math.random() < 0.5 ? 2 : 3; i < n; i++) {
        this.boltSeq.push(at, rand(0.5, 1));
        at += rand(0.07, 0.18);
      }
      this.nextBolt = T + rand(9, 20);
      this.audio.thunder(this.boltSeq[1]);
    }
    if (this.boltSeq.length && T >= this.boltSeq[0]) {
      this.flash = Math.max(this.flash, this.boltSeq[1]);
      this.boltSeq.splice(0, 2);
    }
    this.flash = Math.max(0, this.flash - dt * 6);
    return this.flash;
  }

  /** Un coche pasa por la calle: sus faros barren la pared y el techo. */
  private traffic(T: number, dt: number) {
    // sin coche, la misma luz es la farola de la calle: blanca, fija, la base neutra del cuarto
    const street = this.streetPos;
    let env = 0;
    if (!this.reduced && this.carT < 0 && T > this.nextCar) {
      this.carT = 0;
      this.carDir = Math.random() < 0.5 ? 1 : -1;
      this.nextCar = T + rand(7, 16);
    }
    if (this.carT >= 0) {
      this.carT += dt / 3.2;
      const k = clamp(this.carT, 0, 1);
      env = Math.sin(Math.PI * k) ** 2;
      // la luz no se mueve (si no, la sombra del marco cruza la pared): los faros solo la calientan
      if (this.carT >= 1) this.carT = -1;
    }
    this.car.position.copy(street);
    this.car.target.position.copy(this.winCenter).multiplyScalar(2).sub(this.car.position);
    this.car.color.setRGB(lerp(0.82, 1, env), lerp(0.8, 0.89, env), lerp(0.8, 0.77, env));
    this.car.intensity = this.aimed ? 7 + env * 5 : 0;
    this.audio.car(env);
  }

  /** Cámara espejo bajo el suelo (como THREE.Reflector) y la matriz para muestrear su imagen. */
  private renderReflection() {
    const cam = this.cam;
    const rc = this.reflCam;
    const dir = cam.getWorldDirection(new THREE.Vector3());
    const target = cam.position.clone().add(dir);
    rc.position.set(cam.position.x, -cam.position.y, cam.position.z);
    rc.up.set(0, -1, 0);
    rc.lookAt(target.x, -target.y, target.z);
    rc.projectionMatrix.copy(cam.projectionMatrix);
    rc.updateMatrixWorld();
    this.reflMat.set(0.5, 0, 0, 0.5, 0, 0.5, 0, 0.5, 0, 0, 0.5, 0.5, 0, 0, 0, 1).multiply(rc.projectionMatrix).multiply(rc.matrixWorldInverse);
    this.floor.visible = false;
    this.renderer.setRenderTarget(this.reflRT);
    this.renderer.render(this.scene, rc);
    this.floor.visible = true;
  }

  private frame = (now: number) => {
    this.raf = requestAnimationFrame(this.frame);
    if (this.pending > 0) return;
    if (!this.visible && this.drawnProgress === this.progress) return;
    this.drawnProgress = this.progress;
    const T = (now - this.t0) / 1000;
    const dt = Math.min(0.05, (now - this.last) / 1000);
    this.last = now;
    this.govern(dt);
    const p = this.progress;
    const anim = this.reduced ? 0 : T;

    // ── fuera: el neón fijo, y lo que pasa de vez en cuando
    const fl = this.storm(T, dt);
    this.traffic(T, dt);
    const breathe = 1 + Math.sin(anim * 0.35) * 0.04;
    this.neon.intensity = (this.aimed ? 15 : 0) * breathe * (1 + fl * 0.25);
    this.lightning.intensity = fl * 13; // ilumina el cuarto sin deslumbrar
    this.cookieMat.uniforms.uTime.value = anim;
    (this.shaftMat.uniforms.uColor.value as THREE.Color).copy(this.neon.color);
    this.shaftMat.uniforms.uFlash.value = fl * 0.35;
    this.shaftMat.uniforms.uTime.value = anim;
    if (this.dustMat) this.dustMat.uniforms.uTime.value = anim;

    // ── pantalla: se enciende al llegar a medio camino y se apaga si vuelves
    const target = p > 0.2 ? 1 : 0;
    this.on = this.reduced ? target : target ? Math.min(1, this.on + dt * 1.1) : Math.max(0, this.on - dt * 3);
    const clear = ss(p, 0.4, 0.85) * 0.62 + 0.26;
    const su = this.screenMat.uniforms;
    su.uTime.value = T;
    su.uOn.value = this.on;
    su.uClear.value = clear;
    // la radio se ve en la pantalla: late con la música y se rompe cuando entra una voz
    const level = this.audio.level();
    su.uLevel.value = this.reduced ? 0 : level;
    this.cut = lerp(this.cut, this.audio.cutting ? 0.6 + Math.random() * 0.4 : 0, 1 - Math.exp(-dt * 10));
    su.uCut.value = this.reduced ? 0 : this.cut;
    su.uFlash.value = fl;
    const flick = 0.85 + 0.15 * Math.sin(T * 31) * Math.sin(T * 7.3);
    const light = ss(this.on, 0.0, 0.25) * flick;
    const boot = 1 - ss(this.on, 0, 0.5);
    this.screenLight.intensity = light * (2.2 + boot * 10);
    this.screenSpot.intensity = light * (7 + boot * 25);
    const redness = clear * 0.6;
    this.screenLight.color.setRGB(1, 0.95 - redness * 0.7, 0.92 - redness * 0.75);
    this.screenSpot.color.copy(this.screenLight.color);

    // ojos: van y vienen con la señal
    // si el cursor está sobre la pantalla, la máscara te mira fijamente: ojos entrecerrados y más encendidos
    let over = false;
    if (this.screenMesh && this.on > 0.5 && !this.reduced) {
      this.ray.setFromCamera(this.mouse, this.cam);
      over = this.ray.intersectObject(this.screenMesh).length > 0;
    }
    this.stare = lerp(this.stare, over ? 1 : 0, 1 - Math.exp(-dt * 4));
    const eyeI = this.on > 0.5 ? (0.6 + clear) * (Math.sin(T * 13) > -0.6 || this.stare > 0.5 ? 1 : 0.2) * (1 + level * 0.9 + this.stare * 0.8) * (1 - this.cut * 0.7) : 0;
    this.eyeMat.color.setRGB(14 * eyeI, 0.25 * eyeI, 0.12 * eyeI);
    this.smooth.lerp(this.mouse, 0.05);
    for (const e of this.eyes) {
      // la máscara está girada media vuelta: en su espacio, la x va al revés
      e.mesh.position.set(e.base.x - this.smooth.x * 0.025, e.base.y + this.smooth.y * 0.015, e.base.z);
      e.mesh.scale.y = lerp(1, 0.4, this.stare);
    }
    // el cómic: sube en 0,4 s, se queda 1,6 s y se va en 0,6 s (no se reengancha mientras dura)
    const ct = this.comicAt < 0 ? Infinity : T - this.comicAt;
    if ((this.on >= 1 && p >= 0.6 && !this.wasOut) || (this.stare > 0.5 && !this.wasStare && ct > 2.2)) this.comicAt = T;
    this.wasOut = this.on >= 1 && p >= 0.6;
    this.wasStare = this.stare > 0.5;
    const cn = this.comicAt < 0 ? Infinity : T - this.comicAt;
    this.comic.amount = ss(cn, 0, 0.4) * (1 - ss(cn, 1.6, 2.2));
    // con el cómic, la máscara se mueve a saltos (12 fps)
    if (this.comic.drawFrame(T)) {
      this.maskRig.rotation.y = this.smooth.x * 0.45 + Math.sin(T * 0.4) * 0.08;
      this.maskRig.rotation.x = -this.smooth.y * 0.25 + 0.06;
      this.maskRig.position.z = ss(p, 0.6, 1) * 1.2;
    }

    // ── la silla: se mece sola un poco, luego rueda y gira apartándose
    const roll = ss(p, 0.32, 0.52);
    const sway = this.reduced ? 0 : Math.sin(T * 0.9) * 0.06 * (1 - roll) * ss(this.on, 0.3, 1);
    this.chair.position.set(this.chairHome.x + roll * 0.95, 0, this.chairHome.z + roll * 0.35 - Math.sin(roll * Math.PI) * 0.08);
    this.chair.rotation.y = this.chairYaw + sway + roll * 1.35;

    // ── la grabadora: las bobinas giran mientras suena, y el cursor la señala
    this.reelSpeed = lerp(this.reelSpeed, this.audio.spinning ? 1 : 0, 1 - Math.exp(-dt * 3));
    for (const [i, r] of this.reels.entries()) r.mesh.rotateOnWorldAxis(r.axis, -dt * this.reelSpeed * (i ? 2.1 : 1.6));
    if (this.recorder && !this.reduced) {
      this.ray.setFromCamera(this.mouse, this.cam);
      const h = this.ray.intersectObjects([this.recorder, ...this.reels.map((r) => r.mesh)], true).length > 0;
      if (h !== this.hover) this.opts.canvas.style.cursor = (this.hover = h) ? 'pointer' : '';
    }

    // ── despertar: párpados con un parpadeo antes de abrirse del todo
    if (this.woken && this.wakeT < 0) this.wakeT = T;
    const wt = this.wakeT < 0 ? -1 : T - this.wakeT;
    this.lens.uniforms.uWake.value = this.reduced ? 1 : wt < 0 ? 0 : lids(wt);

    // ── cámara
    const dive = ss(p, 0.86, 1);
    // quietos, se nota la respiración; al hacer scroll se calma
    const idle = this.reduced ? 0 : ss(now / 1000 - this.lastMove, 1, 4);
    const breath = this.reduced ? 0 : (0.3 + 0.7 * idle) * (1 - dive);
    this.lookOff.lerp(this.mouse, 1 - Math.exp(-dt * 2.2));
    if (this.path) {
      // levantarse de la cama hasta detrás de la silla, con arranque y frenada;
      // luego casi quieta mientras la silla se aparta, y de golpe se lanza contra la pantalla
      const k = p < 0.3 ? 0.5 * inOutCubic(p / 0.3) : 0.5 + 0.5 * rush(clamp((p - 0.3) / 0.56, 0, 1));
      const pos = this.path.pos.getPoint(k);
      const look = this.path.look.getPoint(k);
      // la zambullida: del último punto hasta atravesar el cristal
      pos.z = lerp(pos.z, this.screenCenter.z + 0.02, dive * dive);
      const free = this.reduced ? 0 : 1 - dive;
      this.cam.position.set(
        pos.x + this.lookOff.x * 0.03 * free + (Math.sin(T * 0.33) * 0.012 + Math.sin(T * 0.71) * 0.004) * breath,
        pos.y + this.lookOff.y * 0.02 * free + Math.sin(T * 0.5) * 0.01 * breath,
        pos.z,
      );
      this.cam.lookAt(look);
      // un poco de libertad para mirar con el cursor
      this.cam.rotateY(-this.lookOff.x * 0.075 * free);
      this.cam.rotateX(this.lookOff.y * 0.045 * free);
      this.cam.rotateZ(Math.sin(T * 0.27) * 0.008 * breath);
      this.cam.rotateZ(dive * dive * 0.55 * (this.reduced ? 0 : 1)); // al caer dentro, el mundo gira
    }
    this.cam.updateMatrixWorld();
    // la velocidad de la cámara se nota: el ángulo se abre y los bordes se estiran hacia el centro
    const v = this.prevCam.distanceTo(this.cam.position) / Math.max(dt, 1e-3);
    this.prevCam.copy(this.cam.position);
    this.speed = lerp(this.speed, this.reduced ? 0 : Math.min(1, v * 0.45), 0.12);
    this.cam.fov = this.baseFov + this.speed * 9;
    this.cam.updateProjectionMatrix();
    this.lens.uniforms.uSpeed.value = this.speed;
    const near = 1 - ss(this.cam.position.distanceTo(this.screenCenter), 0.3, 1.25);
    this.lens.uniforms.uNear.value = near;
    this.screenMat.uniforms.uNear.value = near;
    this.lens.uniforms.uTime.value = T;
    this.lens.uniforms.uDive.value = dive;
    this.lens.uniforms.uTilt.value = 1 - ss(p, 0.06, 0.3); // al incorporarnos, la manta sale de plano
    this.audio.update(T, dive, this.visible, near);

    // texturas que se pintan aparte: las gotas de la luz, la máscara y el reflejo del suelo
    const r = this.renderer;
    r.setRenderTarget(this.cookieRT);
    r.render(this.cookieScene, this.cookieCam);
    if (this.on > 0 || fl > 0.02) this.renderMask();
    r.shadowMap.needsUpdate = true;
    this.renderReflection();
    r.setRenderTarget(null);
    this.composer.render();
  };

  // la máscara para la pantalla; con el cómic, por su pasada
  private renderMask() {
    const r = this.renderer, c = this.comic;
    if (c.amount <= 0) {
      r.setRenderTarget(this.maskRT);
      r.render(this.maskScene, this.maskCam);
      return;
    }
    r.setRenderTarget(this.maskRaw);
    r.render(this.maskScene, this.maskCam);
    c.renderMask(this.maskScene, this.maskCam);
    c.pass.render(r, this.maskRT, this.maskRaw, 0, false);
  }

  private disposed = false;
  dispose() {
    if (this.disposed) return; // la sala la desecha antes que el desmontaje de Hero
    this.disposed = true;
    cancelAnimationFrame(this.raf);
    this.clock?.dispose();
    window.removeEventListener('resize', this.resize);
    window.removeEventListener('pointermove', this.onPointer);
    this.opts.canvas.removeEventListener('click', this.onClick);
    this.audio.dispose();
    disposeDeep(this.scene);
    for (const rt of [this.maskRT, this.maskRaw, this.cookieRT, this.reflRT]) rt.dispose();
    this.comic.dispose();
    this.composer.dispose();
    this.renderer.dispose();
    // la habitación ya no vuelve: su contexto WebGL se suelta del todo (si no, seguía vivo, con
    // todo el cuarto dentro, mientras las demás escenas pintaban en el suyo)
    this.renderer.forceContextLoss();
  }
}
