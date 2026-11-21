"""Build the Commission research-unit office (scene OFFICE) from layout.json.

Run in Blender (live or background):
    exec(open(".../blender/production/build_office.py").read(), {"__file__": ".../build_office.py"})
Idempotent: re-running clears and rebuilds the OFFICE_* collections only.

Camera-visibility note (measured from layout.json cameras, not from concept images):
CAM_Desk (42 mm, 1.20 m, pitched 13.4 deg down) sees the back wall only up to ~1.2 m;
CAM_OfficeEntry sees up to ~1.8 m. The side walls are never in frame. So the "window on the
learner's left" is placed on the LEFT PART OF THE BACK WALL with a low sill, which is what the
concepts show, and daylight still arrives from the learner's left.
"""
import bpy, sys, math, random, importlib
from pathlib import Path
from mathutils import Vector

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
import ab_lib as L
importlib.reload(L)

D = L.LAYOUT
OF = D["office"]
W, DEP, H = OF["size"]                     # 6 x 5 x 3
X0, X1, Y0, Y1 = -W / 2, W / 2, -DEP / 2, DEP / 2
T = 0.12                                   # wall thickness

sc = L.scene("OFFICE")
root = L.coll("OFFICE", sc)
for n in ["OFFICE_Shell", "OFFICE_Furniture", "OFFICE_Props", "OFFICE_Exterior", "OFFICE_Lights", "OFFICE_Cameras", "OFFICE_Hotspots"]:
    L.clear_coll(L.coll(n, root))
C = {n: L.coll("OFFICE_" + n, root) for n in ["Shell", "Furniture", "Props", "Exterior", "Lights", "Cameras", "Hotspots"]}

# ------------------------------------------------------------------ materials
plaster = L.mat_plaster("AB_Plaster_Warm", (0.76, 0.72, 0.65))
ceiling = L.mat_plaster("AB_Plaster_Ceiling", (0.84, 0.83, 0.80))
tiles = L.mat_tiles("AB_FloorTiles", 0.6, (0.40, 0.35, 0.29), (0.26, 0.23, 0.20))
oak = L.mat_wood("AB_Oak", (0.27, 0.155, 0.075), (0.47, 0.30, 0.155), rough=0.58)
oak_v = L.mat_wood("AB_Oak_Vertical", (0.27, 0.155, 0.075), (0.47, 0.30, 0.155), rough=0.6, axis="Z")
dark_wood = L.mat_wood("AB_DarkWood", (0.08, 0.045, 0.025), (0.20, 0.11, 0.06), rough=0.5)
steel = L.mat("AB_WindowSteel", (0.05, 0.055, 0.055), 0.45, metal=0.6)
brass = L.mat("AB_Brass", (0.62, 0.47, 0.24), 0.35, metal=1.0)
glass = L.mat_glass("AB_WindowGlass")
fixture = L.mat_emit("AB_CeilingFixture", (1.0, 0.95, 0.88), 3.0)

# exterior backdrop: overcast sky over hazy green hillside (painted gradient; rain is a runtime effect)
ext = L.mat("AB_ExteriorBackdrop", (0.5, 0.55, 0.5), 1.0)
nt, b = L._reset_nodes(ext)
tc = nt.nodes.new("ShaderNodeTexCoord")
sep = nt.nodes.new("ShaderNodeSeparateXYZ"); nt.links.new(tc.outputs["Generated"], sep.inputs[0])
nz = nt.nodes.new("ShaderNodeTexNoise"); nz.inputs["Scale"].default_value = 2.5; nz.inputs["Detail"].default_value = 6
nt.links.new(tc.outputs["Generated"], nz.inputs["Vector"])
add = nt.nodes.new("ShaderNodeMath"); add.operation = "MULTIPLY_ADD"
add.inputs[1].default_value = 0.18
nt.links.new(nz.outputs["Fac"], add.inputs[0]); nt.links.new(sep.outputs["Y"], add.inputs[2])   # plane's local Y is world up
ramp = nt.nodes.new("ShaderNodeValToRGB")
els = ramp.color_ramp.elements
els[0].position, els[0].color = 0.30, (0.10, 0.14, 0.09, 1)
els[1].position, els[1].color = 0.92, (0.70, 0.74, 0.76, 1)
e = els.new(0.52); e.color = (0.30, 0.36, 0.30, 1)
e = els.new(0.62); e.color = (0.55, 0.60, 0.60, 1)
nt.links.new(add.outputs[0], ramp.inputs["Fac"])
nt.links.new(ramp.outputs["Color"], b.inputs["Emission Color"])
nt.links.new(ramp.outputs["Color"], b.inputs["Base Color"])
b.inputs["Emission Strength"].default_value = 1.0

