"""Build the research-unit office (scene OFFICE) by re-using the user's Evidence Room.

User decision (19 Nov 2026): build the office from the Evidence Room in
~/investigation assets/EvidenceRoom_v03.blend (scene "Scene", collection EVIDENCE_ROOM), not from scratch.
That file is only READ (appended into this working file); it is never written.

Fit to layout.json:
  * The Evidence Room review desk sits at (1.3, 0) and its hero camera looks -X from x = 2.4.
    One root transform (rotate -90 deg about Z, then +1.3 m in Y) puts the desk centre at the origin and
    the learner on -Y looking +Y, exactly like CAM_Desk.
  * The desk top is lowered from 0.922 m to layout's 0.77 m working surface (desk scaled in Z only)
    and every desk prop is lowered by the same amount, so folder/paper/map anchors stay valid.
  * Room keeps its authored size (about 6 m wide x 8 m deep x 3 m) instead of layout's proposed 6 x 5 x 3;
    the windows are on the wall behind the learner, so daylight comes from behind-left.
Removed (police / real-person / case content): stripe band (re-skinned as wood wainscot), police door kit
(door re-skinned oak), investigation board + all pinned items, exhibits and tents, evidence boxes/lockers/safe,
loose printed sheets, officer notebook, intake clipboard; monitor screen blanked.
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
OF = D["office"]
DESK_TOP_ER = 0.922
DESK_TOP = OF["desk_center"][2] + OF["desk_size"][2] / 2      # 0.77
DZ = DESK_TOP_ER - DESK_TOP

# ------------------------------------------------------------------ source: append once into an SRC scene
src_sc = bpy.data.scenes.get("SRC_EvidenceRoom") or bpy.data.scenes.new("SRC_EvidenceRoom")
if "EVIDENCE_ROOM" not in bpy.data.collections:
    with bpy.data.libraries.load(str(ER_BLEND), link=False) as (src, dst):
        dst.collections = ["EVIDENCE_ROOM"]
    src_sc.collection.children.link(bpy.data.collections["EVIDENCE_ROOM"])
ER = bpy.data.collections["EVIDENCE_ROOM"]

SKIP_COLLECTIONS = {"ER_Desk_Exhibits", "ER_Wall_Displays", "ER_Unused_Parts", "SIM_Colliders", "ER_Cameras"}
SKIP_PREFIX = ("WALL_", "EXH_", "MRK_", "STORAGE_EvidenceBox", "STORAGE_EvidenceLocker", "STORAGE_EvidenceSafe",
               "STORAGE_LockerTop", "DECOR_LooseSheet", "DECOR_PaperStack", "DECOR_Paper_", "PROP_Notebook_Officer",
               "PROP_Clipboard_IntakeLog", "ARCH_Door_EvidenceRoom_PoliceKit__mesh02", "COL_", "CAM_")

# ------------------------------------------------------------------ target scene / collections
sc = L.scene("OFFICE", fps=60)
root = L.coll("OFFICE", sc)
for ch in list(root.children):
    if ch.name.startswith("OFFICE_"):
        L.clear_coll(ch)
for o in list(root.objects):
    bpy.data.objects.remove(o, do_unlink=True)
C = {n: L.coll("OFFICE_" + n, root) for n in ["ER", "Dressing", "Lights", "Cameras", "Hotspots"]}


def skipped(o):
    x = o
    while x:
        if x.name.startswith(SKIP_PREFIX):
            return True
        x = x.parent
    return False


# ------------------------------------------------------------------ copy kept Evidence Room objects under one root
er_root = L.empty("OFFICE_ER_Root", (0, 1.3, 0), C["ER"], "ARROWS", 0.3)
er_root.rotation_euler = (0, 0, math.radians(-90))
copies = {}
for sub in ER.children:
    if sub.name in SKIP_COLLECTIONS:
        continue
    tgt = L.coll("OFFICE_" + sub.name, C["ER"])
    for o in sub.all_objects:
        if o in copies or skipped(o):
            continue
        cp = o.copy()                       # shares mesh/light data with the SRC copy; never edits that data
        tgt.objects.link(cp)
        copies[o] = cp
for o, cp in copies.items():
    if o.parent in copies:
        cp.parent = copies[o.parent]
        cp.matrix_parent_inverse = o.matrix_parent_inverse.copy()
    else:
        cp.parent = er_root
        cp.matrix_parent_inverse = Matrix.Identity(4)
        cp.matrix_basis = L.world_matrix(o)   # ER world space becomes local to the root
    # parenting to a skipped object would have dropped it; such orphans are reparented above


def cp(name):
    src = bpy.data.objects.get(name)
    return copies.get(src)


# desk: lower the working surface to layout height (Z-only scale about the floor)
# every top-level desk part (the top slab is not parented to the desk body in the source)
for o, c in copies.items():
    if o.name.startswith("FURN_Desk_EvidenceReview") and c.parent == er_root:
        # the node is rotated (glTF Y-up import), so scale in the root's Z (= world up), not the node's local Z
        c.matrix_basis = Matrix.Diagonal((1, 1, DESK_TOP / DESK_TOP_ER, 1)) @ c.matrix_basis
for o, c in copies.items():
    if o.users_collection and o.users_collection[0].name == "ER_Desk_Props" and c.parent == er_root:
        c.location.z -= DZ

# ------------------------------------------------------------------ triangle budget (kit: office <= 150k)
# Decimate MODIFIERS on the copies (object level): the mesh data stays shared with the untouched source and the
# export applies the modifiers. Ratios measured 19 Nov 2026: shelf 143k, bookcase 43k, sideboard 39k, wall cabinet 35k.
SLIM = {"STORAGE_MetalShelf_CaseFiles": 0.12, "STORAGE_Bookcase_CaseFiles": 0.22, "STORAGE_Sideboard_South": 0.2,
        "STORAGE_Cabinet_Wall": 0.22, "FURN_Chair_Officer": 0.3, "PROP_Mug_Coffee": 0.25, "DECOR_Plant_Cactus": 0.5,
        "FURN_WasteBin": 0.4}
for o, c in copies.items():
    if c.type != "MESH":
        continue
    x = o
    while x.parent and not x.name.startswith(tuple(SLIM)):
        x = x.parent
    key = next((k for k in SLIM if x.name.startswith(k)), None)
    if key and len(c.data.polygons) > 200:
        m = c.modifiers.new("BudgetDecimate", "DECIMATE"); m.ratio = SLIM[key]; m.use_collapse_triangulate = True

# ------------------------------------------------------------------ re-skin police elements (object-level material overrides)
dark_wood = L.mat_wood("AB_DarkWood_Panel", (0.075, 0.042, 0.022), (0.19, 0.105, 0.055), rough=0.55, axis="Z")
wainscot = L.mat_plaster("AB_Wainscot_Paint", (0.20, 0.13, 0.085), rough=0.6)   # warm brown satin paint
oak_v = L.mat_wood("AB_Oak_Door", (0.27, 0.155, 0.075), (0.47, 0.30, 0.155), rough=0.6, axis="Z")
screen = L.mat("AB_MonitorScreenOff", (0.015, 0.017, 0.02), 0.25, spec=0.6)


def override(obj, material):
    if not obj or obj.type != "MESH":
        return
    for slot in obj.material_slots:
        slot.link = "OBJECT"
        slot.material = material


override(cp("ARCH_WallBand_PoliceStripes"), wainscot)
for n in ("ARCH_Door_EvidenceRoom_PoliceKit__mesh01", "ARCH_Door_EvidenceRoom_PoliceKit__mesh03"):
    override(cp(n), oak_v)
override(cp("PROP_Records_Monitor_Screen"), screen)

# ------------------------------------------------------------------ dressing in place of the investigation board
weave = bpy.data.materials.get("AB_WovenHanging")
if weave is None:   # built by build_office_procedural_v1.py; minimal fallback
    weave = L.mat("AB_WovenHanging", (0.45, 0.32, 0.18), 0.95)
board = bpy.data.objects.get("WALL_InvestigationBoard_Case047")
pts = [L.world_matrix(o) @ Vector(c) for o in [board] + list(board.children_recursive) if o.type == "MESH" for c in o.bound_box]
bc = sum(pts, Vector()) / len(pts)
bc_new = er_root.matrix_basis @ bc
wall_y = max(p.y for p in [er_root.matrix_basis @ q for q in pts])
hang = L.box("OFFICE_WovenHanging", (1.1, 0.012, 1.25), (bc_new.x, wall_y - 0.02, 1.55), weave, C["Dressing"])
me = hang.data
uv = me.uv_layers.active.data
for poly in me.polygons:
    for li in poly.loop_indices:
        co = me.vertices[me.loops[li].vertex_index].co
        uv[li].uv = (co.x / 1.1 + 0.5, co.z / 1.25 + 0.5)
L.box("OFFICE_HangingRod", (1.2, 0.022, 0.022), (bc_new.x, wall_y - 0.03, 2.2), dark_wood, C["Dressing"])

# ------------------------------------------------------------------ cameras + runtime anchors (layout.json authority)
L.cameras(["CAM_OfficeEntry", "CAM_Desk", "CAM_Document", "CAM_Model", "CAM_ChairOffice"], C["Cameras"])
Hs = C["Hotspots"]
L.empty("HOTSPOT_CaseFile", OF["folder_position"], Hs, "CUBE", 0.12)
L.empty("ANCHOR_Folder", OF["folder_position"], Hs, "ARROWS", 0.1)
L.empty("ANCHOR_PaperRead", OF["paper_read_position"], Hs, "ARROWS", 0.1)
L.empty("ANCHOR_Map", OF["map_position"], Hs, "ARROWS", 0.15)
L.empty("ANCHOR_Recorder", (0.42, 0.12, DESK_TOP), Hs, "ARROWS", 0.08)

# ------------------------------------------------------------------ render defaults (Evidence Room world/lights come with it)
er_world = bpy.data.worlds.get("ER_World")
if er_world is None:
    with bpy.data.libraries.load(str(ER_BLEND), link=False) as (src, dst):
        dst.worlds = ["World"]
    er_world = dst.worlds[0]
    er_world.name = "ER_World"
sc.world = er_world
for attr, val in [("use_raytracing", True), ("use_shadows", True), ("taa_render_samples", 48)]:
    if hasattr(sc.eevee, attr):
        setattr(sc.eevee, attr, val)
try:
    sc.render.engine = "BLENDER_EEVEE"
except TypeError:
    pass
sc.view_settings.view_transform = "AgX"
sc.camera = bpy.data.objects["CAM_Desk"]
bpy.context.window.scene = sc
print("OFFICE_ER_BUILD_COMPLETE", len(copies), "objects copied")
