"""
La parte de Blender de bake_lighting.py (se ejecuta dentro de Blender, sin interfaz).

Entrada (tools/.bake/): scene.glb con cada malla fija de la habitación en coordenadas del
mundo, y meta.json con la clave de
cada malla y las luces fijas. Salida (public/models/room/bake/):
  lightmap.webp  luz indirecta que llega a cada punto, en sRGB y normalizada;
  uv.bin         coordenadas del atlas de cada esquina de triángulo, en el orden del índice de
                 three.js (el importador conserva caras y vértices), uint16 normalizado;
  index.json     { size, intensity, meshes: { clave: [inicio, esquinas] } }.
Three.js la aplica como lightMap (irradiancia): por eso se multiplica por pi al guardar.
"""
import json
import math
import os
import sys

import bpy
import numpy as np
from mathutils import Vector

src, out, size, samples, gain = sys.argv[sys.argv.index("--") + 1:]
size, samples, gain = int(size), int(samples), float(gain)
meta = json.load(open(os.path.join(src, "meta.json"), encoding="utf-8"))
ALBEDO = 0.12  # el cuarto es oscuro: todo rebota como una pared de yeso ennegrecida


def log(m):
    print(f"[bake:blender] {m}", flush=True)


def to_blender(p):
    """Three.js (Y arriba) → Blender (Z arriba), igual que hace el importador de glTF."""
    return Vector((p[0], -p[2], p[1]))


bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=os.path.join(src, "scene.glb"), merge_vertices=False)
objs = [o for o in bpy.context.scene.objects if o.type == "MESH"]
log(f"{len(objs)} mallas importadas")

# ── geometría en coordenadas del mundo y material gris (salvo lo que emite luz)
bpy.ops.object.select_all(action="DESELECT")
for o in objs:
    o.select_set(True)
bpy.context.view_layer.objects.active = objs[0]
bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)

for mat in bpy.data.materials:
    if not mat.use_nodes:
        continue
    bsdf = next((n for n in mat.node_tree.nodes if n.type == "BSDF_PRINCIPLED"), None)
    if not bsdf:
        continue
    for link in list(bsdf.inputs["Base Color"].links):
        mat.node_tree.links.remove(link)
    bsdf.inputs["Base Color"].default_value = (ALBEDO, ALBEDO, ALBEDO, 1)
    bsdf.inputs["Roughness"].default_value = 1
    bsdf.inputs["Metallic"].default_value = 0

# ── luces
scene = bpy.context.scene
for i, L in enumerate(meta["lights"]):
    if L["type"] == "world":
        world = bpy.data.worlds.new("world")
        world.use_nodes = True
        bg = world.node_tree.nodes["Background"]
        bg.inputs["Color"].default_value = (*L["color"], 1)
        bg.inputs["Strength"].default_value = L["intensity"] * gain
        scene.world = world
        continue
    pos = to_blender(L["pos"])
    kind = "SPOT" if L["type"] == "spot" else "POINT"
    data = bpy.data.lights.new(f"l{i}", kind)
    data.color = L["color"]
    # three.js: candelas, sin caída si decay = 0. Blender: vatios con caída 1/d².
    # Para las de la ventana (sin caída) se iguala la luz donde llega, en el hueco.
    d = 1.0
    if L["decay"] == 0 and L["target"]:
        d = (to_blender(L["target"]) - pos).length / 2
    data.energy = 4 * math.pi * L["intensity"] * d * d * gain
    data.shadow_soft_size = 0.04 if L["decay"] == 0 else 0.12
    ob = bpy.data.objects.new(f"l{i}", data)
    ob.location = pos
    if kind == "SPOT":
        data.spot_size = 2 * L["angle"]
        data.spot_blend = L["penumbra"]
        ob.rotation_euler = (to_blender(L["target"]) - pos).to_track_quat("-Z", "Y").to_euler()
    scene.collection.objects.link(ob)

# ── un atlas para todo: cada malla se desenvuelve sola, se iguala la escala al área real
#    y luego se empaquetan todas las islas juntas
log("desenvolviendo")
areas = []
for o in objs:
    me = o.data
    me.uv_layers.new(name="lm")
    me.uv_layers.active = me.uv_layers["lm"]
    me.uv_layers["lm"].active_render = True
bpy.ops.object.mode_set(mode="EDIT")
bpy.ops.mesh.select_all(action="SELECT")
bpy.ops.uv.smart_project(angle_limit=math.radians(60), island_margin=0.002, area_weight=0.0, correct_aspect=True, scale_to_bounds=False)
bpy.ops.object.mode_set(mode="OBJECT")

