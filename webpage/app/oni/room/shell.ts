import * as THREE from 'three';
import { canvas, crack, normalFrom, seeded, tex } from './surfaces';

/*
 * La caja de la sala: suelo y paredes de cemento con su textura, la pared del fondo con dos
 * ventanas recortadas a los lados del muro de teles, lluvia en el cristal (gotas que resbalan
 * sobre la ciudad desenfocada) y la luz de la calle entrando por ellas con la sombra de la
 * lluvia en el suelo.
 */

type Tick = (t: number, dt: number) => void;
const rnd = (a: number, b: number) => a + Math.random() * (b - a);

// cemento: color, relieve y brillo salen del mismo ruido. En el suelo, losas con la junta
// biselada, grietas, poros y manchas de humedad que brillan (ahí se refleja la ventana)
function concrete(size: number, base: [number, number, number], tiles: boolean, repeat: [number, number]) {
  const c = canvas(size), hc = canvas(size), rc = canvas(size);
  const x = c.getContext('2d')!, h = hc.getContext('2d')!, r = rc.getContext('2d')!;
  const img = x.createImageData(size, size), d = img.data;
  const himg = h.createImageData(size, size), hd = himg.data;
  const blot = new Float32Array(64 * 64).map(() => Math.random());
  const smooth = (u: number, v: number) => {
    const X = u * 63, Y = v * 63, i = X | 0, j = Y | 0, fx = X - i, fy = Y - j;
    const g = (a: number, b: number) => blot[((b % 64) * 64 + (a % 64)) | 0];
    return g(i, j) * (1 - fx) * (1 - fy) + g(i + 1, j) * fx * (1 - fy) + g(i, j + 1) * (1 - fx) * fy + g(i + 1, j + 1) * fx * fy;
  };
  for (let y = 0; y < size; y++)
    for (let xx = 0; xx < size; xx++) {
      const m = smooth(xx / size, y / size), grain = Math.random() - 0.5;
      const k = 0.78 + m * 0.35 + grain * 0.12;
      const o = (y * size + xx) * 4;
      d[o] = base[0] * k;
      d[o + 1] = base[1] * k;
      d[o + 2] = base[2] * k;
      d[o + 3] = 255;
      const hv = 150 + m * 40 + grain * 26;
      hd[o] = hd[o + 1] = hd[o + 2] = hv;
      hd[o + 3] = 255;
    }
  x.putImageData(img, 0, 0);
  h.putImageData(himg, 0, 0);
  r.fillStyle = tiles ? '#c8c8c8' : '#ececec';
  r.fillRect(0, 0, size, size);
  // manchas de humedad: más oscuras y, en el suelo, casi lisas
  for (let i = 0; i < 14; i++) {
    const rad = rnd(size * 0.04, size * 0.16), px = rnd(0, size), py = rnd(0, size), sy = rnd(0.6, 2.2);
    for (const [ctx, col] of [[x, '0,0,0,0.28'], [r, tiles ? '40,40,40,0.75' : '120,120,120,0.4']] as const) {
      const g = ctx.createRadialGradient(0, 0, 0, 0, 0, rad);
      g.addColorStop(0, `rgba(${col})`);
      g.addColorStop(1, `rgba(${col.replace(/[d.]+$/, '0')})`);
      ctx.save();
      ctx.translate(px, py);
      ctx.scale(1, sy);
      ctx.fillStyle = g;
      ctx.fillRect(-rad, -rad, rad * 2, rad * 2);
      ctx.restore();
    }
  }
  // poros: puntitos hundidos
  h.fillStyle = 'rgba(40,40,40,0.8)';
  for (let i = 0; i < size * 3; i++) h.fillRect(rnd(0, size), rnd(0, size), rnd(1, 2.5), rnd(1, 2.5));
  if (tiles) {
    // las juntas: un surco con bisel (en la altura, degradado; en el color, oscuro y mate)
    const step = size / 4;
    for (let p = 0; p <= size; p += step)
      for (const [w, a] of [[14, 0.25], [8, 0.5], [4, 0.9]]) {
        h.strokeStyle = `rgba(0,0,0,${a})`;
        h.lineWidth = w;
        h.beginPath();
        h.moveTo(p, 0);
        h.lineTo(p, size);
        h.moveTo(0, p);
        h.lineTo(size, p);
        h.stroke();
      }
    x.strokeStyle = 'rgba(0,0,0,0.6)';
    x.lineWidth = 3;
    r.strokeStyle = '#ffffff';
    r.lineWidth = 6;
    for (const ctx of [x, r]) {
      ctx.beginPath();
      for (let p = 0; p <= size; p += step) {
        ctx.moveTo(p, 0);
        ctx.lineTo(p, size);
        ctx.moveTo(0, p);
        ctx.lineTo(size, p);
      }
      ctx.stroke();
    }
    // grietas que salen de alguna junta, y alguna esquina de losa desconchada
    for (let i = 0; i < 9; i++) {
      const px = Math.round(rnd(0, 4)) * step, py = rnd(0, size);
      const len = rnd(size * 0.05, size * 0.22), seed = 1 + ((Math.random() * 1e9) | 0);
      for (const [ctx, col, lw] of [[h, 'rgba(0,0,0,0.85)', 2.2], [x, 'rgba(0,0,0,0.5)', 1.2]] as const) {
        ctx.strokeStyle = col;
        ctx.lineWidth = lw;
        // la mitad salen de una junta vertical y la otra mitad de una horizontal
        crack(ctx, i % 2 ? px : py, i % 2 ? py : px, len, 6, 1, seeded(seed));
      }
    }
    for (let i = 0; i < 6; i++) {
      const cx = Math.round(rnd(0, 4)) * step, cy = Math.round(rnd(0, 4)) * step, rad = rnd(6, 16);
      h.fillStyle = 'rgba(0,0,0,0.6)';
      x.fillStyle = 'rgba(70,62,58,0.5)';
      for (const ctx of [h, x]) {
        ctx.beginPath();
        ctx.arc(cx, cy, rad, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }
  return {
    map: tex(c, repeat, true),
    normalMap: normalFrom(hc, tiles ? 3.2 : 1.6, repeat),
    roughnessMap: tex(rc, repeat, false),
  };
}

// la ciudad de noche detrás del cristal: cielo, edificios con alguna ventana encendida y farolas
function city() {
  const c = Object.assign(document.createElement('canvas'), { width: 512, height: 512 });
  const x = c.getContext('2d')!;
  const sky = x.createLinearGradient(0, 0, 0, 512);
  sky.addColorStop(0, '#120a09');
  sky.addColorStop(0.6, '#4a1a14');
  sky.addColorStop(1, '#1e0c0a');
  x.fillStyle = sky;
  x.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 9; i++) {
    const w = rnd(40, 110), h = rnd(120, 360), bx = rnd(-20, 500);
    x.fillStyle = '#0c0808';
    x.fillRect(bx, 512 - h, w, h);
    for (let wy = 512 - h + 10; wy < 500; wy += 14)
      for (let wx = bx + 6; wx < bx + w - 8; wx += 12)
        if (Math.random() < 0.16) {
          x.fillStyle = Math.random() < 0.25 ? '#c4221a' : '#d8d2c8';
          x.fillRect(wx, wy, 5, 7);
        }
  }
  for (let i = 0; i < 6; i++) {
    const g = x.createRadialGradient(0, 0, 0, 0, 0, 40);
    g.addColorStop(0, 'rgba(255,190,150,0.5)');
    g.addColorStop(1, 'rgba(255,190,150,0)');
    x.save();
    x.translate(rnd(0, 512), rnd(330, 470));
    x.fillStyle = g;
    x.fillRect(-40, -40, 80, 80);
    x.restore();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.generateMipmaps = true;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  return t;
}

// el cristal con lluvia: gotas quietas, gotas que resbalan dejando reguero, y la ciudad
// desenfocada vista a través de cada gota
const glassFrag = /* glsl */ `
uniform sampler2D tCity;
uniform float uTime, uMove;
uniform vec2 uAspect;
varying vec2 vUv;
float h(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
// una capa de gotas en rejilla: cada celda tiene una gota que cae a su ritmo
vec3 drops(vec2 uv, float scale, float t) {
  vec2 g = uv * scale * uAspect;
  g.y += t * 0.25;
  vec2 id = floor(g), f = fract(g) - 0.5;
  float n = h(id);
  float y = fract(t * (0.15 + n * 0.35) + n) ;
  vec2 p = vec2((n - 0.5) * 0.6, 0.5 - y * 1.1);
  vec2 d = f - p;
  float drop = smoothstep(0.09, 0.05, length(d * vec2(1.0, 0.8)));
  float trail = smoothstep(0.035, 0.0, abs(f.x - p.x)) * smoothstep(p.y, 0.5, f.y) * step(p.y, f.y) * 0.5;
  return vec3(d * drop, max(drop, trail));
}
void main() {
  float t = uTime * uMove;
  vec3 a = drops(vUv, 9.0, t), b = drops(vUv + 0.37, 14.0, t * 1.3);
  float still = smoothstep(0.92, 1.0, h(floor(vUv * uAspect * 60.0))) ;
  vec2 off = (a.xy + b.xy) * 0.6;
  float wet = max(max(a.z, b.z), still * 0.7);
  // fuera la ciudad está desenfocada; dentro de cada gota, enfocada y del revés
  vec3 blur = texture2D(tCity, vUv, 4.0).rgb;
  vec3 sharp = texture2D(tCity, vUv + off * 3.0 - vec2(0.0, 0.02) * wet).rgb;
  vec3 col = mix(blur, sharp * 1.25, wet) * 1.5 + wet * 0.035;
  gl_FragColor = vec4(col, 1.0);
}`;

/** Sombras de lluvia para la luz que entra por la ventana (un lienzo que se repinta). */
function rainCookie() {
  const c = Object.assign(document.createElement('canvas'), { width: 256, height: 256 });
  const x = c.getContext('2d')!;
  const drops = Array.from({ length: 70 }, () => ({ x: rnd(0, 256), y: rnd(0, 256), v: rnd(10, 60), r: rnd(1.5, 4) }));
  const tex = new THREE.CanvasTexture(c);
  const draw = (dt: number) => {
    x.fillStyle = '#d8d8d8';
    x.fillRect(0, 0, 256, 256);
    // el marco de la ventana: cruz oscura
    x.fillStyle = '#000';
    x.fillRect(122, 0, 12, 256);
    x.fillRect(0, 122, 256, 12);
    x.fillRect(0, 0, 256, 8);
    x.fillRect(0, 248, 256, 8);
    x.fillRect(0, 0, 8, 256);
    x.fillRect(248, 0, 8, 256);
    x.fillStyle = 'rgba(0,0,0,0.55)';
    for (const d of drops) {
      d.y += d.v * dt;
      if (d.y > 262) {
        d.y = -6;
        d.x = rnd(0, 256);
      }
      x.beginPath();
      x.ellipse(d.x, d.y, d.r, d.r * 1.3, 0, 0, Math.PI * 2);
      x.fill();
      x.fillRect(d.x - 0.6, d.y - d.v * 0.25, 1.2, d.v * 0.25);
    }
    tex.needsUpdate = true;
  };
  draw(0);
  return { tex, draw };
}

export function buildShell(scene: THREE.Scene, renderer: THREE.WebGLRenderer, b: { x0: number; x1: number; back: number; front: number; ceil: number }, reduced: boolean) {
  const ticks: Tick[] = [];
  const { x0, x1, back, front, ceil } = b;
  const w = x1 - x0, d = front - back;

  const floorMat = new THREE.MeshStandardMaterial({ ...concrete(1024, [34, 29, 27], true, [w / 4, d / 4]), roughness: 1, metalness: 0.05 });
  floorMat.userData.env = 1; // los charcos reflejan las teles (la escena pone el entorno)
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(w, d), floorMat);
  floor.rotation.x = -Math.PI / 2;
  floor.position.set((x0 + x1) / 2, 0, (back + front) / 2);
  floor.receiveShadow = true;
  scene.add(floor);

  const wallTex = concrete(512, [30, 25, 24], false, [1, 1]);
  const wallMat = (rx: number, ry: number) => {
    const m = new THREE.MeshStandardMaterial({ roughness: 1 });
    for (const k of ['map', 'normalMap', 'roughnessMap'] as const) {
      const t = (m[k] = wallTex[k].clone());
      t.repeat.set(rx, ry);
      t.needsUpdate = true;
    }
    return m;
  };
  const ceilMat = new THREE.MeshStandardMaterial({ color: 0x0f0c0b, roughness: 1 });
  const plane = (pw: number, ph: number, m: THREE.Material, pos: [number, number, number], ry: number, rx = 0) => {
    const p = new THREE.Mesh(new THREE.PlaneGeometry(pw, ph), m);
    p.position.set(...pos);
    p.rotation.set(rx, ry, 0);
    scene.add(p);
    return p;
  };
  plane(d, ceil, wallMat(d / 3, ceil / 3), [x0, ceil / 2, (back + front) / 2], Math.PI / 2);
  plane(d, ceil, wallMat(d / 3, ceil / 3), [x1, ceil / 2, (back + front) / 2], -Math.PI / 2);
  plane(w, ceil, wallMat(w / 3, ceil / 3), [(x0 + x1) / 2, ceil / 2, front], Math.PI);
  plane(w, d, ceilMat, [(x0 + x1) / 2, ceil, (back + front) / 2], 0, Math.PI / 2);

  // la pared del fondo, con dos huecos de ventana a los lados del muro de teles
  const WW = 1.25, WH = 1.45, WY = 0.95;
  const wins = [x0 + 1.1, x1 - 1.1];
  const shape = new THREE.Shape();
  shape.moveTo(x0, 0);
  shape.lineTo(x1, 0);
  shape.lineTo(x1, ceil);
  shape.lineTo(x0, ceil);
  for (const cx of wins) {
    const hole = new THREE.Path();
    hole.moveTo(cx - WW / 2, WY);
    hole.lineTo(cx - WW / 2, WY + WH);
    hole.lineTo(cx + WW / 2, WY + WH);
    hole.lineTo(cx + WW / 2, WY);
    shape.holes.push(hole);
  }
  const backGeo = new THREE.ShapeGeometry(shape);
  const uv = backGeo.attributes.uv as THREE.BufferAttribute;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) / 3, uv.getY(i) / 3);
  const backWall = new THREE.Mesh(backGeo, wallMat(1, 1));
  backWall.position.z = back;
  scene.add(backWall);

  // ventanas: marco metálico con cruz, alféizar, cristal con lluvia
  const frame = new THREE.MeshStandardMaterial({ color: 0x1a1817, roughness: 0.5, metalness: 0.6 });
  const glass = new THREE.ShaderMaterial({
    vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: glassFrag,
    uniforms: { tCity: { value: city() }, uTime: { value: 0 }, uMove: { value: reduced ? 0 : 1 }, uAspect: { value: new THREE.Vector2(WW / WH, 1) } },
  });
  for (const cx of wins) {
    const g = new THREE.Mesh(new THREE.PlaneGeometry(WW, WH), glass);
    g.position.set(cx, WY + WH / 2, back - 0.06);
    scene.add(g);
    const bar = (bw: number, bh: number, px: number, py: number) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(bw, bh, 0.08), frame);
      m.position.set(px, py, back - 0.03);
      scene.add(m);
    };
    bar(WW + 0.08, 0.05, cx, WY - 0.02);
    bar(WW + 0.08, 0.05, cx, WY + WH + 0.02);
    bar(0.05, WH, cx - WW / 2 - 0.02, WY + WH / 2);
    bar(0.05, WH, cx + WW / 2 + 0.02, WY + WH / 2);
    bar(0.035, WH, cx, WY + WH / 2);
    bar(WW, 0.035, cx, WY + WH * 0.55);
    const sill = new THREE.Mesh(new THREE.BoxGeometry(WW + 0.2, 0.04, 0.22), frame);
    sill.position.set(cx, WY - 0.04, back + 0.09);
    scene.add(sill);
  }
  ticks.push((t) => (glass.uniforms.uTime.value = t));

  // la luz de la calle entra por cada ventana con la sombra de la lluvia
  renderer.shadowMap.enabled = true;
  const cookie = rainCookie();
  for (const cx of wins) {
    const sp = new THREE.SpotLight(0xd9dde0, 18, 10, 0.5, 0.5, 1.4);
    sp.position.set(cx * 1.05, WY + WH + 0.9, back - 1.6);
    sp.target.position.set(cx * 0.75, 0, back + 2.2);
    sp.map = cookie.tex;
    sp.castShadow = true; // three solo aplica el `map` del foco con sombras activas
    sp.shadow.mapSize.set(256, 256);
    scene.add(sp, sp.target);
  }
  let acc = 0;
  ticks.push((_, dt) => {
    if (reduced) return;
    acc += dt;
    if (acc < 1 / 15) return;
    cookie.draw(acc);
    acc = 0;
  });
  return { ticks, wins };
}
