"""CASEFILE scene: the Evidence Room case file (manila folder with its CaseFile_OpenClose shape-key animation),
re-labelled for the Commission and given 18 blank pages, exported as export/casefile.glb.

The web app's inspector brings this file to the screen, opens it, and slides each page aside (the same behaviour as
the investigation viewer). Page faces are painted at runtime from the kit's evidence text, so the pages here are
blank paper with UVs (0..1 over the sheet, v up).

Source objects in SRC_EvidenceRoom are never modified: objects are copied, the folder's material is overridden at
object level, and the atlas is repainted into a new image file in production/textures/.
"""
import bpy, math
import numpy as np
from pathlib import Path

HERE = Path(__file__).resolve().parent
TEX = HERE / "textures"; TEX.mkdir(exist_ok=True)
OUT = HERE / "export"; OUT.mkdir(exist_ok=True)
SRC_ROOT = "EXH_CaseFile_NPF-SGD-INV-2026-047"
PAGES = 18
FONT_SERIF = "/System/Library/Fonts/Supplemental/Georgia Bold.ttf"
FONT_SANS = "/System/Library/Fonts/Supplemental/Arial Bold.ttf"
FONT_MONO = "/System/Library/Fonts/Supplemental/Courier New.ttf"
report = {}


def scene(name):
    s = bpy.data.scenes.get(name) or bpy.data.scenes.new(name)
    for o in list(s.collection.all_objects):
        bpy.data.objects.remove(o, do_unlink=True)
    return s


def px(img):
    a = np.empty(img.size[0] * img.size[1] * 4, dtype=np.float32)
    img.pixels.foreach_get(a)
    return a.reshape(img.size[1], img.size[0], 4)          # rows bottom-up


# ------------------------------------------------------------------ 1. the label, rendered from text objects
def render_label(path, W=980, H=1420):
    s = scene("TMP_CaseLabel")
    s.render.resolution_x, s.render.resolution_y, s.render.resolution_percentage = W, H, 100
    s.render.film_transparent = True
    try:
        s.render.engine = "BLENDER_WORKBENCH"
    except TypeError:
        pass
    s.display.shading.light = "FLAT"; s.display.shading.color_type = "MATERIAL"
    s.view_settings.view_transform = "Standard"
    s.render.image_settings.file_format = "PNG"; s.render.image_settings.color_mode = "RGBA"
    cam = bpy.data.objects.new("TMP_LabelCam", bpy.data.cameras.new("TMP_LabelCam"))
    cam.data.type = "ORTHO"; cam.data.ortho_scale = H / 100; cam.location = (0, 0, 10)
    s.collection.objects.link(cam); s.camera = cam
    X0, Y0 = -W / 200, H / 200                              # 1 unit = 100 px; (x, ytop) in px from the top-left

    def mat(name, rgba):
        m = bpy.data.materials.get(name) or bpy.data.materials.new(name)
        m.diffuse_color = rgba
        return m

    ink, faint, card, red = mat("TMP_Ink", (0.09, 0.08, 0.07, 1)), mat("TMP_Faint", (0.30, 0.28, 0.25, 1)), \
        mat("TMP_Card", (0.95, 0.93, 0.88, 1)), mat("TMP_Red", (0.62, 0.13, 0.10, 1))

    def text(body, x, ytop, size, font, m, align="LEFT", rot=0.0, z=0.02):
        cu = bpy.data.curves.new("TMP_T", "FONT"); cu.body = body; cu.size = size / 100
        cu.font = bpy.data.fonts.load(font, check_existing=True); cu.align_x = align; cu.align_y = "TOP"
        o = bpy.data.objects.new("TMP_T", cu); o.location = (X0 + x / 100, Y0 - ytop / 100, z); o.rotation_euler.z = rot
        o.data.materials.append(m); s.collection.objects.link(o); return o

    def rect(x, ytop, w, h, m, z=0.0, rot=0.0):
        me = bpy.data.meshes.new("TMP_R")
        me.from_pydata([(0, 0, 0), (w / 100, 0, 0), (w / 100, -h / 100, 0), (0, -h / 100, 0)], [], [(0, 1, 2, 3)])
        o = bpy.data.objects.new("TMP_R", me); o.location = (X0 + x / 100, Y0 - ytop / 100, z); o.rotation_euler.z = rot
        me.materials.append(m); s.collection.objects.link(o); return o

    def frame(x, ytop, w, h, t, m, z=0.01, rot=0.0):
        for (a, b2, c, d) in [(x, ytop, w, t), (x, ytop + h - t, w, t), (x, ytop, t, h), (x + w - t, ytop, t, h)]:
            rect(a, b2, c, d, m, z, 0.0)

    text("THE COMMISSION", W / 2, 110, 64, FONT_SANS, ink, "CENTER")
    text("RESEARCH UNIT  ·  KALINDA DESK", W / 2, 205, 30, FONT_SANS, faint, "CENTER")
    rect(40, 270, W - 80, 4, ink, 0.01)
    rect(40, 330, W - 80, 640, card, 0.0)                 # the glued paper label
    frame(40, 330, W - 80, 640, 4, ink)
    text("CASE FILE", W / 2, 400, 104, FONT_SERIF, ink, "CENTER")
    text("KAL/RU/2026/014", W / 2, 540, 46, FONT_MONO, ink, "CENTER")
    rect(90, 625, W - 180, 3, faint, 0.01)
    rows = [("SUBJECT", "Kalinda: background"), ("", "and causes"), ("FOR", "Dr Amina Diallo"), ("CONTENTS", "18 sources")]
    for i, (k, v) in enumerate(rows):
        y = 670 + i * 70
        if k:
            text(k, 95, y + 8, 26, FONT_SANS, faint)
        text(v, 330, y, 38, FONT_MONO, ink)
    # stamp: a red outlined box, tilted
    st = bpy.data.objects.new("TMP_Stamp", None); st.location = (X0 + 3.0, Y0 - 11.6, 0.03); st.rotation_euler.z = math.radians(9)
    s.collection.objects.link(st)
    for o in [rect(-230, -70, 460, 10, red, 0.0), rect(-230, 60, 460, 10, red, 0.0), rect(-230, -70, 10, 140, red, 0.0), rect(220, -70, 10, 140, red, 0.0),
              text("RESTRICTED", 0, -42, 76, FONT_SANS, red, "CENTER")]:
        o.location = (o.location.x - X0, o.location.y - Y0, 0.0); o.parent = st
    text("For the Dialogue · Friday", W / 2, 1300, 40, FONT_MONO, faint, "CENTER")
    s.render.filepath = str(path)
    bpy.ops.render.render(write_still=True, scene=s.name)
    for o in list(s.collection.all_objects):
        bpy.data.objects.remove(o, do_unlink=True)
    bpy.data.scenes.remove(s)
    return path


