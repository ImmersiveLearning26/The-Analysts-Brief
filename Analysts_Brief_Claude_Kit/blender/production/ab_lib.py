"""Shared helpers for The Analyst's Brief production scenes.

Authority: ../layout.json (Blender metres, X right, Y into room, Z up).
Run inside Blender: exec(open(path).read(), {"__file__": path}) or via the build_*.py scripts.
Procedural materials are authored here and baked to images at export time (export_glb.py),
because glTF cannot carry procedural shader nodes.
"""
import bpy, bmesh, json, math, random
from pathlib import Path
from mathutils import Vector, Matrix

KIT = Path(__file__).resolve().parents[2] if "__file__" in globals() else None
LAYOUT = json.loads((KIT / "blender" / "layout.json").read_text()) if KIT else None
SRC_DIR = KIT / "assets" / "source" if KIT else None


# ---------------------------------------------------------------- scenes / collections
def scene(name, fps=30):
    sc = bpy.data.scenes.get(name) or bpy.data.scenes.new(name)
    sc.unit_settings.system = "METRIC"
    sc.unit_settings.scale_length = 1.0
    sc.render.fps = fps
    return sc


def coll(name, parent):
    """Get/create a collection linked under `parent` (a Scene or Collection)."""
    c = bpy.data.collections.get(name) or bpy.data.collections.new(name)
    pc = parent.collection if isinstance(parent, bpy.types.Scene) else parent
    if c.name not in pc.children:
        pc.children.link(c)
    return c


def clear_coll(c):
    for o in list(c.all_objects):
        bpy.data.objects.remove(o, do_unlink=True)
    for ch in list(c.children):
        clear_coll(ch)


def link(o, c):
    for uc in list(o.users_collection):
        uc.objects.unlink(o)
    c.objects.link(o)
    return o


# ---------------------------------------------------------------- materials
def _bsdf(m):
    return next(n for n in m.node_tree.nodes if n.type == "BSDF_PRINCIPLED")


def mat(name, color, rough=0.6, metal=0.0, spec=0.5):
    m = bpy.data.materials.get(name) or bpy.data.materials.new(name)
    try:
        m.use_nodes = True
    except Exception:
        pass
    b = _bsdf(m)
    b.inputs["Base Color"].default_value = (*color, 1)
    b.inputs["Roughness"].default_value = rough
    b.inputs["Metallic"].default_value = metal
    if "Specular IOR Level" in b.inputs:
        b.inputs["Specular IOR Level"].default_value = spec
    m.diffuse_color = (*color, 1)
    return m


def _reset_nodes(m):
    nt = m.node_tree
    for n in list(nt.nodes):
        if n.type not in ("BSDF_PRINCIPLED", "OUTPUT_MATERIAL"):
            nt.nodes.remove(n)
    return nt, _bsdf(m)


