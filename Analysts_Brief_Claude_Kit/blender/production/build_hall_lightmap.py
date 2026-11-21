"""HALL_LM scene: the school hall for P09-P11, built on the user's "Hall | Lightmap Test" model
(hall__lightmap_test.glb, by Pedro Silva, CC-BY-4.0: credit in production/RUNTIME_MODELS.md). Replaces build_hall.py.

The model is a T-shaped gallery (a 1.5 m wide corridor, 9.5 m long, with a 4 m stem), with its lighting baked into
the emission channel (lightmaps). It is used as it is, not stretched:
  * the Commission's planning table stands across the T junction, two officials' chairs on its far side;
  * the learner sits in the stem, facing the junction (CAM_Hall);
  * sixteen residents' chairs line the two arms of the corridor, facing the table (18 chairs with the officials').
  * the three paintings become Kalinda material: the map (two views) and the Dialogue notice.
Textures are capped at 1024 px and exported as WebP; the source GLB is never modified.
"""
import bpy, math
import numpy as np
from pathlib import Path
from mathutils import Vector

HERE = Path(__file__).resolve().parent
TEX = HERE / "textures"; TEX.mkdir(exist_ok=True)
OUT = HERE / "export"
SRC_GLB = HERE.parents[2] / "hall__lightmap_test.glb"     # "The Analyst’s Brief/hall__lightmap_test.glb"
RENDERS = HERE / "renders"
CAP = 1024
FONT_SANS = "/System/Library/Fonts/Supplemental/Arial Bold.ttf"
FONT_SERIF = "/System/Library/Fonts/Supplemental/Georgia.ttf"
report = {}


def scene(name, clear=True):
    s = bpy.data.scenes.get(name) or bpy.data.scenes.new(name)
    if clear:
        for o in list(s.collection.all_objects):
            bpy.data.objects.remove(o, do_unlink=True)
    return s


def source_scene():
    s = scene("SRC_HallLightmap", clear=False)
    if not any(o.type == "MESH" for o in s.objects):
        win = bpy.context.window; prev = win.scene; win.scene = s
        try:
            bpy.ops.import_scene.gltf(filepath=str(SRC_GLB))
        finally:
            win.scene = prev
    return s


def px(img):
    a = np.empty(img.size[0] * img.size[1] * 4, dtype=np.float32)
    img.pixels.foreach_get(a)
    return a.reshape(img.size[1], img.size[0], 4)


def save_img(name, arr):
    im = bpy.data.images.get(name)
    if im:
        bpy.data.images.remove(im)
    h, w = arr.shape[:2]
    im = bpy.data.images.new(name, w, h, alpha=False)
    im.pixels.foreach_set(arr.astype(np.float32).ravel())
    im.filepath_raw = str(TEX / name); im.file_format = "PNG"; im.save()
    return im


def crop_portrait(path, name, aspect):                     # aspect = width / height
    src = bpy.data.images.load(str(path), check_existing=False)
    a = px(src); h, w = a.shape[:2]
    cw = min(w, int(h * aspect)); ch = int(cw / aspect)
    x0 = (w - cw) // 2; y0 = (h - ch) // 2
    out = save_img(name, a[y0:y0 + ch, x0:x0 + cw])
    bpy.data.images.remove(src)
    if out.size[1] > CAP:
        out.scale(int(CAP * aspect), CAP); out.save()
    return out


