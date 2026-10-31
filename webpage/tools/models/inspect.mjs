import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { getBounds } from '@gltf-transform/functions';
import { MeshoptDecoder } from 'meshoptimizer';
await MeshoptDecoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder });
const file = process.argv[2]; const deep = process.argv[3]==='deep';
const doc = await io.read(file); const root = doc.getRoot();
let tris = 0; const meshTris = new Map();
for (const m of root.listMeshes()) { let t=0; for (const p of m.listPrimitives()) { const i=p.getIndices(); const pos=p.getAttribute('POSITION'); t += (i?i.getCount():pos.getCount())/3; } meshTris.set(m,t); }
const scene = root.listScenes()[0]; const b = getBounds(scene);
const sz = b.max.map((v,i)=>(v-b.min[i]).toFixed(2));
let texPx=0; for (const t of root.listTextures()) { const s=t.getSize(); if(s) texPx+=s[0]*s[1]; }
scene.traverse(n=>{ const m=n.getMesh(); if(m) tris+=meshTris.get(m); });
console.log(`tris=${Math.round(tris)} size=${sz.join('x')} mats=${root.listMaterials().length} tex=${root.listTextures().length} (${(texPx/1e6).toFixed(1)}MPx) maxTex=${Math.max(0,...root.listTextures().map(t=>(t.getSize()||[0])[0]))}`);
if (deep) scene.traverse(n=>{ const m=n.getMesh(); if(!m) return; const nb=getBounds(n); const c=nb.min.map((v,i)=>((v+nb.max[i])/2).toFixed(2)); const s=nb.max.map((v,i)=>(v-nb.min[i]).toFixed(2)); console.log(`  ${n.getName()} | ${m.getPrimitives?'':''}${m.listPrimitives().map(p=>p.getMaterial()?.getName()).join(',')} | tris=${meshTris.get(m)} c=${c} s=${s}`); });
