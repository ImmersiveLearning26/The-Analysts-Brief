"""Build the case-file folder rig (scene FOLDER, collection FOLDER) from layout.json + plates 02/03.

Original geometry (the supplied document_file_folder.glb is grey, logo-badged, opens by a 211-target
shape-key morph over 7 s and bakes text into its pages, so it is not used; see production/ASSET_AUDIT.md).

Local frame: FOLDER_Root at the origin, X right, Y up the page, Z up. The runtime places FOLDER_Root at
layout.office.folder_position (-0.20, 0.15, 0.776) with NO rotation; clip translations below are local
deltas that assume exactly that placement.

Canonical nodes: FOLDER_Root, FOLDER_Hinge, FOLDER_Cover, FOLDER_Back, FOLDER_Spine, FOLDER_Tab_All,
FOLDER_Tab_Foundations, FOLDER_Tab_SetAside, PAPER_Stack, PAPER_01, PAPER_02, PAPER_03, TAG_Foundations,
TAG_SetAside, ANCHOR_PaperText.

Clips (60 fps, timings from production/MOTION_AND_ORB.md):
  Folder_Open    FOLDER_Hinge  0 -> -165 deg about Y, 600 ms
  Folder_Close   FOLDER_Hinge  -165 -> 0 deg, 400 ms
  Paper_Extract  PAPER_01      lift 15 mm 120 ms; slide to read pose 360 ms; tilt 70 deg 220 ms overlapping
  Paper_Return   PAPER_01      tilt back + lower/slide to stack, 300 ms
  Tag_Apply      TAG_*         press scale 1.0 -> 0.97 -> 1.0, 160 ms
"""
import bpy, bmesh, sys, math, importlib
from pathlib import Path
from mathutils import Vector

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
import ab_lib as L
importlib.reload(L)

D = L.LAYOUT
FD = D["folder"]
OF = D["office"]
FPS = 60

sc = L.scene("FOLDER", fps=FPS)
root_c = L.coll("FOLDER", sc)
L.clear_coll(root_c)

CW, CH, ENV = FD["closed_size"]            # 0.24, 0.32, 0.008
PW, PH, PT = FD["paper_size"]              # 0.21, 0.297, 0.0004
TW, TH, TT = FD["tag_size"]                # 0.046, 0.018, 0.0005
CARD = 0.0008                              # card thickness
HX, HY, HZ = FD["hinge"]                   # -0.12, 0, 0.004


