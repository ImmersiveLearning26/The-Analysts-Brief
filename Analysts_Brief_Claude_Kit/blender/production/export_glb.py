"""Export the runtime GLBs from analysts_brief_production.blend into blender/production/export/.

  office.glb               OFFICE collection (Evidence-Room office, anchors, hotspots); no cameras/lights/previews
  (folder.glb and hall.glb: retired; see build_casefile.py and build_hall_lightmap.py)
  kalinda.glb              KALINDA map + looping effect clips (KAL_EdgePulse_*, KAL_NetRing_*, KAL_NetPulse_*)
  chair_office_props.glb   CHAIR_Variant props (recorder, cassette, papers, CHAIR_RecIndicator); room = office.glb

glTF cannot carry procedural shader nodes, so for the duration of the export materials are swapped (user_remap,
then swapped back) for export versions:
  * terrain (AB_KAL_Terrain) and woven hanging -> baked image (Cycles DIFFUSE colour)
  * image x constant tint (Mix MULTIPLY) and image -> Hue/Saturation -> pre-processed image copies
  * other procedural looks (plaster, paint, oak, manila, paper, sky) -> flat colour at their authored base colour
  * edge wall -> emissive accent with constant alpha (the runtime scrolls its bands, see KALINDA_MAP_EFFECTS.md)
Images over 2048 px are downscaled to 2048 (kit budget) inside the working file; source asset files are untouched.
"""
import bpy, sys, math, json, struct, importlib
import numpy as np
from pathlib import Path
from mathutils import Vector

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
import ab_lib as L
importlib.reload(L)

OUT = HERE / "export"
OUT.mkdir(exist_ok=True)
CAP = 2048
PROCEDURAL = {"TEX_NOISE", "TEX_WAVE", "TEX_BRICK", "TEX_CHECKER", "VALTORGB", "SEPARATE_XYZ", "MATH", "MAP_RANGE", "TEX_COORD"}
report = {"swapped": {}, "baked": [], "downscaled": [], "exports": {}}


# ------------------------------------------------------------------ helpers: image processing
def img_np(img):
    a = np.empty(img.size[0] * img.size[1] * 4, dtype=np.float32)
    img.pixels.foreach_get(a)
    return a.reshape(-1, 4)


def new_img_from(src, name, arr):
    im = bpy.data.images.get(name)
    if im:
        bpy.data.images.remove(im)
    im = bpy.data.images.new(name, src.size[0], src.size[1], alpha=True)
    im.colorspace_settings.name = src.colorspace_settings.name
    im.pixels.foreach_set(arr.ravel())
    im.pack()
    return im


def rgb_to_hsv(c):
    r, g, b = c[:, 0], c[:, 1], c[:, 2]
    mx = np.max(c[:, :3], axis=1); mn = np.min(c[:, :3], axis=1); d = mx - mn
    h = np.zeros_like(mx)
    m = d > 1e-6
    rc = np.where(m, (mx - r) / np.where(m, d, 1), 0); gc = np.where(m, (mx - g) / np.where(m, d, 1), 0); bc = np.where(m, (mx - b) / np.where(m, d, 1), 0)
    h = np.where(r == mx, bc - gc, np.where(g == mx, 2.0 + rc - bc, 4.0 + gc - rc))
    h = np.where(m, (h / 6.0) % 1.0, 0.0)
    s = np.where(mx > 1e-6, d / np.where(mx > 1e-6, mx, 1), 0)
    return h, s, mx


def hsv_to_rgb(h, s, v):
    i = np.floor(h * 6.0).astype(int) % 6; f = h * 6.0 - np.floor(h * 6.0)
    p = v * (1 - s); q = v * (1 - s * f); t = v * (1 - s * (1 - f))
    r = np.choose(i, [v, q, p, p, t, v]); g = np.choose(i, [t, v, v, q, p, p]); b = np.choose(i, [p, p, t, v, v, q])
    return np.stack([r, g, b], axis=1)


# ------------------------------------------------------------------ export-material builders
def bsdf_of(m):
    return next((n for n in m.node_tree.nodes if n.type == "BSDF_PRINCIPLED"), None) if m and m.node_tree else None


def base_mat(m, name):
    e = bpy.data.materials.get(name)
    if e:
        bpy.data.materials.remove(e)
    e = bpy.data.materials.new(name)
    try:
        e.use_nodes = True
    except Exception:
        pass
    eb = bsdf_of(e); ob = bsdf_of(m)
    if ob:
        for k in ("Metallic", "Roughness", "Alpha", "Emission Color", "Emission Strength", "IOR", "Transmission Weight"):
            if k in ob.inputs and k in eb.inputs and not ob.inputs[k].is_linked:
                eb.inputs[k].default_value = ob.inputs[k].default_value
        if ob.inputs["Roughness"].is_linked:
            eb.inputs["Roughness"].default_value = 0.7
    eb.inputs["Base Color"].default_value = tuple(m.diffuse_color)
    for attr in ("surface_render_method", "use_backface_culling", "blend_method"):
        try:
            setattr(e, attr, getattr(m, attr))
        except Exception:
            pass
    return e, eb


