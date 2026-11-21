"""Build the Kalinda teaching miniature (scene KALINDA, collection KALINDA) from layout.json + plate 01.

Symbolic teaching model, not geography: one fixed map for every test; nothing is ever removed or damaged.
Local frame: KAL_Root at the origin, base top at z = 0.025 (layout map.thickness). The runtime places KAL_Root at
layout.office.map_position (0, 0, 0.76), so the base rests directly on the desk surface.

Built from the user's supplied assets (instruction 19 Nov 2026). Copies only; source files are never written:
  ~/Downloads/lowpoly_buildings_and_structures_collection.glb  barracks blocks, watchtowers, walls, gate,
      concrete pads, generator, arched road bridge, houses, barn, well, fences, rocks
  ~/Downloads/market_stall__sleeping_dogs_universe.glb        corrugated kiosk x4 (bolts/fasteners/players removed)
  kit assets/source/ministry_of_foreign_affairs__tiny_yerevan.glb  government (flag pole removed)
  kit assets/source/3d_design_base_transciver_station_radio_tower.glb  lattice mast + its base pad
  kit assets/source/market_-_stylized_modular_low_poly_asset_pack.glb  fruit crates + fruit
Generated only where no asset exists: terrain, river and roads (traced from layout.json outline/paths) and
PLACEHOLDER trees (no supplied file contains a tree; replace when a tree asset is provided).

Canonical nodes: KAL_Root, KAL_Base, KAL_River, KAL_Roads, KAL_Bridges, KAL_Government, KAL_Barracks,
KAL_Radio, KAL_Mast, KAL_Market, KAL_Stall_01..04, KAL_Villages, KAL_Rocks, KAL_Trees_PLACEHOLDER,
HOTSPOT_KAL_Government/Barracks/Radio/Market, ANCHOR_KAL_MastTop, ANCHOR_KAL_ModelCentre.
"""
import bpy, bmesh, sys, math, random, importlib, re
from pathlib import Path
from mathutils import Vector, Matrix, noise
from mathutils.geometry import delaunay_2d_cdt, intersect_line_line_2d

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
import ab_lib as L
importlib.reload(L)

D = L.LAYOUT
KIT_ROOT = Path(__file__).resolve().parents[3]          # .../The Analyst's Brief
M = D["map"]
TOP = M["thickness"]                                  # 0.025
OUT = [tuple(p) for p in M["outline"]]
INST = {o["name"]: o for o in M["objects"]}

# ONE MAP SCALE for every real-world object (user instruction 19 Nov 2026: "let the scaling be proper").
# 1:450 lets the capital city sit between the government and the barracks and keeps the ministry inside its plate
# footprint: the 1.2 x 0.8 m base shows 540 x 360 m; a 12 m house is 27 mm, a car 11 mm, a 9 m tree 20 mm.
SCALE = 1.0 / 450.0          # metre-unit assets
CM = SCALE / 100.0           # centimetre-unit assets (lowpoly collection, kiosk, bridge)
# Capital city (user's city asset): real ground 114 x 132 m, turned 90 deg, east of the government compound.
CITY_GROUND_Z = -18.45
CITY_REAL_RECT = (-69.8, 48.2, -70.0, 58.0)           # real x (-> map y) and real y (-> map x), cropped to fit
CITY_C_REAL = ((CITY_REAL_RECT[0] + CITY_REAL_RECT[1]) / 2, (CITY_REAL_RECT[2] + CITY_REAL_RECT[3]) / 2)
CITY_C_MAP = (-0.003, 0.04)
CITY_HALF = ((CITY_REAL_RECT[3] - CITY_REAL_RECT[2]) * SCALE / 2, (CITY_REAL_RECT[1] - CITY_REAL_RECT[0]) * SCALE / 2)
RIVER_W = 13.5 * SCALE       # 13.5 m river
VILLAGES = [(-0.44, 0.24), (0.40, -0.24), (-0.24, -0.30)]

sc = L.scene("KALINDA", fps=60)
bpy.context.window.scene = sc
root_c = L.coll("KALINDA", sc)
L.clear_coll(root_c)
C = root_c
kroot = L.empty("KAL_Root", (0, 0, 0), C, "ARROWS", 0.1)


def parent(o, p=kroot):
    o.parent = p
    return o


def lerp(a, b, t):
    return a + (b - a) * t


def smooth(e0, e1, x):
    t = max(0.0, min(1.0, (x - e0) / (e1 - e0)))
    return t * t * (3 - 2 * t)


def catmull(pts, step=0.01):
    """Smooth a 2D polyline (Catmull-Rom), sampled roughly every `step` metres."""
    P = [Vector(p) for p in pts]
    P = [P[0] * 2 - P[1]] + P + [P[-1] * 2 - P[-2]]
    out = []
    for i in range(1, len(P) - 2):
        p0, p1, p2, p3 = P[i - 1], P[i], P[i + 1], P[i + 2]
        n = max(2, int((p2 - p1).length / step))
        for k in range(n):
            t = k / n
            t2, t3 = t * t, t * t * t
            out.append(0.5 * ((2 * p1) + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 + (-p0 + 3 * p1 - 3 * p2 + p3) * t3))
    out.append(P[-2])
    return out


def seg_dist(p, a, b):
    ab = b - a
    t = max(0.0, min(1.0, (p - a).dot(ab) / max(ab.length_squared, 1e-12)))
    return (a + ab * t - p).length


def poly_dist(p, pts):
    return min(seg_dist(p, pts[i], pts[i + 1]) for i in range(len(pts) - 1))


def inside(p, poly):
    x, y = p; c = False
    for i in range(len(poly)):
        x1, y1 = poly[i]; x2, y2 = poly[(i + 1) % len(poly)]
        if (y1 > y) != (y2 > y) and x < (x2 - x1) * (y - y1) / (y2 - y1) + x1:
            c = not c
    return c


# ------------------------------------------------------------------ paths: river and roads (layout + edge extensions)
river_pts = [(-0.545, -0.255)] + [tuple(p) for p in M["river"]] + [(0.585, 0.055)]
RIVER = catmull(river_pts, 0.008)
road_main = [(0.06, -0.095), (0.085, -0.14), (0.10, -0.19), (0.19, -0.08), (0.27, 0.035)]  # city -> market -> barracks
road_gov = [(-0.175, 0.05), (-0.145, 0.05)]                                                # government -> city
road_radio = [(0.03, 0.172), (0.03, 0.19)]                                                 # city -> radio hill
road_v1 = [(-0.40, 0.10), (-0.43, 0.17), (-0.44, 0.23)]
road_v3 = [(-0.10, -0.095), (-0.18, -0.18), (-0.23, -0.28)]
road_v2 = [(0.21, -0.19), (0.30, -0.22), (0.38, -0.24)]
ROADS = [catmull(r_, 0.008) for r_ in (road_main, road_gov, road_radio, road_v1, road_v3, road_v2)]


def footprint_mask(x, y, margin=0.03, soft=0.025):
    m = 0.0
    for o in INST.values():
        cx, cy, _ = o["position"]; w, d, _ = o["size"]
        dx = abs(x - cx) - (w / 2 + margin); dy = abs(y - cy) - (d / 2 + margin)
        dd = max(dx, dy)
        m = max(m, 1.0 - smooth(0.0, soft, dd))
    dx = abs(x - CITY_C_MAP[0]) - (CITY_HALF[0] + margin * 0.5); dy = abs(y - CITY_C_MAP[1]) - (CITY_HALF[1] + margin * 0.5)
    m = max(m, 1.0 - smooth(0.0, soft, max(dx, dy)))
    return m


def height(x, y):
    p = Vector((x, y))
    n1 = noise.noise(Vector((x * 6.0, y * 6.0, 0.3)))
    n2 = noise.noise(Vector((x * 18.0, y * 18.0, 1.7)))
    ridge = smooth(0.22, 0.40, y) * 0.085 * (0.6 + 0.4 * n1)
    side = smooth(0.38, 0.60, abs(x)) * 0.035 * (0.6 + 0.4 * n2)
    h = max(ridge, side) + 0.0035 * (n1 * 0.5 + 0.5) + 0.0012 * n2
    h *= 1.0 - footprint_mask(x, y)
    rd = min(poly_dist(p, r) for r in ROADS)
    h *= smooth(0.006, 0.02, rd) * 0.85 + 0.15 if rd < 0.02 else 1.0
    dv = poly_dist(p, RIVER)
    if dv < RIVER_W * 0.5 + 0.01:
        h = lerp(-0.0045, h, smooth(RIVER_W * 0.5 - 0.001, RIVER_W * 0.5 + 0.01, dv))
    return h


