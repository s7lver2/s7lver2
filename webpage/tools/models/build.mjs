import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { prune, dedup, weld, simplify, textureCompress, meshopt, metalRough, getBounds } from '@gltf-transform/functions';
import { MeshoptEncoder, MeshoptSimplifier } from 'meshoptimizer';
import sharp from 'sharp';
import { fileURLToPath } from 'node:url';
await MeshoptEncoder.ready; await MeshoptSimplifier.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.encoder': MeshoptEncoder });

// node build.mjs <room|surveillance|library|supper|ritual> [job...]
const MODELS = fileURLToPath(new URL('../../public/models/', import.meta.url));

const room = {
  desk:      { src: 'gaming_setup_v2_low-poly', drop: n => n.startsWith('whole_boundary'), tex: 2048 },
  chair:     { src: 'gaming_setup_v2_low-poly', keep: n => n.startsWith('whole_boundary'), tex: 2048 },
  bed:       { src: 'bed', tex: 1024 },
  blahaj:    { src: 'blahaj', tex: 512 },
  blunt:     { src: 'blunt', tex: 256 },
  lamp:      { src: 'ceiling_lamp', tex: 512 },
  flipper:   { src: 'flipper_zero', tex: 512, simplify: 0.08 },
  poster:    { src: 'fnaf_1_poster', tex: 512 },
  lighter:   { src: 'lighter_-_sci_fi', tex: 256 },
  bookshelf: { src: 'old_bookshelf', tex: 1024 },
  walkman:   { src: 'potify_-_sheng_lam_scifi_walkman', tex: 512 },
  steamframe:{ src: 'steam_frame_low_poly_low_effort', tex: 256 },
  steammachine:{ src: 'steam_machine__a_valve_desktop_pc', tex: 512 },
  window:    { src: 'window', tex: 1024 },
  printer:   { src: '3d_printer', drop: n => /Pistol|Suppressor|Device_Shell/.test(n), tex: 1024 },
  panel:     { src: 'acoustic_panel_-_optimized', tex: 512, simplify: 0.25 },
  gpu:       { src: 'asus_rog_rtx_5070_oc__pbr', tex: 512 },
  keyboard:  { src: 'asus_rog_strix_keyboard', tex: 1024, simplify: 0.3 },
  rack:      { src: 'data_center_rack', tex: 1024 },
  door:      { src: 'door_with_door_frame', tex: 512, simplify: 0.4 },
  tower:     { src: 'gaming_pc_low-poly', tex: 1024 },
  stand:     { src: 'headphone_stand', tex: 256, simplify: 0.3 },
  mouse:     { src: 'logitech_g502_x_lightspeed', tex: 256 },
  neon:      { src: 'neon_signs', root: 'vertical japanese sign 1_17', tex: 256, simplify: 0.25 },
  disk:      { src: 'psx_-_disk', tex: 256 },
  recorder:  { src: 'reel-to-reel_tape_recorder', tex: 1024, simplify: 0.5 },
  router:    { src: 'router', tex: 1024, simplify: 0.15 },
  headphones:{ src: 'sony_mdr-7506_headphones', tex: 1024, simplify: 0.5 },
  cables:    { src: 'tangledtwisted_cables_4', tex: 256 },
  usb:       { src: 'usb_stick', tex: 512 },
};

// el logo del mando (SANYO) se tapa y se rotula ONI encima; rectángulo en px de una textura de 1024
async function oniLogo(doc) {
  await doc.transform(metalRough()); // three ya no lee specularGlossiness
  const tex = doc.getRoot().listMaterials()[0].getBaseColorTexture();
  const S = 2048, k = S / 1024;
  const { data } = await sharp(Buffer.from(tex.getImage())).resize(S, S).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const [x0, y0, x1, y1] = [355, 765, 396, 866].map(v => Math.round(v * k));
  for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) data[(y * S + x) * 4 + 3] = 0; // la tira es una calcomanía: se vacía
  const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${S}" height="${S}"><text x="${cx}" y="${cy}" transform="rotate(-90 ${cx} ${cy})" text-anchor="middle" dominant-baseline="central" font-family="Arial Black, Impact, sans-serif" font-weight="900" font-size="${Math.round(30 * k)}" letter-spacing="${Math.round(4 * k)}" fill="#bb0037">ONI</text></svg>`;
  const png = await sharp(data, { raw: { width: S, height: S, channels: 4 } }).composite([{ input: Buffer.from(svg) }]).png().toBuffer();
  tex.setImage(new Uint8Array(png)).setMimeType('image/png');
}

