import * as THREE from 'three';

/*
 * La carta: un joker de dos caras, 63 × 88 mm.
 * - Cara: partida en diagonal. Arriba, papel con la máscara en tinta (ojos rojos); abajo, negro
 *   con la máscara en trama roja, girada como figura de naipe. JOKER en vertical en las esquinas.
 * - Dorso: negro con un mosaico de máscaras pequeñas en trama roja y un marco rojo.
 * La máscara sale del modelo de verdad: se pinta una vez con la gráfica en un lienzo por
 * tratamiento (tinta, trama) y luego todo se compone en 2D. Esquinas redondeadas y grano fino.
 */
const W = 630, H = 880, S = 640;
const RED = '#c9232a', BONE = '#ebe4dc', BLACK = '#0c0909';
// la diagonal de la cara: de (0, 58 %) a (100 %, 42 %)
const DL = H * 0.58, DR = H * 0.42;

const POST = /* glsl */ `
  uniform sampler2D t; uniform float mode, res; varying vec2 v;
  float lum(vec3 c) { return dot(c, vec3(0.299, 0.587, 0.114)); }
  float dots(float k, float cell) {
    vec2 f = fract(mat2(0.69, -0.72, 0.72, 0.69) * v * res / cell) - 0.5;
    return 1.0 - smoothstep(k * 0.62 - 0.05, k * 0.62 + 0.05, length(f));
  }
  void main() {
    vec4 s = texture2D(t, v);
    if (s.a < 0.5) { gl_FragColor = vec4(0.0); return; }
    float l = lum(s.rgb);
    bool eye = s.r > 0.35 && s.r > s.g * 2.2;
    if (mode < 0.5) {
      // tinta: negro en la sombra, trama en los medios, el papel donde da la luz; ojos rojos
      if (eye) { gl_FragColor = vec4(0.78, 0.1, 0.12, 1.0); return; }
      gl_FragColor = vec4(0.06, 0.04, 0.05, l < 0.14 ? 1.0 : dots(smoothstep(0.6, 0.14, l), 6.0));
    } else {
      // trama roja sobre negro: la luz se vuelve puntos rojos; ojos blancos
      if (eye) { gl_FragColor = vec4(1.0, 0.93, 0.9, 1.0); return; }
      gl_FragColor = vec4(0.85, 0.13, 0.16, l > 0.82 ? 1.0 : dots(smoothstep(0.1, 0.82, l), 5.0));
    }
  }`;

// la máscara en sus dos tratamientos, en lienzos transparentes de S × S
function maskImages(face: THREE.Object3D, r: THREE.WebGLRenderer) {
  const m = face.clone(true);
  m.position.set(0, 0, 0);
  m.rotation.set(0, Math.PI, 0);
  m.scale.setScalar(1);
  m.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(m), k = 2.6 / Math.max(...box.getSize(new THREE.Vector3()).toArray());
  m.scale.setScalar(k);
  m.position.sub(box.getCenter(new THREE.Vector3()).multiplyScalar(k));
  const scene = new THREE.Scene(), cam = new THREE.PerspectiveCamera(26, 1, 0.1, 50);
  cam.position.set(0, 0, 6.4);
  const key = new THREE.DirectionalLight(0xffffff, 7);
  key.position.set(-3, 2.5, 4);
  scene.add(m, key, new THREE.AmbientLight(0xffffff, 1.4));
  const rt = new THREE.WebGLRenderTarget(S, S, { samples: 4 }), out = new THREE.WebGLRenderTarget(S, S);
  const post = new THREE.ShaderMaterial({
    uniforms: { t: { value: rt.texture }, mode: { value: 0 }, res: { value: S } },
    vertexShader: 'varying vec2 v; void main() { v = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
    fragmentShader: POST,
  });
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), post), qs = new THREE.Scene(), qc = new THREE.Camera();
  qs.add(quad);
  const prev = r.getRenderTarget(), cc = r.getClearColor(new THREE.Color()), ca = r.getClearAlpha(), shadows = r.shadowMap.enabled;
  r.shadowMap.enabled = false;
  r.setClearColor(0x000000, 0);
  r.setRenderTarget(rt);
  r.clear();
  r.render(scene, cam);
  const px = new Uint8Array(S * S * 4);
  const images = [0, 1].map((mode) => {
    post.uniforms.mode.value = mode;
    r.setRenderTarget(out);
    r.clear();
    r.render(qs, qc);
    r.readRenderTargetPixels(out, 0, 0, S, S, px);
    // la gráfica lee de abajo arriba: se le da la vuelta al pasarlo al lienzo
    const c = Object.assign(document.createElement('canvas'), { width: S, height: S }), x = c.getContext('2d')!, img = x.createImageData(S, S);
    for (let y = 0; y < S; y++) img.data.set(px.subarray((S - 1 - y) * S * 4, (S - y) * S * 4), y * S * 4);
    x.putImageData(img, 0, 0);
    return c;
  });
  r.setRenderTarget(prev);
  r.setClearColor(cc, ca);
  r.shadowMap.enabled = shadows;
  rt.dispose();
  out.dispose();
  post.dispose();
  quad.geometry.dispose();
  return { ink: images[0], dots: images[1] };
}

