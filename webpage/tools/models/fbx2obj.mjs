// node fbx2obj.mjs <in.fbx> <out.obj>: la malla de un FBX riggeado, sin huesos, en su pose de
// reposo, para el auto-rig de Mixamo (que rechaza esqueletos que no reconoce)
import { readFileSync, writeFileSync } from 'node:fs';
import * as THREE from 'three';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';
import { OBJExporter } from 'three/examples/jsm/exporters/OBJExporter.js';
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

// el cargador pide imágenes al DOM: aquí no hacen falta (la textura va aparte en el zip)
globalThis.document = { createElementNS: () => ({ addEventListener() {}, removeEventListener() {}, style: {} }) };
globalThis.self = globalThis;
globalThis.window = { URL: { createObjectURL: () => '' } };

const [src, out] = process.argv.slice(2);
const buf = readFileSync(src);
const root = new FBXLoader().parse(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength), '');
root.updateMatrixWorld(true);
const scene = new THREE.Scene();
const box = new THREE.Box3();
root.traverse((o) => {
  if (!o.isMesh) return;
  let g = o.geometry.clone();
  for (const k of Object.keys(g.attributes)) if (k.startsWith('skin')) g.deleteAttribute(k);
  g.applyMatrix4(o.matrixWorld);
  g = mergeVertices(g); // el FBX llega en triángulos sueltos: se sueldan (las costuras de uv se respetan)
  const m = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ name: 'bot' }));
  m.name = o.name;
  scene.add(m);
  box.expandByObject(m);
  console.log('mesh', o.name, g.attributes.position.count, 'verts', o.isSkinnedMesh ? '(skinned)' : '');
});
console.log('size', box.getSize(new THREE.Vector3()).toArray().map((v) => v.toFixed(2)).join(' x '));
writeFileSync(out, new OBJExporter().parse(scene));