def image_into(e, eb, img, uv_name=None, mapping=None):
    nt = e.node_tree
    t = nt.nodes.new("ShaderNodeTexImage"); t.image = img
    if uv_name or mapping:
        uvn = nt.nodes.new("ShaderNodeUVMap"); uvn.uv_map = uv_name or ""
        if mapping:
            mp = nt.nodes.new("ShaderNodeMapping"); mp.inputs["Scale"].default_value = mapping
            nt.links.new(uvn.outputs["UV"], mp.inputs["Vector"]); nt.links.new(mp.outputs["Vector"], t.inputs["Vector"])
        else:
            nt.links.new(uvn.outputs["UV"], t.inputs["Vector"])
    nt.links.new(t.outputs["Color"], eb.inputs["Base Color"])
    return t


def black_emission_nodes(m):
    """Image -> Emission Color where the image is (near) black: useless glow maps that also fail WebP conversion."""
    out = []
    for n in m.node_tree.nodes:
        if n.type == "TEX_IMAGE" and n.image and any(l.to_socket.name == "Emission Color" for l in n.outputs["Color"].links):
            try:
                a = img_np(n.image)
                if float(a[::97, :3].mean()) < 0.02:
                    out.append(n)
            except Exception:
                out.append(n)
    return out


def classify(m):
    if not m or not m.node_tree:
        return None
    types = {n.type for n in m.node_tree.nodes}
    if m.name == "AB_KAL_Terrain" or m.name == "AB_WovenHanging":
        return "bake"
    if m.name == "AB_KAL_EdgeWall":
        return "edgewall"
    imgs = [n for n in m.node_tree.nodes if n.type == "TEX_IMAGE"]
    if imgs and "HUE_SAT" in types:
        return "huesat"
    if imgs and any(n.type == "MIX" and n.blend_type == "MULTIPLY" and not n.inputs["B"].is_linked for n in m.node_tree.nodes):
        return "tint"
    if not imgs and (types & PROCEDURAL):
        return "flat"
    if black_emission_nodes(m):
        return "drop_emission"
    return None


def export_variant(m):
    kind = classify(m)
    if kind is None:
        return None
    name = m.name + "__EXPORT"
    if kind == "flat":
        e, eb = base_mat(m, name)
        return e
    if kind == "drop_emission":
        old = bpy.data.materials.get(name)
        if old:
            bpy.data.materials.remove(old)
        e = m.copy(); e.name = name
        for n in black_emission_nodes(e):
            e.node_tree.nodes.remove(n)
        bb_ = bsdf_of(e)
        if bb_:
            bb_.inputs["Emission Strength"].default_value = 0.0
        return e
    if kind == "edgewall":
        e, eb = base_mat(m, name)
        eb.inputs["Emission Color"].default_value = (*m.diffuse_color[:3], 1); eb.inputs["Emission Strength"].default_value = 3.0
        eb.inputs["Alpha"].default_value = 0.35
        try:
            e.surface_render_method = "BLENDED"
        except Exception:
            pass
        return e
    tex = next(n for n in m.node_tree.nodes if n.type == "TEX_IMAGE")
    src = tex.image
    arr = img_np(src)
    uv_name = None; mapping = None
    vec_links = tex.inputs["Vector"].links
    if vec_links:
        n_ = vec_links[0].from_node
        if n_.type == "MAPPING":
            mapping = tuple(n_.inputs["Scale"].default_value)
            uv_name = "UVMap"
        elif n_.type == "UVMAP":
            uv_name = n_.uv_map
    if kind == "tint":
        mix = next(n for n in m.node_tree.nodes if n.type == "MIX" and n.blend_type == "MULTIPLY" and not n.inputs["B"].is_linked)
        tint = np.array(mix.inputs["B"].default_value[:3], dtype=np.float32)
        out = arr.copy(); out[:, :3] = np.clip(arr[:, :3] * tint, 0, 1)
        img = new_img_from(src, f"{src.name}__{m.name}", out)
    else:
        hs = next(n for n in m.node_tree.nodes if n.type == "HUE_SAT")
        hue, sat, val = (hs.inputs["Hue"].default_value, hs.inputs["Saturation"].default_value, hs.inputs["Value"].default_value)
        h, s, v = rgb_to_hsv(arr)
        rgb = hsv_to_rgb((h + hue - 0.5) % 1.0, np.clip(s * sat, 0, 1), np.clip(v * val, 0, 1))
        out = arr.copy(); out[:, :3] = rgb
        img = new_img_from(src, f"{src.name}__{m.name}", out)
    e, eb = base_mat(m, name)
    image_into(e, eb, img, uv_name, mapping)
    return e


