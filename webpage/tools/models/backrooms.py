# tools/.blender/blender-4.5.15-windows-x64/blender.exe -b -P tools/models/backrooms.py -- <chars|pieces>
#
# Las fuentes del easter egg de las backrooms, en public/models/backrooms/src/<nombre>/scene.gltf, para que
# build.mjs las comprima:
#   chars:  cada personaje de Mixamo en un solo glTF con todas sus animaciones (cada FBX de animations/ trae
#           la malla de su personaje: se reconoce por el número de vértices). Cada clip, con el nombre del archivo
#   pieces: piezas sueltas de backrooms_vr2 (viene horneado: una malla por material con todas las copias juntas),
#           una copia de cada una; y el globo del partygoer
import bpy, sys, os, glob, bmesh, mathutils

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '../../public/models/backrooms'))
SRC = os.path.join(ROOT, 'src')
what = sys.argv[sys.argv.index('--') + 1]

CHARS = {15648: 'bacteria', 4244: 'partygoer', 38678: 'hazmat'}


def reset():
    bpy.ops.wm.read_factory_settings(use_empty=True)


def export(name, objs=None):
    out = os.path.join(SRC, name)
    os.makedirs(out, exist_ok=True)
    if objs is not None:
        bpy.ops.object.select_all(action='DESELECT')
        for o in objs:
            o.select_set(True)
    bpy.ops.export_scene.gltf(filepath=os.path.join(out, 'scene.gltf'), export_format='GLTF_SEPARATE', use_selection=objs is not None,
                              export_animation_mode='ACTIONS', export_apply=False, export_yup=True)
    print('OUT', name)


def chars():
    groups = {}
    for f in sorted(glob.glob(os.path.join(ROOT, 'animations', '*.fbx'))):
        reset()
        bpy.ops.import_scene.fbx(filepath=f)
        n = sum(len(o.data.vertices) for o in bpy.data.objects if o.type == 'MESH')
        groups.setdefault(CHARS[n], []).append(f)
    for name, files in groups.items():
        reset()
        bpy.ops.import_scene.fbx(filepath=files[0])
        arm = next(o for o in bpy.data.objects if o.type == 'ARMATURE')
        keep = set(bpy.data.objects)
        acts = []
        for f in files:
            if f != files[0]:
                before = set(bpy.data.objects)
                bpy.ops.import_scene.fbx(filepath=f)
                new = [o for o in bpy.data.objects if o not in before]
                act = next(o for o in new if o.type == 'ARMATURE').animation_data.action
                for o in new:
                    bpy.data.objects.remove(o)
            else:
                act = arm.animation_data.action
            act.name = os.path.splitext(os.path.basename(f))[0]
            act.use_fake_user = True
            acts.append(act)
        # cada acción en su pista del NLA: el exportador saca una animación por acción
        arm.animation_data.action = None
        for act in acts:
            tr = arm.animation_data.nla_tracks.new()
            tr.name = act.name
            tr.strips.new(act.name, int(act.frame_range[0]), act)
        print('CLIPS', name, [a.name for a in acts])
        export(name)


def loose(obj):
    """Las partes sueltas de una malla, cada una como objeto."""
    bpy.ops.object.select_all(action='DESELECT')
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj
    bpy.ops.mesh.separate(type='LOOSE')
    return list(bpy.context.selected_objects)


def box(o):
    vs = [o.matrix_world @ mathutils.Vector(c) for c in o.bound_box]
    return [mathutils.Vector([min(v[i] for v in vs) for i in range(3)]), mathutils.Vector([max(v[i] for v in vs) for i in range(3)])]


def cluster(parts, pad=0.05):
    """La copia más completa: las partes cuya caja toca la de la parte más grande (un panel de luz
    son el marco y el difusor, dos partes)."""
    big = max(parts, key=lambda o: len(o.data.vertices))
    lo, hi = box(big)
    lo, hi = lo - mathutils.Vector((pad,) * 3), hi + mathutils.Vector((pad,) * 3)
    out = []
    for p in parts:
        a, b = box(p)
        if all(a[i] <= hi[i] and b[i] >= lo[i] for i in range(3)):
            out.append(p)
    return out


def pieces():
    # mallas de backrooms_vr2 (por material) → nombre de la pieza
    # (sus lámparas son cúpulas de cristal, no los fluorescentes de las backrooms: esos los hace world.ts)
    PIECES = {'vent': ['Vent_1'], 'socket': ['Socket_1'], 'exit': ['Exit_Sign', 'Exit_Traslucent'], 'door': ['Exit_Door'], 'armchair': ['ArmChair_1']}
    for name, mats in PIECES.items():
        reset()
        bpy.ops.import_scene.gltf(filepath=os.path.join(SRC, 'backrooms_vr2', 'scene.gltf'))
        for o in bpy.data.objects:
            if o.type == 'MESH':
                w = o.matrix_world.copy()
                o.parent = None
                o.matrix_world = w
        meshes = [o for o in bpy.data.objects if o.type == 'MESH']
        mine = [o for o in meshes if o.active_material and o.active_material.name in mats]
        for o in list(bpy.data.objects):
            if o not in mine:
                bpy.data.objects.remove(o)
        parts = []
        for o in mine:
            parts += loose(o)
        keep = cluster(parts)
        for o in parts:
            if o not in keep:
                bpy.data.objects.remove(o)
        bpy.ops.object.select_all(action='DESELECT')
        for o in keep:
            o.select_set(True)
        bpy.context.view_layer.objects.active = keep[0]
        bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
        lo = mathutils.Vector([min(box(o)[0][i] for o in keep) for i in range(3)])
        hi = mathutils.Vector([max(box(o)[1][i] for o in keep) for i in range(3)])
        c = mathutils.Vector(((lo.x + hi.x) / 2, (lo.y + hi.y) / 2, lo.z))
        for o in keep:
            o.location -= c
        print('PIECE', name, len(keep), 'parts', [round(v, 2) for v in (hi - lo)])
        export(name, keep)
    # el globo, que se quitó para Mixamo
    reset()
    bpy.ops.import_scene.gltf(filepath=os.path.join(SRC, 'partygoer_from_backrooms_updated', 'scene.gltf'))
    b = [o for o in bpy.data.objects if o.type == 'MESH' and 'Baloon' in o.name]
    for o in b:
        w = o.matrix_world.copy()
        o.parent = None
        o.matrix_world = w
    for o in list(bpy.data.objects):
        if o not in b:
            bpy.data.objects.remove(o)
    print('PIECE balloon', [round(v, 2) for v in b[0].dimensions])
    export('balloon', b)


{'chars': chars, 'pieces': pieces}[what]()
