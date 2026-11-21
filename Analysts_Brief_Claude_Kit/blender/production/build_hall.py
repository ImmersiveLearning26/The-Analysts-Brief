"""Build the Tamarind Crossing school hall (scene HALL) from the user's assets, to layout.json "hall".

Sources (copies only; nothing is written back):
  ~/investigation assets/EvidenceRoom_v03.blend, collection COMMON_ROOM: walls, floor, ceiling, ceiling lights, doors,
      entrance, cork notice board, metal waiting bench. Police content removed: reception counter + crest header,
      posters, signs, stripe band (repainted as a school-green dado), blue door paint (repainted), duty chair, cabinets.
  kit assets/source/office_-_assets.glb: black stacking chair (x18 residents' seats + learner's chair), rough table
      (planning table, sized to 2.4 x 0.8 m).
  kit assets/source/isometric_office.glb: window frames, set high on the side walls.
The Common Room interior (8 x 6 x 3 m) is stretched to the layout's 10 x 8 x 3.5 m hall.
Learner: seated at the planning table, CAM_Hall looking +Y at the residents. No avatars (kit: optional extras only).
"""
import bpy, sys, math, importlib
from pathlib import Path
from mathutils import Vector, Matrix

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
import ab_lib as L
importlib.reload(L)

ER_BLEND = Path.home() / "investigation assets" / "EvidenceRoom_v03.blend"
D = L.LAYOUT
H = D["hall"]
HW, HD, HH = H["size"]                                   # 10 x 8 x 3.5
CR_W, CR_D, CR_H = 8.0, 6.0, 3.0                          # Common Room interior (colliders at x +-4, y +-3)

src_sc = bpy.data.scenes.get("SRC_CommonRoom") or bpy.data.scenes.new("SRC_CommonRoom")
if "COMMON_ROOM" not in bpy.data.collections:
    with bpy.data.libraries.load(str(ER_BLEND), link=False) as (src, dst):
        dst.collections = ["COMMON_ROOM"]
    src_sc.collection.children.link(bpy.data.collections["COMMON_ROOM"])
CR = bpy.data.collections["COMMON_ROOM"]

KEEP_COLL = {"CR_Architecture", "CR_Doors", "CR_Lighting", "CR_Furniture", "CR_Wall_Displays"}
SKIP_PREFIX = ("ARCH_CR_WallBand_PoliceStripes", "FURN_CR_ReceptionCounter", "FURN_CR_Chair_DutyOfficer", "STORAGE_CR_",
               "FURN_CR_WaitingChairs",
               "WALL_CR_Sign", "WALL_CR_Poster", "WALL_CR_FireAlarm", "COL_", "CAM_")
KEEP_DISPLAYS = ("WALL_CR_NoticeBoard",)

sc = L.scene("HALL", fps=60)
bpy.context.window.scene = sc
root = L.coll("HALL", sc)
for ch in list(root.children):
    L.clear_coll(ch)
for o in list(root.objects):
    bpy.data.objects.remove(o, do_unlink=True)
C = {n: L.coll("HALL_" + n, root) for n in ["Shell", "Furniture", "Windows", "Lights", "Cameras", "Hotspots"]}


def skipped(o, coll_name):
    x = o
    while x:
        if x.name.startswith(SKIP_PREFIX):
            return True
        x = x.parent
    if coll_name == "CR_Wall_Displays":
        x = o
        while x:
            if x.name.startswith(KEEP_DISPLAYS):
                return False
            x = x.parent
        return True
    return False


# ------------------------------------------------------------------ shell: copy kept Common Room objects under one stretched root
shell_root = L.empty("HALL_Shell_Root", (0, 0, 0), C["Shell"], "ARROWS", 0.5)
shell_root.scale = (HW / CR_W, HD / CR_D, HH / CR_H)
copies = {}
for sub in CR.children:
    if sub.name not in KEEP_COLL:
        continue
    tgt = C["Lights"] if sub.name == "CR_Lighting" else (C["Furniture"] if sub.name == "CR_Furniture" else C["Shell"])
    for o in sub.all_objects:
        if o in copies or skipped(o, sub.name):
            continue
        cp = o.copy(); tgt.objects.link(cp); copies[o] = cp