for o in objs:
    me = o.data
    n = len(me.loops)
    uv = np.empty(n * 2, np.float32)
    me.uv_layers["lm"].data.foreach_get("uv", uv)
    uv = uv.reshape(-1, 2)
    co = np.empty(len(me.vertices) * 3, np.float32)
    me.vertices.foreach_get("co", co)
    co = co.reshape(-1, 3)
    vi = np.empty(n, np.int64)
    me.loops.foreach_get("vertex_index", vi)
    tri = vi.reshape(-1, 3) if n % 3 == 0 else None
    if tri is None:
        continue
    a, b, c = co[tri[:, 0]], co[tri[:, 1]], co[tri[:, 2]]
    world = np.linalg.norm(np.cross(b - a, c - a), axis=1).sum() / 2
    t = uv.reshape(-1, 3, 2)
    e1, e2 = t[:, 1] - t[:, 0], t[:, 2] - t[:, 0]
    tex = np.abs(e1[:, 0] * e2[:, 1] - e1[:, 1] * e2[:, 0]).sum() / 2
    if tex > 0 and world > 0:
        uv *= math.sqrt(world / tex)
        me.uv_layers["lm"].data.foreach_set("uv", uv.ravel())

bpy.ops.object.mode_set(mode="EDIT")
bpy.ops.mesh.select_all(action="SELECT")
bpy.ops.uv.select_all(action="SELECT")
bpy.ops.uv.pack_islands(rotate=True, shape_method='AABB', margin_method='FRACTION', margin=3 / size)
bpy.ops.object.mode_set(mode="OBJECT")

# ── horneado: solo la luz indirecta (la directa la pinta three.js en tiempo real)
log(f"horneando {size}px, {samples} muestras")
scene.render.engine = "CYCLES"
prefs = bpy.context.preferences.addons["cycles"].preferences
prefs.refresh_devices()
for backend in ("OPTIX", "CUDA", "HIP", "ONEAPI", "METAL"):
    try:
        devs = prefs.get_devices_for_type(backend)
    except (TypeError, ValueError):
        continue
    gpus = [d for d in devs if d.type != "CPU"]
    if gpus:
        prefs.compute_device_type = backend
        for d in devs:
            d.use = d.type != "CPU"
        scene.cycles.device = "GPU"
        log(f"GPU: {backend} ({', '.join(d.name for d in gpus)})")
        break
else:
    log("sin GPU compatible: horneando con el procesador (más lento)")
scene.cycles.samples = samples
scene.cycles.use_denoising = False
scene.cycles.max_bounces = 6
scene.cycles.diffuse_bounces = 4

img = bpy.data.images.new("lightmap", size, size, float_buffer=True, alpha=False)
for mat in bpy.data.materials:
    if not mat.use_nodes:
        continue
    node = mat.node_tree.nodes.new("ShaderNodeTexImage")
    node.image = img
    mat.node_tree.nodes.active = node

bpy.ops.object.select_all(action="DESELECT")
for o in objs:
    o.select_set(True)
bpy.context.view_layer.objects.active = objs[0]
bake = scene.render.bake
bake.use_pass_direct = False
bake.use_pass_indirect = True
bake.use_pass_color = False
bake.margin = 6
bpy.ops.object.bake(type="DIFFUSE", pass_filter={"INDIRECT"}, margin=6, use_clear=True)

# ── guardar: irradiancia (×π), normalizada al percentil alto y en sRGB para no perder las sombras
px = np.empty(size * size * 4, np.float32)
img.pixels.foreach_get(px)
rgb = px.reshape(-1, 4)[:, :3] * math.pi
peak = rgb.max(axis=1)
lit = peak[peak > 0]
scale = float(np.percentile(lit, 99.7)) if lit.size else 1.0
v = np.clip(rgb / scale, 0, 1)
v = np.where(v <= 0.0031308, v * 12.92, 1.055 * np.power(v, 1 / 2.4) - 0.055)
outimg = bpy.data.images.new("lm_out", size, size, alpha=False)
outimg.colorspace_settings.name = "Non-Color"
outimg.pixels.foreach_set(np.concatenate([v, np.ones((v.shape[0], 1), np.float32)], axis=1).ravel())
outimg.file_format = "WEBP"
outimg.filepath_raw = os.path.join(out, "lightmap.webp")
scene.render.image_settings.quality = 92
outimg.save()

# ── coordenadas del atlas por esquina, en el orden del índice que mandó three.js
chunks, index, offset = [], {}, 0
for o in objs:
    i = int(o.name.split(".")[0][1:]) if o.name.startswith("b") else -1
    if i < 0 or i >= len(meta["meshes"]):
        continue
    key = meta["meshes"][i]
    me = o.data
    nv = len(me.loops)
    if nv != int(key.split("|")[-1].split("~")[0]):
        log(f"se salta {key}: {nv} esquinas tras importar")
        continue
    uv = np.empty(nv * 2, np.float32)
    me.uv_layers["lm"].data.foreach_get("uv", uv)
    chunks.append(np.round(np.clip(uv, 0, 1) * 65535).astype("<u2"))
    index[key] = [offset, nv]
    offset += nv

np.concatenate(chunks).tofile(os.path.join(out, "uv.bin"))
json.dump({"size": size, "intensity": scale, "meshes": index}, open(os.path.join(out, "index.json"), "w"))
log(f"{len(index)} mallas en el atlas, intensidad {scale:.3f}")