# ------------------------------------------------------------------ terrain: constrained Delaunay inside the outline
def outline_samples(step=0.01):
    pts = []
    for i in range(len(OUT)):
        a = Vector(OUT[i]); b = Vector(OUT[(i + 1) % len(OUT)])
        n = max(1, int((b - a).length / step))
        for k in range(n):
            pts.append(a.lerp(b, k / n))
    return pts

bnd = outline_samples(0.01)
nb = len(bnd)
grid = []
g = 0.024
xs = int(1.24 / g); ys = int(0.84 / g)
for i in range(xs + 1):
    for j in range(ys + 1):
        p = (-0.62 + i * g, -0.42 + j * g)
        if inside(p, [tuple(v) for v in bnd]):
            q = Vector(p)
            if min((q - b).length for b in bnd[:: 3]) > g * 0.6:
                grid.append(q)
verts2d = bnd + grid
edges = [(i, (i + 1) % nb) for i in range(nb)]
res = delaunay_2d_cdt([v.to_2d() for v in verts2d], edges, [list(range(nb))], 2, 1e-7)
vco, _, faces = res[0], res[1], res[2]

bm = bmesh.new()
top_v = [bm.verts.new((v.x, v.y, TOP + height(v.x, v.y))) for v in vco]
bm.verts.ensure_lookup_table()
top_faces = []
for f in faces:
    try:
        top_faces.append(bm.faces.new([top_v[i] for i in f]))
    except ValueError:
        pass
# make sure top faces point up
for f in top_faces:
    f.normal_update()
    if f.normal.z < 0:
        f.normal_flip()
# side walls + bottom from the boundary loop (first nb verts are the outline samples, in order)
bot_v = [bm.verts.new((top_v[i].co.x, top_v[i].co.y, 0.0)) for i in range(nb)]
side_faces = []
for i in range(nb):
    j = (i + 1) % nb
    side_faces.append(bm.faces.new([top_v[i], bot_v[i], bot_v[j], top_v[j]]))
bottom = bm.faces.new(list(reversed(bot_v)))
bmesh.ops.recalc_face_normals(bm, faces=bm.faces[:])
me = bpy.data.meshes.new("KAL_Base")
bm.to_mesh(me)
bm.free()
base = L._new_obj("KAL_Base", me, C)
parent(base)
for p in me.polygons:
    p.use_smooth = True

# ------------------------------------------------------------------ ground textures from the user's game_landscape_tiles.glb
# Image_22 = seamless grass, Image_2 = dry earth, Image_10 = straight cobble path (band across v 0.27..0.73).
TILES_GLB = KIT_ROOT / "game_landscape_tiles.glb"
def tiles_scene():
    s_ = bpy.data.scenes.get("SRC_LandscapeTiles")
    if s_:
        return s_
    import logging; logging.disable(logging.INFO)
    s_ = bpy.data.scenes.new("SRC_LandscapeTiles"); prev = bpy.context.window.scene
    bpy.context.window.scene = s_; bpy.ops.import_scene.gltf(filepath=str(TILES_GLB)); bpy.context.window.scene = prev
    return s_
tiles_scene()
def tile_image(obj_prefix):
    """Albedo image of a tile object in SRC_LandscapeTiles (image names collide across imported files)."""
    o = next(o for o in bpy.data.scenes["SRC_LandscapeTiles"].objects if o.type == "MESH" and o.name.split(".")[0] == obj_prefix)
    nt_ = o.data.materials[0].node_tree
    bsdf_ = next(n for n in nt_.nodes if n.type == "BSDF_PRINCIPLED")
    link_ = bsdf_.inputs["Base Color"].links[0]
    node_ = link_.from_node
    while node_.type != "TEX_IMAGE":
        node_ = next(l.from_node for i_ in node_.inputs for l in i_.links)
    return node_.image
IMG_GRASS, IMG_DIRT, IMG_PATH = tile_image("Object_28"), tile_image("Object_29"), tile_image("Object_14")
GROUND_TILE = 0.07          # metres of map per texture repeat

# crop fields near the villages (rectangles: centre, size, rotation); earth texture with a light crop tint
FIELDS = [((-0.50, 0.02), (0.06, 0.04), 15), ((-0.40, 0.21), (0.05, 0.035), -10), ((0.47, -0.15), (0.06, 0.04), 25),
          ((0.30, -0.31), (0.05, 0.035), -20), ((-0.33, -0.25), (0.05, 0.04), 5), ((-0.12, -0.33), (0.045, 0.03), 30)]
def field_mask(x, y):
    for (cx, cy), (w, d), r in FIELDS:
        a = math.radians(-r); dx, dy = x - cx, y - cy
        u = dx * math.cos(a) - dy * math.sin(a); v = dx * math.sin(a) + dy * math.cos(a)
        if abs(u) < w / 2 and abs(v) < d / 2:
            return 1.0, (0.85 + 0.15 * math.sin(v * 900))      # furrow stripes in the tint
    return 0.0, 1.0

# per-corner tint (hill darkening, river bed) + per-corner earth mask; UVs are world-planar XY
col = me.color_attributes.new("Col", "BYTE_COLOR", "CORNER")
dirt = me.color_attributes.new("Dirt", "BYTE_COLOR", "CORNER")
uvl = me.uv_layers.new(name="UVMap")
for poly in me.polygons:
    is_top = poly.normal.z > 0.3
    for li in poly.loop_indices:
        v = me.vertices[me.loops[li].vertex_index].co
        if is_top:
            uvl.data[li].uv = (v.x / GROUND_TILE, v.y / GROUND_TILE)
            hh = v.z - TOP
            n = noise.noise(Vector((v.x * 14, v.y * 14, 4.0))) * 0.5 + 0.5
            t = lerp(0.95, 1.08, n) * lerp(1.0, 0.62, smooth(0.008, 0.06, hh))     # hills darker / denser
            tint = (t, t, t * 0.95)
            e = max(footprint_mask(v.x, v.y, 0.012, 0.012) * 0.95, smooth(0.6, 0.85, n) * 0.35)
            if hh < -0.001:
                e = max(e, smooth(-0.001, -0.004, hh)); tint = (0.8, 0.75, 0.7)
            fm, furrow = field_mask(v.x, v.y)
            if fm:
                e = 1.0; tint = (0.95 * furrow, 1.0 * furrow, 0.75 * furrow)
        else:
            uvl.data[li].uv = ((v.x + v.y) / GROUND_TILE, v.z / GROUND_TILE)
            e = 1.0; tint = (0.55, 0.42, 0.32) if v.z > TOP - 0.006 else (0.42, 0.32, 0.25)
        col.data[li].color = (*tint, 1.0)
        dirt.data[li].color = (e, e, e, 1.0)
me.color_attributes.active_color = col

terrain_mat = L.mat("AB_KAL_Terrain", (0.3, 0.35, 0.2), 0.92, spec=0.25)
nt, b = L._reset_nodes(terrain_mat)
uvn = nt.nodes.new("ShaderNodeUVMap"); uvn.uv_map = "UVMap"
tg = nt.nodes.new("ShaderNodeTexImage"); tg.image = IMG_GRASS
td = nt.nodes.new("ShaderNodeTexImage"); td.image = IMG_DIRT
for t_ in (tg, td):
    nt.links.new(uvn.outputs["UV"], t_.inputs["Vector"])