# woven wall hanging: abstract stripes, muted indigo / ochre / cream / rust (no symbols, no text)
weave = L.mat("AB_WovenHanging", (0.5, 0.4, 0.3), 0.95)
nt, b = L._reset_nodes(weave)
tc = nt.nodes.new("ShaderNodeTexCoord")
wv = nt.nodes.new("ShaderNodeTexWave"); wv.wave_type = "BANDS"; wv.bands_direction = "Y"; wv.wave_profile = "SAW"   # UV v runs up the hanging
wv.inputs["Scale"].default_value = 1.6; wv.inputs["Distortion"].default_value = 0.0
nt.links.new(tc.outputs["UV"], wv.inputs["Vector"])
ramp = nt.nodes.new("ShaderNodeValToRGB"); ramp.color_ramp.interpolation = "CONSTANT"
cols = [(0.0, (0.09, 0.11, 0.20)), (0.22, (0.62, 0.42, 0.14)), (0.38, (0.80, 0.74, 0.60)), (0.50, (0.42, 0.16, 0.09)),
        (0.62, (0.80, 0.74, 0.60)), (0.74, (0.62, 0.42, 0.14)), (0.90, (0.09, 0.11, 0.20))]
ramp.color_ramp.elements[0].position, ramp.color_ramp.elements[0].color = cols[0][0], (*cols[0][1], 1)
ramp.color_ramp.elements[1].position, ramp.color_ramp.elements[1].color = cols[-1][0], (*cols[-1][1], 1)
for p, cc in cols[1:-1]:
    el = ramp.color_ramp.elements.new(p); el.color = (*cc, 1)
nt.links.new(wv.outputs["Fac"], ramp.inputs["Fac"])
ck = nt.nodes.new("ShaderNodeTexChecker"); ck.inputs["Scale"].default_value = 120
ck.inputs["Color1"].default_value = (1, 1, 1, 1); ck.inputs["Color2"].default_value = (0.82, 0.82, 0.82, 1)
nt.links.new(tc.outputs["UV"], ck.inputs["Vector"])
mx = nt.nodes.new("ShaderNodeMix"); mx.data_type = "RGBA"; mx.blend_type = "MULTIPLY"; mx.inputs["Factor"].default_value = 1.0
nt.links.new(ramp.outputs["Color"], mx.inputs["A"]); nt.links.new(ck.outputs["Color"], mx.inputs["B"])
nt.links.new(mx.outputs["Result"], b.inputs["Base Color"])

# ------------------------------------------------------------------ shell
S = C["Shell"]
L.box("OFFICE_Floor", (W + 2 * T, DEP + 2 * T, 0.1), (0, 0, -0.05), tiles, S)
L.box("OFFICE_Ceiling", (W + 2 * T, DEP + 2 * T, 0.1), (0, 0, H + 0.05), ceiling, S)
L.box("OFFICE_WallLeft", (T, DEP + 2 * T, H), (X0 - T / 2, 0, H / 2), plaster, S)
L.box("OFFICE_WallRight", (T, DEP + 2 * T, H), (X1 + T / 2, 0, H / 2), plaster, S)
L.box("OFFICE_WallFront", (W, T, H), (0, Y0 - T / 2, H / 2), plaster, S)
# back wall with window opening
WX0, WX1, WZ0, WZ1 = -2.45, -0.55, 0.85, 2.25
yb = Y1 + T / 2
L.box("OFFICE_WallBack_Below", (W, T, WZ0), (0, yb, WZ0 / 2), plaster, S)
L.box("OFFICE_WallBack_Above", (W, T, H - WZ1), (0, yb, (H + WZ1) / 2), plaster, S)
L.box("OFFICE_WallBack_Left", (WX0 - X0, T, WZ1 - WZ0), ((X0 + WX0) / 2, yb, (WZ0 + WZ1) / 2), plaster, S)
L.box("OFFICE_WallBack_Right", (X1 - WX1, T, WZ1 - WZ0), ((WX1 + X1) / 2, yb, (WZ0 + WZ1) / 2), plaster, S)
# window: steel frame, three panes and a transom, interior sill
fw, fd = 0.045, 0.06
yf = Y1 + T - fd / 2 - 0.01
wcx, wcz, ww, wh = (WX0 + WX1) / 2, (WZ0 + WZ1) / 2, WX1 - WX0, WZ1 - WZ0
L.box("OFFICE_WindowFrame_Bottom", (ww, fd, fw), (wcx, yf, WZ0 + fw / 2), steel, S)
L.box("OFFICE_WindowFrame_Top", (ww, fd, fw), (wcx, yf, WZ1 - fw / 2), steel, S)
L.box("OFFICE_WindowFrame_Left", (fw, fd, wh), (WX0 + fw / 2, yf, wcz), steel, S)
L.box("OFFICE_WindowFrame_Right", (fw, fd, wh), (WX1 - fw / 2, yf, wcz), steel, S)
for i in (1, 2):
    L.box(f"OFFICE_WindowMullion_{i}", (0.03, fd, wh), (WX0 + ww * i / 3, yf, wcz), steel, S)
