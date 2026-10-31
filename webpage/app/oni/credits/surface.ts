import * as THREE from 'three';

/*
 * La superficie del agua vista desde abajo: justo por encima está el suelo del ritual, con el
 * pentagrama encendido. Se mueve con un oleaje suave (tres ondas, ±2,5 cm) y hace lo que hace el
 * agua de verdad mirada desde dentro: hacia arriba deja pasar la luz de encima (el rojo del
 * pentagrama, temblando), y a partir de ~49° de la vertical la refleja entera y se ve oscura, como
 * un espejo del fondo. El borde entre las dos, roto por las olas, es lo que la hace agua.
 *
 * Y unos haces tenues que bajan desde ella y se balancean despacio. Todo se va apagando con la
 * profundidad (`depth`, lo que está la cámara por debajo).
 */
const RED = new THREE.Color(1.0, 0.16, 0.1);
const COLD = new THREE.Color(0x2c3b42);
/** El tono del agua al fondo (el horizonte): la superficie y el fondo acaban en él, sin costura. */
export const MURK = new THREE.Color(0x05090b);

export function makeSurface(y: number) {
  const group = new THREE.Group();
  const uniforms = { uTime: { value: 0 }, uFade: { value: 1 }, uRed: { value: RED }, uCold: { value: COLD }, uMurk: { value: MURK } };

  const sheet = new THREE.Mesh(
    new THREE.PlaneGeometry(24, 24, 160, 160).rotateX(-Math.PI / 2),
    new THREE.ShaderMaterial({
      uniforms,
      side: THREE.DoubleSide,
      vertexShader: `
        uniform float uTime; varying vec3 vW, vN;
        // tres ondas largas en direcciones distintas; la normal sale de sus derivadas
        const vec3 W0 = vec3(0.8, 0.6, 1.7), W1 = vec3(-0.5, 0.86, 2.6), W2 = vec3(0.2, -0.98, 4.1);
        vec3 wave(vec3 w, float a, float s, vec2 p, inout vec2 d) {
          float ph = dot(w.xy, p) * w.z + uTime * s;
          d += w.xy * w.z * a * cos(ph);
          return vec3(0.0, a * sin(ph), 0.0);
        }
        void main() {
          vec3 p = (modelMatrix * vec4(position, 1.0)).xyz;
          vec2 d = vec2(0.0);
          p += wave(W0, 0.012, 0.9, p.xz, d) + wave(W1, 0.008, 1.3, p.xz, d) + wave(W2, 0.005, 1.9, p.xz, d);
          vW = p;
          vN = normalize(vec3(-d.x, 1.0, -d.y));
          gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0);
        }`,
      fragmentShader: `
        uniform float uTime, uFade; uniform vec3 uRed, uCold, uMurk; varying vec3 vW, vN;
        float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
        float noise(vec2 p) {
          vec2 i = floor(p), f = fract(p), u = f * f * (3.0 - 2.0 * f);
          return mix(mix(hash(i), hash(i + vec2(1, 0)), u.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), u.x), u.y);
        }
        void main() {
          vec3 v = normalize(vW - cameraPosition);
          // el ángulo con la vertical, sobre la normal movida por las olas: dentro de la ventana de
          // Snell (~49°) pasa la luz de arriba; fuera, reflexión total (oscuro)
          float up = dot(v, vN);
          float win = smoothstep(0.62, 0.72, up);
          // la luz de arriba, temblando: el rojo del pentagrama, a manchas que se mueven con el agua
          float sh = noise(vW.xz * 3.0 + vN.xz * 6.0 + uTime * 0.2) * 0.6 + noise(vW.xz * 7.0 - uTime * 0.35) * 0.4;
          vec3 through = uRed * (0.25 + 0.75 * sh) * 0.55 + uCold * 0.3;
          // reflejo: el fondo oscuro, y la luz de arriba bailando en líneas que se mueven con las olas
          // (las rizaduras pequeñas, encima del oleaje, deciden dónde)
          vec2 q = vW.xz * 5.0 + vN.xz * 9.0;
          float rip = noise(q + vec2(uTime * 0.5, -uTime * 0.3)) - noise(q * 1.7 - vec2(uTime * 0.4, uTime * 0.6));
          float lines = pow(max(0.0, 1.0 - abs(rip)), 14.0);
          vec3 mirror = uCold * 0.07 + uRed * 0.32 * lines + uCold * 0.2 * lines;
          vec3 c = mix(mirror, through, win);
          // se pierde en el agua con la distancia, hasta el mismo tono del fondo
          float far = exp(-length(vW - cameraPosition) * 0.35);
          gl_FragColor = vec4(mix(uMurk, c * uFade, far), 1.0);
        }`,
    }),
  );
  sheet.position.y = y;
  group.add(sheet);

  // los haces: planos altos que bajan desde la superficie, más claros arriba, con bordes suaves
  const beamMat = new THREE.ShaderMaterial({
    uniforms,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
    vertexShader: `
      varying vec2 vUv;
      void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `
      uniform float uTime, uFade; uniform vec3 uRed, uCold; varying vec2 vUv;
      void main() {
        // más claro arriba pero sin borde: nace suave bajo la superficie y se pierde hacia abajo
        // (bases de pow nunca negativas: en Windows darían NaN, que el bloom pinta como cuadrados negros)
        float a = pow(max(vUv.y, 0.0), 1.6) * (1.0 - smoothstep(0.85, 1.0, vUv.y)) * pow(max(sin(3.14159 * vUv.x), 0.0), 4.0);
        a *= 0.75 + 0.25 * sin(uTime * 0.6 + vUv.y * 4.0);
        gl_FragColor = vec4(mix(uCold, uRed * 0.5, 0.5) * a * 0.07 * uFade, 1.0);
      }`,
  });
  const beams: { m: THREE.Mesh; base: number; ph: number }[] = [];
  const spots: [number, number, number][] = [[-1.4, -1.6, 0.4], [-0.4, -2.4, 0.3], [0.8, -1.9, 0.5], [1.8, -2.8, 0.35], [0.1, -3.4, 0.6]];
  for (const [x, z, w] of spots) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, 8).translate(0, -4, 0), beamMat);
    m.position.set(x, y, z);
    m.rotation.z = x * -0.06; // abiertos en abanico, como la luz que entra por arriba
    group.add(m);
    beams.push({ m, base: m.rotation.z, ph: x * 2.1 + z });
  }

  return {
    group,
    /** `depth`: lo que está la cámara por debajo de la superficie; cuanto más abajo, más tenue. */
    update(t: number, depth: number, still: boolean) {
      uniforms.uTime.value = still ? 0 : t;
      uniforms.uFade.value = Math.exp(-Math.max(0, depth - 0.5) * 0.3);
      if (!still) for (const b of beams) b.m.rotation.z = b.base + Math.sin(t * 0.25 + b.ph) * 0.04;
    },
  };
}