for o, cp in copies.items():
    if o.parent in copies:
        cp.parent = copies[o.parent]; cp.matrix_parent_inverse = o.matrix_parent_inverse.copy()
    else:
        cp.parent = shell_root; cp.matrix_parent_inverse = Matrix.Identity(4); cp.matrix_basis = L.world_matrix(o)
# notice board: rebuilt as one mesh (pivot at its base) and mounted flat on the back wall, facing the learner
nb_src = bpy.data.objects.get("WALL_CR_NoticeBoard")
for x_ in ([nb_src] + list(nb_src.children_recursive)) if nb_src else []:
    c_ = copies.pop(x_, None)
    if c_:
        bpy.data.objects.remove(c_, do_unlink=True)
if nb_src:
    nb = L.join("HALL_NoticeBoard", [o for o in [nb_src] + list(nb_src.children_recursive) if o.type == "MESH"], C["Shell"])
    z0 = min(v.co.z for v in nb.data.vertices)
    L.set_origin_bottom_centre(nb)
    d_ = L.dims(nb)
    if d_[0] < d_[1]:                                      # thin along X -> turn so it lies along the back wall
        nb.data.transform(Matrix.Rotation(math.radians(90), 4, "Z"))
    nb.location = (-2.8, HD / 2 - 0.03 - min(d_[0], d_[1]) / 2, z0)

# ------------------------------------------------------------------ repaint police colours (object-level overrides; source untouched)
dado = L.mat_plaster("AB_Hall_DadoGreen", (0.11, 0.20, 0.15), rough=0.55)
door_paint = L.mat("AB_Hall_DoorPaint", (0.10, 0.18, 0.13), 0.5)


def is_police_blue(m):
    if not m or not m.node_tree:
        return False
    b = next((n for n in m.node_tree.nodes if n.type == "BSDF_PRINCIPLED"), None)
    if not b:
        return False
    c = b.inputs["Base Color"].default_value
    return (not b.inputs["Base Color"].is_linked) and c[2] > c[0] + 0.08 and c[2] > c[1] + 0.02


trim = L.mat("AB_Hall_TrimDark", (0.05, 0.08, 0.06), 0.5)
for o, cp in copies.items():
    if cp.type != "MESH":
        continue
    for slot in cp.material_slots:
        m_ = slot.material
        nm_ = m_.name if m_ else ""
        if nm_.startswith("Paint"):                        # painted lower trim: police blue -> dark green
            slot.link = "OBJECT"; slot.material = trim
        elif nm_.startswith("Door.") or nm_ == "Door" or is_police_blue(m_):   # blue door slabs
            slot.link = "OBJECT"; slot.material = door_paint
band = bpy.data.objects.get("ARCH_CR_WallBand_PoliceStripes")
if band:   # the stripe band itself is skipped; repaint its footprint as a green dado using a copy with an override
    bc = band.copy(); C["Shell"].objects.link(bc); bc.parent = shell_root
    bc.matrix_parent_inverse = Matrix.Identity(4); bc.matrix_basis = L.world_matrix(band); bc.name = "HALL_Dado"
    for slot in bc.material_slots:
        slot.link = "OBJECT"; slot.material = dado

# ------------------------------------------------------------------ high windows (isometric office window frames) + daylight panes
L.import_source("isometric_office.glb", "SRC_IsometricOffice")
win_src = bpy.data.objects["Window_Group_511"]
win_me = L.join("HALL_Window_mesh", [o for o in [win_src] + list(win_src.children_recursive) if o.type == "MESH"], C["Windows"])
L.set_origin_bottom_centre(win_me)
wd = L.dims(win_me)                                        # ~0.26 x 1.46 x 1.04, faces +-X
sky = L.mat("AB_Hall_WindowGlass", (0.86, 0.90, 0.92), 0.05, spec=0.6)   # clear glass: the exterior shows through
_bg = L._bsdf(sky); _bg.inputs["Alpha"].default_value = 0.12
try:
    sky.surface_render_method = "BLENDED"
except Exception:
    pass
