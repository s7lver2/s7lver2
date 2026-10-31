import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { Reflector } from 'three/examples/jsm/objects/Reflector.js';

/*
 * El ático: la cena es en lo alto de una torre. Detrás de la mesa, un ventanal de suelo a techo
 * partido por pilares de mármol negro (de ellos cuelgan los cuadros de los logros) y, al otro lado
 * del cristal mojado, la ciudad de noche: torres con ventanas encendidas y neones, desenfocada como
 * por una lente abierta. El suelo es mármol negro pulido que refleja lo que tiene delante.
 */

/** El plano del cristal (z) y dónde van los pilares (x), de ancho PILLAR_W. */
export const GLASS = -2.1;
export const PILLARS = [-2.45, -0.95, 0.95, 2.45], PILLAR_W = 0.55, PILLAR_D = 0.45;
/** La cara de delante de los pilares, donde se cuelgan los cuadros. */
export const PILLAR_FRONT = GLASS + PILLAR_D / 2;
/** Lo alto del ventanal; el techo va justo encima del dintel. */
export const H = 4.2, CEIL = H + 0.1;
/** Lo ancho del ventanal (y del ático): la cámara se aleja mucho y no se le deben ver los bordes. */
const WIDE = 19;

const rnd = (() => {
  let s = 12345;
  return () => (s = (s * 16807) % 2147483647) / 2147483647;
})();

/** La ciudad, pintada en un lienzo: cielo con la bruma roja de la ciudad, tres capas de torres y neones. */
function city() {
  const W = 2048, Hc = 768, c = Object.assign(document.createElement('canvas'), { width: W, height: Hc });
  const x = c.getContext('2d')!;
  const sky = x.createLinearGradient(0, 0, 0, Hc);
  sky.addColorStop(0, '#040203');
  sky.addColorStop(0.55, '#1a0706');
  sky.addColorStop(1, '#2c0d08');
  x.fillStyle = sky;
  x.fillRect(0, 0, W, Hc);
  // tres capas de torres, de lejos a cerca: más oscuras, más altas y con menos ventanas encendidas
  const layers = [
    { top: 0.42, body: '#12080a', lit: 0.16, win: 3 },
    { top: 0.3, body: '#0b0507', lit: 0.12, win: 4 },
    { top: 0.18, body: '#060304', lit: 0.09, win: 5 },
  ];
  for (const L of layers) {
    for (let bx = -40; bx < W; ) {
      const w = 50 + rnd() * 150, top = Hc * (L.top + rnd() * 0.3);
      x.fillStyle = L.body;
      x.fillRect(bx, top, w, Hc - top);
      // las ventanas: una rejilla, unas pocas encendidas (ámbar, blanco frío apagado o rojo)
      for (let wy = top + 8; wy < Hc; wy += L.win * 2.4)
        for (let wx = bx + 5; wx < bx + w - 5; wx += L.win * 2)
          if (rnd() < L.lit) {
            const k = rnd();
            x.fillStyle = k < 0.6 ? `rgba(255, 178, 107, ${0.4 + rnd() * 0.5})` : k < 0.9 ? `rgba(214, 222, 226, ${0.25 + rnd() * 0.3})` : 'rgba(255, 60, 40, 0.8)';
            x.fillRect(wx, wy, L.win, L.win * 1.4);
          }
      bx += w + rnd() * 12;
    }
  }
  // los neones: letreros verticales en rojo y ámbar, con su halo
  x.textAlign = 'center';
  x.textBaseline = 'middle';
  const signs = '鬼酒夜銀死赤影';
  for (let i = 0; i < 9; i++) {
    const nx = rnd() * W, ny = Hc * (0.35 + rnd() * 0.4), col = rnd() < 0.7 ? '#ff3b2f' : '#ff9a3c';
    x.shadowColor = col;
    x.shadowBlur = 24;
    x.fillStyle = col;
    x.font = `700 ${22 + rnd() * 18}px "Yu Gothic", "Meiryo", "Noto Sans JP", sans-serif`;
    for (let j = 0; j < 3; j++) x.fillText(signs[(i + j) % signs.length], nx, ny + j * 30);
  }
  x.shadowBlur = 0;
  // desenfocada: la lente está a foco en la mesa; las luces se abren en círculos (bokeh)
  const out = Object.assign(document.createElement('canvas'), { width: W, height: Hc });
  const o = out.getContext('2d')!;
  o.filter = 'blur(5px)';
  o.drawImage(c, 0, 0);
  o.filter = 'none';
  o.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 140; i++) {
    const k = rnd(), r = 6 + rnd() * 18;
    o.fillStyle = k < 0.65 ? 'rgba(255, 150, 90, 0.08)' : 'rgba(255, 50, 35, 0.1)';
    o.beginPath();
    o.arc(rnd() * W, Hc * (0.3 + rnd() * 0.7), r, 0, Math.PI * 2);
    o.fill();
  }
  const t = new THREE.CanvasTexture(out);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** El cielo de noche sobre la ciudad: negro arriba y, abajo, el rojo sucio de sus luces. */
