import * as THREE from 'three';
import { CELL, type Maze } from './maze';

/*
 * La luz de las backrooms, horneada al crear cada mapa: una textura vista desde arriba (3 texels por
 * celda) con lo que llega de cada fluorescente encendido (cortado por las paredes: sombras de verdad)
 * y la oclusión de las paredes cercanas (esquinas y pies de pared más oscuros). Suelo, techo, paredes y
 * piezas la leen por su posición en el mundo; las paredes, medio metro hacia fuera de su cara.
 *
 * Es una textura de datos en un uniform: cambiarla de un mapa a otro no crea programas nuevos.
 */

const R = 3; // texels por celda
const COLOR = [1, 0.93, 0.74]; // fluorescente viejo, tirando a amarillo
const RANGE = 9; // metros: más allá, un panel no cuenta

// los uniforms, compartidos por todos los materiales parcheados (hay una partida a la vez)
// uLmGain: la corriente (1 normal, 0 en un apagón), compartida por todos los materiales
export const LM = { uLm: { value: null as THREE.Texture | null }, uLmSize: { value: new THREE.Vector2(1, 1) }, uLmGain: { value: 1 } };
const patched = new WeakSet<THREE.Material>();

/** Hace que un material estándar tome la luz del lightmap (una vez por material; la misma función siempre: el mismo programa). */
export function lightmapped(m: THREE.Material) {
  if (patched.has(m) || !(m as THREE.MeshStandardMaterial).isMeshStandardMaterial) return;
  patched.add(m);
  m.onBeforeCompile = patch;
}

function patch(s: THREE.WebGLProgramParametersWithUniforms) {
  Object.assign(s.uniforms, LM);
  s.vertexShader = s.vertexShader
    .replace('#include <common>', '#include <common>\nvarying vec3 vLmP;\nvarying vec3 vLmN;')
    .replace(
      '#include <begin_vertex>',
      `#include <begin_vertex>
      vec4 lmW = vec4(transformed, 1.0);
      vec3 lmN = objectNormal;
      #ifdef USE_INSTANCING
        lmW = instanceMatrix * lmW;
        lmN = mat3(instanceMatrix) * lmN;
      #endif
      vLmP = (modelMatrix * lmW).xyz;
      vLmN = normalize(mat3(modelMatrix) * lmN);`,
    );
  s.fragmentShader = s.fragmentShader
    .replace('#include <common>', '#include <common>\nuniform sampler2D uLm;\nuniform vec2 uLmSize;\nuniform float uLmGain;\nvarying vec3 vLmP;\nvarying vec3 vLmN;')
    .replace(
      '#include <opaque_fragment>',
      `{
        vec3 n = normalize(vLmN);
        vec4 lm = texture2D(uLm, (vLmP.xz + n.xz * 0.45) / uLmSize);
        // en las paredes: el rodapié en sombra y una franja más oscura bajo el techo
        float side = 1.0 - abs(n.y);
        float grad = mix(1.0, 0.5 + 0.5 * smoothstep(-0.1, 0.8, vLmP.y), side) * mix(1.0, 0.82, side * smoothstep(2.1, 2.7, vLmP.y));
        // el techo recibe poco de unos paneles que alumbran hacia abajo
        float up = n.y < -0.5 ? 0.42 : 1.0;
        outgoingLight = outgoingLight * lm.a * grad + diffuseColor.rgb * lm.rgb * 2.0 * lm.a * grad * up * uLmGain;
      }
      #include <opaque_fragment>`,
    );
}