C["Windows"].objects.unlink(win_me)
WIN_E = (-0.2, 1.6)                                       # clear of the two east doors and their transoms
WIN_N = (-1.6, 1.6, 3.6)
for i, y in enumerate(WIN_E):                             # east wall
    x = HW / 2 - 0.02
    w = bpy.data.objects.new(f"HALL_Window_E{i+1}", win_me.data); C["Windows"].objects.link(w)
    w.location = (x, y, 2.25); w.scale = (1.0, 1.25, 1.0)
    L.box(f"HALL_DaylightPane_E{i+1}", (0.01, wd[1] * 1.25 - 0.08, wd[2] - 0.08), (x - 0.01, y, 2.25 + wd[2] / 2), sky, C["Windows"])
for i, x in enumerate(WIN_N):                             # back wall, above the notice board line
    y = HD / 2 - 0.02
    w = bpy.data.objects.new(f"HALL_Window_N{i+1}", win_me.data); C["Windows"].objects.link(w)
    w.location = (x, y, 2.25); w.rotation_euler.z = math.radians(90); w.scale = (1.0, 1.25, 1.0)
    L.box(f"HALL_DaylightPane_N{i+1}", (wd[1] * 1.25 - 0.08, 0.01, wd[2] - 0.08), (x, y - 0.01, 2.25 + wd[2] / 2), sky, C["Windows"])

# ------------------------------------------------------------------ planning table + chairs (office assets)
L.import_source("office_-_assets.glb", "SRC_OfficeAssets")
F = C["Furniture"]


def donor(name, roots):
    o = L.join(name, L.donor_meshes(roots), F)
    L.set_origin_bottom_centre(o)
    return o


def face_backrest(o, direction, key=0.75):
    vs = [v.co for v in o.data.vertices if v.co.z > key * L.dims(o)[2]]
    cen = sum(vs, Vector()) / len(vs)
    o.data.transform(Matrix.Rotation(math.atan2(direction[1], direction[0]) - math.atan2(cen.y, cen.x), 4, "Z"))
    L.set_origin_bottom_centre(o)


tx, ty, tz = H["table_center"]; tw, td, tt = H["table_size"]
table = donor("HALL_PlanningTable", ["Table_Rough_32"])
dx, dy, dz = L.dims(table)
if dy > dx:                                                # long axis -> X
    table.data.transform(Matrix.Rotation(math.radians(90), 4, "Z")); dx, dy = dy, dx
table.data.transform(Matrix.Diagonal((tw / dx, td / dy, (tz + tt / 2) / dz, 1)))
table.location = (tx, ty, 0)

chair = donor("HALL_Chair_mesh", ["Chair_51"])
face_backrest(chair, (0, 1))                               # residents face the table (backrest away from it)
F.objects.unlink(chair)
rows, cols = H["chair_rows"], H["chair_columns"]
sx_, sy_ = H["chair_spacing"]; aisle = H["aisle"]
for r in range(rows):
    for c in range(cols):
        x = (c - (cols - 1) / 2) * sx_ + (-(aisle - sx_) / 2 if c < cols / 2 else (aisle - sx_) / 2)
        y = -0.4 + r * sy_
        o = bpy.data.objects.new(f"HALL_Chair_{r}_{c}", chair.data); F.objects.link(o)
        o.location = (x, y, 0); o.rotation_euler.z = math.pi
learner_chair = bpy.data.objects.new("HALL_Chair_Learner", chair.data); F.objects.link(learner_chair)
learner_chair.location = (0, ty - 0.75, 0)

# mobile whiteboard (user's whiteboards.glb), at the front of the back wall facing the learner
def import_glb(path, scene_name):
    s_ = bpy.data.scenes.get(scene_name)
    if s_:
        return s_
    import logging; logging.disable(logging.INFO)
    s_ = bpy.data.scenes.new(scene_name); prev = bpy.context.window.scene
    bpy.context.window.scene = s_; bpy.ops.import_scene.gltf(filepath=str(path)); bpy.context.window.scene = prev
    return s_
import_glb(Path.home() / "investigation assets" / "whiteboards.glb", "SRC_Whiteboards")
wb = L.join("HALL_Whiteboard", L.donor_meshes(["WBoard_V1", "WBoard_V1_Markers"]), F)
L.set_origin_bottom_centre(wb)
wb.location = (0.0, HD / 2 - 0.55, 0.0)
wb.rotation_euler.z = 0.0
# wipe the source board's handwriting (could be a real name): large faces on the writing surface -> plain white
clean = L.mat("AB_Hall_WhiteboardClean", (0.92, 0.93, 0.93), 0.25)
wb.data.materials.append(clean)
ci = len(wb.data.materials) - 1
for poly in wb.data.polygons:
    if abs(poly.normal.y) > 0.9 and poly.area > 0.25:
        poly.material_index = ci

