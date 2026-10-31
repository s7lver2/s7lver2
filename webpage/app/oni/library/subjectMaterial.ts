import * as THREE from 'three';

/*
 * El cuerpo del sujeto: negro, de dos materiales, como un robot de carcasa. Placas de laca negra
 * dura (antebrazos, manos, espinillas, pies, cuello, cabeza y el peto del pecho), que solo se ven
 * por el reflejo de las luces, y entre ellas una malla sintética mate, un tejido técnico de
 * rombos diminutos que coge la luz en el contorno. Donde se juntan, una junta fina hundida.
 *
 * Qué es placa sale del esqueleto: el peso de los huesos de placa en cada vértice. Como los pesos
 * se reparten en las articulaciones, el cambio cae en el codo, la rodilla o el cuello, igual que en
 * una carcasa real. El dibujo de la malla va pegado al cuerpo en reposo, así no resbala al moverse.
 */
const PLATES = /(ForeArm|Hand|Leg|Foot|ToeBase|Neck|Head)$/; // LeftLeg es la espinilla; UpLeg, el muslo, no
const CHEST = /Spine2$/;

// el atributo aPlate en la geometría, una vez (los clones la comparten): x, el peso de los huesos de
// placa; y, el del pecho, que el shader recorta luego por píxel a la cara de delante (por vértice, el
// borde del peto salía a trozos)
function markPlates(mesh: THREE.SkinnedMesh) {
  const g = mesh.geometry;
  if (g.getAttribute('aPlate')) return;
  const idx = g.getAttribute('skinIndex'), w = g.getAttribute('skinWeight');
  const names = mesh.skeleton.bones.map((b) => b.name);
  const plate = new Float32Array(idx.count * 2);
  for (let v = 0; v < idx.count; v++) {
    let k = 0, c = 0;
    for (let j = 0; j < 4; j++) {
      const get = (a: typeof idx) => [a.getX, a.getY, a.getZ, a.getW][j].call(a, v);
      const name = names[get(idx)] ?? '', wt = get(w);
      if (PLATES.test(name) && !/UpLeg$/.test(name)) k += wt;
      else if (CHEST.test(name)) c += wt;
    }
    plate[v * 2] = Math.min(1, k);
    plate[v * 2 + 1] = Math.min(1, c);
  }
  g.setAttribute('aPlate', new THREE.BufferAttribute(plate, 2));
  g.computeBoundingBox();
}

export function subjectMaterial(mesh: THREE.SkinnedMesh) {
  markPlates(mesh);
  const box = mesh.geometry.boundingBox!;
  const m = new THREE.MeshPhysicalMaterial({
    color: 0x000000, roughness: 1, metalness: 0, specularIntensity: 1,
    clearcoat: 1, clearcoatRoughness: 0.38,
    sheen: 0.6, sheenColor: 0x5a6680, sheenRoughness: 0.18,
  });
  // metros por unidad del modelo (el rig va en sus propias unidades)
  const unit = 1.8 / (box.max.y - box.min.y);
  m.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', `#include <common>
        attribute vec2 aPlate; varying vec2 vPlate; varying vec3 vRest; varying vec3 vRestN;`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        vPlate = aPlate; vRest = position * ${unit.toFixed(6)}; vRestN = normal;`);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
        varying vec2 vPlate; varying vec3 vRest; varying vec3 vRestN;
        // rombos de ~7 mm; se apagan cuando son más pequeños que un píxel (si no, centellean)
        float knit(vec2 uv) {
          vec2 q = uv * 140.0;
          vec2 g = fract(vec2(q.x + q.y, q.x - q.y) * 0.5) - 0.5;
          float fade = 1.0 - smoothstep(0.15, 0.45, length(fwidth(q)));
          return smoothstep(0.5, 0.3, abs(g.x) + abs(g.y)) * fade;
        }
        // relieve a partir de una altura, como el bump de three pero sin textura
        vec3 bumped(vec3 pos, vec3 n, float h) {
          vec3 sx = dFdx(pos), sy = dFdy(pos), r1 = cross(sy, n), r2 = cross(n, sx);
          float det = dot(sx, r1) * (gl_FrontFacing ? 1.0 : -1.0);
          vec3 grad = sign(det) * (dFdx(h) * r1 + dFdy(h) * r2);
          // donde no hay relieve (silueta, lejos) el vector sale nulo: normalizarlo da NaN en bloques de
          // 2×2 píxeles, que el bloom pinta como cuadrados negros. Ahí, la normal tal cual
          vec3 b = abs(det) * n - grad;
          return dot(b, b) > 1e-20 ? normalize(b) : n;
        }`)
      .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
        // el peto: la parte del pecho que mira hacia delante
        float pv = max(vPlate.x, smoothstep(0.55, 0.75, vPlate.y) * smoothstep(0.3, 0.6, normalize(vRestN).z));
        float plate = smoothstep(0.42, 0.58, pv);
        // la junta: una línea de pocos píxeles donde cambia el material
        float seam = 1.0 - smoothstep(0.6, 1.6, abs(pv - 0.5) / max(fwidth(pv), 1e-4));
        vec3 an = abs(normalize(vRestN));
        vec3 tw = an / (an.x + an.y + an.z);
        float weave = (knit(vRest.zy) * tw.x + knit(vRest.xz) * tw.y + knit(vRest.xy) * tw.z) * (1.0 - plate);
        roughnessFactor = mix(0.7 - weave * 0.1, 0.42, plate) + seam * 0.6;`)
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
        normal = bumped(-vViewPosition, normal, weave * 0.0004);`)
      .replace('#include <lights_physical_fragment>', `#include <lights_physical_fragment>
        // la malla casi no brilla; la placa, sí, y lleva laca encima
        material.specularColor *= mix(0.15, 0.45, plate) * (1.0 - seam);
        material.clearcoat *= 0.3 * plate * (1.0 - seam);
        material.sheenColor *= mix(1.0, 0.2, plate);`);
  };
  m.customProgramCacheKey = () => 'subject-shell';
  return m;
}