# ------------------------------------------------------------------ 2. the repainted folder atlas
def repaint_atlas():
    src = bpy.data.images["CaseFile_FolderAtlas_Manila.png"]
    a = px(src).copy()
    S = src.size[0]                                         # 4096
    x0, x1, yt0, yt1 = 110, 1330, 230, 1900                 # old print plus a margin, top-origin pixels
    r0, r1 = S - yt1, S - yt0                               # bottom-up rows
    w = x1 - x0
    patch = a[r0:r1, 1420:1420 + w].copy()                  # plain manila from the same face, to the right
    patch = patch[:, ::-1]                                  # mirrored so its grain does not repeat side by side
    f = 40.0                                                # feathered edges
    yy, xx = np.mgrid[0:r1 - r0, 0:w]
    edge = np.minimum.reduce([xx, w - 1 - xx, yy, r1 - r0 - 1 - yy]) / f
    m = np.clip(edge, 0, 1)[..., None]
    a[r0:r1, x0:x1, :3] = a[r0:r1, x0:x1, :3] * (1 - m) + patch[..., :3] * m
    lab_path = render_label(TEX / "casefile_label_render.png")
    lab = bpy.data.images.load(str(lab_path), check_existing=False)
    L = px(lab)[:, ::-1]                                    # the atlas prints mirrored on this face
    lh, lw = L.shape[:2]
    al = L[..., 3:4]
    lx, lr = x0 + 110, r0 + 170                             # label inset inside the cleaned area
    tgt = a[lr:lr + lh, lx:lx + lw, :3]
    # ink sits on the paper (multiply-ish), the card is glued on top
    a[lr:lr + lh, lx:lx + lw, :3] = tgt * (1 - al * 0.93) + L[..., :3] * al * 0.93
    bpy.data.images.remove(lab)
    name = "CaseFile_FolderAtlas_Commission.png"
    im = bpy.data.images.get(name)
    if im:
        bpy.data.images.remove(im)
    im = bpy.data.images.new(name, S, S, alpha=False)
    im.colorspace_settings.name = src.colorspace_settings.name
    im.pixels.foreach_set(a.ravel())
    im.scale(2048, 2048)
    im.filepath_raw = str(TEX / name); im.file_format = "PNG"; im.save()
    report["atlas"] = str(TEX / name)
    return im