# ------------------------------------------------------------------ real window openings + 1:1 exterior (user: "real windows and view")
# Openings: Boolean modifiers on the wall COPIES (mesh data stays shared with the untouched source; cutters hidden).
cut_c = L.coll("HALL_Cutters", root)
L.clear_coll(cut_c)
cw, ch_ = wd[1] * 1.25 - 0.06, wd[2] - 0.06
for i, y in enumerate(WIN_E):
    L.box(f"HALL_Cut_E{i+1}", (1.0, cw, ch_), (HW / 2, y, 2.25 + wd[2] / 2), None, cut_c)
for i, x in enumerate(WIN_N):
    L.box(f"HALL_Cut_N{i+1}", (cw, 1.0, ch_), (x, HD / 2, 2.25 + wd[2] / 2), None, cut_c)
for o in cut_c.objects:
    o.hide_render = True; o.display_type = "WIRE"
for o in list(C["Shell"].objects):
    if o.type == "MESH" and o.name.startswith(("ARCH_CR_Walls", "ARCH_CR_WallPaint")):
        m_ = o.modifiers.new("HALL_WindowOpenings", "BOOLEAN")
        m_.operation = "DIFFERENCE"; m_.operand_type = "COLLECTION"; m_.collection = cut_c
        m_.solver = "EXACT"
        try:
            m_.use_hole_tolerant = True
        except AttributeError:
            pass
# the window frames' own glass -> clear
for o in C["Windows"].objects:
    if o.type == "MESH":
        for slot in o.material_slots:
            if slot.material and slot.material.name.startswith(("Glass", "hidden_material")):
                slot.link = "OBJECT"; slot.material = sky

# Exterior at true 1:1 scale from the user's assets: wet grass ground, trees (autumn pines + crowns, city trees),
# city apartment blocks behind them, overcast sky. Seen through high windows from a seated eye: treetops,
# upper floors and sky.
EX = L.coll("HALL_Exterior", root)
L.clear_coll(EX)
grass_img = None
ts_ = bpy.data.scenes.get("SRC_LandscapeTiles")
if ts_:
    o_ = next(o for o in ts_.objects if o.type == "MESH" and o.name.split(".")[0] == "Object_28")
    b_ = next(n for n in o_.data.materials[0].node_tree.nodes if n.type == "BSDF_PRINCIPLED")
    n_ = b_.inputs["Base Color"].links[0].from_node
    while n_.type != "TEX_IMAGE":
        n_ = next(l.from_node for i_ in n_.inputs for l in i_.links)
    grass_img = n_.image
gm = L.mat("AB_Hall_WetGrass", (0.18, 0.24, 0.10), 0.35)            # low roughness: rain-wet
if grass_img:
    nt_, b_ = L._reset_nodes(gm)
    tc_ = nt_.nodes.new("ShaderNodeTexCoord"); mp_ = nt_.nodes.new("ShaderNodeMapping"); mp_.inputs["Scale"].default_value = (0.4, 0.4, 0.4)
    ti_ = nt_.nodes.new("ShaderNodeTexImage"); ti_.image = grass_img
    mm_ = nt_.nodes.new("ShaderNodeMix"); mm_.data_type = "RGBA"; mm_.blend_type = "MULTIPLY"; mm_.inputs["Factor"].default_value = 1.0
    mm_.inputs["B"].default_value = (0.55, 0.6, 0.5, 1)
    nt_.links.new(tc_.outputs["Object"], mp_.inputs["Vector"]); nt_.links.new(mp_.outputs["Vector"], ti_.inputs["Vector"])
    nt_.links.new(ti_.outputs["Color"], mm_.inputs["A"]); nt_.links.new(mm_.outputs["Result"], b_.inputs["Base Color"])
ground = L.box("HALL_ExteriorGround", (92, 92, 0.1), (0, 0, -0.06), gm, EX)

