import * as THREE from 'three';

/*
 * El pentagrama del ritual, grabado en el suelo: la estrella invertida (0-2-4-1-3) con los lados
 * hechos pistas de circuito (tramos rectos, quiebros a 45° y pads en los quiebros), un doble
 * círculo y, entre los dos, glifos medio corruptos (katakana y marcas del oni, con trozos que
 * faltan). Todo se dibuja una vez en un lienzo: rojo para las pistas, verde para círculos y glifos.
 *
 * Apagado es un grabado apenas más claro que la piedra. \`set(on)\` lo enciende: una corriente roja
 * corre por las pistas del centro a las puntas (llega con on = 0,8) con un pulso de brillo en el
 * frente, y de 0,8 a 1 se encienden los círculos y los glifos, con un par de cortes.
 */
const SIZE = 2048;
const GLYPHS = 'アカサタナハマヤラワンヲヌフムユルレロ鬼面呪';

export function makePentagram(points: THREE.Vector3[], radius: number) {
  const half = radius + 0.8, px = SIZE / (half * 2);
  const c = Object.assign(document.createElement('canvas'), { width: SIZE, height: SIZE }), x = c.getContext('2d')!;
  // del suelo (x, z) al lienzo
  const P = (v: THREE.Vector3) => [(v.x + half) * px, (v.z + half) * px] as const;
  x.lineCap = 'round';
  x.lineJoin = 'round';

  // la estrella: cada lado, de punta a punta, como una pista con dos quiebros a 45° (se aparta
  // 6 cm de la recta y vuelve), y pads en cada quiebro
  x.strokeStyle = x.fillStyle = '#ff0000';
  x.lineWidth = 0.022 * px;
  const order = [0, 2, 4, 1, 3, 0];
  for (let i = 0; i < 5; i++) {
    const a = points[order[i]], b = points[order[i + 1]];
    const d = b.clone().sub(a), len = d.length(), u = d.clone().normalize(), n = new THREE.Vector3(-u.z, 0, u.x);
    const off = (i % 2 ? 1 : -1) * 0.06, j = Math.abs(off); // el quiebro a 45°: avanza lo mismo que se aparta
    const k = [a, a.clone().addScaledVector(u, len * 0.3), a.clone().addScaledVector(u, len * 0.3 + j).addScaledVector(n, off),
      a.clone().addScaledVector(u, len * 0.7 - j).addScaledVector(n, off), a.clone().addScaledVector(u, len * 0.7), b];
    x.beginPath();
    k.forEach((v, m) => (m ? x.lineTo(...P(v)) : x.moveTo(...P(v))));
    x.stroke();
    for (const v of k.slice(1, -1)) {
      x.beginPath();
      x.arc(...P(v), 0.024 * px, 0, Math.PI * 2);
      x.fill();
    }
    // una pista fina paralela, más corta, como en una placa
    x.lineWidth = 0.008 * px;
    x.beginPath();
    x.moveTo(...P(a.clone().addScaledVector(u, len * 0.36).addScaledVector(n, -off * 0.9)));
    x.lineTo(...P(a.clone().addScaledVector(u, len * 0.64).addScaledVector(n, -off * 0.9)));
    x.stroke();
    x.lineWidth = 0.022 * px;
  }
  // un pad en cada punta
  for (const v of points) {
    x.beginPath();
    x.arc(...P(v), 0.05 * px, 0, Math.PI * 2);
    x.lineWidth = 0.012 * px;
    x.stroke();
  }

  // el doble círculo y los glifos (verde)
  x.globalCompositeOperation = 'lighter';
  x.strokeStyle = x.fillStyle = '#00ff00';
  const [cx, cy] = P(new THREE.Vector3());
  for (const [r, w] of [[radius + 0.35, 0.02], [radius + 0.55, 0.012]]) {
    x.lineWidth = w * px;
    x.beginPath();
    x.arc(cx, cy, r * px, 0, Math.PI * 2);
    x.stroke();
  }
  let seed = 11;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  x.font = `${0.15 * px}px "Yu Gothic", "Meiryo", "Noto Sans JP", sans-serif`;
  x.textAlign = 'center';
  x.textBaseline = 'middle';
  for (let i = 0; i < 30; i++) {
    const a = (i / 30) * Math.PI * 2, r = (radius + 0.45) * px, g = GLYPHS[Math.floor(rnd() * GLYPHS.length)];
    x.save();
    x.translate(cx + Math.sin(a) * r, cy + Math.cos(a) * r);
    x.rotate(-a + Math.PI);
    // corruptos: alguno desplazado, y a casi todos les falta un trozo
    const shift = rnd() < 0.25 ? (rnd() - 0.5) * 0.05 * px : 0;
    x.fillText(g, shift, 0);
    if (rnd() < 0.7) {
      x.globalCompositeOperation = 'destination-out';
      x.fillRect((rnd() - 0.5) * 0.12 * px, (rnd() - 0.6) * 0.12 * px, (0.03 + rnd() * 0.06) * px, (0.01 + rnd() * 0.03) * px);
      x.globalCompositeOperation = 'lighter';
    }
    x.restore();
  }

  const tex = new THREE.CanvasTexture(c);
  tex.anisotropy = 8;
  const mat = new THREE.ShaderMaterial({
    uniforms: { uMap: { value: tex }, uOn: { value: 0 }, uTime: { value: 0 }, uR: { value: radius }, uColor: { value: new THREE.Color(6, 0.12, 0.06) } },
    transparent: true,
    depthWrite: false,
    vertexShader: `
      varying vec2 vUv; varying vec3 vW;
      void main() { vUv = uv; vW = (modelMatrix * vec4(position, 1.0)).xyz; gl_Position = projectionMatrix * viewMatrix * vec4(vW, 1.0); }`,
    fragmentShader: `
      uniform sampler2D uMap; uniform float uOn, uTime, uR; uniform vec3 uColor; varying vec2 vUv; varying vec3 vW;
      float h(float n) { return fract(sin(n * 12.9898) * 43758.5453); }
      void main() {
        vec4 t = texture2D(uMap, vUv);
        float m = max(t.r, t.g);
        if (m < 0.02) discard;
        // la corriente: del centro (0) a las puntas (1), con el frente a on / 0,8
        float r = length(vW.xz) / uR, front = uOn / 0.8 * 1.04;
        float lit = t.r * smoothstep(front, front - 0.04, r);
        // (al cuadrado a mano: pow con base negativa da NaN en Windows y el bloom lo pinta como cuadrados negros)
        float dr = (r - front) * 16.0;
        float pulse = t.r * exp(-dr * dr) * step(uOn, 0.85);
        // círculos y glifos, de 0,8 a 1, con dos cortes al arrancar
        float k = smoothstep(0.8, 1.0, uOn), cut = step(0.82, uOn) * step(uOn, 0.9) * step(0.5, h(floor(uTime * 14.0)));
        float ring = t.g * k * (1.0 - cut);
        // un latido lento una vez encendido
        float beat = 0.85 + 0.15 * sin(uTime * 2.2 - r * 3.0);
        float e = (lit * beat + pulse * 2.5 + ring * 0.8 * beat);
        // apagado: el grabado, un 4 % más claro que la piedra
        vec3 col = mix(vec3(0.045), uColor * e, min(1.0, e * 4.0));
        gl_FragColor = vec4(col, max(m * 0.6, min(1.0, e * 4.0)));
      }`,
  });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(half * 2, half * 2).rotateX(-Math.PI / 2), mat);
  mesh.position.y = 0.002;
  mesh.renderOrder = 2;
  return {
    mesh,
    set(on: number) {
      mat.uniforms.uOn.value = on;
    },
    update(t: number) {
      mat.uniforms.uTime.value = t;
    },
    dispose() {
      mesh.geometry.dispose();
      mat.dispose();
      tex.dispose();
    },
  };
}