# ------------------------------------------------------------------ bakes (terrain, woven hanging)
def bake_to(obj, scene, mat, img, uv_name):
    prev = bpy.context.window.scene
    bpy.context.window.scene = scene
    eng = scene.render.engine
    scene.render.engine = "CYCLES"
    scene.cycles.samples = 8
    try:
        scene.cycles.device = "CPU"
    except Exception:
        pass
    nt = mat.node_tree
    node = nt.nodes.new("ShaderNodeTexImage"); node.image = img
    for n in nt.nodes:
        n.select = False
    node.select = True; nt.nodes.active = node
    obj.data.uv_layers.active = obj.data.uv_layers[uv_name]
    for o in scene.view_layers[0].objects:
        o.select_set(False)
    obj.select_set(True); scene.view_layers[0].objects.active = obj
    with bpy.context.temp_override(scene=scene, view_layer=scene.view_layers[0], active_object=obj, selected_objects=[obj], object=obj):
        bpy.ops.object.bake(type="DIFFUSE", pass_filter={"COLOR"}, margin=6, use_clear=True)
    nt.nodes.remove(node)
    obj.data.uv_layers.active = obj.data.uv_layers[0]
    img.pack()
    scene.render.engine = eng
    bpy.context.window.scene = prev
    report["baked"].append((obj.name, img.name, tuple(img.size)))


def bake_terrain():
    base = next(o for o in bpy.data.collections["KALINDA"].objects if o.name.startswith("KAL_Base"))
    me = base.data
    uv = me.uv_layers.get("BakeUV") or me.uv_layers.new(name="BakeUV")
    xs = [v.co.x for v in me.vertices]; ys = [v.co.y for v in me.vertices]
    x0, x1, y0, y1 = min(xs), max(xs), min(ys), max(ys)
    zmax = max(v.co.z for v in me.vertices if abs(v.co.x) > 0)            # for the side band
    for poly in me.polygons:
        top = poly.normal.z > 0.3
        for li in poly.loop_indices:
            co = me.vertices[me.loops[li].vertex_index].co
            if top:
                uv.data[li].uv = ((co.x - x0) / (x1 - x0), (co.y - y0) / (y1 - y0) * 0.86)
            else:                                                             # soil band: strip along the top of the map
                a = (math.atan2(co.y, co.x) + math.pi) / math.tau
                uv.data[li].uv = (a, 0.88 + 0.11 * max(0.0, min(1.0, co.z / 0.03)))
    img = bpy.data.images.get("KAL_Terrain_Baked") or bpy.data.images.new("KAL_Terrain_Baked", 2048, 2048)
    m = bpy.data.materials["AB_KAL_Terrain"]
    bake_to(base, bpy.data.scenes["KALINDA"], m, img, "BakeUV")
    e = bpy.data.materials.get("AB_KAL_Terrain__EXPORT")
    if e:
        bpy.data.materials.remove(e)
    e = bpy.data.materials.new("AB_KAL_Terrain__EXPORT")
    try:
        e.use_nodes = True
    except Exception:
        pass
    eb = bsdf_of(e); eb.inputs["Roughness"].default_value = 0.9
    image_into(e, eb, img, "BakeUV")
    return m, e


def bake_weave():
    o = bpy.data.objects.get("OFFICE_WovenHanging")
    if not o:
        return None
    img = bpy.data.images.get("OFFICE_WovenHanging_Baked") or bpy.data.images.new("OFFICE_WovenHanging_Baked", 256, 512)
    m = bpy.data.materials["AB_WovenHanging"]
    bake_to(o, bpy.data.scenes["OFFICE"], m, img, o.data.uv_layers[0].name)
    e = bpy.data.materials.get("AB_WovenHanging__EXPORT")
    if e:
        bpy.data.materials.remove(e)
    e = bpy.data.materials.new("AB_WovenHanging__EXPORT")
    try:
        e.use_nodes = True
    except Exception:
        pass
    eb = bsdf_of(e); eb.inputs["Roughness"].default_value = 0.95
    image_into(e, eb, img, o.data.uv_layers[0].name)
    return m, e


# ------------------------------------------------------------------ selection of objects per export
def coll_objects(name, skip_prefix=(), skip_colls=()):
    out = []
    def walk(c):
        if c.name in skip_colls:
            return
        for o in c.objects:
            if not o.name.startswith(skip_prefix) and o.type in {"MESH", "EMPTY", "CURVE"}:
                out.append(o)
        for ch in c.children:
            walk(ch)
    walk(bpy.data.collections[name])
    return out