function haze() {
  const c = Object.assign(document.createElement('canvas'), { width: 4, height: 256 });
  const x = c.getContext('2d')!, g = x.createLinearGradient(0, 0, 0, 256);
  g.addColorStop(0, '#020101');
  g.addColorStop(0.6, '#0b0303');
  g.addColorStop(0.85, '#2a0806');
  g.addColorStop(1, '#3a0d08');
  x.fillStyle = g;
  x.fillRect(0, 0, 4, 256);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** Mármol negro: fondo casi negro con vetas finas y claras que se cruzan. */
function marble() {
  const S = 1024, c = Object.assign(document.createElement('canvas'), { width: S, height: S });
  const x = c.getContext('2d')!;
  x.fillStyle = '#0a0808';
  x.fillRect(0, 0, S, S);
  for (let i = 0; i < 26; i++) {
    x.strokeStyle = `rgba(200, 180, 170, ${0.04 + rnd() * 0.1})`;
    x.lineWidth = 0.6 + rnd() * 1.8;
    x.beginPath();
    let px = rnd() * S, py = rnd() * S;
    x.moveTo(px, py);
    for (let j = 0; j < 6; j++) {
      const nx = px + (rnd() - 0.3) * 300, ny = py + (rnd() - 0.5) * 300;
      x.quadraticCurveTo((px + nx) / 2 + (rnd() - 0.5) * 120, (py + ny) / 2 + (rnd() - 0.5) * 120, nx, ny);
      (px = nx), (py = ny);
    }
    x.stroke();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

/** El cristal mojado: gotas que resbalan dejando su rastro, en capas; casi transparente. */
function rain() {
  return new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 } },
    transparent: true,
    depthWrite: false,
    vertexShader: `varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `
      uniform float uTime; varying vec2 vUv;
      float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float drops(vec2 uv, float t, float scale) {
        vec2 g = uv * vec2(scale, scale * 0.45);
        vec2 id = floor(g), f = fract(g) - 0.5;
        float h = hash(id);
        // cada celda: una gota que baja a tirones (lenta, luego rápida) y su rastro hacia arriba
        float y = fract(-t * (0.04 + h * 0.06) + h);
        y = y * y * (3.0 - 2.0 * y) - 0.5;
        float x = (h - 0.5) * 0.6 + sin(g.y * 3.0 + h * 6.0) * 0.05;
        vec2 d = (f - vec2(x, y)) * vec2(1.0, 0.45);
        float drop = smoothstep(0.06, 0.03, length(d));
        float trail = smoothstep(0.035, 0.0, abs(f.x - x)) * smoothstep(-0.05, 0.4, f.y - y) * step(y, f.y) * 0.35;
        return (drop + trail) * step(0.45, h);
      }
      void main() {
        float a = drops(vUv * vec2(1.9, 1.0), uTime, 30.0) + drops(vUv * vec2(1.9, 1.0) + 0.37, uTime * 1.3, 48.0) * 0.7;
        gl_FragColor = vec4(vec3(1.0, 0.86, 0.8), a * 0.1);
      }`,
  });
}

/** `low`: sin el espejo del suelo (vuelve a pintar la escena entera cada fotograma). */
export function makePenthouse(low: boolean) {
  const g = new THREE.Group();
  /*
   * el suelo: mármol negro pulido. Debajo, un espejo (a media resolución) con la sala de verdad
   * reflejada: los focos, los robots, la ciudad; encima, el mármol, casi opaco, que lo apaga y le da
   * la veta. Sin espejo, solo el reflejo del entorno
   */
  const mt = marble();
  mt.repeat.set(6, 4);
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(30, 24),
    new THREE.MeshStandardMaterial({ map: mt, roughness: 0.18, metalness: 0.0, transparent: !low, opacity: 0.8 }),
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.z = 4;
  floor.receiveShadow = true;
  let mirror: Reflector | undefined;
  if (!low) {
    const w = Math.round(innerWidth * 0.5), h = Math.round(innerHeight * 0.5);
    mirror = new Reflector(new THREE.PlaneGeometry(30, 24), { textureWidth: w, textureHeight: h, color: 0x6a6262 });
    mirror.rotation.x = -Math.PI / 2;
    mirror.position.set(0, -0.002, 4);
    g.add(mirror);
  }
  g.add(floor);
  // el techo: negro mate, con las latas de los focos colgando
  const ceil = new THREE.Mesh(new THREE.PlaneGeometry(30, 24), new THREE.MeshStandardMaterial({ color: 0x050404, roughness: 0.9 }));
  ceil.rotation.x = Math.PI / 2;
  ceil.position.set(0, CEIL, 4);
  g.add(ceil);
  const can = new THREE.MeshStandardMaterial({ color: 0x0c0a0a, roughness: 0.4, metalness: 0.8 });
  for (const x of [-2.1, 0, 2.1]) {
    const c = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.14, 0.26, 20, 1, true), can);
    c.position.set(x, CEIL - 0.13, 0.6);
    g.add(c);
  }

  // el cielo detrás de la ciudad: casi negro, con la bruma roja de la ciudad abajo (sin niebla: es luz)
  const tex = city();
  const sky = new THREE.Mesh(new THREE.PlaneGeometry(700, 220), new THREE.MeshBasicMaterial({ map: haze(), fog: false, toneMapped: false }));
  sky.position.set(0, 30, GLASS - 250);
  const skyMat = sky.material as THREE.MeshBasicMaterial;
  g.add(sky);

  // los pilares (mármol negro con su veta) y el marco del ventanal: el alféizar y el dintel
  const stone = new THREE.MeshStandardMaterial({ map: mt, roughness: 0.22, metalness: 0.0, color: 0xbfb2ac });
  const metal = new THREE.MeshStandardMaterial({ color: 0x1a1414, roughness: 0.35, metalness: 0.9 });
  const add = (geo: THREE.BufferGeometry, m: THREE.Material, x: number, y: number, z: number) => {
    const o = new THREE.Mesh(geo, m);
    o.position.set(x, y, z);
    o.castShadow = o.receiveShadow = true;
    g.add(o);
    return o;
  };
  for (const px of [...PILLARS, -4.2, 4.2, -6, 6, -7.8, 7.8]) add(new RoundedBoxGeometry(PILLAR_W, H, PILLAR_D, 3, 0.03), stone, px, H / 2, GLASS);
  add(new RoundedBoxGeometry(WIDE, 0.12, 0.3, 2, 0.02), metal, 0, 0.06, GLASS);
  add(new RoundedBoxGeometry(WIDE, 0.2, 0.36, 2, 0.02), metal, 0, H, GLASS);
  // los montantes finos que parten cada paño del ventanal a lo alto
  for (const px of [-3.3, -1.7, 0, 1.7, 3.3, -5.1, 5.1, -6.9, 6.9]) add(new THREE.BoxGeometry(0.035, H, 0.06), metal, px, H / 2, GLASS);

  // el cristal con la lluvia
  const glass = new THREE.Mesh(new THREE.PlaneGeometry(WIDE, H), rain());
  glass.position.set(0, H / 2, GLASS - 0.01);
  glass.renderOrder = 1;
  g.add(glass);
  return {
    group: g,
    mirror,
    /** `flash`: el relámpago (0-1), que enciende el cielo. */
    update(t: number, reduced: boolean, flash = 0) {
      (glass.material as THREE.ShaderMaterial).uniforms.uTime.value = reduced ? 0 : t;
      skyMat.color.setScalar(1 + flash * 5);
    },
    /** El entorno de los reflejos: la ciudad detrás, oscuro alrededor y el calor de los focos arriba. */
    environment(r: THREE.WebGLRenderer) {
      const env = new THREE.Scene();
      env.background = new THREE.Color(0x050303);
      const v = new THREE.Mesh(new THREE.PlaneGeometry(40, 16), new THREE.MeshBasicMaterial({ map: tex }));
      v.position.set(0, 2, -10);
      const warm = new THREE.Mesh(new THREE.PlaneGeometry(6, 2), new THREE.MeshBasicMaterial({ color: 0xffb070 }));
      warm.position.set(0, 8, 0);
      warm.rotation.x = Math.PI / 2;
      env.add(v, warm);
      const pm = new THREE.PMREMGenerator(r);
      const out = pm.fromScene(env, 0.02).texture;
      pm.dispose();
      return out;
    },
  };
}