cd = nt.nodes.new("ShaderNodeVertexColor"); cd.layer_name = "Dirt"
ct = nt.nodes.new("ShaderNodeVertexColor"); ct.layer_name = "Col"
mx = nt.nodes.new("ShaderNodeMix"); mx.data_type = "RGBA"
nt.links.new(cd.outputs["Color"], mx.inputs["Factor"]); nt.links.new(tg.outputs["Color"], mx.inputs["A"]); nt.links.new(td.outputs["Color"], mx.inputs["B"])
mul = nt.nodes.new("ShaderNodeMix"); mul.data_type = "RGBA"; mul.blend_type = "MULTIPLY"; mul.inputs["Factor"].default_value = 1.0
nt.links.new(mx.outputs["Result"], mul.inputs["A"]); nt.links.new(ct.outputs["Color"], mul.inputs["B"])
nt.links.new(mul.outputs["Result"], b.inputs["Base Color"])
me.materials.append(terrain_mat)

# ------------------------------------------------------------------ ribbons (river, roads) that follow the terrain
def ribbon(name, pts, width, zoff, material, clamp_to=None, v_range=(0.0, 1.0), u_len=0.04):
    """Strip mesh along a path. UV u runs along the path (repeats every u_len metres), v across it."""
    bm = bmesh.new(); uvk = bm.loops.layers.uv.new("UVMap")
    left, right, us = [], [], []
    acc = 0.0
    for i, p in enumerate(pts):
        if i:
            acc += (p - pts[i - 1]).length
        us.append(acc / u_len)
        a = pts[max(0, i - 1)]; c = pts[min(len(pts) - 1, i + 1)]
        t = (c - a).normalized(); nrm = Vector((-t.y, t.x))
        for side, lst in ((1, left), (-1, right)):
            q = p + nrm * side * width / 2
            z = (clamp_to if clamp_to is not None else TOP + height(q.x, q.y)) + zoff
            lst.append(bm.verts.new((q.x, q.y, z)))
    for i in range(len(pts) - 1):
        f = bm.faces.new([left[i], right[i], right[i + 1], left[i + 1]])
        for lp_, (uu, vv) in zip(f.loops, [(us[i], v_range[1]), (us[i], v_range[0]), (us[i + 1], v_range[0]), (us[i + 1], v_range[1])]):
            lp_[uvk].uv = (uu, vv)
    for f in bm.faces:
        f.normal_update()
        if f.normal.z < 0:
            f.normal_flip()
    me_ = bpy.data.meshes.new(name); bm.to_mesh(me_); bm.free()
    o = L._new_obj(name, me_, C); me_.materials.append(material)
    return parent(o)

def tex_mat(name, img, tint=(1, 1, 1), rough=0.9):
    m = L.mat(name, tint, rough)
    nt_, b_ = L._reset_nodes(m)
    t_ = nt_.nodes.new("ShaderNodeTexImage"); t_.image = img
    mm = nt_.nodes.new("ShaderNodeMix"); mm.data_type = "RGBA"; mm.blend_type = "MULTIPLY"; mm.inputs["Factor"].default_value = 1.0
    mm.inputs["B"].default_value = (*tint, 1)
    nt_.links.new(t_.outputs["Color"], mm.inputs["A"]); nt_.links.new(mm.outputs["Result"], b_.inputs["Base Color"])
    return m

water = L.mat("AB_KAL_Water", (0.05, 0.12, 0.13), 0.06, spec=0.8)
_bw = L._bsdf(water); _bw.inputs["Alpha"].default_value = 0.85
road_cobble = tex_mat("AB_KAL_RoadCobble", IMG_PATH, (1.0, 0.95, 0.9))
road_earth = tex_mat("AB_KAL_RoadEarth", IMG_DIRT, (1.05, 0.72, 0.55))      # laterite tint on the earth texture
ribbon("KAL_River", RIVER, RIVER_W, 0.0, water, clamp_to=TOP - 0.002)
road_objs = [ribbon(f"KAL_Road_{i}", r, 0.011 if i < 2 else 0.0065, 0.0012,
                    road_cobble if i < 2 else road_earth,
                    v_range=(0.22, 0.78) if i < 2 else (0.0, 1.0), u_len=0.011 if i < 2 else 0.03) for i, r in enumerate(ROADS)]
roads = L.join("KAL_Roads", road_objs, C); parent(roads)
for o in road_objs:
    bpy.data.objects.remove(o, do_unlink=True)

# ======================================================================================================
# Assembly from the user's supplied assets (user instruction 19 Nov 2026: use provided assets, not modelling)
#   ~/Downloads/lowpoly_buildings_and_structures_collection.glb  (cm units): barracks, towers, walls, gate,
#       houses, barn, well, fences, bridge, generator, concrete pads, rocks
#   ~/Downloads/market_stall__sleeping_dogs_universe.glb: corrugated kiosk (bolts / fasteners / players removed)
#   kit assets/source: ministry (government), radio tower (lattice + pad), market pack (crates, fruit)
# Generated only where no asset exists: terrain, river and roads (traced from layout.json) and PLACEHOLDER trees.
# ======================================================================================================
DL = Path.home() / "Downloads"


def import_path(path, scene_name):
    sc_src = bpy.data.scenes.get(scene_name)
    if sc_src:
        return sc_src
    import logging
    logging.disable(logging.INFO)
    sc_src = bpy.data.scenes.new(scene_name)
    prev = bpy.context.window.scene
    bpy.context.window.scene = sc_src
    bpy.ops.import_scene.gltf(filepath=str(path))
    bpy.context.window.scene = prev
    return sc_src

import_path(DL / "lowpoly_buildings_and_structures_collection.glb", "SRC_Lowpoly")
import_path(DL / "market_stall__sleeping_dogs_universe.glb", "SRC_SDStall")
import_path(DL / "autumn_landscape.glb", "SRC_Autumn")
L.import_source("ministry_of_foreign_affairs__tiny_yerevan.glb", "SRC_Ministry")
L.import_source("3d_design_base_transciver_station_radio_tower.glb", "SRC_Radio")
L.import_source("market_-_stylized_modular_low_poly_asset_pack.glb", "SRC_Market")


def lp(*roots):
    """Mesh objects under lowpoly-collection group names (resolved inside SRC_Lowpoly only)."""
    sc_src = bpy.data.scenes["SRC_Lowpoly"]
    out = []
    for r in roots:
        top = next(o for o in sc_src.objects if o.name == r or o.name.rsplit(".", 1)[0] == r and o.name.startswith(r))
        out += [o for o in [top] + list(top.children_recursive) if o.type == "MESH"]
    return out


def fit(o, w=None, d=None, h=None, uniform=True):
    """Scale mesh data to a target size (uniform uses the tightest given axis); origin bottom-centre."""
    dx, dy, dz = L.dims(o)
    sc_ = [w / dx if w else None, d / dy if d else None, h / dz if h else None]
    if uniform:
        k = min(v for v in sc_ if v)
        o.data.transform(Matrix.Scale(k, 4))
    else:
        o.data.transform(Matrix.Diagonal((sc_[0] or 1, sc_[1] or 1, sc_[2] or 1, 1)))
    L.set_origin_bottom_centre(o)
    o.location = (0, 0, 0)
    return o


def asset(name, meshes, scale=None, fit_to=None, uniform=True, rotz=0.0, decimate=None):
    """Join donor meshes into one asset mesh (bottom-centre origin). Either a uniform `scale` or `fit_to` (w,d,h).
    `decimate` (0-1 collapse ratio) reduces dense donors to the map's triangle budget; the source is untouched."""
    o = L.join(name + "_asset", meshes, C)
    if decimate:
        m = o.modifiers.new("Decimate", "DECIMATE"); m.ratio = decimate
        bpy.context.view_layer.update()
        ev = o.evaluated_get(bpy.context.evaluated_depsgraph_get())
        new_me = bpy.data.meshes.new_from_object(ev)
        o.modifiers.clear()
        old_me = o.data; o.data = new_me; bpy.data.meshes.remove(old_me)
    if rotz:
        o.data.transform(Matrix.Rotation(math.radians(rotz), 4, "Z"))
    if scale:
        o.data.transform(Matrix.Scale(scale, 4))
        L.set_origin_bottom_centre(o); o.location = (0, 0, 0)
    else:
        fit(o, *fit_to, uniform=uniform)
    C.objects.unlink(o)          # keep only as mesh data for placed instances
    return o.data