function canvasFace(draw: (x: CanvasRenderingContext2D) => void) {
  const c = Object.assign(document.createElement('canvas'), { width: W, height: H }), x = c.getContext('2d', { willReadFrequently: true })!;
  x.beginPath();
  x.roundRect(0, 0, W, H, 34);
  x.clip();
  draw(x);
  // grano fino de papel encima de todo
  const img = x.getImageData(0, 0, W, H), d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const n = (Math.random() - 0.5) * 10;
    d[i] += n;
    d[i + 1] += n;
    d[i + 2] += n;
  }
  x.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

// la mitad de abajo de la diagonal (o la de arriba, con `top`)
function half(x: CanvasRenderingContext2D, top: boolean) {
  x.beginPath();
  if (top) x.moveTo(0, 0), x.lineTo(W, 0), x.lineTo(W, DR), x.lineTo(0, DL);
  else x.moveTo(0, DL), x.lineTo(W, DR), x.lineTo(W, H), x.lineTo(0, H);
  x.closePath();
}

export function makeCard(face: THREE.Object3D, renderer: THREE.WebGLRenderer) {
  const { ink, dots } = maskImages(face, renderer);
  const front = canvasFace((x) => {
    x.fillStyle = BONE;
    x.fillRect(0, 0, W, H);
    half(x, false);
    x.fillStyle = BLACK;
    x.fill();
    // arriba la tinta, recortada a su mitad
    x.save();
    half(x, true);
    x.clip();
    x.drawImage(ink, W / 2 - 180, 70, 360, 360);
    x.restore();
    // abajo la trama, girada como figura de naipe: más pequeña y más baja para que la diagonal no la corte
    x.save();
    half(x, false);
    x.clip();
    x.translate(W, H);
    x.rotate(Math.PI);
    x.drawImage(dots, W / 2 - 140, 92, 280, 280);
    x.restore();
    x.strokeStyle = RED;
    x.lineWidth = 3;
    x.beginPath();
    x.moveTo(0, DL);
    x.lineTo(W, DR);
    x.stroke();
    // JOKER en vertical, letra a letra, en las dos esquinas
    for (const flip of [false, true]) {
      x.save();
      if (flip) x.translate(W, H), x.rotate(Math.PI);
      x.fillStyle = RED;
      x.textAlign = 'center';
      x.font = '700 40px Georgia, "Times New Roman", serif';
      'JOKER'.split('').forEach((ch, i) => x.fillText(ch, 66, 100 + i * 42));
      x.restore();
    }
  });
  const back = canvasFace((x) => {
    x.fillStyle = BLACK;
    x.fillRect(0, 0, W, H);
    x.globalAlpha = 0.5;
    for (let j = 0; j < 9; j++) for (let i = 0; i < 6; i++) x.drawImage(dots, i * 116 - (j % 2) * 58, j * 104 - 20, 110, 110);
    x.globalAlpha = 1;
    x.strokeStyle = RED;
    x.lineWidth = 3;
    x.beginPath();
    x.roundRect(34, 34, W - 68, H - 68, 22);
    x.stroke();
  });
  const g = new THREE.PlaneGeometry(0.063, 0.088);
  // con un poco de luz propia: pegada a la lente, en lo alto y a oscuras, el joker tiene que leerse
  const mat = (map: THREE.Texture) => new THREE.MeshStandardMaterial({ map, roughness: 0.4, alphaTest: 0.5, emissiveMap: map, emissive: 0xffffff, emissiveIntensity: 0.22 });
  const mesh = new THREE.Mesh(g, mat(front));
  const rev = new THREE.Mesh(g, mat(back));
  rev.rotation.y = Math.PI;
  mesh.add(rev);
  return {
    mesh,
    dispose() {
      g.dispose();
      for (const m of [mesh.material, rev.material]) m.map?.dispose(), m.dispose();
    },
  };
}