import random
rng = random.Random(4)
ext_meshes = {}
def ext_mesh(key, objs, target_h=None, decimate=None):
    if key in ext_meshes:
        return ext_meshes[key]
    o = L.join(f"HALL_Ext_{key}", objs, EX)
    if decimate:
        md = o.modifiers.new("Decimate", "DECIMATE"); md.ratio = decimate
        bpy.context.view_layer.update()
        nm = bpy.data.meshes.new_from_object(o.evaluated_get(bpy.context.evaluated_depsgraph_get()))
        o.modifiers.clear(); old = o.data; o.data = nm; bpy.data.meshes.remove(old)
    L.set_origin_bottom_centre(o)
    if target_h:
        k = target_h / L.dims(o)[2]; o.data.transform(Matrix.Scale(k, 4))
    EX.objects.unlink(o)
    ext_meshes[key] = o.data
    return o.data
def ext_place(name, me, loc, rz=0.0, s=1.0):
    o = bpy.data.objects.new(name, me); EX.objects.link(o)
    o.location = loc; o.rotation_euler.z = rz; o.scale = (s, s, s)
    return o

trees = []
au = bpy.data.scenes.get("SRC_Autumn")
if au:
    for n in ("Object_12_lambert6_0", "Object_18_lambert7_0", "Object_28_lambert9_0"):
        trees.append(ext_mesh(n, [bpy.data.objects[n]], target_h=10.0))
    for i, n in enumerate(("Object_199_lambert8_0", "Object_174_lambert10_0")):
        me_ = ext_mesh(n, [bpy.data.objects[n]], target_h=7.0, decimate=0.05)
        me_.materials[0] = bpy.data.materials.get(f"AB_KAL_Crown_{i}") or L.mat(f"AB_KAL_Crown_{i}", (0.08, 0.16, 0.04), 0.85)
        trees.append(me_)
cs_ = bpy.data.scenes.get("SRC_City")
if cs_:
    ct = [o for o in cs_.objects if o.type == "MESH" and o.name.startswith("Tree_") ][:2]
    for i, o in enumerate(ct):
        trees.append(ext_mesh(f"CityTree{i}", [o], target_h=7.5, decimate=0.5))
k = 0
for side in ("N", "E"):
    for j in range(16):
        d_ = rng.uniform(18, 34); a_ = rng.uniform(-26, 26)
        loc = (a_, HD / 2 + d_, 0) if side == "N" else (HW / 2 + d_, a_ * 0.8, 0)
        k += 1; ext_place(f"HALL_ExtTree_{k:02}", rng.choice(trees), loc, rng.uniform(0, 6.28), rng.uniform(0.8, 1.25))
if cs_:
    blds = [o for o in cs_.objects if o.type == "MESH" and o.name.startswith("House_") and "Glass" not in o.name
            and 9 < o.dimensions.z < 26 and len(o.data.polygons) > 300]
    blds = sorted(blds, key=lambda o: o.name)[:6]
    spots = [(-22, 34, 0), (-4, 37, 0.1), (15, 35, -0.05), (28, 27, 0.6), (35, 10, 1.57), (34, -12, 1.5)]   # within 40 m
    for i, (o, (x_, y_, r_)) in enumerate(zip(blds, spots)):
        me_ = ext_mesh(f"CityBlock{i}", [o], decimate=0.35)
        ext_place(f"HALL_ExtBuilding_{i+1}", me_, (x_, y_, 0), r_)

# overcast sky: a large emissive dome-band around the hall (grey-blue, lighter at the horizon)
skym = L.mat("AB_Hall_OvercastSky", (0.6, 0.65, 0.7), 1.0)
nt_, b_ = L._reset_nodes(skym)
tc_ = nt_.nodes.new("ShaderNodeTexCoord"); sp_ = nt_.nodes.new("ShaderNodeSeparateXYZ")
nt_.links.new(tc_.outputs["Generated"], sp_.inputs[0])
rp_ = nt_.nodes.new("ShaderNodeValToRGB")
rp_.color_ramp.elements[0].position, rp_.color_ramp.elements[0].color = 0.0, (0.66, 0.70, 0.72, 1)
rp_.color_ramp.elements[1].position, rp_.color_ramp.elements[1].color = 1.0, (0.40, 0.45, 0.50, 1)
nt_.links.new(sp_.outputs["Z"], rp_.inputs["Fac"])
nt_.links.new(rp_.outputs["Color"], b_.inputs["Emission Color"]); nt_.links.new(rp_.outputs["Color"], b_.inputs["Base Color"])
b_.inputs["Emission Strength"].default_value = 1.4
bpy.ops.mesh.primitive_cylinder_add(vertices=48, radius=45, depth=50, location=(0, 0, 20), end_fill_type="NOTHING")   # inside CAM_Hall far clip (50 m)
skyo = bpy.context.object; skyo.name = "HALL_ExteriorSky"; L.link(skyo, EX); skyo.data.materials.append(skym)
skyo.data.flip_normals()