def render_notice(path, W=700, H=966):
    s = scene("TMP_Notice")
    s.render.resolution_x, s.render.resolution_y, s.render.resolution_percentage = W, H, 100
    try:
        s.render.engine = "BLENDER_WORKBENCH"
    except TypeError:
        pass
    s.display.shading.light = "FLAT"; s.display.shading.color_type = "MATERIAL"
    s.view_settings.view_transform = "Standard"
    s.render.image_settings.file_format = "PNG"
    cam = bpy.data.objects.new("TMP_NoticeCam", bpy.data.cameras.new("TMP_NoticeCam"))
    cam.data.type = "ORTHO"; cam.data.ortho_scale = H / 100; cam.location = (0, 0, 10)
    s.collection.objects.link(cam); s.camera = cam
    X0, Y0 = -W / 200, H / 200

    def mat(n, c):
        m = bpy.data.materials.get(n) or bpy.data.materials.new(n); m.diffuse_color = c; return m
    paper, ink, accent, faint = mat("TMP_NPaper", (0.93, 0.89, 0.80, 1)), mat("TMP_NInk", (0.09, 0.08, 0.07, 1)), \
        mat("TMP_NAcc", (0.72, 0.36, 0.12, 1)), mat("TMP_NFaint", (0.33, 0.3, 0.26, 1))

    def rect(x, y, w, h, m, z=0.0):
        me = bpy.data.meshes.new("TMP_R")
        me.from_pydata([(0, 0, 0), (w / 100, 0, 0), (w / 100, -h / 100, 0), (0, -h / 100, 0)], [], [(0, 1, 2, 3)])
        o = bpy.data.objects.new("TMP_R", me); o.location = (X0 + x / 100, Y0 - y / 100, z); me.materials.append(m)
        s.collection.objects.link(o)

    def text(body, x, y, size, font, m, align="CENTER"):
        cu = bpy.data.curves.new("TMP_T", "FONT"); cu.body = body; cu.size = size / 100
        cu.font = bpy.data.fonts.load(font, check_existing=True); cu.align_x = align; cu.align_y = "TOP"
        o = bpy.data.objects.new("TMP_T", cu); o.location = (X0 + x / 100, Y0 - y / 100, 0.02); o.data.materials.append(m)
        s.collection.objects.link(o)

    rect(0, 0, W, H, paper, -0.01)
    rect(0, 0, W, 150, accent)
    text("TAMARIND CROSSING", W / 2, 44, 46, FONT_SANS, paper)
    text("COMMUNITY", W / 2, 230, 74, FONT_SANS, ink)
    text("DIALOGUE", W / 2, 320, 74, FONT_SANS, ink)
    rect(120, 430, W - 240, 4, accent)
    text("Thursday · 4 pm", W / 2, 470, 44, FONT_SERIF, ink)
    text("School hall", W / 2, 530, 44, FONT_SERIF, ink)
    text("The new district boundaries:", W / 2, 640, 30, FONT_SERIF, faint)
    text("bring your questions.", W / 2, 682, 30, FONT_SERIF, faint)
    text("All residents welcome", W / 2, 800, 36, FONT_SANS, accent)
    text("The Commission · Research Unit", W / 2, 890, 24, FONT_SANS, faint)
    s.render.filepath = str(path)
    bpy.ops.render.render(write_still=True, scene=s.name)
    for o in list(s.collection.all_objects):
        bpy.data.objects.remove(o, do_unlink=True)
    bpy.data.scenes.remove(s)
    im = bpy.data.images.load(str(path), check_existing=False)
    im.name = path.name
    return im


_capped = {}
def capped(img):
    """Use a <=1024 px copy of a source image (the source file is never touched). One copy per source per run."""
    if max(img.size) <= CAP:
        return img
    if img.name in _capped:
        return _capped[img.name]
    name = img.name.replace(".", "_") + "_hall1k.png"
    old = bpy.data.images.get(name)
    if old is not None:
        old.name = name + "_old"                            # a copy from an earlier run; its users are rebuilt
    _ = img.pixels[0]                                       # make sure the packed source is loaded
    tmp = img.copy(); tmp.scale(CAP, max(1, int(CAP * img.size[1] / img.size[0])))
    w, h = tmp.size; arr = np.empty(w * h * 4, dtype=np.float32); tmp.pixels.foreach_get(arr)
    bpy.data.images.remove(tmp)
    out = bpy.data.images.new(name + "_w", w, h, alpha=True, float_buffer=False)   # always 8-bit (some sources are 16-bit)
    out.colorspace_settings.name = img.colorspace_settings.name
    out.pixels.foreach_set(arr); out.filepath_raw = str(TEX / name); out.file_format = "PNG"; out.save()
    bpy.data.images.remove(out)
    c = bpy.data.images.load(str(TEX / name), check_existing=False)   # a clean file image, not a packed copy
    c.name = name; c.colorspace_settings.name = img.colorspace_settings.name
    _capped[img.name] = c
    return c


