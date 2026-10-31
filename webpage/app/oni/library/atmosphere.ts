import * as THREE from 'three';

/*
 * El aire de la biblioteca: los haces de luna que entran por las ventanas altas y cruzan el
 * pasillo, y el polvo que flota y solo se ve cuando pasa por dentro de uno. Nada de esto es luz
 * de three (no cambia cuántas luces hay ni recompila nada): son mallas aditivas con su shader.
 */

const MAX = 4;

export interface Shaft {
  from: THREE.Vector3;
  to: THREE.Vector3;
  radius: number;
}

const shaftMaterial = (color: THREE.Color, edgePow: number, near: number) =>
  new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uColor: { value: color }, uAmt: { value: 1 }, uEdge: { value: edgePow }, uNear: { value: near } },
    vertexShader: `
      varying vec2 vUv; varying vec3 vN, vView; varying float vDist;
      void main() {
        vUv = uv;
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vN = normalize(mat3(modelMatrix) * normal);
        vView = normalize(cameraPosition - wp.xyz);
        vDist = distance(cameraPosition, wp.xyz);
        gl_Position = projectionMatrix * viewMatrix * wp;
      }`,
    fragmentShader: `
      uniform float uTime, uAmt, uEdge, uNear; uniform vec3 uColor; varying vec2 vUv; varying vec3 vN, vView; varying float vDist;
      float hash(float n) { return fract(sin(n) * 43758.5453); }
      float noise(float x) { float i = floor(x), f = fract(x); return mix(hash(i), hash(i + 1.0), f * f * (3.0 - 2.0 * f)); }
      void main() {
        // borde suave: el haz se ve más por el centro que por los lados
        float edge = pow(abs(dot(vN, vView)), uEdge);
        // con la cámara dentro o rozando el haz, la pared del cono no tapa la imagen
        float near = uNear > 0.0 ? smoothstep(uNear * 0.3, uNear, vDist) : 1.0;
        // se apaga arriba (la ventana) y abajo (el suelo), y tiene vetas que se mueven despacio
        float along = smoothstep(0.0, 0.18, vUv.y) * smoothstep(1.0, 0.55, vUv.y);
        float streak = 0.65 + 0.35 * noise(vUv.x * 18.0 + uTime * 0.15) * noise(vUv.x * 7.0 - uTime * 0.07 + 3.0);
        gl_FragColor = vec4(uColor * edge * near * along * streak * 0.085 * uAmt, 1.0);
      }`,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
  });

