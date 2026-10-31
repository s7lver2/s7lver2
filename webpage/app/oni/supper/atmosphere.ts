import * as THREE from 'three';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';

/*
 * El aire de la cena: los haces de los focos (conos que se apagan hacia abajo y hacia los bordes,
 * con humo que deriva), el polvo que flota dentro de ellos y la última pasada de imagen: grano,
 * viñeta y, de vez en cuando, el fallo de la máscara (bandas que se desplazan y el rojo que se
 * separa) durante unos fotogramas.
 */

export function makeBeam(x: number, top: number, bottom: number, r: number, color: number) {
  const h = top - bottom;
  const mat = new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uColor: { value: new THREE.Color(color) }, uK: { value: 1 } },
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    vertexShader: `
      varying vec2 vUv; varying vec3 vN, vV;
      void main() {
        vUv = uv;
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vN = normalize(mat3(modelMatrix) * normal);
        vV = normalize(cameraPosition - wp.xyz);
        gl_Position = projectionMatrix * viewMatrix * wp;
      }`,
    fragmentShader: `
      uniform float uTime, uK; uniform vec3 uColor; varying vec2 vUv; varying vec3 vN, vV;
      float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float noise(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
        return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y); }
      void main() {
        // de cara se ve el haz; de canto (los bordes del cono), nada
        float rim = pow(abs(dot(vN, vV)), 1.6);
        // más denso arriba, junto al foco, y se apaga antes del suelo
        float len = smoothstep(0.0, 0.35, vUv.y) * (0.35 + 0.65 * vUv.y);
        float smoke = 0.55 + 0.45 * noise(vec2(vUv.x * 7.0, vUv.y * 3.0 - uTime * 0.05));
        gl_FragColor = vec4(uColor * rim * len * smoke * 0.11 * uK, 1.0);
      }`,
  });
  const m = new THREE.Mesh(new THREE.CylinderGeometry(0.06, r, h, 40, 1, true), mat);
  m.position.set(x, bottom + h / 2, 0.15);
  m.renderOrder = 2;
  return m;
}

/** El polvo: motas que suben y bajan muy despacio sobre la mesa. */
export function makeDust(n: number) {
  const pos = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) pos.set([(Math.random() - 0.5) * 6.5, 0.8 + Math.random() * 3, -1.2 + Math.random() * 2.4], i * 3);
  const g = new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const p = new THREE.Points(g, new THREE.PointsMaterial({ color: 0xffb38a, size: 1.6, sizeAttenuation: false, transparent: true, opacity: 0.45, depthWrite: false, blending: THREE.AdditiveBlending }));
  const base = pos.slice();
  return {
    points: p,
    update(t: number) {
      const a = g.attributes.position as THREE.BufferAttribute;
      for (let i = 0; i < n; i++) {
        a.setY(i, base[i * 3 + 1] + Math.sin(t * 0.07 + i) * 0.08);
        a.setX(i, base[i * 3] + Math.sin(t * 0.05 + i * 1.7) * 0.05);
      }
      a.needsUpdate = true;
    },
  };
}

/**
 * La última pasada: grano, viñeta y el fallo de la máscara. `uGlitch` (0-1) lo sube la escena
 * unos fotogramas de vez en cuando: bandas horizontales que se corren y el canal rojo que se separa.
 */
export function makeFinish() {
  return new ShaderPass({
    uniforms: { tDiffuse: { value: null }, uTime: { value: 0 }, uGlitch: { value: 0 }, uSeed: { value: 0 } },
    vertexShader: `varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `
      uniform sampler2D tDiffuse; uniform float uTime, uGlitch, uSeed; varying vec2 vUv;
      float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
      void main() {
        vec2 uv = vUv;
        // bandas: unas pocas franjas horizontales que se corren a un lado
        float band = floor(uv.y * 24.0);
        float on = step(1.0 - uGlitch * 0.45, hash(vec2(band, uSeed)));
        uv.x += on * (hash(vec2(band, uSeed + 1.0)) - 0.5) * 0.08 * uGlitch;
        float split = 0.004 + 0.012 * uGlitch;
        vec3 c = vec3(texture2D(tDiffuse, uv + vec2(split * uGlitch, 0.0)).r, texture2D(tDiffuse, uv).g, texture2D(tDiffuse, uv - vec2(split * uGlitch, 0.0)).b);
        // viñeta y grano fino
        vec2 d = vUv - 0.5;
        c *= 1.0 - dot(d, d) * 1.1;
        c += (hash(vUv * 1000.0 + fract(uTime * 7.0)) - 0.5) * 0.045;
        gl_FragColor = vec4(c, 1.0);
      }`,
  });
}
