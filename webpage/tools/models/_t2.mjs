import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { getBounds } from '@gltf-transform/functions';
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
const doc = await io.read('../../public/models/library/src/library/scene.gltf'); const root = doc.getRoot();
const rn = root.listNodes().find(n=>n.getName()==='RootNode');
const tri = n => { let t=0; n.traverse(c=>{const m=c.getMesh(); if(m) for(const p of m.listPrimitives()){const i=p.getIndices(); t+=(i?i.getCount():p.getAttribute('POSITION').getCount())/3;}}); return t; };
const seen={};
for (const k of rn.listChildren()) { const p=k.getName().replace(/[._\d]+$/,''); seen[p]=(seen[p]||0)+1; if (seen[p]>2) continue; const b=getBounds(k); const s=b.max.map((v,i)=>(v-b.min[i]).toFixed(0)); const c=b.min.map((v,i)=>((v+b.max[i])/2).toFixed(0)); const mats=new Set(); k.traverse(c=>c.getMesh()?.listPrimitives().forEach(p=>mats.add(p.getMaterial()?.getName()))); console.log(k.getName(), 'tris='+tri(k), 'c='+c, 's='+s, 'kids='+k.listChildren().length, [...mats].join(',')); }
console.log(rn.getScale(), rn.getRotation(), root.listNodes().find(n=>n.getName()==='Sketchfab_model').getRotation());
console.log(root.listMaterials().map(m=>m.getName()+':'+(m.getBaseColorTexture()?.getURI()||'')).join('\n'));
