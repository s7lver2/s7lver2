import * as THREE from 'three';

/*
 * La niebla a ras de suelo: unas capas horizontales finas, con ruido que deriva despacio, que se
 * desvanecen cerca de la cámara (en el contrapicado está metida en ellas) y lejos, donde ya manda
 * la bruma de la escena. Mallas transparentes con su shader: no son luces, no recompilan nada.
 */
export function makeMist(o: { radius: number; reduced: boolean }) {
  const mat = new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uColor: { value: new THREE.Color(0x4a4e5c) } },
    transparent: true,
    depthWrite: false,
    vertexShader: `
      varying vec3 vW;
      void main() {
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vW = wp.xyz;
        gl_Position = projectionMatrix * viewMatrix * wp;
      }`,
    fragmentShader: `
      uniform float uTime; uniform vec3 uColor; varying vec3 vW;
      float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float noise(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
        return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y); }
      float fbm(vec2 p) { float a = 0.5, s = 0.0; for (int i = 0; i < 4; i++) { s += a * noise(p); p *= 2.1; a *= 0.5; } return s; }
      void main() {
        vec2 p = vW.xz * 0.35 + vec2(uTime * 0.05, uTime * 0.02) + vW.y * 7.0;
        float d = fbm(p) * fbm(p * 0.5 - uTime * 0.03);
        // ni pegada a la cámara ni más allá del círculo
        float near = smoothstep(0.4, 2.2, distance(vW, cameraPosition));
        float far = 1.0 - smoothstep(8.0, 16.0, length(vW.xz));
        gl_FragColor = vec4(uColor, smoothstep(0.12, 0.5, d) * 0.32 * near * far);
      }`,
  });
  const group = new THREE.Group();
  for (const y of [0.03, 0.1, 0.19]) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(o.radius * 2, o.radius * 2).rotateX(-Math.PI / 2), mat);
    m.position.y = y;
    m.renderOrder = 4;
    group.add(m);
  }
  return {
    group,
    update(t: number) {
      mat.uniforms.uTime.value = o.reduced ? 0 : t;
    },
    dispose() {
      group.traverse((x) => (x as THREE.Mesh).geometry?.dispose());
      mat.dispose();
    },
  };
}
