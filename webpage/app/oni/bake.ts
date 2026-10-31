import * as THREE from 'three';

/*
 * Luz horneada. tools/bake_lighting.py abre la página en modo ?bake, recibe de aquí la
 * habitación tal cual está montada (exportBake), la hornea en Blender y deja en
 * /models/room/bake/ un atlas con la luz indirecta y las coordenadas de cada malla.
 * Al cargar, applyBake la pega encima como lightMap. Las mallas se reconocen por una
 * clave (modelo, nombre, posición, nº de vértices): si algo se mueve o se añade sin
 * volver a hornear, esa malla se queda sin luz horneada y no pasa nada más.
 */

const DIR = '/models/room/bake/';

interface BakeIndex {
  size: number;
  intensity: number;
  meshes: Record<string, [number, number]>; // clave → [inicio, nº de esquinas] en uv.bin, en el orden del índice
}

/** Mallas fijas de la habitación: lo que se mueve (userData.dynamic) y los shaders propios no se hornean. */
export function staticMeshes(scene: THREE.Scene) {
  const out: THREE.Mesh[] = [];
  const walk = (o: THREE.Object3D) => {
    if (!o.visible || o.userData.dynamic) return;
    const mesh = o as THREE.Mesh;
    if (mesh.isMesh && !Array.isArray(mesh.material) && (mesh.material as THREE.MeshStandardMaterial).isMeshStandardMaterial) out.push(mesh);
    o.children.forEach(walk);
  };
  walk(scene);
  // claves estables aunque los modelos lleguen en otro orden
  const keys = out.map((m) => meshKey(m, scene));
  const seen = new Map<string, number>();
  return out
    .map((m, i) => ({ m, k: keys[i] }))
    .sort((a, b) => (a.k < b.k ? -1 : a.k > b.k ? 1 : 0))
    .map(({ m, k }) => {
      const n = seen.get(k) ?? 0;
      seen.set(k, n + 1);
      return { mesh: m, key: n ? `${k}~${n}` : k };
    });
}

function meshKey(m: THREE.Mesh, scene: THREE.Scene) {
  let root: THREE.Object3D = m;
  while (root.parent && root.parent !== scene) root = root.parent;
  const c = new THREE.Box3().setFromObject(m).getCenter(new THREE.Vector3());
  const g = m.geometry;
  const n = g.index ? g.index.count : g.attributes.position.count;
  return `${root.name || 'room'}|${m.name}|${c.toArray().map((v) => Math.round(v * 100)).join(',')}|${n}`;
}

/** Una esquina de triángulo por vértice: así cada esquina puede tener su propia coordenada del atlas. */
function deindex(g: THREE.BufferGeometry) {
  const idx = g.index;
  const n = idx ? idx.count : g.attributes.position.count;
  const out = new THREE.BufferGeometry();
  for (const [name, a] of Object.entries(g.attributes)) {
    const s = a.itemSize;
    const arr = new Float32Array(n * s);
    for (let i = 0; i < n; i++) {
      const j = idx ? idx.getX(i) : i;
      arr[i * s] = a.getX(j);
      if (s > 1) arr[i * s + 1] = a.getY(j);
      if (s > 2) arr[i * s + 2] = a.getZ(j);
      if (s > 3) arr[i * s + 3] = a.getW(j);
    }
    out.setAttribute(name, new THREE.BufferAttribute(arr, s));
  }
  for (const gr of g.groups) out.addGroup(gr.start, gr.count, gr.materialIndex);
  return out;
}

function toFloat(a: THREE.BufferAttribute | THREE.InterleavedBufferAttribute) {
  const out = new THREE.Float32BufferAttribute(a.count * a.itemSize, a.itemSize);
  const v = new THREE.Vector3();
  for (let i = 0; i < a.count; i++) out.setXYZ(i, ...v.fromBufferAttribute(a, i).toArray());
  return out;
}

/** La habitación para Blender: posición y normal en coordenadas del mundo, material gris y la emisión. */
export async function exportBake(scene: THREE.Scene, lights: object[]) {
  const { GLTFExporter } = await import('three/examples/jsm/exporters/GLTFExporter.js');
  scene.updateMatrixWorld(true);
  const out = new THREE.Scene();
  const list = staticMeshes(scene);
  list.forEach(({ mesh }, i) => {
    // con sus índices, para que Blender vea las caras unidas; en coma flotante y ya en el mundo
    const g = mesh.geometry;
    const flat = new THREE.BufferGeometry();
    flat.setAttribute('position', toFloat(g.attributes.position).applyMatrix4(mesh.matrixWorld));
    if (g.attributes.normal) flat.setAttribute('normal', toFloat(g.attributes.normal).applyNormalMatrix(new THREE.Matrix3().getNormalMatrix(mesh.matrixWorld)));
    if (g.index) flat.setIndex(Array.from({ length: g.index.count }, (_, k) => g.index!.getX(k)));
    const src = mesh.material as THREE.MeshStandardMaterial;
    const mat = new THREE.MeshStandardMaterial({ color: 0x1f1f1f, roughness: 1 });
    if (src.emissive && src.emissiveIntensity * src.emissive.getHex() > 0 && !src.emissiveMap) mat.emissive.copy(src.emissive).multiplyScalar(src.emissiveIntensity);
    const m = new THREE.Mesh(flat, mat);
    m.name = 'b' + i;
    out.add(m);
  });
  const glb = (await new GLTFExporter().parseAsync(out, { binary: true })) as ArrayBuffer;
  return { glb, meta: { meshes: list.map((l) => l.key), lights } };
}

/** Pega la luz horneada, si la hay. */
export async function applyBake(scene: THREE.Scene) {
  let index: BakeIndex;
  let uv: Uint16Array;
  try {
    const r = await fetch(DIR + 'index.json');
    if (!r.ok) return;
    index = await r.json();
    uv = new Uint16Array(await (await fetch(DIR + 'uv.bin')).arrayBuffer());
  } catch {
    return;
  }
  const tex = await new THREE.TextureLoader().loadAsync(DIR + 'lightmap.webp');
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.channel = 1;
  // copia del material para las mallas horneadas: el original puede compartirlo algo que se mueve
  // (las bobinas de la grabadora) y sin coordenadas de atlas se quedaría sin dibujar
  const baked = new Map<THREE.Material, THREE.MeshStandardMaterial>();
  for (const { mesh, key } of staticMeshes(scene)) {
    const at = index.meshes[key];
    const g = mesh.geometry;
    if (!at || at[1] !== (g.index ? g.index.count : g.attributes.position.count)) continue;
    const flat = deindex(g);
    flat.setAttribute('uv1', new THREE.BufferAttribute(uv.slice(at[0] * 2, (at[0] + at[1]) * 2), 2, true));
    mesh.geometry = flat;
    const src = mesh.material as THREE.MeshStandardMaterial;
    let m = baked.get(src);
    if (!m) {
      m = src.clone();
      m.onBeforeCompile = src.onBeforeCompile;
      m.customProgramCacheKey = () => src.customProgramCacheKey() + '-lm';
      m.lightMap = tex;
      m.lightMapIntensity = index.intensity;
      baked.set(src, m);
    }
    mesh.material = m;
  }
}