// la foto del marco: el cuadro no trae textura, solo un gris; se le pone la foto recortada al
// trozo de uv que ocupa (u 0.143-0.861, v 0.005-0.995 en una textura cuadrada)
async function framePhoto(doc) {
  const S = 1024, [u0, v0, u1, v1] = [0.143, 0.005, 0.861, 0.995].map(v => Math.round(v * S));
  const photo = await sharp(fileURLToPath(new URL('./frame-photo.webp', import.meta.url))).resize(u1 - u0, v1 - v0, { fit: 'cover', position: 'top' }).flip().toBuffer(); // el cuadro lee la v al revés
  const png = await sharp({ create: { width: S, height: S, channels: 3, background: '#d8d4cc' } }).composite([{ input: photo, left: u0, top: v0 }]).png().toBuffer();
  const mat = doc.getRoot().listMaterials().find(m => m.getName().endsWith('artwork'));
  const tex = doc.createTexture('photo').setImage(new Uint8Array(png)).setMimeType('image/png');
  mat.setBaseColorTexture(tex).setBaseColorFactor([1, 1, 1, 1]);
  // el cristal viene opaco, con un reflejo pintado que tapa la foto: fuera
  for (const n of doc.getRoot().listNodes()) if (n.getMesh()?.getName().includes('glass')) n.dispose();
}

const surveillance = {
  tvstack:   { src: '28e9373b8550488bac26b3c35ac2225a', tex: 1024 },
  crt:       { src: 'crt_tv', tex: 1024 },
  oldtv:     { src: 'old_tv', tex: 1024 },
  retrotv:   { src: 'tv__old_tv__retro_tv', tex: 1024 },
  antennatv: { src: 'old_analog_tv_with_antenas', tex: 1024, simplify: 0.2, error: 0.01 },
  remote:    { src: 'simple_tv_remote', tex: 2048, pre: oniLogo },
  camera:    { src: 'security_camera', tex: 512 },
  pi:        { src: 'raspberry_pi_3', tex: 512 },
  server:    { src: 'server_v2_console', tex: 512 },
  frame:     { src: 'standing_picture_frame_02_4k', tex: 1024, pre: framePhoto },
  tux:       { src: 'tux_penguin', tex: 512, pre: doc => doc.transform(metalRough()) },
};

// La biblioteca de anaroeto viene entera en una escena y en centímetros. Cada trabajo se queda con
// unas piezas de primer nivel (y, con `near`, con lo que cae dentro de su caja, como las filas de
// libros de una estantería) y la deja en metros con el origen en su base, centrada en x/z.
function piece(names, near) {
  return doc => {
    const rn = doc.getRoot().listNodes().find(n => n.getName() === 'RootNode');
    const kids = rn.listChildren(), keep = new Set(kids.filter(k => names.includes(k.getName())));
    if (near) {
      const b = [...keep].map(k => getBounds(k));
      for (const k of kids) {
        if (!near.test(k.getName())) continue;
        const c = getBounds(k), m = [0, 1, 2].map(i => (c.min[i] + c.max[i]) / 2);
        if (b.some(o => m.every((v, i) => v > o.min[i] && v < o.max[i]))) keep.add(k);
      }
    }
    for (const k of kids) if (!keep.has(k)) k.dispose();
    const scene = doc.getRoot().listScenes()[0], b = getBounds(scene), cm = 0.01;
    const pivot = doc.createNode('pivot').setScale([cm, cm, cm])
      .setTranslation([-(b.min[0] + b.max[0]) / 2 * cm, -b.min[1] * cm, -(b.min[2] + b.max[2]) / 2 * cm]);
    for (const n of scene.listChildren()) { scene.removeChild(n); pivot.addChild(n); }
    scene.addChild(pivot);
  };
}

