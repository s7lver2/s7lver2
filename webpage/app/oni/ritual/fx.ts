import * as THREE from 'three';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';

/*
 * El acabado de imagen del ritual, la última pasada: grano fino, viñeta, y con la cámara girando
 * deprisa, un desenfoque radial desde el centro, la separación de color hacia los bordes y, en lo
 * más rápido, un fundido a desenfocado.
 * `speed` (0-1) lo pone la escena según lo rápido que gira la cámara.
 */
export function makeFx() {
  const pass = new ShaderPass({
    uniforms: { tDiffuse: { value: null }, uSpeed: { value: 0 }, uTime: { value: 0 }, uFocus: { value: 0 } },
    vertexShader: `varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `
      uniform sampler2D tDiffuse; uniform float uSpeed, uTime, uFocus; varying vec2 vUv;
      float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
      void main() {
        vec2 d = vUv - 0.5;
        float r = length(d);
        // desenfoque radial: varias muestras hacia el centro, más lejos cuanto más deprisa y más al borde
        vec3 c = vec3(0.0);
        float spread = uSpeed * 0.06 * smoothstep(0.05, 0.6, r);
        for (int i = 0; i < 8; i++) {
          float k = float(i) / 7.0;
          vec2 uv = vUv - d * spread * k;
          // la separación de color crece hacia el borde y con la velocidad
          float ca = (0.002 + uSpeed * 0.012) * r;
          c += vec3(texture2D(tDiffuse, uv + d * ca).r, texture2D(tDiffuse, uv).g, texture2D(tDiffuse, uv - d * ca).b);
        }
        c /= 8.0;
        // en lo más rápido del giro la imagen se funde en un desenfoque suave, como si se perdiera
        // el foco, y se recupera al frenar
        float melt = smoothstep(0.35, 0.9, uSpeed);
        if (melt > 0.0) {
          vec3 b = vec3(0.0);
          for (int i = 0; i < 12; i++) {
            float a = float(i) * 2.39996, rr = sqrt(float(i) + 0.5) / 3.5;
            b += texture2D(tDiffuse, vUv + vec2(cos(a), sin(a)) * rr * 0.03).rgb;
          }
          c = mix(c, b / 12.0 * 0.85, melt * 0.85);
        }
        // viñeta suave, más cerrada al girar
        // en las redes, más cerrada todavía: el fondo se hunde y manda el centro
        c *= 1.0 - smoothstep(0.35 - uFocus * 0.1, 0.85, r) * min(0.95, 0.55 + uSpeed * 0.3 + uFocus * 0.3);
        // grano fino, distinto en cada fotograma
        c += (hash(vUv * 1000.0 + fract(uTime * 7.3)) - 0.5) * 0.035;
        gl_FragColor = vec4(c, 1.0);
      }`,
  });
  return pass;
}