def place(name, mesh, par, loc=(0, 0, 0), rotz=0.0, scale=(1, 1, 1)):
    o = bpy.data.objects.new(name, mesh); C.objects.link(o)
    o.parent = par; o.location = loc; o.rotation_euler.z = math.radians(rotz); o.scale = scale
    return o


def inst_root(name):
    o = INST[name]; x, y, z = o["position"]
    e = L.empty(name, (x, y, TOP), C, "CUBE", 0.02)
    return parent(e), o["size"]


def muted(mesh, hue=0.53, sat=0.45, val=0.85):
    """Give an asset copy a toned version of its palette material (Hue/Saturation after the texture).
    Used to bring the lowpoly pack's saturated barn-red / orange palette cells to earth tones."""
    for i, m in enumerate(mesh.materials):
        if not m or not m.node_tree:
            continue
        nm = m.name + "_KAL_Muted"
        mm = bpy.data.materials.get(nm)
        if mm is None:
            mm = m.copy(); mm.name = nm
            nt = mm.node_tree
            tex = next((n for n in nt.nodes if n.type == "TEX_IMAGE"), None)
            bsdf = next(n for n in nt.nodes if n.type == "BSDF_PRINCIPLED")
            if tex:
                hs = nt.nodes.new("ShaderNodeHueSaturation")
                hs.inputs["Hue"].default_value = hue; hs.inputs["Saturation"].default_value = sat; hs.inputs["Value"].default_value = val
                nt.links.new(tex.outputs["Color"], hs.inputs["Color"])
                nt.links.new(hs.outputs["Color"], bsdf.inputs["Base Color"])
        mesh.materials[i] = mm
    return mesh


S_LP = CM               # lowpoly collection is in centimetres

# ------------------------------------------------------------------ bridges (lowpoly bridge2 + arcs + pillars)
bridge_me = asset("KAL_RoadBridge", lp("bridge1", "bridge1_pillars"), scale=CM, decimate=0.5)          # 35 m span
foot_me = asset("KAL_FootBridge", [bpy.data.objects["bridge3_low_lambert1_0_lambert2_0"]], fit_to=(None, 16 * SCALE, None))
foot_me.transform(Matrix.Rotation(math.radians(90), 4, "Z"))                                            # long axis -> X
bridge_me.transform(Matrix.Diagonal((1.0, 7.0 / 16.6, 1.0, 1.0)))          # two-lane 7 m deck on the 35 m span
DECK_ROAD = max(v.co.z for v in bridge_me.vertices) - 1.0 * SCALE          # deck surface below the railings
DECK_FOOT = max(v.co.z for v in foot_me.vertices) - 0.6 * SCALE
bridges = L.empty("KAL_Bridges", (0, 0, 0), C, "PLAIN_AXES", 0.02); parent(bridges)
k = 0
for ri, r in enumerate(ROADS):
    for i in range(len(r) - 1):
        for j in range(len(RIVER) - 1):
            hit = intersect_line_line_2d(r[i], r[i + 1], RIVER[j], RIVER[j + 1])
            if hit:
                t = (r[i + 1] - r[i]).normalized(); k += 1
                place(f"KAL_Bridge_{k}", bridge_me if ri < 2 else foot_me, bridges,
                      (hit.x, hit.y, TOP + 0.0012 - (DECK_ROAD if ri < 2 else DECK_FOOT)), math.degrees(math.atan2(t.y, t.x)))

# ------------------------------------------------------------------ government: ministry on a concrete forecourt
g_root, (gw, gd, gh) = inst_root("KAL_Government")
gov_me = asset("KAL_GovernmentBuilding", decimate=0.6, meshes= [o for o in bpy.data.scenes["SRC_Ministry"].objects if o.type == "MESH" and o.name != "Object_15.003"],
               scale=SCALE)                                           # flag pole (Object_15.003) removed; metre units
pad_me = asset("KAL_ConcretePad", lp("ground_concrete"), fit_to=(1, 1, 1), uniform=False)
place("KAL_GovForecourt", pad_me, g_root, (0, 0, 0), 0, (gw, gd, 0.0015))
place("KAL_GovernmentBuilding", gov_me, g_root, (0, 0, 0.0015))

# ------------------------------------------------------------------ radio: lattice mast + its own base pad + generator
r_root, (rw, rd, rh) = inst_root("KAL_Radio")
mast_me = asset("KAL_Mast", [o for o in bpy.data.scenes["SRC_Radio"].objects if o.name in {"Object_4.003", "Object_5.001", "Object_100"}],
                fit_to=(None, None, 90 * SCALE), decimate=0.25)                # 90 m broadcast mast
mast = place("KAL_Mast", mast_me, r_root, (-0.012, 0.0, 0.0))
MAST_H = max(v.co.z for v in mast_me.vertices)
gen_me = asset("KAL_RadioGenerator", lp("generator1"), scale=CM)
place("KAL_RadioGenerator", gen_me, r_root, (0.035, -0.022, 0.0), 90)
L.empty("ANCHOR_KAL_MastTop", (-0.012, 0.0, MAST_H), C, "SPHERE", 0.015).parent = r_root

# ------------------------------------------------------------------ barracks: lowpoly compound
b_root, (bw_, bd_, bh_) = inst_root("KAL_Barracks")
place("KAL_BarracksGround", pad_me, b_root, (0, 0, 0), 0, (bw_, bd_, 0.0015))
b4 = asset("KAL_Barrack4", lp("barrack4"), scale=S_LP, rotz=90)
b1 = asset("KAL_Barrack1", lp("barrack1"), scale=S_LP)
b3 = asset("KAL_Barrack3", lp("barrack3"), scale=S_LP)
b2 = asset("KAL_Barrack2", lp("barrack2"), scale=S_LP)
b5 = asset("KAL_Barrack5", lp("barrack5"), scale=S_LP, rotz=90)
tower = asset("KAL_Watchtower", lp("tower1"), scale=S_LP, decimate=0.4)
wall = asset("KAL_Wall", lp("wall4"), scale=S_LP)                  # 1300 cm long along X -> 81 mm
gate = asset("KAL_Gate", lp("gate1"), scale=S_LP)
for nm_, me_, xy_, rz_ in [("A", b1, (-0.090, 0.058), 0), ("B", b1, (-0.065, 0.058), 0), ("C", b1, (-0.040, 0.058), 0),
                           ("D", b5, (0.035, 0.058), 0), ("E", b5, (0.070, 0.058), 0), ("F", b4, (0.100, 0.020), 90),
                           ("G", b3, (-0.095, 0.015), 90), ("H", b3, (-0.095, -0.025), 90), ("I", b2, (0.060, -0.045), 0),
                           ("J", b2, (0.085, -0.045), 0), ("K", b1, (-0.015, 0.058), 0), ("L", b5, (0.100, 0.058), 0),
                           ("M", b3, (-0.065, -0.045), 0), ("N", b3, (-0.035, -0.045), 0)]:
    place(f"KAL_Barrack_{nm_}", me_, b_root, (xy_[0], xy_[1], 0.0015), rz_)
wl = 1300 * S_LP
hx, hy = bw_ / 2 - 0.006, bd_ / 2 - 0.006
place("KAL_BarracksWall_N", wall, b_root, (0, hy, 0.0015), 0, ((2 * hx) / wl, 1, 1))
place("KAL_BarracksWall_W", wall, b_root, (-hx, 0, 0.0015), 90, ((2 * hy) / wl, 1, 1))
place("KAL_BarracksWall_E", wall, b_root, (hx, 0, 0.0015), 90, ((2 * hy) / wl, 1, 1))
gap = 0.012
seg = hx - gap / 2
for s_ in (-1, 1):
    place(f"KAL_BarracksWall_S{'W' if s_ < 0 else 'E'}", wall, b_root, (s_ * (gap / 2 + seg / 2), -hy, 0.0015), 0, (seg / wl, 1, 1))
place("KAL_BarracksGate", gate, b_root, (0, -hy, 0.0015))
for i, (x, y) in enumerate([(-hx, -hy), (hx, -hy), (-hx, hy), (hx, hy)]):
    place(f"KAL_BarracksTower_{i+1}", tower, b_root, (x, y, 0.0015), 0, (0.8, 0.8, 0.8))

