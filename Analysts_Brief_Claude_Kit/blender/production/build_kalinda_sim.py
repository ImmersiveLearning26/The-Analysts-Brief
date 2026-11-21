"""Outcome animation for the Kalinda miniature (design v3.1, 20 Nov 2026). Run in the open production file after
build_kalinda.py. NO PEOPLE (user instruction): vehicles, lights, banners, awnings and light shafts only.

Each outcome gets its own clips, one per animated object, named KAL_Sim_<Outcome>__<object>:
  Coup           army trucks leave the barracks in turn and drive the real roads through the capital to the
                 government, where they park; two jeeps take checkpoint positions at the bridge and the market;
                 red beacons light on the watchtowers.
  Rule           (personalised rule) a warm light shaft rises over the government, a ring spreads from it, a link
                 forms from the radio mast to the government, banners go up along the roads year by year.
  Consolidation  civilian vehicles drive the roads, awnings unfold over the market stalls, lights come on in the
                 villages one after another.
Timing: 10 s at 60 fps, 2 s per simulated year (Year 2 at 2 s ... Year 10 at 10 s). Frame 0 is the map exactly as
build_kalinda.py left it (helpers at scale 0), so the static map is unchanged when no clip plays.
Decoration only: the rule engine decides the outcome; a clip illustrates the outcome it returned. Nothing is removed.
Re-runnable: previous KAL_Sim objects and clips are deleted first; vehicles return to their remembered home.
"""
import bpy, math
from mathutils import Vector

FPS, END = 60, 600
sc = bpy.data.scenes["KALINDA"]
bpy.context.window.scene = sc
sc.frame_set(0)
root = bpy.data.objects["KAL_Root"]
coll = bpy.data.collections["KALINDA"]
VEH = bpy.data.objects["KAL_Vehicles"]

# ------------------------------------------------------------------ clean previous runs
for a in [a for a in bpy.data.actions if a.name.startswith("KAL_Sim_")]:
    bpy.data.actions.remove(a)
old = bpy.data.objects.get("KAL_Sim")
if old:
    for o in list(old.children_recursive):
        bpy.data.objects.remove(o, do_unlink=True)
    bpy.data.objects.remove(old, do_unlink=True)

def home(o):
    """Remember where the build placed a vehicle; every run starts from there."""
    if "sim_home" not in o:
        o["sim_home"] = [*o.location, *o.rotation_euler]
    h = list(o["sim_home"])
    o.location = h[:3]; o.rotation_euler = h[3:6]
    if o.animation_data:
        o.animation_data.action = None

for o in VEH.children:
    home(o)

sim = bpy.data.objects.new("KAL_Sim", None); sim.empty_display_size = .02
coll.objects.link(sim); sim.parent = root

# ------------------------------------------------------------------ ground probe (vehicles hidden so rays reach the road)
GROUND = ("KAL_Base", "KAL_Roads", "KAL_Bridge", "KAL_City_Ground", "KAL_Terrain", "KAL_River")
hidden = [o for o in VEH.children if not o.hide_viewport]
for o in hidden:
    o.hide_viewport = True
bpy.context.view_layer.update()
dg = bpy.context.evaluated_depsgraph_get()

def ground(x, y):
    p = Vector((x, y, .6))
    for _ in range(8):
        hit, loc, _n, _i, obj, _m = sc.ray_cast(dg, p, Vector((0, 0, -1)))
        if not hit:
            return .025
        if obj.name.startswith(GROUND):
            return loc.z
        p = loc - Vector((0, 0, 1e-4))
    return .025

# ------------------------------------------------------------------ paths
def catmull(pts, step=.003):
    P = [Vector(p) for p in pts]; P = [P[0]] + P + [P[-1]]; out = []
    for i in range(1, len(P) - 2):
        p0, p1, p2, p3 = P[i - 1], P[i], P[i + 1], P[i + 2]
        n = max(2, int((p2 - p1).length / step))
        for k in range(n):
            t = k / n; t2 = t * t; t3 = t2 * t
            out.append(.5 * ((2 * p1) + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 + (-p0 + 3 * p1 - 3 * p2 + p3) * t3))
    out.append(P[-2]); return out