def mat_wood(name, dark=(0.20, 0.11, 0.05), light=(0.42, 0.26, 0.13), rough=0.45, scale=6.0, axis="X"):
    """Oak-like grain: stretched noise + wave, mapped along `axis`."""
    m = mat(name, light, rough)
    nt, b = _reset_nodes(m)
    tc = nt.nodes.new("ShaderNodeTexCoord")
    mp = nt.nodes.new("ShaderNodeMapping")
    # grain runs along `axis`: compress the other two axes so features stretch along the grain
    mp.inputs["Scale"].default_value = (0.35, 5, 5) if axis == "X" else ((5, 0.35, 5) if axis == "Y" else (5, 5, 0.35))
    nt.links.new(tc.outputs["Object"], mp.inputs["Vector"])
    nz = nt.nodes.new("ShaderNodeTexNoise")
    nz.inputs["Scale"].default_value = scale * 0.6
    nz.inputs["Detail"].default_value = 10
    nz.inputs["Roughness"].default_value = 0.55
    nt.links.new(mp.outputs["Vector"], nz.inputs["Vector"])
    wv = nt.nodes.new("ShaderNodeTexWave")
    wv.wave_type = "RINGS"
    wv.inputs["Scale"].default_value = 1.1
    wv.inputs["Distortion"].default_value = 14
    wv.inputs["Detail"].default_value = 4
    wv.inputs["Detail Roughness"].default_value = 0.6
    nt.links.new(mp.outputs["Vector"], wv.inputs["Vector"])
    mix = nt.nodes.new("ShaderNodeMix")
    mix.data_type = "FLOAT"
    mix.inputs["Factor"].default_value = 0.45
    nt.links.new(nz.outputs["Fac"], mix.inputs["A"])
    nt.links.new(wv.outputs["Fac"], mix.inputs["B"])
    ramp = nt.nodes.new("ShaderNodeValToRGB")
    ramp.color_ramp.elements[0].position = 0.2
    ramp.color_ramp.elements[0].color = (*dark, 1)
    ramp.color_ramp.elements[1].position = 0.85
    ramp.color_ramp.elements[1].color = (*light, 1)
    nt.links.new(mix.outputs["Result"], ramp.inputs["Fac"])
    # fine pore streaks along the grain
    mp2 = nt.nodes.new("ShaderNodeMapping")
    mp2.inputs["Scale"].default_value = tuple(v * 30 for v in mp.inputs["Scale"].default_value)
    nt.links.new(tc.outputs["Object"], mp2.inputs["Vector"])
    fine = nt.nodes.new("ShaderNodeTexNoise")
    fine.inputs["Scale"].default_value = 3.0
    fine.inputs["Detail"].default_value = 2
    nt.links.new(mp2.outputs["Vector"], fine.inputs["Vector"])
    fr = nt.nodes.new("ShaderNodeMapRange")
    fr.inputs["From Min"].default_value = 0.35
    fr.inputs["From Max"].default_value = 0.65
    fr.inputs["To Min"].default_value = 0.82
    fr.inputs["To Max"].default_value = 1.0
    nt.links.new(fine.outputs["Fac"], fr.inputs["Value"])
    mul = nt.nodes.new("ShaderNodeMix")
    mul.data_type = "RGBA"
    mul.blend_type = "MULTIPLY"
    mul.inputs["Factor"].default_value = 1.0
    nt.links.new(ramp.outputs["Color"], mul.inputs["A"])
    nt.links.new(fr.outputs["Result"], mul.inputs["B"])
    nt.links.new(mul.outputs["Result"], b.inputs["Base Color"])
    rr = nt.nodes.new("ShaderNodeMapRange")
    rr.inputs["To Min"].default_value = rough - 0.08
    rr.inputs["To Max"].default_value = rough + 0.12
    nt.links.new(nz.outputs["Fac"], rr.inputs["Value"])
    nt.links.new(rr.outputs["Result"], b.inputs["Roughness"])
    return m


def mat_plaster(name, color=(0.74, 0.71, 0.65), rough=0.92):
    """Matte plaster with very soft mottling (kept low-contrast so UI text stays readable over it)."""
    m = mat(name, color, rough, spec=0.3)
    nt, b = _reset_nodes(m)
    nz = nt.nodes.new("ShaderNodeTexNoise")
    nz.inputs["Scale"].default_value = 3.0
    nz.inputs["Detail"].default_value = 10
    ramp = nt.nodes.new("ShaderNodeValToRGB")
    c0 = tuple(max(0, v * 0.93) for v in color)
    c1 = tuple(min(1, v * 1.04) for v in color)
    ramp.color_ramp.elements[0].color = (*c0, 1)
    ramp.color_ramp.elements[1].color = (*c1, 1)
    nt.links.new(nz.outputs["Fac"], ramp.inputs["Fac"])
    nt.links.new(ramp.outputs["Color"], b.inputs["Base Color"])
    return m


def mat_tiles(name, tile=0.6, base=(0.55, 0.50, 0.44), grout=(0.33, 0.31, 0.28), rough=0.55):
    m = mat(name, base, rough)
    nt, b = _reset_nodes(m)
    tc = nt.nodes.new("ShaderNodeTexCoord")
    br = nt.nodes.new("ShaderNodeTexBrick")
    br.offset = 0.0
    br.inputs["Scale"].default_value = 1.0 / tile
    br.inputs["Mortar Size"].default_value = 0.006
    br.inputs["Brick Width"].default_value = 1.0
    br.inputs["Row Height"].default_value = 1.0
    br.inputs["Color1"].default_value = (*base, 1)
    br.inputs["Color2"].default_value = (*(v * 0.94 for v in base), 1)
    br.inputs["Mortar"].default_value = (*grout, 1)
    nt.links.new(tc.outputs["Object"], br.inputs["Vector"])
    nz = nt.nodes.new("ShaderNodeTexNoise")
    nz.inputs["Scale"].default_value = 18
    mix = nt.nodes.new("ShaderNodeMix")
    mix.data_type = "RGBA"
    mix.blend_type = "MULTIPLY"
    mix.inputs["Factor"].default_value = 0.12
    nt.links.new(br.outputs["Color"], mix.inputs["A"])
    nt.links.new(nz.outputs["Color"], mix.inputs["B"])
    nt.links.new(mix.outputs["Result"], b.inputs["Base Color"])
    return m