# ------------------------------------------------------------------ market: four corrugated kiosks + crates and fruit
m_root, (mw, md, mh) = inst_root("KAL_Market")
sd = bpy.data.scenes["SRC_SDStall"]
kiosk_src = [o for o in sd.objects if o.type == "MESH" and not o.name.startswith(("bolt", "Cube.063_music", "Cube.022_music", "Plane.003_krepezhi"))]
kiosk_src = [o for o in kiosk_src if o.name.startswith("Metalprof")]      # walls + roof panels: all that reads at 4.7 mm
kiosk = asset("KAL_Kiosk", kiosk_src, scale=CM, decimate=0.025)         # 2.8 m kiosk -> 6.2 mm
cont_m = muted(asset("KAL_MarketContainer", lp("ship_container1"), scale=CM), hue=0.5, sat=0.6, val=0.9)
shop_mes = [muted(asset(f"KAL_ContainerShop_{k_}", lp("container1"), scale=CM), hue=h_, sat=0.7, val=0.95) for k_, h_ in enumerate((0.42, 0.5, 0.58))]
rng = random.Random(3)
for i, (cx_, cy_) in enumerate([(-mw / 4, md / 4), (mw / 4, md / 4), (-mw / 4, -md / 4), (mw / 4, -md / 4)]):
    s_root = L.empty(f"KAL_Stall_{i+1:02}", (cx_, cy_, 0), C, "PLAIN_AXES", 0.01); s_root.parent = m_root
    for r_ in range(3):
        for c_ in range(6):
            x_ = (c_ - 2.5) * 0.0105; y_ = (r_ - 1) * 0.0115
            if r_ == 1 and c_ == 2:                           # one of the user's kiosks per cluster; the rest container shops
                place(f"KAL_Stall_{i+1:02}_Kiosk_{r_}{c_}", kiosk, s_root, (x_, y_, 0.0), 180 if r_ % 2 else 0)
            else:
                place(f"KAL_Stall_{i+1:02}_Shop_{r_}{c_}", rng.choice(shop_mes), s_root, (x_, y_, 0.0), 0 if r_ % 2 else 180)
place("KAL_MarketContainer_1", cont_m, m_root, (-mw / 2 + 0.012, 0, 0), 90)
place("KAL_MarketContainer_2", cont_m, m_root, (mw / 2 - 0.012, 0.01, 0), 90)

# ------------------------------------------------------------------ villages: lowpoly house, barn, well, fences
house = muted(asset("KAL_House", lp("house1"), scale=CM, decimate=0.22))
barn = muted(asset("KAL_Barn", lp("barn1"), scale=CM, decimate=0.5), hue=0.55, sat=0.35, val=0.75)
well = muted(asset("KAL_Well", lp("well1"), scale=CM))
fence = muted(asset("KAL_Fence", lp("woodfence01"), scale=CM))
vill = L.empty("KAL_Villages", (0, 0, 0), C, "PLAIN_AXES", 0.02); parent(vill)
rng = random.Random(5)
for vi, (vc, n) in enumerate(zip(VILLAGES, (12, 10, 8))):
    placed = 0; tries = 0
    while placed < n and tries < 300:
        tries += 1
        x = vc[0] + rng.uniform(-0.045, 0.045); y = vc[1] + rng.uniform(-0.035, 0.035)
        q = Vector((x, y))
        if not inside((x, y), OUT) or footprint_mask(x, y, 0.012, 0.001) > 0 or poly_dist(q, RIVER) < 0.03 \
                or min(poly_dist(q, r) for r in ROADS) < 0.014 or any((q - Vector(c.location[:2])).length < 0.011 for c in vill.children):
            continue
        me_ = barn if placed == 0 else (well if placed == 3 else house)
        o = place(f"KAL_Village{vi+1}_{placed+1:02}", me_, vill, (x, y, TOP + height(x, y) - 0.0004), rng.uniform(0, 360))
        placed += 1
        if me_ is house and rng.random() < 0.5:
            place(f"KAL_Village{vi+1}_{placed:02}_Fence", fence, vill, (x + 0.012, y, TOP + height(x + 0.012, y) - 0.0004), rng.uniform(0, 360))

# ------------------------------------------------------------------ rocks along the river and on the hills (lowpoly)
rock_mes = [muted(asset(f"KAL_{r}", lp(r), scale=CM * 2.5), hue=0.5, sat=0.15, val=0.8) for r in ("rockbig1", "rockbig2", "rocksmall1", "rocksmall2", "rocksmall5")]
rocks = L.empty("KAL_Rocks", (0, 0, 0), C, "PLAIN_AXES", 0.02); parent(rocks)
rng = random.Random(21)
n = 0; tries = 0
while n < 40 and tries < 3000:
    tries += 1
    if rng.random() < 0.6:
        base_p = RIVER[rng.randrange(len(RIVER))]
        q = base_p + Vector((rng.uniform(-0.03, 0.03), rng.uniform(-0.03, 0.03)))
    else:
        q = Vector((rng.uniform(-0.55, 0.55), rng.uniform(0.24, 0.38)))
    if not inside(tuple(q), OUT) or footprint_mask(q.x, q.y, 0.01, 0.001) > 0 or poly_dist(q, RIVER) < 0.013 or min(poly_dist(q, r) for r in ROADS) < 0.01:
        continue
    s = rng.uniform(0.6, 1.4)
    place(f"KAL_Rock_{n+1:02}", rng.choice(rock_mes), rocks, (q.x, q.y, TOP + height(q.x, q.y) - 0.0008), rng.uniform(0, 360), (s, s, s))
    n += 1

# ------------------------------------------------------------------ trees from the user's autumn_landscape.glb (pines + rounded crowns)
import_path(DL / "autumn_landscape.glb", "SRC_Autumn")
pine_src = ["Object_12_lambert6_0", "Object_18_lambert7_0", "Object_28_lambert9_0", "Object_16_lambert8_0", "Object_64_lambert5_0"]
pines = [asset(f"KAL_Pine_{i}", [bpy.data.objects[n]], fit_to=(None, None, 12 * SCALE), decimate=0.6) for i, n in enumerate(pine_src)]
crown_greens = [(0.07, 0.15, 0.03), (0.10, 0.17, 0.04), (0.13, 0.19, 0.05)]
crowns = []
for i, (n, g_) in enumerate(zip(["Object_199_lambert8_0", "Object_174_lambert10_0", "Object_159_lambert16_0"], crown_greens)):
    cm = asset(f"KAL_Crown_{i}", [bpy.data.objects[n]], fit_to=(9 * SCALE, None, None), decimate=0.008)
    cm.materials[0] = L.mat(f"AB_KAL_Crown_{i}", g_, 0.85)          # autumn reds/oranges recoloured to savanna greens
    crowns.append(cm)
bush = asset("KAL_Bush", [bpy.data.objects["Object_70_lambert7_0"]], fit_to=(None, None, 3.5 * SCALE))
trees = L.empty("KAL_Trees", (0, 0, 0), C, "PLAIN_AXES", 0.02); parent(trees)
rng = random.Random(9)
n = 0; tries = 0
taken = [Vector(c.location[:2]) for c in vill.children]
while n < 88 and tries < 8000:
    tries += 1
    x = rng.uniform(-0.6, 0.6); y = rng.uniform(-0.4, 0.4)
    q = Vector((x, y))
    if not inside((x, y), OUT) or min((q - Vector(b_)).length for b_ in bnd[::4]) < 0.015:
        continue
    if footprint_mask(x, y, 0.01, 0.001) > 0 or field_mask(x, y)[0] or poly_dist(q, RIVER) < 0.015 \
            or min(poly_dist(q, r) for r in ROADS) < 0.009 or any((q - t_).length < 0.011 for t_ in taken):
        continue
    hh = height(x, y)
    if hh > 0.012:
        me_ = rng.choice(pines)                       # highlands: pines
    elif rng.random() < 0.55:
        me_ = rng.choice(crowns)                      # plains: rounded crowns, sparse
    elif rng.random() < 0.5:
        me_ = bush
    else:
        continue
    s = rng.uniform(0.75, 1.3)
    sink = 0.002 if me_ in crowns else 0.0005         # crowns are bushy blobs that sit into the ground
    place(f"KAL_Tree_{n+1:03}", me_, trees, (x, y, TOP + hh - sink), rng.uniform(0, 360), (s, s, s))
    taken.append(q); n += 1