const dustMaterial = (color: THREE.Color, shafts: Shaft[]) => {
  const a = shafts.slice(0, MAX), pad = (v: THREE.Vector3[]) => [...v, ...Array(MAX - v.length).fill(new THREE.Vector3())];
  return new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uColor: { value: color },
      uAmt: { value: 1 },
      uFrom: { value: pad(a.map((s) => s.from)) },
      uTo: { value: pad(a.map((s) => s.to)) },
      uR: { value: [...a.map((s) => s.radius), ...Array(MAX - a.length).fill(0)] },
      uN: { value: a.length },
      uPx: { value: 1 },
    },
    vertexShader: `
      #define MAX ${MAX}
      uniform float uTime, uR[MAX], uPx; uniform vec3 uFrom[MAX], uTo[MAX]; uniform int uN;
      attribute float seed; varying float vLit;
      void main() {
        // deriva lenta, cada mota con su fase
        vec3 p = position + vec3(sin(uTime * 0.11 + seed * 6.3), sin(uTime * 0.07 + seed * 4.1) * 0.6 - 0.02 * uTime, cos(uTime * 0.09 + seed * 5.7)) * 0.18;
        // cuánto está dentro de algún haz
        vLit = 0.0;
        for (int i = 0; i < MAX; i++) {
          if (i >= uN) break;
          vec3 ab = uTo[i] - uFrom[i];
          float k = clamp(dot(p - uFrom[i], ab) / dot(ab, ab), 0.0, 1.0);
          float d = length(p - (uFrom[i] + ab * k));
          vLit = max(vLit, exp(-d * d / (uR[i] * uR[i] * 0.5)));
        }
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_PointSize = (1.0 + seed * 1.6) * uPx * 6.0 / -mv.z;
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: `
      uniform vec3 uColor; uniform float uAmt; varying float vLit;
      void main() {
        float r = length(gl_PointCoord - 0.5);
        float a = smoothstep(0.5, 0.1, r) * (0.06 + vLit * 0.94) * uAmt;
        gl_FragColor = vec4(uColor * a * 0.9, 1.0);
      }`,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
};

/** Los haces (`shafts`) y el polvo repartido por `dustBox`. `update(t)` cada fotograma. */
/**
 * `taper`: el radio de arriba respecto al de abajo; `edge`: lo que se apaga el haz hacia los lados
 * (más, más blando); `near`: a menos de esos metros de la cámara el haz se desvanece (0, nunca).
 */
export function atmosphere(scene: THREE.Scene, o: { shafts: Shaft[]; dustBox: THREE.Box3; reduced: boolean; color?: number; taper?: number; edge?: number; near?: number }) {
  const color = new THREE.Color(o.color ?? 0x9fb4e6);
  const group = new THREE.Group();
  const mats: THREE.ShaderMaterial[] = [];
  for (const sh of o.shafts) {
    // un cono abierto de la ventana al suelo, algo más ancho abajo
    const len = sh.from.distanceTo(sh.to);
    const g = new THREE.CylinderGeometry(sh.radius * 1.15 * (o.taper ?? 0.7 / 1.15), sh.radius * 1.15, len, 32, 1, true);
    g.translate(0, -len / 2, 0);
    // uv.y: 0 abajo, 1 arriba en el cilindro de three; se le da la vuelta para que 0 sea la ventana
    const uv = g.attributes.uv as THREE.BufferAttribute;
    for (let i = 0; i < uv.count; i++) uv.setY(i, 1 - uv.getY(i));
    const m = shaftMaterial(color, o.edge ?? 1.6, o.near ?? 0);
    mats.push(m);
    const mesh = new THREE.Mesh(g, m);
    mesh.position.copy(sh.from);
    mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, -1, 0), sh.to.clone().sub(sh.from).normalize());
    mesh.renderOrder = 5;
    mesh.frustumCulled = false;
    group.add(mesh);
  }
  const n = 1500, pos = new Float32Array(n * 3), seed = new Float32Array(n), b = o.dustBox;
  for (let i = 0; i < n; i++) {
    pos[i * 3] = THREE.MathUtils.lerp(b.min.x, b.max.x, Math.random());
    pos[i * 3 + 1] = THREE.MathUtils.lerp(b.min.y, b.max.y, Math.random());
    pos[i * 3 + 2] = THREE.MathUtils.lerp(b.min.z, b.max.z, Math.random());
    seed[i] = Math.random();
  }
  const dg = new THREE.BufferGeometry();
  dg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  dg.setAttribute('seed', new THREE.BufferAttribute(seed, 1));
  const dm = dustMaterial(color, o.shafts);
  mats.push(dm);
  const dust = new THREE.Points(dg, dm);
  dust.frustumCulled = false;
  dust.renderOrder = 6;
  group.add(dust);
  scene.add(group);
  return {
    group,
    /** Cuánto se ven (0-1): el tiempo parado lo baja para que no tapen las hojas. */
    set amount(v: number) {
      for (const m of mats) m.uniforms.uAmt.value = v;
    },
    update(t: number, px: number) {
      // con movimiento reducido, el polvo no deriva
      const tt = o.reduced ? 0 : t;
      for (const m of mats) m.uniforms.uTime.value = tt;
      dm.uniforms.uPx.value = px;
    },
    dispose() {
      group.traverse((x) => (x as THREE.Mesh).geometry?.dispose());
      for (const m of mats) m.dispose();
      scene.remove(group);
    },
  };
}