# rain sheets just outside each window (Blender preview only; the runtime draws rain)
rainm = L.mat("AB_Hall_RainPreview", (0.8, 0.85, 0.9), 0.1)
nt_, b_ = L._reset_nodes(rainm)
tc_ = nt_.nodes.new("ShaderNodeTexCoord"); mp_ = nt_.nodes.new("ShaderNodeMapping"); mp_.inputs["Scale"].default_value = (60, 60, 2.5)
nz_ = nt_.nodes.new("ShaderNodeTexNoise"); nz_.inputs["Scale"].default_value = 1.0; nz_.inputs["Detail"].default_value = 1
nt_.links.new(tc_.outputs["Object"], mp_.inputs["Vector"]); nt_.links.new(mp_.outputs["Vector"], nz_.inputs["Vector"])
rr_ = nt_.nodes.new("ShaderNodeValToRGB"); rr_.color_ramp.elements[0].position = 0.62; rr_.color_ramp.elements[1].position = 0.7
rr_.color_ramp.elements[0].color = (0, 0, 0, 1)
nt_.links.new(nz_.outputs["Fac"], rr_.inputs["Fac"])
am_ = nt_.nodes.new("ShaderNodeMath"); am_.operation = "MULTIPLY"; am_.inputs[1].default_value = 0.35
nt_.links.new(rr_.outputs["Color"], am_.inputs[0]); nt_.links.new(am_.outputs[0], b_.inputs["Alpha"])
try:
    rainm.surface_render_method = "BLENDED"
except Exception:
    pass
for i, y in enumerate(WIN_E):
    r_ = L.box(f"HALL_RainPreview_E{i+1}", (0.01, 3.0, 3.0), (HW / 2 + 0.6, y, 2.6), rainm, EX)
for i, x in enumerate(WIN_N):
    r_ = L.box(f"HALL_RainPreview_N{i+1}", (3.0, 0.01, 3.0), (x, HD / 2 + 0.6, 2.6), rainm, EX)

# ------------------------------------------------------------------ cameras, anchors, light balance
L.cameras(["CAM_Hall"], C["Cameras"])
L.empty("HOTSPOT_HallTable", (tx, ty, tz + 0.05), C["Hotspots"], "CUBE", 0.3)
L.empty("ANCHOR_HallResidents", (0, 0.6, 1.0), C["Hotspots"], "ARROWS", 0.3)
# hall-only overcast daylight (the office keeps the Evidence Room world untouched)
hw_ = bpy.data.worlds.get("AB_World_HallOvercast") or bpy.data.worlds.new("AB_World_HallOvercast")
try:
    hw_.use_nodes = True
except Exception:
    pass
bgn = next(n for n in hw_.node_tree.nodes if n.type == "BACKGROUND")
bgn.inputs[0].default_value = (0.55, 0.60, 0.66, 1); bgn.inputs[1].default_value = 0.9
sc.world = hw_
sun = L.light("HALL_OvercastSun", "SUN", (0, 0, 20), 2.2, (0.90, 0.94, 1.0), C["Lights"])
sun.data.angle = math.radians(35)
sun.rotation_euler = (math.radians(50), 0, math.radians(200))
for attr, val in [("use_raytracing", True), ("use_shadows", True), ("taa_render_samples", 48)]:
    if hasattr(sc.eevee, attr):
        setattr(sc.eevee, attr, val)
try:
    sc.render.engine = "BLENDER_EEVEE"
except TypeError:
    pass
sc.view_settings.view_transform = "AgX"
sc.camera = bpy.data.objects["CAM_Hall"]
print("HALL_BUILD_COMPLETE", len(copies), "shell objects copied")