# ------------------------------------------------------------------ capital city: user's chicken_gun_fruzer_-_city.glb at 1:600
# Kept: buildings, street/ground plates, city trees. Dropped: ammo boxes, two embedded photographs, keys, and small
# props (boxes, barrels, bins, hydrants, ATMs, fans) that would be under 1 mm at this scale.
import_path(KIT_ROOT / "chicken_gun_fruzer_-_city (1).glb", "SRC_City")
def cstem(n):
    return re.sub(r"(_?_?\d+_?_?)*_?LowPolyFPS_(MAIN|Glass).*$", "", n)
CITY_BUILD = {"House", "Bank", "CityHall", "Construction", "Church", "Office", "Gas_Station", "AutoService", "Roof"}
CITY_GROUND = {"BG", "Road", "ParkingBG"}
cats = {"Buildings": [], "Ground": [], "Trees": []}
xr0, xr1, yr0, yr1 = CITY_REAL_RECT
for o in bpy.data.scenes["SRC_City"].objects:
    if o.type != "MESH":
        continue
    st = cstem(o.name)
    pts = [o.matrix_world @ Vector(c_) for c_ in o.bound_box]
    cxr = sum(p_.x for p_ in pts) / 8; cyr = sum(p_.y for p_ in pts) / 8
    if not (xr0 < cxr < xr1 and yr0 < cyr < yr1):
        continue
    if st in CITY_GROUND:
        cats["Ground"].append(o)
    elif st == "Tree":
        cats["Trees"].append(o)
    elif st in CITY_BUILD or st.startswith("House_0"):
        cats["Buildings"].append(o)
city_root = L.empty("KAL_City", (CITY_C_MAP[0], CITY_C_MAP[1], TOP + 0.0004), C, "CUBE", 0.05); parent(city_root)
to_map = Matrix.Scale(SCALE, 4) @ Matrix.Rotation(math.radians(90), 4, "Z") @ Matrix.Translation((-CITY_C_REAL[0], -CITY_C_REAL[1], -CITY_GROUND_Z))
for cat, ratio in (("Ground", 0.2), ("Buildings", 0.05), ("Trees", 0.06)):   # 0.035 broke facades
    o = L.join(f"KAL_City_{cat}", cats[cat], C)
    o.data.transform(to_map)
    if ratio < 1:
        m_ = o.modifiers.new("Decimate", "DECIMATE"); m_.ratio = ratio
        bpy.context.view_layer.update()
        nm_ = bpy.data.meshes.new_from_object(o.evaluated_get(bpy.context.evaluated_depsgraph_get()))
        o.modifiers.clear(); old_ = o.data; o.data = nm_; nm_.name = f"KAL_City_{cat}"; bpy.data.meshes.remove(old_)
    o.parent = city_root
    print("CITY", cat, len(cats[cat]), "objects ->", len(o.data.polygons), "faces")

# ------------------------------------------------------------------ power line (lowpoly pylons + line spans) from the west edge to the barracks
pylon = asset("KAL_Pylon", lp("pylon1"), scale=CM, decimate=0.6)
span = asset("KAL_PylonLine", lp("pylon_line1"), scale=1.0)          # stretched per span below
pyl = L.empty("KAL_PowerLine", (0, 0, 0), C, "PLAIN_AXES", 0.02); parent(pyl)
route = catmull([(-0.44, 0.21), (-0.30, 0.20), (-0.12, 0.165), (0.05, 0.16), (0.16, 0.22), (0.27, 0.24)], 0.005)
step = max(1, int(0.045 / 0.005))
posts = [route[i] for i in range(0, len(route), step)]
top_h = 711.33 * CM * 0.93
ldx, ldy, ldz = L.dims(bpy.data.objects.new("_tmp", span)); bpy.data.objects.remove(bpy.data.objects["_tmp"])
for i, p_ in enumerate(posts):
    z0 = TOP + height(p_.x, p_.y)
    nxt = posts[min(i + 1, len(posts) - 1)]; prv = posts[max(i - 1, 0)]
    ang = math.degrees(math.atan2(nxt.y - prv.y, nxt.x - prv.x)) + 90
    place(f"KAL_Pylon_{i+1}", pylon, pyl, (p_.x, p_.y, z0), ang)
    if i < len(posts) - 1:
        z1 = TOP + height(nxt.x, nxt.y)
        mid = (p_ + nxt) / 2; ln = (nxt - p_).length
        o = place(f"KAL_PylonSpan_{i+1}", span, pyl, (mid.x, mid.y, (z0 + z1) / 2 + top_h - 0.001),
                  math.degrees(math.atan2(nxt.y - p_.y, nxt.x - p_.x)) - 90, (0.0004 / ldx, ln / ldy, 0.0006 / ldz))

# ------------------------------------------------------------------ vehicles, containers, water tanks, lamps (lowpoly)
S_VEH = CM
veh = L.empty("KAL_Vehicles", (0, 0, 0), C, "PLAIN_AXES", 0.02); parent(veh)
pickup = asset("KAL_Pickup", lp("pickup", "pickup_wheel"), scale=S_VEH)
van = asset("KAL_Van", lp("van", "van_wheel"), scale=S_VEH)
truck = asset("KAL_SupplyTruck", lp("teamtruck", "teamtruck_wheels", "teamtruck_back", "teamtruck_back_wheels"), scale=S_VEH, decimate=0.4)
jeep = asset("KAL_Jeep", lp("jeep"), scale=S_VEH, decimate=0.4)
for nm, me_, path, t in [("Pickup", pickup, ROADS[0], 0.25), ("Van", van, ROADS[0], 0.72), ("Truck", truck, ROADS[0], 0.55),
                          ("Pickup2", pickup, ROADS[4], 0.5), ("Van2", van, ROADS[1], 0.4)]:
    p_ = path[int(t * (len(path) - 1))]; p2 = path[int(t * (len(path) - 1)) + 1]
    place(f"KAL_{nm}", me_, veh, (p_.x, p_.y, TOP + height(p_.x, p_.y) + 0.0012), math.degrees(math.atan2(p2.y - p_.y, p2.x - p_.x)) - 90)
bx_, by_, _ = INST["KAL_Barracks"]["position"]
for j_ in range(4):
    place(f"KAL_BarracksJeep_{j_+1}", jeep, veh, (bx_ - 0.015 + j_ * 0.009, by_ - 0.01, TOP + 0.0015), 90)
mtruck = asset("KAL_MilitaryTruck", lp("military_veh1", "military_veh1_back", "military_veh1_wheels"), scale=S_VEH, decimate=0.25)
for j_ in range(3):
    place(f"KAL_BarracksTruck_{j_+1}", mtruck, veh, (bx_ - 0.02 + j_ * 0.012, by_ + 0.012, TOP + 0.0015), 90)
tank = muted(asset("KAL_WaterTank", lp("desert_watertank1"), scale=S_VEH), hue=0.5, sat=0.4, val=0.9)
for vi, vc in enumerate(VILLAGES):
    for dxy in ((0.03, 0.02), (-0.03, -0.025), (0.0, 0.035)):
        q = Vector((vc[0] + dxy[0], vc[1] + dxy[1]))
        if inside(tuple(q), OUT) and footprint_mask(q.x, q.y, 0.01, 0.001) == 0 and poly_dist(q, RIVER) > 0.02 \
                and min(poly_dist(q, r) for r in ROADS) > 0.01 and all((q - t_).length > 0.014 for t_ in taken):
            place(f"KAL_WaterTank_{vi+1}", tank, vill, (q.x, q.y, TOP + height(q.x, q.y) - 0.0003)); taken.append(q); break
lamp = asset("KAL_StreetLamp", lp("lamp1"), scale=CM)
gw2, gd2 = INST["KAL_Government"]["size"][0], INST["KAL_Government"]["size"][1]
for i, x in enumerate((-0.09, -0.03, 0.03, 0.09)):
    place(f"KAL_GovLamp_{i+1}", lamp, g_root, (x, -gd2 / 2 + 0.004, 0.0015), 0)