def scaled_copy(name, size=2048):
    src = bpy.data.images[name]
    out = TEX / name.replace(".png", "_2k.png")
    im = bpy.data.images.get(out.name) or src.copy()
    im.name = out.name
    if im.size[0] != size:
        im.scale(size, size)
    im.filepath_raw = str(out); im.file_format = "PNG"; im.save()
    return im


# ------------------------------------------------------------------ 3. the CASEFILE scene
def build():
    s = scene("CASEFILE")
    root_src = bpy.data.objects[SRC_ROOT]
    atlas = repaint_atlas()
    nrm, mr = scaled_copy("CaseFile_FolderAtlas_Normal.png"), scaled_copy("CaseFile_FolderAtlas_MetalRough.png")

    copies = {}
    def copy(o, parent):
        c = o.copy(); c.name = o.name.replace(SRC_ROOT, "CASEFILE") if SRC_ROOT in o.name else o.name + ".CF"
        s.collection.objects.link(c); c.parent = parent
        copies[o.name] = c
        for ch in o.children:
            if ch.name.startswith("CF_Doc_"):
                continue                                    # police documents are replaced by blank pages
            copy(ch, c)
        return c

    root = copy(root_src, None)
    root.name = "CASEFILE_Root"
    root.location = (0, 0, 0); root.rotation_euler = (0, 0, 0)       # placed by the app (layout.office.folder_position)
    for k in [k for k in root.keys()]:
        del root[k]
    root["sim_name"] = "Case file KAL/RU/2026/014"; root["sim_interaction"] = "open_close"; root["sim_anim_clip"] = "CaseFile_OpenClose"
    root["sim_anim_open_frames"] = [0, 78]; root["sim_anim_close_frames"] = [92, 168]; root["sim_anim_fps"] = 24

    # folder: same mesh + shape keys + action, new label via an object-level material
    fold = copies["CF_Folder_Animated"]; fold.name = "CF_Folder"
    m0 = fold.data.materials[0]
    m = bpy.data.materials.get("MAT_CaseFile_Folder_Commission") or m0.copy()
    m.name = "MAT_CaseFile_Folder_Commission"
    for n in m.node_tree.nodes:
        if n.type == "TEX_IMAGE" and n.image:
            if "Manila" in n.image.name or "Commission" in n.image.name: n.image = atlas
            elif "Normal" in n.image.name: n.image = nrm
            elif "MetalRough" in n.image.name: n.image = mr
    for l in m.node_tree.links:                             # base colour by link (survives a re-run that replaced the image)
        if l.to_socket.name == "Base Color" and l.from_node.type == "TEX_IMAGE":
            l.from_node.image = atlas
    for slot in fold.material_slots:
        slot.link = "OBJECT"; slot.material = m

    # 18 blank pages (one shared sheet mesh), stacked where the six documents lay
    doc = bpy.data.objects["CF_Doc_E01_ComplaintReport_FunmiAdeyemi"]
    me = bpy.data.meshes.get("CF_PageSheet")
    if me:
        bpy.data.meshes.remove(me)
    me = doc.data.copy(); me.name = "CF_PageSheet"; me.materials.clear()
    pm = bpy.data.materials.get("MAT_CF_Page") or bpy.data.materials.new("MAT_CF_Page")
    pm.use_nodes = True
    bsdf = next(n for n in pm.node_tree.nodes if n.type == "BSDF_PRINCIPLED")
    bsdf.inputs["Base Color"].default_value = (0.93, 0.91, 0.86, 1); bsdf.inputs["Roughness"].default_value = 0.85
    me.materials.append(pm)
    for i in range(PAGES):
        o = bpy.data.objects.new(f"CF_Page_{i + 1:02d}", me)
        o.location = (0, 0, 0.154 - i * 0.0011); o.parent = root
        o["evidence_index"] = i
        s.collection.objects.link(o)
    report["objects"] = len(s.collection.all_objects)
    return s


def export(s):
    win = bpy.context.window
    prev = win.scene; win.scene = s
    try:
        path = OUT / "casefile.glb"
        kw = dict(filepath=str(path), export_format="GLB", use_active_scene=True, export_cameras=False, export_lights=False,
                  export_apply=False, export_animations=True, export_morph=True, export_morph_normal=False,
                  export_image_format="WEBP", export_extras=True, export_yup=True)
        try:
            bpy.ops.export_scene.gltf(**kw, export_draco_mesh_compression_enable=True, export_draco_mesh_compression_level=6)
            report["draco"] = True
        except Exception as e:
            report["draco_error"] = str(e)[:200]
            bpy.ops.export_scene.gltf(**kw)
        report["size_mb"] = round(path.stat().st_size / 1e6, 2)
    finally:
        win.scene = prev


s = build()
export(s)
result = report