const library = {
  shelf:       { src: 'library', tex: 1024, pre: piece(['prop_biblioteca_estanteria'], /libros/) },
  table:       { src: 'library', tex: 512, pre: piece(['mesa_low']) },
  chair:       { src: 'library', tex: 512, pre: piece(['silla_low']) },
  desklamp:    { src: 'library', tex: 512, pre: piece(['lampara_mesa_low']) },
  ceilinglamp: { src: 'library', tex: 512, simplify: 0.3, pre: piece(['lampara_techo_low']) },
  railing:     { src: 'library', tex: 512, pre: piece(['biblioteca_barandilla']) },
  door:        { src: 'library', tex: 512, pre: piece(['prop_casa_puerta', 'prop_casa_puerta001', 'marco_puertaDoble']) },
  shell:       { src: 'library', tex: 1024, pre: piece(['biblioteca', 'biblioteca_suelo', 'biblioteca_techo', 'biblioteca_suelo_volante', 'biblioteca_barandilla', 'biblioteca_barandilla001']) },
};

// la cena: la mesa, el mantel y las armas que llevan los robots
const supper = {
  table:   { src: 'banquet_table', tex: 1024 },
  cloth:   { src: 'tablecloth_lowpoly', tex: 1024 },
  pistol:  { src: '9_mm', tex: 512, drop: n => n.startsWith('Plane') },
  mp5:     { src: 'low-poly_hk_mp5', tex: 256 },
  grenade: { src: 'sci-fi_granade', tex: 256, simplify: 0.08, error: 0.01 },
  bread:   { src: 'bread', tex: 512, simplify: 0.05, error: 0.01 },
  burger:  { src: 'macdonald', tex: 256 },
  skull:   { src: 'scull_cup', tex: 512, simplify: 0.05, error: 0.01 },
  city:    { src: 'cyberpunk_city_-_1', tex: 1024 },
};

const ritual = {
  torii:   { src: 'japanese_torii_gate', tex: 1024 },
  temple:  { src: 'japanese_lowpoly_temple', tex: 512, drop: n => n === 'Object_3' }, // sin las rocas de la base: de cerca, astillas blancas
  stones:  { src: 'stylized_stones_minipack', tex: 512 },
};

const SETS = { ritual: [ritual, 'ritual/'], supper: [supper, 'supper/'], room: [room, 'room/'], surveillance: [surveillance, 'surveilance_room/'], library: [library, 'library/'] };
const [set, ...only] = process.argv.slice(2);
if (!SETS[set]) { console.error('uso: node build.mjs <room|surveillance|library|supper|ritual> [job...]'); process.exit(1); }
const [jobs, dir] = SETS[set];
const SRC = MODELS + dir + 'src/', OUT = MODELS + dir;

for (const [name, j] of Object.entries(jobs)) {
  if (only.length && !only.includes(name)) continue;
  const doc = await io.read(SRC + j.src + '/scene.gltf');
  const root = doc.getRoot();
  if (j.drop || j.keep) for (const n of root.listNodes()) { const nm = n.getName(); if (!n.getMesh()) continue; if ((j.drop && j.drop(nm)) || (j.keep && !j.keep(nm))) n.dispose(); }
  if (j.root) { const keep = new Set(); const r = root.listNodes().find(n => n.getName() === j.root); r.traverse(n => keep.add(n)); for (const n of root.listNodes()) if (n.getMesh() && !keep.has(n)) n.dispose(); }
  if (j.pre) await j.pre(doc);
  const t = [dedup(), prune()];
  if (j.simplify) t.push(weld(), simplify({ simplifier: MeshoptSimplifier, ratio: j.simplify, error: j.error ?? 0.002 }));
  t.push(textureCompress({ encoder: sharp, targetFormat: 'webp', resize: [j.tex, j.tex], quality: 82 }), prune(), meshopt({ encoder: MeshoptEncoder, level: 'medium' }));
  await doc.transform(...t);
  await io.write(OUT + name + '.glb', doc);
  console.log(name, 'ok');
}