# ------------------------------------------------------------------ helpers for looping effect animation (60 fps; runtime loops every clip)
FPS_ = 60
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

def loop_action(obj, name, keys, interp="LINEAR"):
    ad = obj.animation_data_create(); ad.action = None
    for old in [a_ for a_ in bpy.data.actions if a_.name == name or a_.name.startswith(name + ".")]:
        bpy.data.actions.remove(old)                       # rebuilds replace the clip instead of adding .001 copies
    for f, vals in keys:
        for path_, v in vals.items():
            setattr(obj, path_, v); obj.keyframe_insert(data_path=path_, frame=f)
    act = ad.action; act.name = name; act.use_fake_user = True
    for fc in fcurves_of(act):
        for kp in fc.keyframe_points:
            kp.interpolation = interp
        fc.modifiers.new("CYCLES")
    return act

def glow_mat(name, color, strength, alpha=1.0):
    m = L.mat(name, color, 0.4)
    b_ = L._bsdf(m)
    b_.inputs["Emission Color"].default_value = (*color, 1); b_.inputs["Emission Strength"].default_value = strength
    b_.inputs["Alpha"].default_value = alpha
    try:
        m.surface_render_method = "BLENDED" if alpha < 1 else "DITHERED"
    except Exception:
        pass
    return m

ACCENT = L.LAYOUT.get("accent_linear", (0.888, 0.262, 0.044))     # SharedLove accent #F28C38 in linear RGB

# ------------------------------------------------------------------ animated light wall around the map edge
# KAL_EdgeWall: translucent band rising 8 mm above the terrain edge; UV u = distance along the perimeter (0..1),
# v = height (0 bottom .. 1 top). Blender previews the moving light bands with a frame driver; the runtime
# reproduces it by scrolling the band texture along u (see production/THREE_INTEGRATION notes).
# KAL_EdgeLine: bright line along the wall top. KAL_EdgePulse_1..3: light pulses travelling round the edge (keyframed loop).
area = sum(OUT[i][0] * OUT[(i + 1) % len(OUT)][1] - OUT[(i + 1) % len(OUT)][0] * OUT[i][1] for i in range(len(OUT)))
ccw = area > 0
edge = L.empty("KAL_Edge", (0, 0, 0), C, "PLAIN_AXES", 0.02); parent(edge)
ring_pts = []
for i in range(nb):
    a_ = bnd[i - 1]; c_ = bnd[(i + 1) % nb]
    t = (c_ - a_).normalized(); nrm = Vector((t.y, -t.x)) if ccw else Vector((-t.y, t.x))   # outward
    p_ = bnd[i] + nrm * 0.0015
    ring_pts.append((p_, TOP + max(height(bnd[i].x, bnd[i].y), 0.0) + 0.013))
perim = sum((ring_pts[(i + 1) % nb][0] - ring_pts[i][0]).length for i in range(nb))
bm = bmesh.new(); uvk = bm.loops.layers.uv.new("UVMap")
lo = [bm.verts.new((p_.x, p_.y, -0.001)) for p_, z in ring_pts]
hi = [bm.verts.new((p_.x, p_.y, z)) for p_, z in ring_pts]
acc = [0.0]
for i in range(1, nb + 1):
    acc.append(acc[-1] + (ring_pts[i % nb][0] - ring_pts[i - 1][0]).length)
for i in range(nb):
    j = (i + 1) % nb
    f = bm.faces.new([lo[i], lo[j], hi[j], hi[i]])
    u0, u1 = acc[i] / perim, acc[i + 1] / perim
    for lp_, uv_ in zip(f.loops, [(u0, 0), (u1, 0), (u1, 1), (u0, 1)]):
        lp_[uvk].uv = uv_
wall_me = bpy.data.meshes.new("KAL_EdgeWall"); bm.to_mesh(wall_me); bm.free()
wall_o = L._new_obj("KAL_EdgeWall", wall_me, C); wall_o.parent = edge
wm = L.mat("AB_KAL_EdgeWall", ACCENT, 0.4)
nt_, b_ = L._reset_nodes(wm)
uvn_ = nt_.nodes.new("ShaderNodeUVMap"); uvn_.uv_map = "UVMap"
sepu = nt_.nodes.new("ShaderNodeSeparateXYZ"); nt_.links.new(uvn_.outputs["UV"], sepu.inputs[0])
scroll = nt_.nodes.new("ShaderNodeMath"); scroll.operation = "ADD"; scroll.name = "Scroll"
nt_.links.new(sepu.outputs["X"], scroll.inputs[0])
drv = scroll.inputs[1].driver_add("default_value").driver; drv.expression = "frame/600"
bands = nt_.nodes.new("ShaderNodeMath"); bands.operation = "MULTIPLY"; bands.inputs[1].default_value = 28.0
nt_.links.new(scroll.outputs[0], bands.inputs[0])
frac = nt_.nodes.new("ShaderNodeMath"); frac.operation = "FRACT"; nt_.links.new(bands.outputs[0], frac.inputs[0])
br = nt_.nodes.new("ShaderNodeValToRGB"); e_ = br.color_ramp.elements
e_[0].position, e_[0].color = 0.0, (0.15, 0.15, 0.15, 1); e_[1].position, e_[1].color = 0.12, (1, 1, 1, 1)
e2 = e_.new(0.35); e2.color = (0.15, 0.15, 0.15, 1)
nt_.links.new(frac.outputs[0], br.inputs["Fac"])
vr = nt_.nodes.new("ShaderNodeValToRGB"); ev = vr.color_ramp.elements                       # fade upwards, bright top lip
ev[0].position, ev[0].color = 0.0, (0.55, 0.55, 0.55, 1); ev[1].position, ev[1].color = 1.0, (1, 1, 1, 1)
e3 = ev.new(0.85); e3.color = (0.12, 0.12, 0.12, 1)
nt_.links.new(sepu.outputs["Y"], vr.inputs["Fac"])
mixa = nt_.nodes.new("ShaderNodeMath"); mixa.operation = "MULTIPLY"
nt_.links.new(br.outputs["Color"], mixa.inputs[0]); nt_.links.new(vr.outputs["Color"], mixa.inputs[1])
nt_.links.new(mixa.outputs[0], b_.inputs["Alpha"])
b_.inputs["Emission Color"].default_value = (*ACCENT, 1); b_.inputs["Emission Strength"].default_value = 4.0
nt_.links.new(mixa.outputs[0], b_.inputs["Emission Strength"])
b_.inputs["Base Color"].default_value = (*ACCENT, 1)
try:
    wm.surface_render_method = "BLENDED"; wm.use_backface_culling = False
except Exception:
    pass
wall_me.materials.append(wm)
# bright line on top of the wall
crv = bpy.data.curves.new("KAL_EdgeLine", "CURVE"); crv.dimensions = "3D"; crv.bevel_depth = 0.0008; crv.bevel_resolution = 0
line_pts = ring_pts[::2]                                   # half the points: the line is 0.8 mm thick
sp = crv.splines.new("POLY"); sp.points.add(len(line_pts) - 1); sp.use_cyclic_u = True
for i, (p_, z) in enumerate(line_pts):
    sp.points[i].co = (p_.x, p_.y, z, 1)
