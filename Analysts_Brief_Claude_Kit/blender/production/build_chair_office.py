"""Build the Chair's evening office (scene CHAIR_OFFICE) by SHARING the OFFICE collection (kit: the Chair office
reuses office.glb with a lighting/prop configuration, not another asset).

Per-scene differences only (the OFFICE scene is unchanged):
  * the Evidence Room daytime lights and the folder/map preview instances are excluded in this scene's view layer
  * evening world + warm lamp key, dim warm ceiling fill and a cool dusk light from the windows behind the learner
  * CHAIR_Variant props: the user's cassette radio-recorder (digital-evidence workstation, maker names already painted
    out there) + cassette, the office pack's notebook and clipboard
  * CHAIR_RecIndicator: a small red light on the recorder, HIDDEN by default; the runtime shows it only while an
    actual recording is in progress (kit: no indicator unless recording is active)
Camera: CAM_ChairOffice from layout.json (shared with the office cameras collection).
"""
import bpy, sys, math, importlib
from pathlib import Path
from mathutils import Vector, Matrix

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
import ab_lib as L
importlib.reload(L)

D = L.LAYOUT
OF = D["office"]
DESK_TOP = OF["desk_center"][2] + OF["desk_size"][2] / 2          # 0.77 (Evidence Room desk inset surface ~0.76)
WS_GLB = Path.home() / "digital evidence " / "digital-evidence-lab" / "assets" / "models" / "workstation.glb"

office_root = bpy.data.collections["OFFICE"]
sc = bpy.data.scenes.get("CHAIR_OFFICE") or bpy.data.scenes.new("CHAIR_OFFICE")
sc.render.fps = 60
if office_root.name not in sc.collection.children:
    sc.collection.children.link(office_root)
var = L.coll("CHAIR_Variant", sc)
L.clear_coll(var)
bpy.context.window.scene = sc


def layer_coll(lc, name):
    if lc.collection.name == name:
        return lc
    for ch in lc.children:
        r = layer_coll(ch, name)
        if r:
            return r
    return None


vl = sc.view_layers[0]
for nm in ("OFFICE_ER_Lighting", "OFFICE_Hotspots", "OFFICE_Debug"):
    lc = layer_coll(vl.layer_collection, nm)
    if lc:
        lc.exclude = True

# ------------------------------------------------------------------ props
def import_glb(path, scene_name):
    s_ = bpy.data.scenes.get(scene_name)
    if s_:
        return s_
    import logging; logging.disable(logging.INFO)
    s_ = bpy.data.scenes.new(scene_name); prev = bpy.context.window.scene
    bpy.context.window.scene = s_; bpy.ops.import_scene.gltf(filepath=str(path)); bpy.context.window.scene = prev
    return s_

import_glb(WS_GLB, "SRC_Workstation")
L.import_source("office_-_assets.glb", "SRC_OfficeAssets")


def prop(name, roots, loc, rotz_deg=0.0, exclude=()):
    meshes = [o for o in L.donor_meshes(roots) if not o.name.startswith(exclude)]
    o = L.join(name, meshes, var)
    L.set_origin_bottom_centre(o)
    o.location = loc
    o.rotation_euler.z = math.radians(rotz_deg)
    return o

ax, ay, _ = bpy.data.objects["ANCHOR_Recorder"].location
# CAM_ChairOffice only frames the back strip of the desk (y > ~0.22), so the props sit there, front to the Chair
recorder = prop("CHAIR_Recorder", ["TapePlayer"], (0.28, 0.30, DESK_TOP - 0.01), 0, exclude=("Tape_Out",))
tape = prop("CHAIR_Cassette", ["Microcassette"], (0.06, 0.27, DESK_TOP - 0.01), 15)
note = prop("CHAIR_Notebook", ["Notebook_50"], (-0.30, 0.28, DESK_TOP - 0.01), -6)
clip = prop("CHAIR_Clipboard", ["Clipboard_49", "Clipboard_Paper_48"], (-0.05, -0.12, DESK_TOP - 0.01), 4)

# red REC indicator on the recorder's top front edge (hidden; runtime shows it only while recording)
rd = L.dims(recorder)
rec_mat = L.mat_emit("AB_Chair_RecRed", (1.0, 0.05, 0.03), 12.0)
bpy.context.view_layer.update()
rec = L.box("CHAIR_RecIndicator", (0.008, 0.004, 0.004), (0, 0, 0), rec_mat, var)
rec.parent = recorder
rec.location = (rd[0] * 0.35, -rd[1] / 2 - 0.001, rd[2] * 0.78)  # on the front face (towards the Chair)
rec.hide_render = True
rec.hide_viewport = False

# ------------------------------------------------------------------ evening lighting
w = bpy.data.worlds.get("AB_World_Evening") or bpy.data.worlds.new("AB_World_Evening")
try:
    w.use_nodes = True
except Exception:
    pass
bg = next(n for n in w.node_tree.nodes if n.type == "BACKGROUND")
bg.inputs[0].default_value = (0.08, 0.10, 0.18, 1); bg.inputs[1].default_value = 0.45
sc.world = w
lamp = bpy.data.objects.get("PROP_DeskLamp_Office.001") or next((o for o in bpy.data.objects if o.name.startswith("PROP_DeskLamp_Office") and "OFFICE_ER_Desk_Props" in [c.name for c in o.users_collection]), None)
lp_ = lamp.matrix_world.translation if lamp else Vector((0.86, 0.32, DESK_TOP))
key = L.light("CHAIR_LampWarm", "SPOT", (lp_.x - 0.12, lp_.y - 0.06, DESK_TOP + 0.42), 140, (1.0, 0.70, 0.42), var, size=0.04, spot=math.radians(95))
L.aim(key, (0.15, -0.05, DESK_TOP))
glow = L.light("CHAIR_LampBounce", "POINT", (lp_.x - 0.1, lp_.y - 0.05, DESK_TOP + 0.38), 25, (1.0, 0.68, 0.40), var, size=0.06)
fill = L.light("CHAIR_CeilingWarm", "AREA", (0, -0.2, 2.9), 60, (1.0, 0.84, 0.66), var, size=(1.6, 1.6))
dusk = L.light("CHAIR_DuskWindow", "AREA", (-1.6, -2.4, 1.7), 90, (0.45, 0.58, 1.0), var, size=(2.0, 1.4))
L.aim(dusk, (0.2, 0.5, 0.9))
wall_wash = L.light("CHAIR_WallWashWarm", "AREA", (0.6, 1.5, 2.6), 30, (1.0, 0.78, 0.55), var, size=(2.5, 0.6))
L.aim(wall_wash, (0.6, 5.0, 1.2))

for attr, val in [("use_raytracing", True), ("use_shadows", True), ("taa_render_samples", 48)]:
    if hasattr(sc.eevee, attr):
        setattr(sc.eevee, attr, val)
try:
    sc.render.engine = "BLENDER_EEVEE"
except TypeError:
    pass
sc.view_settings.view_transform = "AgX"
sc.view_settings.look = "AgX - Medium High Contrast" if "AgX - Medium High Contrast" in [i.identifier for i in sc.view_settings.bl_rna.properties["look"].enum_items] else sc.view_settings.look
sc.camera = bpy.data.objects["CAM_ChairOffice"]
print("CHAIR_OFFICE_BUILD_COMPLETE", [o.name for o in var.objects])
