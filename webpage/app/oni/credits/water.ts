import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';

/*
 * El agua, sobre la imagen ya terminada: las ondas lentas desplazan la imagen (±0,6 % de la
 * pantalla), los colores se separan un poco hacia los bordes, viñeta y grano. `uCut` es el corte de
 * entrada (unas bandas que se desplazan y se separan en canales); `uDark`, el fundido final a negro.
 */
export function makeWater() {
  return new ShaderPass({
    uniforms: { tDiffuse: { value: null }, uTime: { value: 0 }, uCut: { value: 0 }, uDark: { value: 0 } },
    vertexShader: `
      varying vec2 vUv;
      void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `
      uniform sampler2D tDiffuse; uniform float uTime, uCut, uDark; varying vec2 vUv;
      float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
      float noise(vec2 p) {
        vec2 i = floor(p), f = fract(p), u = f * f * (3.0 - 2.0 * f);
        return mix(mix(hash(i), hash(i + vec2(1, 0)), u.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), u.x), u.y);
      }
      void main() {
        vec2 uv = vUv;
        // dos capas de ondas lentas (0,15 Hz), en sentidos contrarios
        vec2 w = vec2(noise(uv * 3.0 + vec2(0.0, uTime * 0.15)), noise(uv * 3.0 + vec2(5.2, -uTime * 0.12))) - 0.5;
        uv += w * 0.012;
        // el corte: bandas horizontales que saltan de lado, distintas en cada fotograma
        float f = floor(uTime * 30.0), band = floor(vUv.y * 14.0);
        float on = step(0.62, hash(vec2(band, f))) * uCut;
        uv.x += on * (hash(vec2(band, f + 1.0)) - 0.5) * 0.15;
        float r = length(vUv - 0.5), ca = 0.0012 + r * 0.004 + uCut * 0.02;
        vec3 c = vec3(texture2D(tDiffuse, uv + vec2(ca, 0.0)).r, texture2D(tDiffuse, uv).g, texture2D(tDiffuse, uv - vec2(ca, 0.0)).b);
        c *= 1.0 - smoothstep(0.3, 0.85, r) * 0.6;
        c += (hash(vUv * 1000.0 + fract(uTime * 7.3)) - 0.5) * 0.03;
        gl_FragColor = vec4(c * (1.0 - uDark), 1.0);
      }`,
  });
}