co_ = bpy.data.objects.new("KAL_EdgeLine_curve", crv); C.objects.link(co_)
bpy.context.view_layer.update()
line_me = bpy.data.meshes.new_from_object(co_.evaluated_get(bpy.context.evaluated_depsgraph_get()))
bpy.data.objects.remove(co_); bpy.data.curves.remove(crv)
line_me.name = "KAL_EdgeLine"; line_me.materials.clear(); line_me.materials.append(glow_mat("AB_KAL_EdgeLine", ACCENT, 8.0))
place("KAL_EdgeLine", line_me, edge)
# pulses running round the edge (one keyframed loop of 10 s; three pulses a third apart)
pbm = bmesh.new(); bmesh.ops.create_uvsphere(pbm, u_segments=8, v_segments=5, radius=1.0)
bmesh.ops.scale(pbm, vec=(0.012, 0.0016, 0.0016), verts=pbm.verts[:])
pulse_me = bpy.data.meshes.new("KAL_EdgePulse"); pbm.to_mesh(pulse_me); pbm.free()
pulse_me.materials.append(glow_mat("AB_KAL_EdgePulse", (1.0, 0.75, 0.45), 18.0))
LOOP = 600
for k_ in range(3):
    po = place(f"KAL_EdgePulse_{k_+1}", pulse_me, edge)
    keys = []
    nkey = 60
    for s_ in range(nkey + 1):
        frac_ = (s_ / nkey + k_ / 3) % 1.0
        target = frac_ * perim
        i = max(0, min(nb - 1, next((ii for ii in range(nb) if acc[ii + 1] >= target), nb - 1)))
        tt = (target - acc[i]) / max(acc[i + 1] - acc[i], 1e-9)
        pa, za = ring_pts[i]; pb, zb = ring_pts[(i + 1) % nb]
        pos = pa.lerp(pb, tt); z = lerp(za, zb, tt)
        ang = math.atan2(pb.y - pa.y, pb.x - pa.x)
        keys.append((s_ * LOOP / nkey, {"location": (pos.x, pos.y, z), "rotation_euler": (0, 0, ang)}))
    # unwrap rotation so the pulse never spins a full turn between keys
    for idx in range(1, len(keys)):
        a0 = keys[idx - 1][1]["rotation_euler"][2]; a1 = keys[idx][1]["rotation_euler"][2]
        while a1 - a0 > math.pi: a1 -= math.tau
        while a1 - a0 < -math.pi: a1 += math.tau
        keys[idx][1]["rotation_euler"] = (0, 0, a1)
    loop_action(po, f"KAL_EdgePulse_{k_+1}_Loop", keys)

# ------------------------------------------------------------------ looping network animation on the radio tower
# KAL_NetRing_1..3: signal rings expanding from the mast top (1.5 s loop, staggered).
# KAL_NetLink_*: arcs from the mast to each institution and village; KAL_NetPulse_*: packets running along them (2 s loop).
net = L.empty("KAL_Network", (0, 0, 0), C, "PLAIN_AXES", 0.02); parent(net)
rx, ry, _ = INST["KAL_Radio"]["position"]
mast_top = Vector((rx - 0.012, ry, TOP + MAST_H))
crv = bpy.data.curves.new("_ring", "CURVE"); crv.dimensions = "3D"; crv.bevel_depth = 0.012; crv.bevel_resolution = 0
sp = crv.splines.new("POLY"); sp.points.add(47); sp.use_cyclic_u = True
for i in range(48):
    a_ = math.tau * i / 48; sp.points[i].co = (math.cos(a_), math.sin(a_), 0, 1)
rco = bpy.data.objects.new("_ring", crv); C.objects.link(rco); bpy.context.view_layer.update()
ring_me = bpy.data.meshes.new_from_object(rco.evaluated_get(bpy.context.evaluated_depsgraph_get()))
bpy.data.objects.remove(rco); bpy.data.curves.remove(crv)
ring_me.name = "KAL_NetRing"; ring_me.materials.clear(); ring_me.materials.append(glow_mat("AB_KAL_NetRing", ACCENT, 6.0, 0.8))
RL = 90
for k_ in range(3):
    ro = place(f"KAL_NetRing_{k_+1}", ring_me, net, tuple(mast_top - Vector((0, 0, 0.01 + 0.012 * k_))))
    ph = k_ / 3
    def s_at(f):
        t = (f / RL + ph) % 1.0
        return 0.004 + t * 0.07
    wrap = (1 - ph) * RL
    keys = [(0, {"scale": (s_at(0),) * 3})]
    if 0 < wrap < RL:
        keys += [(wrap - 0.01, {"scale": (0.074,) * 3}), (wrap, {"scale": (0.004,) * 3})]
    keys += [(RL, {"scale": (s_at(RL - 1e-6),) * 3})]
    loop_action(ro, f"KAL_NetRing_{k_+1}_Loop", keys)

targets = {nm: Vector((o["position"][0], o["position"][1], TOP + o["size"][2] + 0.004)) for nm, o in INST.items() if nm != "KAL_Radio"}
for vi, vc in enumerate(VILLAGES):
    targets[f"Village{vi+1}"] = Vector((vc[0], vc[1], TOP + height(*vc) + 0.012))
targets["City"] = Vector((CITY_C_MAP[0], CITY_C_MAP[1], TOP + 0.04))
link_mat = glow_mat("AB_KAL_NetLink", ACCENT, 1.5, 0.3)
pkt_me = bpy.data.meshes.new("KAL_NetPacket"); pb_ = bmesh.new(); bmesh.ops.create_uvsphere(pb_, u_segments=8, v_segments=5, radius=0.0022)
pb_.to_mesh(pkt_me); pb_.free(); pkt_me.materials.append(glow_mat("AB_KAL_NetPacket", (1.0, 0.85, 0.6), 20.0))
PL = 120
for ti, (nm, tgt) in enumerate(targets.items()):
    mid = (mast_top + tgt) / 2 + Vector((0, 0, 0.012 + 0.03 * (mast_top - tgt).length))
    pts3 = [(1 - t) ** 2 * mast_top + 2 * (1 - t) * t * mid + t ** 2 * tgt for t in [i / 24 for i in range(25)]]
    crv = bpy.data.curves.new("_arc", "CURVE"); crv.dimensions = "3D"; crv.bevel_depth = 0.0003; crv.bevel_resolution = 0
    sp = crv.splines.new("POLY"); sp.points.add(len(pts3) - 1)
    for i, p_ in enumerate(pts3):
        sp.points[i].co = (*p_, 1)
    co_ = bpy.data.objects.new("_arc", crv); C.objects.link(co_); bpy.context.view_layer.update()
    lme = bpy.data.meshes.new_from_object(co_.evaluated_get(bpy.context.evaluated_depsgraph_get()))
    bpy.data.objects.remove(co_); bpy.data.curves.remove(crv)
    short = nm.replace("KAL_", "")
    lme.name = f"KAL_NetLink_{short}"; lme.materials.clear(); lme.materials.append(link_mat)
    place(f"KAL_NetLink_{short}", lme, net)
    po = place(f"KAL_NetPulse_{short}", pkt_me, net)
    off = (ti * 23) % PL
    keys = []
    for s_ in range(13):
        f = s_ * PL / 12
        t = ((f + off) % PL) / PL
        i = min(int(t * 24), 23); tt = t * 24 - i
        keys.append((f, {"location": tuple(pts3[i].lerp(pts3[i + 1], tt))}))
    loop_action(po, f"KAL_NetPulse_{short}_Loop", keys)

sc.frame_start, sc.frame_end = 0, 600

# ------------------------------------------------------------------ hotspots + anchors (runtime raycast targets)
for nm, o in INST.items():
    x, y, z = o["position"]; w, d, h = o["size"]
    parent(L.empty("HOTSPOT_" + nm, (x, y, TOP + h / 2), C, "CUBE", max(w, d) / 2))
L.empty("ANCHOR_KAL_ModelCentre", (0, 0, TOP + 0.12), C, "SPHERE", 0.03).parent = kroot

# ------------------------------------------------------------------ preview instance on the office desk
off = bpy.data.scenes.get("OFFICE")
if off:
    hc = bpy.data.collections.get("OFFICE_Hotspots")
    old = bpy.data.objects.get("PREVIEW_KalindaInstance")
    if old:
        bpy.data.objects.remove(old, do_unlink=True)
    inst = bpy.data.objects.new("PREVIEW_KalindaInstance", None)
    inst.instance_type = "COLLECTION"; inst.instance_collection = root_c
    inst.location = D["office"]["map_position"]
    hc.objects.link(inst)

tri = 0
for o in root_c.all_objects:
    if o.type == "MESH":
        o.data.calc_loop_triangles(); tri += len(o.data.loop_triangles)
print("KALINDA_BUILD_COMPLETE", len(list(root_c.all_objects)), "objects,", tri, "triangles (instances counted each)")