def poly(pts, step=.003):
    out = []
    for a, b in zip(pts, pts[1:]):
        a, b = Vector(a), Vector(b); n = max(1, int((b - a).length / step))
        out += [a.lerp(b, k / n) for k in range(n)]
    out.append(Vector(pts[-1])); return out

def join(*parts):
    out = []
    for p in parts:
        for v in p:
            if not out or (v - out[-1]).length > 1e-5:
                out.append(v)
    return out

def measure(path):
    d = [0.0]
    for a, b in zip(path, path[1:]):
        d.append(d[-1] + (b - a).length)
    return d

def at(path, dist, s):
    """Position and heading at distance s along path."""
    s = max(0.0, min(s, dist[-1]))
    for i in range(1, len(dist)):
        if dist[i] >= s:
            t = (s - dist[i - 1]) / max(1e-9, dist[i] - dist[i - 1])
            p = path[i - 1].lerp(path[i], t); d = path[i] - path[i - 1]
            return p, math.atan2(d.y, d.x)
    d = path[-1] - path[-2]; return path[-1], math.atan2(d.y, d.x)

def nearest(path, dist, p):
    best = min(range(len(path)), key=lambda i: (path[i] - Vector(p[:2])).length)
    return dist[best]

ROAD_MAIN = catmull([(0.06, -0.095), (0.085, -0.14), (0.10, -0.19), (0.19, -0.08), (0.27, 0.035)])   # city -> market -> barracks gate
ROAD_V3 = catmull([(-0.10, -0.095), (-0.18, -0.18), (-0.23, -0.28)])
# a clear route through the capital, found by an A* search over ray-cast city ground (buildings/trees blocked)
CITY = poly([(0.06, -0.095), (0.032, -0.092), (-0.068, -0.092), (-0.10, -0.06), (-0.118, -0.048), (-0.17, -0.048),
             (-0.18, -0.032), (-0.18, -0.024), (-0.148, 0.044), (-0.145, 0.05)])
GOV_GATE = poly([(-0.145, 0.05), (-0.175, 0.05)])

ease = lambda t: t * t * (3 - 2 * t)

# ------------------------------------------------------------------ keyframing helpers
def fcurves_of(act):
    try:
        return list(act.fcurves)
    except AttributeError:
        out = []
        for layer in act.layers:
            for strip in layer.strips:
                for cb in strip.channelbags:
                    out += list(cb.fcurves)
        return out

def finish(o, outcome, interp="LINEAR"):
    """Pin the clip to 0..END, name it for the runtime and keep it on export."""
    for path_ in ("location", "rotation_euler", "scale"):
        o.keyframe_insert(data_path=path_, frame=END)
    act = o.animation_data.action
    act.name = f"KAL_Sim_{outcome}__{o.name}"; act.use_fake_user = True
    for fc in fcurves_of(act):
        for kp in fc.keyframe_points:
            kp.interpolation = interp
    return act

def key(o, f, loc=None, yaw=None, scale=None):
    if loc is not None:
        o.location = loc; o.keyframe_insert("location", frame=f)
    if yaw is not None:
        o.rotation_euler.z = yaw; o.keyframe_insert("rotation_euler", frame=f)
    if scale is not None:
        o.scale = scale if hasattr(scale, "__len__") else (scale, scale, scale); o.keyframe_insert("scale", frame=f)