def paint_material(name, img):
    m = bpy.data.materials.get(name) or bpy.data.materials.new(name)
    m.use_nodes = True; nt = m.node_tree
    for n in list(nt.nodes):
        if n.type not in ("BSDF_PRINCIPLED", "OUTPUT_MATERIAL"):
            nt.nodes.remove(n)
    b = next(n for n in nt.nodes if n.type == "BSDF_PRINCIPLED")
    t = nt.nodes.new("ShaderNodeTexImage"); t.image = img
    nt.links.new(t.outputs["Color"], b.inputs["Base Color"])
    nt.links.new(t.outputs["Color"], b.inputs["Emission Color"])   # lit like its baked neighbours
    b.inputs["Emission Strength"].default_value = 0.55; b.inputs["Roughness"].default_value = 0.6
    return m


def fit_uv(o):
    """Map a picture quad 0..1, upright and unmirrored as seen from the room."""
    me = o.data; mw = o.matrix_world
    ws = [mw @ v.co for v in me.vertices]
    n = (mw.to_3x3() @ me.polygons[0].normal).normalized()
    centre = sum(ws, Vector()) / len(ws)
    if n.dot(Vector((-2.0, 0, 1.4)) - centre) < 0:            # make the normal face into the corridor
        n = -n
    up = Vector((0, 0, 1)); right = up.cross(n).normalized()
    us = [w.dot(right) for w in ws]; vs = [w.z for w in ws]
    u0, u1, v0, v1 = min(us), max(us), min(vs), max(vs)
    uv = me.uv_layers.active.data
    for li, l in enumerate(me.loops):
        w = ws[l.vertex_index]
        uv[li].uv = ((w.dot(right) - u0) / (u1 - u0), (w.z - v0) / (v1 - v0))