EXPORTS = [
    ("office.glb", "OFFICE", coll_objects("OFFICE", ("PREVIEW_", "DBG_"), ("OFFICE_Cameras", "OFFICE_Lights", "OFFICE_ER_Lighting", "OFFICE_Debug")), False),
    # folder.glb and hall.glb are retired (20 Nov 2026): the case file is exported by build_casefile.py (casefile.glb)
    # and the hall by build_hall_lightmap.py (hall.glb from the user's lightmapped hall). Do not re-add them here.
    ("kalinda.glb", "KALINDA", coll_objects("KALINDA"), True),
    ("chair_office_props.glb", "CHAIR_OFFICE", [o for o in bpy.data.collections["CHAIR_Variant"].objects if o.type == "MESH"], False),
]


def materials_of(objs):
    ms = set()
    for o in objs:
        if o.type == "MESH":
            for s in o.material_slots:
                if s.material:
                    ms.add(s.material)
    return ms


def images_of(mats):
    out = set()
    for m in mats:
        if m.node_tree:
            for n in m.node_tree.nodes:
                if n.type == "TEX_IMAGE" and n.image:
                    out.add(n.image)
    return out


def glb_info(path):
    with open(path, "rb") as fh:
        fh.read(12); ln, _ = struct.unpack("<II", fh.read(8)); js = json.loads(fh.read(ln))
    return {"MB": round(path.stat().st_size / 1e6, 2), "nodes": len(js.get("nodes", [])), "meshes": len(js.get("meshes", [])),
            "materials": len(js.get("materials", [])), "images": len(js.get("images", [])),
            "animations": [a.get("name") for a in js.get("animations", [])],
            "extensions": js.get("extensionsUsed", []), "node_names": [n.get("name") for n in js.get("nodes", [])]}


def run():
    # bakes first (they need the original procedural materials)
    swaps = []
    t = bake_terrain(); swaps.append(t)
    w = bake_weave()
    if w:
        swaps.append(w)
    all_objs = [o for _, _, objs, _ in EXPORTS for o in objs]
    mats = materials_of(all_objs)
    for m in sorted(mats, key=lambda m: m.name):
        if m.name in ("AB_KAL_Terrain", "AB_WovenHanging"):
            continue
        v = export_variant(m)
        if v:
            swaps.append((m, v)); report["swapped"][m.name] = classify(m)
    # texture budget
    for img in images_of(mats | {v for _, v in swaps}):
        if img.size[0] > CAP or img.size[1] > CAP:
            k = CAP / max(img.size)
            report["downscaled"].append((img.name, tuple(img.size)))
            img.scale(max(1, int(img.size[0] * k)), max(1, int(img.size[1] * k)))
            img.pack()
    for m, v in swaps:
        m.user_remap(v)
    try:
        for fname, scene_name, objs, anim in EXPORTS:
            sc = bpy.data.scenes[scene_name]
            bpy.context.window.scene = sc
            vl = sc.view_layers[0]
            for o in vl.objects:
                o.select_set(False)
            sel = 0
            for o in objs:
                if o.name in vl.objects:
                    o.select_set(True); sel += 1
            path = OUT / fname
            # use_active_scene: without it the exporter writes EVERY scene in the file (all SRC_ donor scenes too)
            kw = dict(filepath=str(path), export_format="GLB", use_selection=True, use_active_scene=True, export_apply=True, export_yup=True,
                      export_cameras=False, export_lights=False, export_extras=True, export_animations=anim,
                      export_image_format="WEBP", export_draco_mesh_compression_enable=True)
            if anim:
                kw["export_animation_mode"] = "ACTIONS"
            try:
                bpy.ops.export_scene.gltf(**kw)
            except TypeError:
                kw.pop("export_image_format"); bpy.ops.export_scene.gltf(**kw)
            report["exports"][fname] = {"selected": sel, **{k: v for k, v in glb_info(path).items() if k != "node_names"}}
            report["exports"][fname]["sample_nodes"] = [n for n in glb_info(path)["node_names"] if n and n.startswith(
                ("FOLDER_", "PAPER_", "TAG_", "ANCHOR", "HOTSPOT", "KAL_Root", "KAL_Base", "KAL_Mast", "KAL_Stall_0", "KAL_City", "KAL_Edge", "KAL_Net", "CHAIR_", "HALL_Chair_0_0", "HALL_PlanningTable"))][:40]
    finally:
        for m, v in swaps:
            v.user_remap(m)
    (OUT / "export_report.json").write_text(json.dumps(report, indent=1))
    return report


if __name__ == "__main__":
    r = run()
    print("EXPORT_COMPLETE", json.dumps({k: {kk: vv for kk, vv in v.items() if kk in ("MB", "animations", "selected")} for k, v in r["exports"].items()}))