def drive(o, path, start, frames, s0=0.0, s1=None, lift=.0013, step=4):
    """Drive a vehicle along path from distance s0 to s1, easing in and out; heading follows the road."""
    dist = measure(path); s1 = dist[-1] if s1 is None else s1
    yaw_prev = o.rotation_euler.z
    key(o, 0, loc=o.location.copy(), yaw=yaw_prev)
    if start > 0:
        key(o, start, loc=o.location.copy(), yaw=yaw_prev)
    for f in range(start, start + frames + 1, step):
        t = ease((f - start) / frames); p, h = at(path, dist, s0 + (s1 - s0) * t)
        yaw = h - math.pi / 2 + (math.pi if s1 < s0 else 0.0)   # face the direction of travel
        while yaw - yaw_prev > math.pi: yaw -= 2 * math.pi
        while yaw - yaw_prev < -math.pi: yaw += 2 * math.pi
        yaw_prev = yaw
        key(o, f, loc=(p.x, p.y, ground(p.x, p.y) + lift), yaw=yaw)

def mat(name, color, emit=0.0, alpha=1.0):
    m = bpy.data.materials.get(name) or bpy.data.materials.new(name)
    m.use_nodes = True
    b = next(n for n in m.node_tree.nodes if n.type == "BSDF_PRINCIPLED")
    b.inputs["Base Color"].default_value = (*color, 1); b.inputs["Roughness"].default_value = .45
    b.inputs["Emission Color"].default_value = (*color, 1); b.inputs["Emission Strength"].default_value = emit
    b.inputs["Alpha"].default_value = alpha
    try:
        m.surface_render_method = "BLENDED" if alpha < 1 else "DITHERED"
    except Exception:
        pass
    return m

def helper(name, mesh_fn, loc, material, rot_z=0.0):
    bm = mesh_fn(); me = bpy.data.meshes.new(name); bm.to_mesh(me); bm.free(); me.materials.append(material)
    o = bpy.data.objects.new(name, me); coll.objects.link(o); o.parent = sim
    o.location = loc; o.rotation_euler.z = rot_z; o.scale = (0, 0, 0)
    return o

import bmesh
def sphere(r):
    def f():
        bm = bmesh.new(); bmesh.ops.create_uvsphere(bm, u_segments=12, v_segments=8, radius=r); return bm
    return f
def box(w, d, h, base=True):
    def f():
        bm = bmesh.new(); bmesh.ops.create_cube(bm, size=1)
        for v in bm.verts:
            v.co.x *= w; v.co.y *= d; v.co.z = v.co.z * h + (h / 2 if base else 0)
        return bm
    return f
def cylinder(r, h, segs=24, cap=True):
    def f():
        bm = bmesh.new(); bmesh.ops.create_cone(bm, cap_ends=cap, segments=segs, radius1=r, radius2=r, depth=h)
        for v in bm.verts:
            v.co.z += h / 2
        return bm
    return f
def ring(r0, r1, segs=48):
    def f():
        bm = bmesh.new(); outer = []; inner = []
        for k in range(segs):
            a = 2 * math.pi * k / segs
            outer.append(bm.verts.new((r1 * math.cos(a), r1 * math.sin(a), 0)))
            inner.append(bm.verts.new((r0 * math.cos(a), r0 * math.sin(a), 0)))
        for k in range(segs):
            bm.faces.new((inner[k], outer[k], outer[(k + 1) % segs], inner[(k + 1) % segs]))
        return bm
    return f

def pop(o, f, size=1.0, over=1.18):
    """Appear with a spring: 0 -> overshoot -> settle (all before f+18)."""
    s = size if hasattr(size, "__len__") else (size, size, size)
    key(o, 0, scale=(0, 0, 0)); key(o, f, scale=(0, 0, 0))
    key(o, f + 10, scale=tuple(c * over for c in s)); key(o, f + 18, scale=s)

YEAR = lambda y: int(y * FPS)          # simulated year y (2..10) -> frame
clips = {"Coup": [], "Rule": [], "Consolidation": []}

