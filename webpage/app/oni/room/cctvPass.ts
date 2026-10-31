import * as THREE from 'three';

/*
 * Mientras seguimos dentro de la tele de la CAM 03, todo se ve a través de una cámara de
 * seguridad: grano que hierve, líneas de barrido, una banda de tracking que baja despacio,
 * filas que se desplazan a ratos, aberración, color lavado y viñeteado. Une la imagen del
 * virus con la sala y se apaga al salir de la pantalla.
 */
export const CctvShader = {
  uniforms: {
    tDiffuse: { value: null as THREE.Texture | null },
    uTime: { value: 0 },
    uRes: { value: new THREE.Vector2(1, 1) },
    uMove: { value: 1 }, // 0 con movimiento reducido: grano quieto, sin banda ni saltos
    uAmt: { value: 1 }, // 1 dentro de la pantalla de la CAM 03; se va a 0 al salir de ella
    // la biblioteca: la máscara del cómic (sin la curva de la lente) y cuánto cede el filtro sobre ella
    tComic: { value: null as THREE.Texture | null },
    uComicCctv: { value: 0 },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse, tComic;
    uniform float uTime, uMove, uAmt, uComicCctv;
    uniform vec2 uRes;
    varying vec2 vUv;
    float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
    void main() {
      if (uAmt <= 0.0) { gl_FragColor = texture2D(tDiffuse, vUv); return; }
      vec2 uv = vUv;
      float t = floor(uTime * 24.0) * uMove;
      // la banda de tracking baja despacio; dentro, las filas tiemblan
      float bandY = fract(-uTime * 0.045 * uMove + 0.3);
      float band = smoothstep(0.035, 0.0, abs(uv.y - bandY)) * uMove;
      float row = floor(uv.y * uRes.y / 2.0);
      uv.x += band * (hash(vec2(row, t)) - 0.5) * 0.012;
      // de vez en cuando, un salto de sincronía de unas pocas filas
      float jump = step(0.985, hash(vec2(floor(uTime * 3.0), 7.0))) * uMove;
      uv.x += jump * step(abs(uv.y - hash(vec2(floor(uTime * 3.0), 3.0))), 0.03) * 0.02;
      // aberración leve
      vec2 ca = (uv - 0.5) * 0.0025;
      vec3 col = vec3(texture2D(tDiffuse, uv + ca).r, texture2D(tDiffuse, uv).g, texture2D(tDiffuse, uv - ca).b);
      // color de cámara barata: algo lavado, negros levantados y aplastados
      float l = dot(col, vec3(0.3, 0.59, 0.11));
      col = mix(vec3(l), col, 0.75);
      col = col * 0.94 + 0.018;
      // el cómic asoma: sobre él, grano y líneas ceden (su máscara, curvada como la lente)
      vec2 cc = vUv - 0.5, aa = vec2(uRes.x / uRes.y, 1.0);
      float cm = uComicCctv > 0.0 ? texture2D(tComic, 0.5 + cc * (1.0 + 0.16 * dot(cc * aa, cc * aa)) * 0.9).r * uComicCctv : 0.0;
      // grano que hierve, más fuerte en la sombra
      float g = hash(floor(vUv * uRes / 1.5) + t * 1.7) - 0.5;
      col += g * (0.09 - l * 0.05) * (1.0 - cm);
      // líneas de barrido y la banda, algo más clara
      col *= mix(0.93 + 0.07 * sin(vUv.y * uRes.y * 1.6), 1.0, cm);
      col += band * 0.05;
      // viñeteado de lente barata
      vec2 v = vUv - 0.5;
      col *= 1.0 - dot(v, v) * 0.75;
      gl_FragColor = vec4(mix(texture2D(tDiffuse, vUv).rgb, col, uAmt), 1.0);
    }`,
};