def mat_emit(name, color, strength=1.0):
    m = mat(name, color, 1.0)
    b = _bsdf(m)
    b.inputs["Emission Color"].default_value = (*color, 1)
    b.inputs["Emission Strength"].default_value = strength
    return m


def mat_glass(name, tint=(0.85, 0.90, 0.92)):
    m = mat(name, tint, 0.04, spec=0.5)
    b = _bsdf(m)
    b.inputs["Transmission Weight"].default_value = 1.0
    b.inputs["IOR"].default_value = 1.45
    b.inputs["Alpha"].default_value = 0.25
    try:
        m.surface_render_method = "BLENDED"
    except Exception:
        pass
    return m


# ---------------------------------------------------------------- geometry
def _new_obj(name, mesh, c):
    o = bpy.data.objects.get(name)
    if o:
        bpy.data.objects.remove(o, do_unlink=True)
    o = bpy.data.objects.new(name, mesh)
    c.objects.link(o)
    return o


def box(name, size, pos, material, c, bevel=0.0, parent=None):
    """Axis-aligned box with real dimensions (no object scale). `pos` is the centre."""
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    bmesh.ops.scale(bm, vec=Vector(size), verts=bm.verts)
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    o = _new_obj(name, me, c)
    o.location = pos
    if material:
        me.materials.append(material)
    if bevel > 0:
        bv = o.modifiers.new("Bevel", "BEVEL")
        bv.width = bevel
        bv.segments = 2
        bv.limit_method = "ANGLE"
        wn = o.modifiers.new("WeightedNormal", "WEIGHTED_NORMAL")
        wn.keep_sharp = True
    if parent:
        o.parent = parent
        o.matrix_parent_inverse = parent.matrix_world.inverted()
    box_uv(o)
    return o


def box_uv(o, scale=1.0):
    """Cube-project UVs in world-size units so baked textures keep real-world density."""
    me = o.data
    if not me.uv_layers:
        me.uv_layers.new(name="UVMap")
    bm = bmesh.new()
    bm.from_mesh(me)
    uv = bm.loops.layers.uv.active
    for f in bm.faces:
        n = f.normal
        ax = max(range(3), key=lambda i: abs(n[i]))
        for l in f.loops:
            co = l.vert.co
            u, v = [(co.y, co.z), (co.x, co.z), (co.x, co.y)][ax]
            l[uv].uv = (u * scale, v * scale)
    bm.to_mesh(me)
    bm.free()


def poly_prism(name, outline, z0, z1, material, c):
    n = len(outline)
    verts = [(x, y, z) for z in (z0, z1) for x, y in outline]
    faces = [tuple(reversed(range(n))), tuple(range(n, 2 * n))] + [
        (i, (i + 1) % n, (i + 1) % n + n, i + n) for i in range(n)
    ]
    me = bpy.data.meshes.new(name)
    me.from_pydata(verts, [], faces)
    me.update()
    o = _new_obj(name, me, c)
    if material:
        me.materials.append(material)
    box_uv(o)
    return o


def empty(name, pos, c, kind="PLAIN_AXES", size=0.05):
    o = bpy.data.objects.get(name)
    if o:
        bpy.data.objects.remove(o, do_unlink=True)
    o = bpy.data.objects.new(name, None)
    o.empty_display_type = kind
    o.empty_display_size = size
    o.location = pos
    c.objects.link(o)
    return o


def world_matrix(o):
    """World matrix computed from the parent chain, valid even before any depsgraph update
    (objects created in a scene that is not the window's active scene have stale matrix_world)."""
    m = o.matrix_basis.copy()
    if o.parent:
        m = world_matrix(o.parent) @ o.matrix_parent_inverse @ m
    return m


def join(name, objs, c):
    """Merge mesh objects into one new object `name` in world space (originals untouched).
    Pure bmesh, no operators, so it works regardless of which scene is active."""
    mats = []
    out = bmesh.new()
    for o in objs:
        mw = world_matrix(o)
        tmp_me = o.data.copy()
        tmp_me.transform(mw)
        if mw.determinant() < 0:
            tmp_me.flip_normals()
        remap = []
        for m in tmp_me.materials:
            if m not in mats:
                mats.append(m)
            remap.append(mats.index(m))
        for p in tmp_me.polygons:
            p.material_index = remap[p.material_index] if remap else 0
        out.from_mesh(tmp_me)
        bpy.data.meshes.remove(tmp_me)
    me = bpy.data.meshes.new(name)
    out.to_mesh(me)
    out.free()
    for m in mats:
        me.materials.append(m)
    return _new_obj(name, me, c)