# ================================================================== COUP
bx, by = .27, .13
for k in range(3):
    t = bpy.data.objects[f"KAL_BarracksTruck_{k+1}"]
    start = Vector(t.location[:2])
    exit_ = poly([tuple(start), (start.x, .10), (.27, .06), (.27, .035)])
    spot = [(-0.192 - .022 * k, .047)]
    path = join(exit_, list(reversed(ROAD_MAIN)), CITY, GOV_GATE, poly([(-0.175, .05)] + spot))
    drive(t, path, start=YEAR(1) + 50 * k, frames=330)
    clips["Coup"].append(finish(t, "Coup"))
for k, stop_at in ((0, (0.06, -0.095)), (1, (0.10, -0.19))):           # checkpoints: bridge, market
    j = bpy.data.objects[f"KAL_BarracksJeep_{k+1}"]
    start = Vector(j.location[:2])
    path = join(poly([tuple(start), (start.x, .10), (.27, .06), (.27, .035)]), list(reversed(ROAD_MAIN)))
    dist = measure(path)
    drive(j, path, start=YEAR(.6) + 40 * k, frames=220, s1=nearest(path, dist, stop_at))
    clips["Coup"].append(finish(j, "Coup"))
red = mat("AB_KAL_Sim_Beacon", (1.0, .08, .04), emit=8.0)
for k in range(4):
    tw = bpy.data.objects.get(f"KAL_BarracksTower_{k+1}")
    if not tw:
        continue
    parts = [tw] + list(tw.children_recursive)
    bb = [m.matrix_world @ Vector(c) for m in parts if m.type == "MESH" for c in m.bound_box] or [tw.matrix_world.translation]
    top = Vector((sum(v.x for v in bb) / len(bb), sum(v.y for v in bb) / len(bb), max(v.z for v in bb) + .003))
    b = helper(f"KAL_Sim_Beacon_{k+1}", sphere(.0026), top, red)
    pop(b, YEAR(.5) + 8 * k)
    for f in range(YEAR(.5) + 8 * k + 40, END - 20, 44):              # slow warning pulse
        key(b, f, scale=1.0); key(b, f + 14, scale=1.45); key(b, f + 30, scale=1.0)
    clips["Coup"].append(finish(b, "Coup", "BEZIER"))

# ================================================================== PERSONALISED RULE
gx, gy, gtop = -.27, .10, .025 + .09
warm = mat("AB_KAL_Sim_Shaft", (1.0, .62, .25), emit=6.0, alpha=.35)
shaft = helper("KAL_Sim_GovShaft", cylinder(.018, .16), (gx, gy, .03), warm)
key(shaft, 0, scale=(0, 0, 0)); key(shaft, YEAR(.8), scale=(.5, .5, .02)); key(shaft, YEAR(3), scale=(1, 1, 1))
key(shaft, YEAR(6), scale=(1.12, 1.12, 1.1)); key(shaft, YEAR(10), scale=(1.25, 1.25, 1.2))
clips["Rule"].append(finish(shaft, "Rule", "BEZIER"))
glow = mat("AB_KAL_Sim_Ring", (1.0, .55, .18), emit=5.0, alpha=.6)
rg = helper("KAL_Sim_GovRing", ring(.11, .118), (gx, gy, .034), glow)
key(rg, 0, scale=(0, 0, 0)); key(rg, YEAR(1.5), scale=(.8, .8, 1)); key(rg, YEAR(5), scale=(1.25, 1.25, 1)); key(rg, YEAR(10), scale=(1.55, 1.55, 1))
clips["Rule"].append(finish(rg, "Rule", "BEZIER"))
mast = bpy.data.objects["ANCHOR_KAL_MastTop"].matrix_world.translation.copy()
gov_top = Vector((gx, gy, gtop))
v_ = gov_top - mast
link = helper("KAL_Sim_RadioLink", box(.0016, .0016, v_.length), mast, glow)
link.rotation_mode = "QUATERNION"; link.rotation_quaternion = Vector((0, 0, 1)).rotation_difference(v_.normalized())
key(link, 0, scale=(0, 0, 0)); key(link, YEAR(2), scale=(0, 0, 0)); key(link, YEAR(3.5), scale=(1, 1, 1))
clips["Rule"].append(finish(link, "Rule", "BEZIER"))
banner_m = mat("AB_KAL_Sim_Banner", (.86, .18, .12), emit=.6)
pole_pts = [(-0.175, .056), (-0.155, .056), (-0.13, -0.042), (-0.09, -0.052), (-0.05, -0.086), (0.0, -0.086), (0.05, -0.088), (0.09, -0.15)]
for k, (x, y) in enumerate(pole_pts):
    bn = helper(f"KAL_Sim_Banner_{k+1}", box(.0012, .006, .016), (x, y, ground(x, y)), banner_m)
    pop(bn, YEAR(1.6) + k * 62, size=(1, 1, 1))
    clips["Rule"].append(finish(bn, "Rule", "BEZIER"))