def build():
    src = source_scene()
    s = scene("HALL_LM")
    root = bpy.data.objects.new("HALL_Root", None); s.collection.objects.link(root)
    copies = {}

    def copy(o, parent):
        c = o.copy()
        if o.type == "MESH":
            c.data = o.data.copy()                         # own mesh: UVs and materials change here only
        c.name = "HALL_" + o.name.split(".")[0]
        s.collection.objects.link(c); c.parent = parent
        copies[o.name] = c
        for ch in o.children:
            copy(ch, c)

    for o in [o for o in src.objects if o.parent is None and o.name != "TMP_Top"]:
        copy(o, root)

    # own material copies (the imported source keeps its own), textures capped at 1024 px
    own = {}
    for c in copies.values():
        if c.type != "MESH":
            continue
        for i, m in enumerate(list(c.data.materials)):
            if not m or not m.node_tree:
                continue
            if m.name not in own:
                mc = m.copy(); mc.name = "HALL_" + m.name.split(".")[0]
                for n in mc.node_tree.nodes:
                    if n.type == "TEX_IMAGE" and n.image:
                        n.image = capped(n.image)
                own[m.name] = mc
            c.data.materials[i] = own[m.name]
    report["materials"] = len(own)

    # the three paintings become Kalinda material
    import re
    paint = {o.name: o for o in copies.values() if o.type == "MESH" and re.search(r"_Paint\d_0$", o.name)}
    asp = 0.42 / 0.58
    imgs = {
        "Paint1": crop_portrait(RENDERS / "kalinda_three_quarter.png", "hall_poster_kalinda_a.png", asp),
        "Paint2": render_notice(TEX / "hall_poster_dialogue.png"),
        "Paint3": crop_portrait(RENDERS / "kalinda_CAM_Model.png", "hall_poster_kalinda_b.png", asp),
    }
    for o in paint.values():
        key = re.search(r"_(Paint\d)_0$", o.name).group(1)
        o.data.materials.clear(); o.data.materials.append(paint_material("MAT_Hall_" + key, imgs[key]))
        fit_uv(o)
    report["paintings"] = sorted(o.name for o in paint.values())

    # furniture from the previous hall build (shared mesh data, placed for the T-shaped gallery)
    old = bpy.data.scenes["HALL"]
    def claim(name):                                        # the superseded hall build keeps its objects, renamed
        o = bpy.data.objects.get(name)
        if o and s.name not in [sc.name for sc in o.users_scene]:
            o.name = "HALLv1_" + name
    for n in ("CAM_Hall", "HALL_PlanningTable", "HOTSPOT_HallTable", "ANCHOR_HallResidents", "HALL_Chair_Learner"):
        claim(n)
    def place(name, new_name, loc, face_dir=None, rot=None):
        src_o = bpy.data.objects.get(name) or bpy.data.objects["HALLv1_" + name]
        o = src_o.copy(); o.name = new_name
        s.collection.objects.link(o); o.parent = None; o.location = loc
        if face_dir is not None:
            o.rotation_euler = (0, 0, math.atan2(-face_dir[0], face_dir[1]))      # chairs face +y at rotation 0
        if rot is not None:
            o.rotation_euler = (0, 0, rot)
        return o

    table = place("HALL_PlanningTable", "HALL_PlanningTable", (-0.55, 0.0, 0.0), rot=math.pi / 2)
    hot = place("HOTSPOT_HallTable", "HOTSPOT_HallTable", (-0.55, 0.0, 0.8))
    place("HALL_Chair_Learner", "HALL_Chair_Learner", (-2.0, 0.0, 0.0), face_dir=(1, 0))   # under the camera
    place("HALL_Chair_0_0", "HALL_Chair_Official_1", (0.32, -0.5, 0.0), face_dir=(-1, 0))
    place("HALL_Chair_0_0", "HALL_Chair_Official_2", (0.32, 0.5, 0.0), face_dir=(-1, 0))
    k = 0
    for side in (1, -1):
        for r, y in enumerate((1.75, 2.6, 3.45, 4.25)):
            for x in (-0.36, 0.36):
                place("HALL_Chair_0_0", f"HALL_Chair_Resident_{k + 1:02d}", (x, side * y, 0.0), face_dir=(0, -side))
                k += 1
    anchor = place("ANCHOR_HallResidents", "ANCHOR_HallResidents", (0.0, 2.6, 1.0))
    report["chairs"] = k + 3

    cam = bpy.data.objects.new("CAM_Hall", bpy.data.cameras.new("CAM_Hall_LM")); s.collection.objects.link(cam)
    report["names"] = [table.name, hot.name, anchor.name, cam.name]
    cam.data.lens = 24; cam.data.sensor_width = 36; cam.data.clip_end = 40
    cam.location = (-1.85, 0.0, 1.22)
    d = Vector((0.75, 0.0, 1.05)) - cam.location
    cam.rotation_euler = d.to_track_quat("-Z", "Y").to_euler()
    s.camera = cam
    return s


def export(s):
    win = bpy.context.window; prev = win.scene; win.scene = s
    try:
        path = OUT / "hall.glb"
        bpy.ops.export_scene.gltf(filepath=str(path), export_format="GLB", use_active_scene=True, export_cameras=False,
                                  export_lights=False, export_apply=True, export_animations=False, export_extras=True,
                                  export_image_format="WEBP", export_yup=True,
                                  export_draco_mesh_compression_enable=True, export_draco_mesh_compression_level=6)
        report["size_mb"] = round(path.stat().st_size / 1e6, 2)
    finally:
        win.scene = prev


def preview(s, path):
    s.render.engine = "BLENDER_EEVEE" if "BLENDER_EEVEE" in [e.identifier for e in bpy.types.RenderSettings.bl_rna.properties["engine"].enum_items] else s.render.engine
    s.render.resolution_x, s.render.resolution_y = 1280, 720
    s.world = bpy.data.worlds.get("HALL_LM_World") or bpy.data.worlds.new("HALL_LM_World")
    s.world.color = (0.05, 0.05, 0.05)
    s.render.filepath = str(path)
    bpy.ops.render.render(write_still=True, scene=s.name)


s = build()
export(s)
try:
    preview(s, RENDERS / "hall_lightmap_CAM_Hall.png")
    report["preview"] = str(RENDERS / "hall_lightmap_CAM_Hall.png")
except Exception as e:
    report["preview_error"] = str(e)[:200]
result = report
