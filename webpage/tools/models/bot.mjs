// node bot.mjs [carpeta de fbx] [salida]: el maniquí de Mixamo y todas sus animaciones (por defecto
// public/models/animations/*.fbx) en un solo glb (por defecto public/models/library/bot.glb).
// Sin texturas: la escena le pone sus materiales negros
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { resolve, sep } from 'node:path';
import { pathToFileURL } from 'node:url';
import * as THREE from 'three';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { dedup, prune, resample, meshopt } from '@gltf-transform/functions';
import { MeshoptEncoder } from 'meshoptimizer';

// el cargador y el exportador piden cosas del navegador que aquí no hacen falta
globalThis.document = { createElementNS: () => ({ addEventListener() {}, removeEventListener() {}, style: {} }) };
globalThis.self = globalThis;
globalThis.window = { URL: { createObjectURL: () => '' } };
globalThis.FileReader = class {
  readAsArrayBuffer(b) { b.arrayBuffer().then((r) => { this.result = r; this.onloadend?.(); this.onload?.({ target: this }); }); }
};
console.warn = () => {};

const BASE = new URL('../../public/models/animations/', import.meta.url);
const D = process.argv[2] ? pathToFileURL(resolve(process.argv[2]) + sep) : BASE;
const OUT = process.argv[3] ? pathToFileURL(resolve(process.argv[3])) : new URL('../../public/models/library/bot.glb', import.meta.url);
const load = (f, dir = D) => {
  const b = readFileSync(new URL(f, dir));
  return new FBXLoader().parse(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength), '');
};
const files = readdirSync(D).filter((f) => f.endsWith('.fbx'));
// el maniquí sale siempre de la idle de la biblioteca: los clips de otra carpeta van sobre el mismo esqueleto
const bot = load('Idle.fbx', BASE);
bot.traverse((o) => { if (o.isMesh) o.material = new THREE.MeshStandardMaterial({ name: 'bot' }); });
const clips = files.map((f) => {
  const c = load(f).animations[0];
  c.name = f.replace('.fbx', '').toLowerCase().replace(/\s+/g, '-');
  const hips = c.tracks.find((t) => t.name === 'mixamorigHips.position');
  if (hips) {
    const v = hips.values, n = v.length / 3;
    console.log(c.name.padEnd(24), c.duration.toFixed(2) + 's', 'hips dx', (v[(n - 1) * 3] - v[0]).toFixed(1), 'dz', (v[(n - 1) * 3 + 2] - v[2]).toFixed(1));
  }
  return c;
});
const glb = await new GLTFExporter().parseAsync(bot, { binary: true, animations: clips });
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.encoder': MeshoptEncoder });
await MeshoptEncoder.ready;
const doc = await io.readBinary(new Uint8Array(glb));
await doc.transform(dedup(), resample(), prune(), meshopt({ encoder: MeshoptEncoder, level: 'medium' }));
writeFileSync(OUT, await io.writeBinary(doc));
console.log(OUT.pathname.split('/').pop(), clips.length, 'clips');
