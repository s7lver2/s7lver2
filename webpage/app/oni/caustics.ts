import * as THREE from 'three';

/*
 * Cáusticas: la red de luz que deja la superficie del agua al refractar, pintada en una textura que
 * proyecta un foco (SpotLight.map), como las gotas del cristal de la habitación. Celdas de Voronoi
 * deformadas y en movimiento: la luz se junta en los bordes y deja huecos oscuros en medio.
 */
const QUAD_VS = `varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;

export function makeCaustics(renderer: THREE.WebGLRenderer, size = 256) {
  const rt = new THREE.WebGLRenderTarget(size, size);
  const mat = new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 } },
    vertexShader: QUAD_VS,
    fragmentShader: `
      uniform float uTime; varying vec2 vUv;
      vec2 h2(vec2 p) { p = vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3))); return fract(sin(p) * 43758.5453); }
      // distancia al borde de la celda más cercana
      float edge(vec2 p, float t) {
        vec2 i = floor(p), f = fract(p);
        float d1 = 8.0, d2 = 8.0;
        for (int y = -1; y <= 1; y++) for (int x = -1; x <= 1; x++) {
          vec2 g = vec2(x, y), o = 0.5 + 0.45 * sin(t + 6.2831 * h2(i + g));
          float d = length(g + o - f);
          if (d < d1) { d2 = d1; d1 = d; } else if (d < d2) d2 = d;
        }
        return d2 - d1;
      }
      void main() {
        vec2 p = vUv * 12.0;
        p += 0.25 * vec2(sin(p.y * 1.7 + uTime * 0.6), cos(p.x * 1.3 + uTime * 0.5));
        float c = pow(1.0 - smoothstep(0.0, 0.16, edge(p, uTime * 0.7)), 2.0);
        c += 0.6 * pow(1.0 - smoothstep(0.0, 0.12, edge(p * 1.7 + 3.1, uTime * 0.9)), 2.0);
        gl_FragColor = vec4(vec3(0.12 + c * 1.4), 1.0);
      }`,
  });
  const scene = new THREE.Scene().add(new THREE.Mesh(new THREE.PlaneGeometry(1, 1), mat));
  const cam = new THREE.OrthographicCamera(-0.5, 0.5, 0.5, -0.5, 0, 1);
  return {
    texture: rt.texture,
    update(t: number) {
      mat.uniforms.uTime.value = t;
      const prev = renderer.getRenderTarget();
      renderer.setRenderTarget(rt);
      renderer.render(scene, cam);
      renderer.setRenderTarget(prev);
    },
    dispose() {
      rt.dispose();
      mat.dispose();
    },
  };
}