L.box("OFFICE_WindowTransom", (ww, fd, 0.03), (wcx, yf, WZ1 - 0.42), steel, S)
L.box("OFFICE_WindowGlass", (ww - 0.02, 0.006, wh - 0.02), (wcx, yf + 0.01, wcz), glass, S)
L.box("OFFICE_WindowSill", (ww + 0.16, 0.24, 0.035), (wcx, Y1 - 0.06, WZ0 - 0.0175), oak, S, bevel=0.004)
# skirting
for nm, sz, p in [("Back", (W, 0.015, 0.09), (0, Y1 - 0.0075, 0.045)), ("Front", (W, 0.015, 0.09), (0, Y0 + 0.0075, 0.045)),
                  ("Left", (0.015, DEP, 0.09), (X0 + 0.0075, 0, 0.045)), ("Right", (0.015, DEP, 0.09), (X1 - 0.0075, 0, 0.045))]:
    L.box("OFFICE_Skirting_" + nm, sz, p, dark_wood, S)
# entry door (behind the learner; never in a learner camera, present so the room is closed)
L.box("OFFICE_DoorFrame", (1.0, 0.05, 2.15), (2.1, Y0 + 0.02, 1.075), dark_wood, S)
L.box("OFFICE_Door", (0.9, 0.045, 2.08), (2.1, Y0 + 0.04, 1.04), oak_v, S, bevel=0.003)
L.box("OFFICE_DoorHandle", (0.12, 0.05, 0.02), (1.78, Y0 + 0.085, 1.0), brass, S)
L.box("OFFICE_CeilingFixture", (0.6, 0.6, 0.03), (0, -0.2, H - 0.015), fixture, S)

# ------------------------------------------------------------------ desk (1.80 x 1.10, top centre z .75, .04 thick)
F = C["Furniture"]
dx, dy, dz = OF["desk_center"]
sx, sy, sz = OF["desk_size"]
top_z = dz + sz / 2                         # 0.77 working surface
under = dz - sz / 2                         # 0.73
L.box("DESK_Top", (sx, sy, sz), (dx, dy, dz), oak, F, bevel=0.006)
ped_w = 0.44
pcx = dx + sx / 2 - 0.04 - ped_w / 2
L.box("DESK_Pedestal", (ped_w, sy - 0.12, under), (pcx, dy, under / 2), oak_v, F, bevel=0.003)
L.box("DESK_LeftPanel", (0.04, sy - 0.12, under), (dx - sx / 2 + 0.06, dy, under / 2), oak_v, F, bevel=0.003)
L.box("DESK_ModestyPanel", (sx - 0.12 - ped_w, 0.02, 0.42), (dx - sx / 2 + 0.08 + (sx - 0.12 - ped_w) / 2, dy + sy / 2 - 0.09, under - 0.21), oak_v, F)
front = dy - (sy - 0.12) / 2 - 0.006
hs = [0.17, 0.22, 0.30]
z = under - 0.02
for i, hgt in enumerate(hs):
    zc = z - hgt / 2
    L.box(f"DESK_Drawer_{i+1}", (ped_w - 0.03, 0.014, hgt - 0.012), (pcx, front, zc), oak, F, bevel=0.002)
    L.box(f"DESK_DrawerPull_{i+1}", (0.11, 0.018, 0.012), (pcx, front - 0.014, zc + hgt * 0.22), brass, F, bevel=0.002)
    z -= hgt