def srgb(h):
    c = [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    return tuple(v / 12.92 if v <= 0.04045 else ((v + 0.055) / 1.055) ** 2.4 for v in c)


# ------------------------------------------------------------------ materials
def fibre_mat(name, color, rough=0.85, scale=220):
    m = L.mat(name, color, rough, spec=0.35)
    nt, b = L._reset_nodes(m)
    tc = nt.nodes.new("ShaderNodeTexCoord")
    nz = nt.nodes.new("ShaderNodeTexNoise"); nz.inputs["Scale"].default_value = scale; nz.inputs["Detail"].default_value = 6
    nt.links.new(tc.outputs["Object"], nz.inputs["Vector"])
    ramp = nt.nodes.new("ShaderNodeValToRGB")
    ramp.color_ramp.elements[0].color = (*(v * 0.95 for v in color), 1)
    ramp.color_ramp.elements[1].color = (*(min(1, v * 1.03) for v in color), 1)
    nt.links.new(nz.outputs["Fac"], ramp.inputs["Fac"])
    nt.links.new(ramp.outputs["Color"], b.inputs["Base Color"])
    return m

manila = fibre_mat("AB_Manila", srgb("D9BF8C"), 0.8, 160)
manila_in = fibre_mat("AB_Manila_Inside", srgb("E6D2A8"), 0.85, 160)
paper = fibre_mat("AB_Paper", srgb("F3EFE6"), 0.9, 300)
stack_mat = fibre_mat("AB_PaperStackEdge", srgb("E9E4D8"), 0.9, 600)
tag_f = L.mat("AB_Tag_Foundations", srgb("C5D0B8"), 0.7)
tag_s = L.mat("AB_Tag_SetAside", srgb("B9C6CF"), 0.7)


# ------------------------------------------------------------------ geometry helpers
def rrect(w, h, r, seg=4, x0=0.0, y0=0.0, corners=(1, 1, 1, 1)):
    """Rounded rectangle outline (CCW) with lower-left at (x0, y0). corners = (LL, LR, UR, UL) on/off."""
    pts = []
    cs = [((x0 + r, y0 + r), math.pi, (x0, y0)), ((x0 + w - r, y0 + r), 1.5 * math.pi, (x0 + w, y0)),
          ((x0 + w - r, y0 + h - r), 0.0, (x0 + w, y0 + h)), ((x0 + r, y0 + h - r), 0.5 * math.pi, (x0, y0 + h))]
    for on, (c, a0, sharp) in zip(corners, cs):
        if not on or r <= 0:
            pts.append(sharp); continue
        for i in range(seg + 1):
            a = a0 + (math.pi / 2) * i / seg
            pts.append((c[0] + r * math.cos(a), c[1] + r * math.sin(a)))
    return pts


def slab(name, outline, z0, t, material, c, parent=None, uv_box=None):
    o = L.poly_prism(name, outline, z0, z0 + t, material, c)
    if uv_box:   # (xmin, ymin, w, h): planar 0..1 UVs, used for paper so the app can map a canvas
        xm, ym, w, h = uv_box
        me = o.data
        uvl = me.uv_layers.active.data
        for li, lp in enumerate(me.loops):
            co = me.vertices[lp.vertex_index].co
            uvl[li].uv = ((co.x - xm) / w, (co.y - ym) / h)
    if parent:
        o.parent = parent
    return o


# ------------------------------------------------------------------ rig
C = root_c
froot = L.empty("FOLDER_Root", (0, 0, 0), C, "ARROWS", 0.08)

# back panel (inside face up), lower-left at (-CW/2, -CH/2)
back = slab("FOLDER_Back", rrect(CW, CH, 0.004, 4, -CW / 2, -CH / 2, corners=(0, 1, 1, 0)), 0.0, CARD, manila_in, C, froot)
# three filter tabs standing off the top edge of the back panel (blank; labels are HTML/canvas in the app)
for i, nm in enumerate(["All", "Foundations", "SetAside"]):
    tw = 0.072
    x0 = -CW / 2 + 0.008 + i * (tw + 0.006)
    slab(f"FOLDER_Tab_{nm}", rrect(tw, 0.02, 0.005, 4, x0, CH / 2, corners=(0, 0, 1, 1)), 0.0, CARD, manila_in, C, froot)
# spine crease along the hinge
L.box("FOLDER_Spine", (0.004, CH, ENV), (HX, 0, ENV / 2), manila, C, parent=froot)

# paper: a block stand-in for the filed stack, plus three loose top sheets (PAPER_01 is the active sheet)
px0, py0 = -PW / 2, -PH / 2 + 0.0005
stack_t = 0.0050
slab("PAPER_Stack", rrect(PW, PH, 0.0, 0, px0, py0), CARD, stack_t, stack_mat, C, froot)
z = CARD + stack_t
sheets = []
for i in (3, 2, 1):
    s = slab(f"PAPER_{i:02}", rrect(PW, PH, 0.0, 0, -PW / 2, -PH / 2), 0.0, PT, paper, C, froot, uv_box=(-PW / 2, -PH / 2, PW, PH))
    s.location = (0, 0.0005 + (i - 2) * 0.0012, z)     # slight offsets so edges read as separate sheets
    s.rotation_euler.z = math.radians((i - 2) * 0.6)
    z += PT
    sheets.append(s)
p1 = bpy.data.objects["PAPER_01"]
p1.rotation_euler.z = 0.0
L.empty("ANCHOR_PaperText", (0, 0, PT), C, "PLAIN_AXES", 0.03).parent = p1


# tags: flat label face + 2.5 mm folded edge over the paper's right edge, near the top-right corner
def make_tag(name, material, visible):
    face = slab(name, rrect(TW, TH, 0.002, 4, -TW, 0.0), 0.0, TT, material, C, p1)
    # folded edge: hangs down at the right end (x = 0), merged into the tag mesh
    bm = bmesh.new(); bm.from_mesh(face.data)
    ret = bmesh.ops.create_cube(bm, size=1.0)
    vs = ret["verts"]
    bmesh.ops.scale(bm, vec=(TT, TH - 0.004, 0.0025), verts=vs)
    bmesh.ops.translate(bm, vec=(TT / 2, TH / 2, -0.00125 + TT), verts=vs)
    bm.to_mesh(face.data); bm.free()
    face.location = (PW / 2, PH / 2 - 0.03 - TH, PT)       # right end flush with the paper edge
    face.hide_render = not visible
    face.hide_viewport = False
    return face

tf = make_tag("TAG_Foundations", tag_f, True)
ts = make_tag("TAG_SetAside", tag_s, False)

# hinge + cover (outside face up when closed). Cover geometry spans x 0..CW relative to the hinge.
hinge = L.empty("FOLDER_Hinge", (HX, HY, HZ), C, "SINGLE_ARROW", 0.05)
hinge.parent = froot
hinge.rotation_mode = "XYZ"
cover = slab("FOLDER_Cover", rrect(CW, CH, 0.004, 4, 0.0, -CH / 2, corners=(0, 1, 1, 0)), ENV - CARD - HZ, CARD, manila, C, hinge)


# ------------------------------------------------------------------ animation clips (NLA strips, one action each)
def clip(obj, name, start, keys):
    """keys: list of (frame, {data_path: value or tuple}). Creates action `name`, pushes it to an NLA track."""
    ad = obj.animation_data_create()
    for tr in list(ad.nla_tracks):
        if tr.name == name:
            ad.nla_tracks.remove(tr)
    old = bpy.data.actions.get(name)
    if old:
        bpy.data.actions.remove(old)
    ad.action = None
    for f, vals in keys:
        for path, v in vals.items():
            setattr(obj, path, v)
            obj.keyframe_insert(data_path=path, frame=f)
    act = ad.action
    act.name = name
    act.use_fake_user = True
    ad.action = None
    tr = ad.nla_tracks.new()
    tr.name = name
    st = tr.strips.new(name, start, act)
    st.extrapolation = "HOLD_FORWARD"
    return act


ms = lambda t: t * FPS / 1000.0
R = math.radians
open_deg = FD["open_degrees"]                 # -165

clip(hinge, "Folder_Open", 0, [(0, {"rotation_euler": (0, 0, 0)}), (ms(600), {"rotation_euler": (0, R(open_deg), 0)})])
clip(hinge, "Folder_Close", 400, [(0, {"rotation_euler": (0, R(open_deg), 0)}), (ms(400), {"rotation_euler": (0, 0, 0)})])
bpy.data.objects["FOLDER_Hinge"].animation_data.nla_tracks["Folder_Open"].strips[0].extrapolation = "HOLD"

rest = Vector(p1.location)
read = Vector(OF["paper_read_position"]) - Vector(OF["folder_position"])   # local delta for an unrotated root
lift = rest + Vector((0, 0, 0.015))
clip(p1, "Paper_Extract", 40, [
    (0, {"location": rest, "rotation_euler": (0, 0, 0)}),
    (ms(120), {"location": lift}),
    (ms(260), {"rotation_euler": (0, 0, 0)}),
    (ms(480), {"location": read, "rotation_euler": (R(OF["paper_read_rotation_degrees"][0]), 0, 0)}),
])
bpy.data.objects["PAPER_01"].animation_data.nla_tracks["Paper_Extract"].strips[0].extrapolation = "HOLD"
clip(p1, "Paper_Return", 240, [
    (0, {"location": read, "rotation_euler": (R(OF["paper_read_rotation_degrees"][0]), 0, 0)}),
    (ms(140), {"rotation_euler": (0, 0, 0)}),
    (ms(300), {"location": rest}),
])
for t in (tf, ts):
    clip(t, "Tag_Apply" + ("_Foundations" if t is tf else "_SetAside"), 120,
         [(0, {"scale": (1, 1, 1)}), (ms(80), {"scale": (0.97, 0.97, 0.97)}), (ms(160), {"scale": (1, 1, 1)})])

sc.frame_start, sc.frame_end = 0, 300
sc.frame_set(0)

# ------------------------------------------------------------------ show the folder in the office preview
off = bpy.data.scenes.get("OFFICE")
if off:
    hc = L.coll("OFFICE_Hotspots", bpy.data.collections["OFFICE"])
    inst = bpy.data.objects.get("PREVIEW_FolderInstance")
    if inst:
        bpy.data.objects.remove(inst, do_unlink=True)
    inst = bpy.data.objects.new("PREVIEW_FolderInstance", None)
    inst.instance_type = "COLLECTION"
    inst.instance_collection = root_c
    inst.location = OF["folder_position"]
    hc.objects.link(inst)
    off.render.fps = FPS

print("FOLDER_BUILD_COMPLETE", [o.name for o in root_c.all_objects])