def set_origin_bottom_centre(o):
    """Move mesh so its origin is at bottom-centre of its bounds; returns that world point."""
    me = o.data
    xs = [v.co.x for v in me.vertices]; ys = [v.co.y for v in me.vertices]; zs = [v.co.z for v in me.vertices]
    p = Vector(((min(xs) + max(xs)) / 2, (min(ys) + max(ys)) / 2, min(zs)))
    me.transform(Matrix.Translation(-p))
    o.location = o.location + p
    return p


def dims(o):
    me = o.data
    xs = [v.co.x for v in me.vertices]; ys = [v.co.y for v in me.vertices]; zs = [v.co.z for v in me.vertices]
    return (max(xs) - min(xs), max(ys) - min(ys), max(zs) - min(zs))


# ---------------------------------------------------------------- source donors
def import_source(filename, scene_name):
    """Import an original GLB into its own SRC_ scene once; returns that scene. Source file is read only."""
    sc = bpy.data.scenes.get(scene_name)
    if sc:
        return sc
    import logging
    logging.disable(logging.INFO)
    sc = bpy.data.scenes.new(scene_name)
    prev = bpy.context.window.scene
    bpy.context.window.scene = sc
    bpy.ops.import_scene.gltf(filepath=str(SRC_DIR / filename))
    bpy.context.window.scene = prev
    return sc


def donor_meshes(root_names):
    """All mesh objects under the given root object names (recursive)."""
    out = []
    for rn in root_names:
        r = bpy.data.objects[rn]
        for o in [r] + list(r.children_recursive):
            if o.type == "MESH":
                out.append(o)
    return out


# ---------------------------------------------------------------- cameras / lights
def cameras(names, c):
    made = []
    for n in names:
        e = LAYOUT["cameras"][n]
        cam = bpy.data.objects.get(n)
        if not cam:
            cam = bpy.data.objects.new(n, bpy.data.cameras.new(n))
        if cam.name not in c.objects:
            for uc in list(cam.users_collection):
                uc.objects.unlink(cam)
            c.objects.link(cam)
        cam.data.lens = e["lens_mm"]
        cam.data.sensor_width = 36
        cam.data.sensor_fit = "HORIZONTAL"
        cam.data.clip_start = 0.02
        cam.data.clip_end = 50
        cam.location = e["position"]
        cam.rotation_euler = (Vector(e["target"]) - Vector(e["position"])).to_track_quat("-Z", "Y").to_euler()
        made.append(cam)
    return made


def light(name, kind, pos, energy, color, c, size=0.5, rot=None, spot=None):
    o = bpy.data.objects.get(name)
    if o:
        bpy.data.objects.remove(o, do_unlink=True)
    ld = bpy.data.lights.new(name, kind)
    ld.energy = energy
    ld.color = color
    if kind == "AREA":
        ld.shape = "RECTANGLE"
        ld.size, ld.size_y = size if isinstance(size, tuple) else (size, size)
    elif kind in ("POINT", "SPOT"):
        ld.shadow_soft_size = size if not isinstance(size, tuple) else size[0]
    if kind == "SPOT" and spot:
        ld.spot_size = spot
        ld.spot_blend = 0.6
    o = bpy.data.objects.new(name, ld)
    o.location = pos
    if rot:
        o.rotation_euler = rot
    c.objects.link(o)
    return o


def aim(o, target):
    o.rotation_euler = (Vector(target) - o.location).to_track_quat("-Z", "Y").to_euler()


def render_still(sc, cam_name, path, res=(1366, 768), samples=None, engine="BLENDER_EEVEE"):
    sc.camera = bpy.data.objects[cam_name]
    try:
        sc.render.engine = engine
    except TypeError:
        pass
    sc.render.resolution_x, sc.render.resolution_y = res
    sc.render.resolution_percentage = 100
    sc.render.image_settings.file_format = "PNG"
    sc.render.filepath = str(path)
    if samples and hasattr(sc.eevee, "taa_render_samples"):
        sc.eevee.taa_render_samples = samples
    bpy.ops.render.render(write_still=True, scene=sc.name)
    return path