# credenza against the back wall, and the woven hanging above it
cx_c, cw = 0.35, 1.3
L.box("OFFICE_Credenza", (cw, 0.42, 0.74), (cx_c, Y1 - 0.23, 0.39), oak, F, bevel=0.004)
L.box("OFFICE_CredenzaPlinth", (cw - 0.06, 0.38, 0.04), (cx_c, Y1 - 0.23, 0.02), dark_wood, F)
for i in range(3):
    L.box(f"OFFICE_CredenzaDoorLine_{i}", (0.004, 0.006, 0.6), (cx_c - cw / 2 + cw * (i + 1) / 4, Y1 - 0.443, 0.42), dark_wood, F)
hang = L.box("OFFICE_WovenHanging", (0.78, 0.012, 1.0), (cx_c, Y1 - 0.01, 1.62), weave, F)
# hanging uses UV 0..1 across its face for the stripe pattern
me = hang.data
uv = me.uv_layers.active.data
for poly in me.polygons:
    for li in poly.loop_indices:
        co = me.vertices[me.loops[li].vertex_index].co
        uv[li].uv = (co.x / 0.78 + 0.5, co.z / 1.0 + 0.5)
L.box("OFFICE_HangingRod", (0.86, 0.02, 0.02), (cx_c, Y1 - 0.025, 2.13), dark_wood, F)

# bookshelf (original, procedural; spines carry no text)
bx, bw, bd, bh = 1.92, 1.3, 0.34, 2.05
by = Y1 - bd / 2 - 0.005
L.box("SHELF_Left", (0.025, bd, bh), (bx - bw / 2 + 0.0125, by, bh / 2), oak_v, F)
L.box("SHELF_Right", (0.025, bd, bh), (bx + bw / 2 - 0.0125, by, bh / 2), oak_v, F)
L.box("SHELF_Back", (bw, 0.012, bh), (bx, Y1 - 0.011, bh / 2), dark_wood, F)
L.box("SHELF_Top", (bw, bd, 0.03), (bx, by, bh - 0.015), oak, F, bevel=0.003)
levels = [0.06, 0.45, 0.83, 1.21, 1.59]
for i, zl in enumerate(levels):
    L.box(f"SHELF_Board_{i}", (bw - 0.05, bd - 0.01, 0.025), (bx, by, zl), oak, F)
book_cols = [(0.33, 0.09, 0.07), (0.10, 0.14, 0.24), (0.50, 0.38, 0.16), (0.24, 0.27, 0.16), (0.70, 0.64, 0.52), (0.18, 0.12, 0.08), (0.12, 0.12, 0.12)]
book_mats = [L.mat(f"AB_BookCloth_{i}", c, 0.8) for i, c in enumerate(book_cols)]
rng = random.Random(7)
books = []
for li, zl in enumerate(levels[:-1] + [levels[-1]]):
    x = bx - bw / 2 + 0.04
    xend = bx + bw / 2 - 0.04
    if li == 2:
        xend = bx + 0.05          # leave room for file boxes on this shelf
    while x < xend - 0.03:
        if rng.random() < 0.07:
            x += rng.uniform(0.05, 0.12); continue
        t = rng.uniform(0.02, 0.05); hgt = rng.uniform(0.2, 0.3); dep = rng.uniform(0.18, 0.25)
        o = L.box(f"SHELF_Book_{li}_{len(books)}", (t, dep, hgt), (x + t / 2, by - bd / 2 + 0.02 + dep / 2, zl + 0.0125 + hgt / 2), rng.choice(book_mats), F)
        books.append(o); x += t + 0.002
if books:
    j = L.join("SHELF_Books", books, F)
    for o in books:
        bpy.data.objects.remove(o, do_unlink=True)

# ------------------------------------------------------------------ donor pieces (originals stay in SRC scenes; copies only)
L.import_source("office_-_assets.glb", "SRC_OfficeAssets")
P = C["Props"]

def place(name, roots, target, face=None, c=P, key_z=0.7):
    """Join donor meshes into a new object, origin bottom-centre, place at `target`.
    `face` = desired XY direction of the part above key_z (e.g. chair backrest / lamp shade)."""
    o = L.join(name, L.donor_meshes(roots), c)
    L.set_origin_bottom_centre(o)
    if face is not None:
        vs = [v.co for v in o.data.vertices if v.co.z > key_z * L.dims(o)[2]]
        cen = sum(vs, Vector()) / len(vs)
        cur = math.atan2(cen.y, cen.x)
        want = math.atan2(face[1], face[0])
        o.rotation_euler.z = want - cur
    o.location = target
    return o