# ================================================================== CONSOLIDATION
d_main = measure(ROAD_MAIN)
for nm, speed_s, forward in (("KAL_Pickup", 0.0, True), ("KAL_Van", 0.0, False), ("KAL_Truck", 0.0, True)):
    o = bpy.data.objects[nm]; s0 = nearest(ROAD_MAIN, d_main, o.location)
    s1 = min(d_main[-1], s0 + .26) if forward else max(0.0, s0 - .26)
    drive(o, ROAD_MAIN, start=YEAR(.4), frames=END - YEAR(.4) - 20, s0=s0, s1=s1, lift=o.location.z - ground(o.location.x, o.location.y))
    clips["Consolidation"].append(finish(o, "Consolidation"))
o = bpy.data.objects["KAL_Pickup2"]; d_v3 = measure(ROAD_V3); s0 = nearest(ROAD_V3, d_v3, o.location)
drive(o, ROAD_V3, start=YEAR(.8), frames=480, s0=s0, s1=0.0 if s0 > d_v3[-1] / 2 else d_v3[-1], lift=o.location.z - ground(o.location.x, o.location.y))
clips["Consolidation"].append(finish(o, "Consolidation"))
o = bpy.data.objects["KAL_Van2"]; city_out = join(list(reversed(GOV_GATE)), list(reversed(CITY)))
drive(o, city_out, start=YEAR(1.2), frames=420, lift=o.location.z - ground(o.location.x, o.location.y))
clips["Consolidation"].append(finish(o, "Consolidation"))
cols = [(.10, .55, .55), (.95, .45, .12), (.95, .78, .25), (.55, .45, .85)]
for k in range(4):
    st = bpy.data.objects[f"KAL_Stall_0{k+1}"]; p = st.matrix_world.translation
    aw = helper(f"KAL_Sim_Awning_{k+1}", box(.044, .036, .0012), (p.x, p.y, .025 + .015), mat(f"AB_KAL_Sim_Awning_{k+1}", cols[k], emit=.15))
    pop(aw, YEAR(1.2) + 45 * k)
    clips["Consolidation"].append(finish(aw, "Consolidation", "BEZIER"))
lamp_m = mat("AB_KAL_Sim_VillageLight", (1.0, .78, .4), emit=10.0)
VILLAGES = [(-0.44, 0.24), (0.40, -0.24), (-0.24, -0.30)]
n = 0
for vx, vy in VILLAGES:
    for dx, dy in ((.018, .0), (-.012, .015), (-.006, -.017)):
        x, y = vx + dx, vy + dy
        li = helper(f"KAL_Sim_VillageLight_{n+1}", sphere(.0021), (x, y, ground(x, y) + .006), lamp_m)
        pop(li, YEAR(2) + n * 44, over=1.4)
        clips["Consolidation"].append(finish(li, "Consolidation", "BEZIER")); n += 1

# ------------------------------------------------------------------ restore
for o in hidden:
    o.hide_viewport = False
sc.frame_set(0)
result = {k: len(v) for k, v in clips.items()}
print("KALINDA_SIM", result)