/** Hornea la luz de un mapa y la deja puesta en los materiales parcheados. */
export function bakeLight(m: Maze) {
  const W = m.w * R, H = m.h * R, n = W * H;
  const light = new Float32Array(n), ao = new Float32Array(n), solidT = new Uint8Array(n);
  const solid = (cx: number, cy: number) => cx < 0 || cy < 0 || cx >= m.w || cy >= m.h || !m.open[cy * m.w + cx];
  const lamps = m.lamps.map((c) => ({ x: (c.x + 0.5) * CELL, z: (c.y + 0.5) * CELL }));
  // los paneles, por cubos de 6 m, para no mirarlos todos desde cada texel
  const B = 6, bw = Math.ceil((m.w * CELL) / B), buckets: (typeof lamps)[] = Array.from({ length: bw * bw }, () => []);
  for (const l of lamps) buckets[Math.floor(l.z / B) * bw + Math.floor(l.x / B)]?.push(l);
  const step = CELL / 3;
  const sees = (ax: number, az: number, bx: number, bz: number, d: number) => {
    const k = Math.ceil(d / step);
    for (let i = 1; i < k; i++) {
      const t = i / k;
      if (solid(Math.floor((ax + (bx - ax) * t) / CELL), Math.floor((az + (bz - az) * t) / CELL))) return false;
    }
    return true;
  };
  const near = Math.ceil(RANGE / B);
  for (let j = 0; j < H; j++)
    for (let i = 0; i < W; i++) {
      const k = j * W + i, px = ((i + 0.5) / R) * CELL, pz = ((j + 0.5) / R) * CELL, cx = Math.floor(i / R), cy = Math.floor(j / R);
      if (solid(cx, cy)) {
        solidT[k] = 1;
        continue;
      }
      // la luz: cada panel visible, con caída suave (están a 2,65 m: nunca de golpe)
      let sum = 0.025;
      const bx = Math.floor(px / B), bz = Math.floor(pz / B);
      for (let y = bz - near; y <= bz + near; y++)
        for (let x = bx - near; x <= bx + near; x++) {
          const b = x >= 0 && y >= 0 && x < bw && y < bw ? buckets[y * bw + x] : undefined;
          if (!b) continue;
          for (const l of b) {
            const dx = l.x - px, dz = l.z - pz, d2 = dx * dx + dz * dz;
            if (d2 > RANGE * RANGE || !sees(px, pz, l.x, l.z, Math.sqrt(d2))) continue;
            sum += 0.9 / (1 + (d2 + 7) / 4.5);
          }
        }
      light[k] = sum;
      // la oclusión: cada celda de pared vecina oscurece según lo cerca que esté su borde
      let f = 1;
      for (let dy = -1; dy <= 1; dy++)
        for (let dx = -1; dx <= 1; dx++) {
          if ((!dx && !dy) || !solid(cx + dx, cy + dy)) continue;
          const x0 = (cx + dx) * CELL, z0 = (cy + dy) * CELL;
          const ex = Math.max(x0 - px, 0, px - (x0 + CELL)), ez = Math.max(z0 - pz, 0, pz - (z0 + CELL));
          const d = Math.hypot(ex, ez);
          f *= 1 - 0.42 * (1 - THREE.MathUtils.smoothstep(d, 0, 1.1));
        }
      ao[k] = f;
    }
  // lo de dentro de las paredes toma lo de sus vecinos (al filtrar, el borde no se oscurece)
  for (let pass = 0; pass < 2; pass++)
    for (let k = 0; k < n; k++) {
      if (!solidT[k]) continue;
      let l = 0, a = 0, c = 0;
      for (const o of [1, -1, W, -W]) {
        const q = k + o;
        if (q < 0 || q >= n || (solidT[q] && light[q] === 0)) continue;
        l += light[q];
        a += ao[q];
        c++;
      }
      if (c) (light[k] = l / c), (ao[k] = a / c);
    }
  // un desenfoque de 3×3: las sombras de las paredes, con penumbra
  const blur = (src: Float32Array) => {
    const out = new Float32Array(n);
    for (let j = 0; j < H; j++)
      for (let i = 0; i < W; i++) {
        let s = 0, c = 0;
        for (let y = Math.max(0, j - 1); y <= Math.min(H - 1, j + 1); y++) for (let x = Math.max(0, i - 1); x <= Math.min(W - 1, i + 1); x++) (s += src[y * W + x]), c++;
        out[j * W + i] = s / c;
      }
    return out;
  };
  const L = blur(light), A = blur(ao), data = new Uint8Array(n * 4);
  for (let k = 0; k < n; k++) {
    const v = Math.min(1, L[k] / 2) * 255;
    data[k * 4] = v * COLOR[0];
    data[k * 4 + 1] = v * COLOR[1];
    data[k * 4 + 2] = v * COLOR[2];
    data[k * 4 + 3] = A[k] * 255;
  }
  const tex = new THREE.DataTexture(data, W, H);
  tex.magFilter = tex.minFilter = THREE.LinearFilter;
  tex.needsUpdate = true;
  LM.uLm.value?.dispose();
  LM.uLm.value = tex;
  LM.uLmSize.value.set(m.w * CELL, m.h * CELL);
  return tex;
}