place("OFFICE_Chair", ["Chair_51"], (0, -0.98, 0), face=(0, -1), key_z=0.75)
place("OFFICE_DeskLamp", ["Lamp01_57", "Lamp02_54", "Lamp02.001_56", "Lamp02.002_55", "Lamp_Holder.001_53", "Lamp_Shade.001_52"],
      (0.66, 0.30, top_z), face=(-0.55, -0.6), key_z=0.8)
place("OFFICE_Notebook", ["Notebook_50"], (0.75, -0.36, top_z)).rotation_euler.z = math.radians(-9)
place("OFFICE_Cactus", ["Cactus_0", "Cactus_Pot_2", "Cactus_Soil_1"], (-0.95, Y1 - 0.08, WZ0))
fb1 = place("OFFICE_FileBox_Green", ["FileBox_Green_8"], (bx + 0.22, by, levels[2] + 0.0125))
fb2 = place("OFFICE_FileBox_Black", ["FileBox_Black_7"], (bx + 0.36, by, levels[2] + 0.0125))

# ------------------------------------------------------------------ lights (review lighting; runtime lights are set in three.js)
Lc = C["Lights"]
win = L.light("LIGHT_WindowDaylight", "AREA", (wcx, Y1 - 0.05, wcz), 110, (0.82, 0.88, 1.0), Lc, size=(ww, wh))
win.rotation_euler = (math.radians(-90), 0, 0)         # area light emits along -Z; -90 deg about X turns that to -Y (into the room)
L.light("LIGHT_CeilingFill", "AREA", (0, -0.4, H - 0.05), 45, (1.0, 0.95, 0.88), Lc, size=(1.8, 1.8))
lamp = bpy.data.objects["OFFICE_DeskLamp"]
L.light("LIGHT_DeskLamp", "SPOT", (lamp.location.x - 0.14, lamp.location.y - 0.14, top_z + 0.36), 28, (1.0, 0.78, 0.52), Lc,
        size=0.03, spot=math.radians(80))
L.aim(bpy.data.objects["LIGHT_DeskLamp"], (0.25, -0.05, top_z))

# ------------------------------------------------------------------ exterior backdrop seen through the window
E = C["Exterior"]
bpy.ops.mesh.primitive_plane_add(size=1, location=(wcx + 0.4, Y1 + 4.0, 1.3), rotation=(math.radians(90), 0, 0))
pl = bpy.context.object; pl.name = "OFFICE_ExteriorBackdrop"; pl.dimensions = (11, 6, 1)
bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
L.link(pl, E); pl.data.materials.append(ext)

# ------------------------------------------------------------------ cameras and runtime anchors
L.cameras(["CAM_OfficeEntry", "CAM_Desk", "CAM_Document", "CAM_Model", "CAM_ChairOffice"], C["Cameras"])
Hs = C["Hotspots"]
L.empty("HOTSPOT_CaseFile", OF["folder_position"], Hs, "CUBE", 0.12)
L.empty("ANCHOR_Folder", OF["folder_position"], Hs, "ARROWS", 0.1)
L.empty("ANCHOR_PaperRead", OF["paper_read_position"], Hs, "ARROWS", 0.1)
L.empty("ANCHOR_Map", OF["map_position"], Hs, "ARROWS", 0.15)
L.empty("ANCHOR_Recorder", (0.42, 0.12, top_z), Hs, "ARROWS", 0.08)

# ------------------------------------------------------------------ world and render defaults
w = bpy.data.worlds.get("AB_World_Office") or bpy.data.worlds.new("AB_World_Office")
sc.world = w
try:
    w.use_nodes = True
except Exception:
    pass
bg = next(n for n in w.node_tree.nodes if n.type == "BACKGROUND")
bg.inputs[0].default_value = (0.55, 0.6, 0.65, 1); bg.inputs[1].default_value = 0.12
try:
    sc.render.engine = "BLENDER_EEVEE"
except TypeError:
    pass
for attr, val in [("use_raytracing", True), ("use_shadows", True), ("taa_render_samples", 48)]:
    if hasattr(sc.eevee, attr):
        setattr(sc.eevee, attr, val)
sc.view_settings.view_transform = "AgX"
sc.camera = bpy.data.objects["CAM_Desk"]
bpy.context.window.scene = sc
print("OFFICE_BUILD_COMPLETE", len(list(root.all_objects)))
