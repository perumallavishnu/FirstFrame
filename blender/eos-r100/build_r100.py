"""Build the Canon EOS R100 production model from the photo-derived shell.

blender -b blender/eos-r100/build/shell.blend --python blender/eos-r100/build_r100.py -- <project_root>

Input:  build/shell.blend (hull panels from tools/hull.py + tools/sdf_to_mesh.py), measurements.json,
        Canon manual icon SVGs (assets/models/canon-eos-r100/reference/canon_manual/icons).
Output: blender/eos-r100/Canon_EOS_R100.blend (editable source).
Then:   tools/export_glb.py writes assets/models/canon-eos-r100/Canon_EOS_R100.glb.

Every selectable part gets a PART_* mesh (the names in js/camera/eos_r100_profile.js) and an ANCHOR_* empty on its
clickable surface, parented to the part so it follows doors, dials and the lens. Animated parts have their origin on
the real pivot and custom properties ff_motion / ff_axis (Three.js axes) / ff_range, exported as glTF extras.
Positions come from measurements.json; ray casts drop each control onto the actual photo-derived surface.
"""
import bpy, bmesh, json, math, os, sys
import numpy as np
from mathutils import Vector, Matrix
from mathutils.bvhtree import BVHTree

import addon_utils
addon_utils.enable("io_curve_svg", default_set=True)  # Canon icon SVG import
ROOT = sys.argv[sys.argv.index("--") + 1] if "--" in sys.argv else os.getcwd()
HERE = os.path.join(ROOT, "blender", "eos-r100")
ICONS = os.path.join(ROOT, "assets", "models", "canon-eos-r100", "reference", "canon_manual", "icons")
MEAS = json.load(open(os.path.join(HERE, "measurements.json")))["parts"]
OFF = (58.15, 34.4, 42.75)
TAU = math.tau


def P(x, y, z):
    """frame mm -> Blender metres"""
    return Vector(((x - OFF[0]) / 1000, (y - OFF[1]) / 1000, (z - OFF[2]) / 1000))


def three_axis(v):
    """Blender axis -> Three.js axis (glTF export maps X,Y,Z -> X,Z,-Y)"""
    return [round(v[0], 4), round(v[2], 4), round(-v[1], 4)]


mm = 0.001

# ----------------------------------------------------------------------------------------------- collections
def coll(name, parent=None):
    c = bpy.data.collections.get(name) or bpy.data.collections.new(name)
    par = parent or bpy.context.scene.collection
    if c.name not in [x.name for x in par.children]: par.children.link(c)
    return c

COL = {n: coll(n) for n in ["CAMERA_BODY", "CAMERA_GRIP", "TOP_CONTROLS", "REAR_CONTROLS", "FRONT_COMPONENTS", "VIEWFINDER",
                            "BUILT_IN_FLASH", "HOT_SHOE", "LCD_ASSEMBLY", "SIDE_PORTS", "BATTERY_COMPARTMENT", "TRIPOD_MOUNT",
                            "MATERIAL_DETAILS", "LENS_ASSEMBLY", "LENS_GLASS", "INTERNAL_EDUCATIONAL", "INTERACTION_ANCHORS"]}


def link(ob, c):
    for u in list(ob.users_collection): u.objects.unlink(ob)
    COL[c].objects.link(ob)
    return ob

# ----------------------------------------------------------------------------------------------- materials
def tex_image(name, arr, nonColor=True):
    h, w = arr.shape[:2]
    img = bpy.data.images.get(name) or bpy.data.images.new(name, w, h, alpha=False)
    rgba = np.ones((h, w, 4), np.float32); rgba[..., :3] = arr[..., :3]
    img.pixels.foreach_set(rgba.ravel())
    if nonColor: img.colorspace_settings.name = "Non-Color"
    img.pack()
    return img


def normal_from_height(hgt, strength):
    gx = (np.roll(hgt, -1, 1) - np.roll(hgt, 1, 1)) * strength
    gy = (np.roll(hgt, -1, 0) - np.roll(hgt, 1, 0)) * strength
    n = np.dstack([-gx, -gy, np.ones_like(hgt)]); n /= np.linalg.norm(n, axis=2, keepdims=True)
    return n * 0.5 + 0.5


def bandpass_noise(n, lo, hi, seed):
    rng = np.random.default_rng(seed)
    f = np.fft.fft2(rng.standard_normal((n, n)))
    k = np.sqrt(np.add.outer(np.fft.fftfreq(n) ** 2, np.fft.fftfreq(n) ** 2)) * n
    f *= np.exp(-((k - (lo + hi) / 2) / ((hi - lo) / 2)) ** 2)
    h = np.real(np.fft.ifft2(f)); return (h - h.min()) / (h.max() - h.min())


def make_textures():
    N = 512
    # leatherette: irregular pebbles (Canon grip covering), tile = 10 mm
    a = bandpass_noise(N, 28, 60, 1); b = bandpass_noise(N, 8, 16, 2)
    peb = np.clip((a - 0.45) * 4, 0, 1) ** 0.6 * 0.8 + b * 0.2
    T = {"leather": tex_image("T_R100_Leather_N", normal_from_height(peb, 6.0))}
    # moulded polymer: fine grain, tile = 10 mm
    g = bandpass_noise(N, 70, 140, 3)
    T["grain"] = tex_image("T_R100_Grain_N", normal_from_height(g, 1.6))
    # diamond knurl for dials (tile = one knurl cell repeated by UVs)
    u, v = np.meshgrid(np.linspace(0, TAU, N, endpoint=False), np.linspace(0, TAU, N, endpoint=False))
    kn = 1 - np.maximum(np.abs(np.sin((u + v) * 4)), np.abs(np.sin((u - v) * 4)))
    T["knurl"] = tex_image("T_R100_Knurl_N", normal_from_height(kn, 10.0))
    # straight ribs (zoom ring)
    rib = 0.5 + 0.5 * np.cos(u * 16)
    T["ribs"] = tex_image("T_R100_Ribs_N", normal_from_height(rib, 8.0))
    return T

TEX = make_textures()
MATS = {}


def mat(name, base, rough, metal=0.0, normal=None, nstrength=1.0, emit=None, alpha=1.0, coat=0.0):
    if name in MATS: return MATS[name]
    m = bpy.data.materials.new(name); m.use_nodes = True
    nt = m.node_tree; bsdf = nt.nodes["Principled BSDF"]
    bsdf.inputs["Base Color"].default_value = (*base, 1)
    bsdf.inputs["Roughness"].default_value = rough
    bsdf.inputs["Metallic"].default_value = metal
    if coat: bsdf.inputs["Coat Weight"].default_value = coat
    if emit:
        bsdf.inputs["Emission Color"].default_value = (*emit[0], 1); bsdf.inputs["Emission Strength"].default_value = emit[1]
    if alpha < 1:
        bsdf.inputs["Alpha"].default_value = alpha; m.blend_method = "BLEND" if hasattr(m, "blend_method") else None
    if normal:
        ti = nt.nodes.new("ShaderNodeTexImage"); ti.image = TEX[normal]
        nm = nt.nodes.new("ShaderNodeNormalMap"); nm.inputs["Strength"].default_value = nstrength
        nt.links.new(ti.outputs["Color"], nm.inputs["Color"]); nt.links.new(nm.outputs["Normal"], bsdf.inputs["Normal"])
    MATS[name] = m
    return m

BLACK = (0.022, 0.022, 0.024)
M = {
    "body": mat("MAT_Polymer_Body", BLACK, 0.5),  # smooth moulded finish: no grain map (it streaked across UV islands)
    "leather": mat("MAT_Rubber_Leatherette", (0.017, 0.017, 0.018), 0.78, normal="leather", nstrength=0.9),
    "rubber": mat("MAT_Rubber_Soft", (0.02, 0.02, 0.021), 0.72),
    "button": mat("MAT_Polymer_Button", (0.03, 0.03, 0.032), 0.38),
    "gloss": mat("MAT_Polymer_Gloss", (0.012, 0.012, 0.013), 0.16, coat=0.6),
    "knurl": mat("MAT_Polymer_Knurl", (0.03, 0.03, 0.032), 0.45, normal="knurl", nstrength=0.8),
    "ribs": mat("MAT_Rubber_Ribs", (0.02, 0.02, 0.021), 0.7, normal="ribs", nstrength=0.8),
    "alu": mat("MAT_Metal_Mount", (0.78, 0.78, 0.79), 0.3, metal=1.0),
    "shoe": mat("MAT_Metal_HotShoe", (0.8, 0.8, 0.81), 0.22, metal=1.0),
    "steel": mat("MAT_Metal_Dark", (0.25, 0.25, 0.26), 0.35, metal=1.0),
    "gold": mat("MAT_Metal_Contacts", (0.95, 0.72, 0.32), 0.25, metal=1.0),
    "print": mat("MAT_Print_White", (0.82, 0.83, 0.84), 0.5),
    "print_dark": mat("MAT_Print_Emboss", (0.035, 0.035, 0.037), 0.6),
    "red": mat("MAT_Print_Red", (0.62, 0.03, 0.03), 0.4),
    "screen": mat("MAT_Glass_Screen", (0.004, 0.004, 0.005), 0.06, coat=1.0),
    "display": mat("MAT_Screen_Display", (0.0, 0.0, 0.0), 0.3, emit=((0.0, 0.0, 0.0), 0.0)),
    "glass": mat("MAT_Glass_Coated", (0.01, 0.015, 0.03), 0.04, metal=0.3, coat=1.0),
    "sensor": mat("MAT_Sensor", (0.06, 0.24, 0.3), 0.14, metal=0.7),
    "lamp": mat("MAT_Lamp_Window", (0.75, 0.72, 0.62), 0.25),
    "flashwin": mat("MAT_Flash_Window", (0.035, 0.035, 0.037), 0.12, coat=0.5),  # smoked, as in the front photo
    "pcb": mat("MAT_Internal_PCB", (0.06, 0.22, 0.12), 0.6),
    "chip": mat("MAT_Internal_Chip", (0.08, 0.08, 0.09), 0.35, metal=0.5),
    "battery": mat("MAT_Battery_LPE17", (0.035, 0.035, 0.038), 0.45),
    "fresnel": mat("MAT_Flash_Fresnel", (0.86, 0.86, 0.84), 0.35),
    "card": mat("MAT_Internal_SDCard", (0.1, 0.22, 0.5), 0.45),
    "label": mat("MAT_Label", (0.03, 0.03, 0.032), 0.6),
}


def set_mat(ob, m):
    ob.data.materials.clear(); ob.data.materials.append(m)

# ----------------------------------------------------------------------------------------------- mesh helpers
def new_obj(name, me, c, parent=None):
    ob = bpy.data.objects.new(name, me); COL[c].objects.link(ob)
    if parent: ob.parent = parent
    return ob


def finish(bm, name, sharp_deg=35):
    for f in bm.faces: f.smooth = True
    for e in bm.edges:
        if len(e.link_faces) == 2 and e.calc_face_angle(0) > math.radians(sharp_deg): e.smooth = False
    me = bpy.data.meshes.new(name); bm.to_mesh(me); bm.free()
    return me


def lathe(name, profile, seg=64, star=None, uv_rep=1.0, sharp_deg=35):
    """revolve [(r_mm, z_mm), ...] about local Z. star=(teeth, depth_mm) knurls the outer surface.
    UVs: u = angle * uv_rep, v = profile length (mm/10)."""
    bm = bmesh.new(); uvl = bm.loops.layers.uv.new("UVMap")
    rings = []
    for (r, z) in profile:
        ring = []
        for i in range(seg):
            a = TAU * i / seg; rr = r
            if star and r > 0.01: rr = r - star[1] * (0.5 + 0.5 * math.cos(a * star[0]))  # knurl teeth
            ring.append(bm.verts.new((rr * math.cos(a) * mm, rr * math.sin(a) * mm, z * mm)) if rr > 1e-6 else None)
        rings.append(ring)
    vs = [0.0]
    for k in range(1, len(profile)): vs.append(vs[-1] + math.hypot(profile[k][0] - profile[k - 1][0], profile[k][1] - profile[k - 1][1]) / 10)
    centres = {}
    for k in range(len(profile) - 1):
        A, B = rings[k], rings[k + 1]
        for i in range(seg):
            j = (i + 1) % seg
            quad = [A[i], A[j], B[j], B[i]]
            uvq = [(i / seg * uv_rep, vs[k]), ((i + 1) / seg * uv_rep, vs[k]), ((i + 1) / seg * uv_rep, vs[k + 1]), (i / seg * uv_rep, vs[k + 1])]
            if A[i] is None or B[i] is None:  # collapse to the axis
                zc = profile[k][1] if A[i] is None else profile[k + 1][1]
                if zc not in centres: centres[zc] = bm.verts.new((0, 0, zc * mm))
                c = centres[zc]
                tri = [c, B[j], B[i]] if A[i] is None else [A[i], A[j], c]
                uvt = [((i + .5) / seg * uv_rep, vs[k]), uvq[2], uvq[3]] if A[i] is None else [uvq[0], uvq[1], ((i + .5) / seg * uv_rep, vs[k + 1])]
                try:
                    f = bm.faces.new(tri)
                    for l, t in zip(f.loops, uvt): l[uvl].uv = t
                except ValueError: pass
                continue
            try:
                f = bm.faces.new(quad)
                for l, t in zip(f.loops, uvq): l[uvl].uv = t
            except ValueError: pass
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return finish(bm, name, sharp_deg)


def rbox(name, w, d, h, r=0.4, seg=3):
    """rounded box centred on origin in X/Y, base at z=0 (mm)"""
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    for v in bm.verts: v.co = Vector((v.co.x * w * mm, v.co.y * d * mm, (v.co.z + 0.5) * h * mm))
    if r > 0: bmesh.ops.bevel(bm, geom=list(bm.edges), offset=min(r, w / 2.1, d / 2.1, h / 2.1) * mm, segments=seg, affect="EDGES", profile=0.5)
    uvl = bm.loops.layers.uv.new("UVMap")
    for f in bm.faces:
        for l in f.loops: l[uvl].uv = (l.vert.co.x * 100, l.vert.co.y * 100 + l.vert.co.z * 100)
    return finish(bm, name, 30)


def prism(name, poly_mm, h, bevel=0.0):
    """extrude a 2D outline (mm, local XY) to height h (mm) with optional edge bevel"""
    bm = bmesh.new()
    vs = [bm.verts.new((x * mm, y * mm, 0)) for x, y in poly_mm]
    f = bm.faces.new(vs)
    ext = bmesh.ops.extrude_face_region(bm, geom=[f])
    for v in [e for e in ext["geom"] if isinstance(e, bmesh.types.BMVert)]: v.co.z += h * mm
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    if bevel: bmesh.ops.bevel(bm, geom=[e for e in bm.edges], offset=bevel * mm, segments=2, affect="EDGES", profile=0.5)
    uvl = bm.loops.layers.uv.new("UVMap")
    for fc in bm.faces:
        for l in fc.loops: l[uvl].uv = (l.vert.co.x * 100, l.vert.co.y * 100)
    return finish(bm, name, 30)


def orient(ob, loc, normal, up):
    n = Vector(normal).normalized(); u = Vector(up)
    y = (u - u.dot(n) * n)
    if y.length < 1e-6: y = Vector((0, 0, 1)) - n.z * n
    y.normalize(); x = y.cross(n)
    ob.matrix_world = Matrix.Translation(loc) @ Matrix((x, y, n)).transposed().to_4x4()


def flat_from_curve(cu_obj, name, depth_mm):
    cu_obj.data.extrude = depth_mm * mm / 2 if depth_mm else 0
    cu_obj.data.fill_mode = "BOTH" if depth_mm else "FRONT"
    dg = bpy.context.evaluated_depsgraph_get()
    me = bpy.data.meshes.new_from_object(cu_obj.evaluated_get(dg)); me.name = name
    return me


def text_mesh(name, body, size_mm, depth_mm=0.0, font_bold=False):
    cu = bpy.data.curves.new(name + "_txt", "FONT"); cu.body = body; cu.size = size_mm * mm * 1.38  # cap height ~ size
    cu.align_x = "CENTER"; cu.align_y = "CENTER"
    if font_bold:
        f = next((ff for ff in bpy.data.fonts if "Bold" in ff.name), None)
        if f: cu.font = f
    ob = bpy.data.objects.new(name + "_tmp", cu); bpy.context.scene.collection.objects.link(ob)
    me = flat_from_curve(ob, name, depth_mm); bpy.data.objects.remove(ob); bpy.data.curves.remove(cu)
    return me


def svg_mesh(name, icon, height_mm, depth_mm=0.0, width_mm=None):
    """import a Canon manual icon, drop its invisible bounding rectangle, fit to height (or width), centre"""
    before = set(bpy.data.objects)
    bpy.ops.import_curve.svg(filepath=os.path.join(ICONS, icon + ".svg"))
    new = [o for o in bpy.data.objects if o not in before]
    keep = []
    for o in new:
        sp = o.data.splines; pts = sum(len(s.bezier_points) + len(s.points) for s in sp)
        if len(sp) == 1 and pts <= 5: bpy.data.objects.remove(o)
        else: keep.append(o)
    meshes = []
    dg = bpy.context.evaluated_depsgraph_get()
    for o in keep:
        o.data.fill_mode = "BOTH" if depth_mm else "FRONT"; o.data.extrude = depth_mm * mm / 2
    dg.update()
    bm = bmesh.new()
    for o in keep:
        tmp = bpy.data.meshes.new_from_object(o.evaluated_get(dg))
        tmp.transform(o.matrix_world)
        bm.from_mesh(tmp); bpy.data.meshes.remove(tmp)
    for o in keep:
        c = o.data; bpy.data.objects.remove(o); bpy.data.curves.remove(c)
    for c in [c for c in bpy.data.collections if c.name.startswith(icon)]: bpy.data.collections.remove(c)
    xs = [v.co.x for v in bm.verts]; ys = [v.co.y for v in bm.verts]; zs = [v.co.z for v in bm.verts]
    cx, cy = (min(xs) + max(xs)) / 2, (min(ys) + max(ys)) / 2
    s = (height_mm * mm) / max(1e-9, max(ys) - min(ys))
    if width_mm: s = min(s, width_mm * mm / max(1e-9, max(xs) - min(xs)))
    zc = (min(zs) + max(zs)) / 2
    for v in bm.verts: v.co = Vector(((v.co.x - cx) * s, (v.co.y - cy) * s, (v.co.z - zc) * (depth_mm * mm / max(1e-9, max(zs) - min(zs))) if max(zs) > min(zs) else 0))
    return finish(bm, name, 89)

# ----------------------------------------------------------------------------------------------- the shell
SHELL_PARTS = {  # name: (collection, material, target face count after decimation; faces come out as ~2 triangles)
    "BODY_Shell": ("CAMERA_BODY", "body", 25000), "BODY_Leatherette": ("CAMERA_BODY", "leather", 9000),
    "PART_Grip": ("CAMERA_GRIP", "leather", 7000), "BODY_ThumbRest": ("REAR_CONTROLS", "leather", 2000),
    "PART_BuiltInFlash": ("BUILT_IN_FLASH", "body", 2500), "PART_Eyecup": ("VIEWFINDER", "rubber", 3500),
    "PART_CardBatteryCover": ("BATTERY_COMPARTMENT", "body", 3000),
    "PART_TerminalCoverRight": ("SIDE_PORTS", "rubber", 2000), "PART_TerminalCoverLeft": ("SIDE_PORTS", "rubber", 1500),
    "PART_TerminalCoverLeftRemote": ("SIDE_PORTS", "rubber", 1500)}


def prepare_shell():
    for name, (c, m, target) in SHELL_PARTS.items():
        ob = bpy.data.objects.get(name)
        if not ob: print("MISSING", name); continue
        link(ob, c)
        n = len(ob.data.polygons)
        if n > target:
            d = ob.modifiers.new("dec", "DECIMATE"); d.ratio = target / n
            bpy.context.view_layer.objects.active = ob
            with bpy.context.temp_override(object=ob, active_object=ob):
                bpy.ops.object.modifier_apply(modifier=d.name)
        me = ob.data; bm = bmesh.new(); bm.from_mesh(me)
        bmesh.ops.reverse_faces(bm, faces=bm.faces)  # the level-set mesher winds faces inward
        bm.to_mesh(me); bm.free()
        set_mat(ob, M[m])
        # UVs: smart project, then rescale so one UV unit = 10 mm (texture tile)
        bpy.ops.object.select_all(action="DESELECT"); ob.select_set(True); bpy.context.view_layer.objects.active = ob
        bpy.ops.object.mode_set(mode="EDIT"); bpy.ops.mesh.select_all(action="SELECT")
        bpy.ops.uv.smart_project(angle_limit=math.radians(60), island_margin=0.001, scale_to_bounds=False)
        bpy.ops.object.mode_set(mode="OBJECT")
        me = ob.data; uv = me.uv_layers.active.data
        a3 = sum(p.area for p in me.polygons)
        a2 = 0.0
        for p in me.polygons:
            pts = [uv[i].uv for i in p.loop_indices]
            for k in range(1, len(pts) - 1):
                a2 += abs((pts[k] - pts[0]).cross(pts[k + 1] - pts[0])) / 2
        s = math.sqrt((a3 / (0.01 ** 2)) / max(a2, 1e-12))
        for l in uv: l.uv = l.uv * s
        print("SHELL %-28s faces %6d" % (name, len(me.polygons)))


prepare_shell()
SURF = [bpy.data.objects[n] for n in SHELL_PARTS if n in bpy.data.objects]
dg = bpy.context.evaluated_depsgraph_get()
BVH = {o.name: BVHTree.FromObject(o, dg) for o in SURF}
for o in SURF:  # BVH is in object space; shells sit at identity so world == local
    assert o.matrix_world == Matrix.Identity(4)

DIRS = {"top": ((0, 0, -1), lambda a, b: P(a, b, 140)), "bottom": ((0, 0, 1), lambda a, b: P(a, b, -60)),
        "rear": ((0, -1, 0), lambda a, b: P(a, 140, b)), "front": ((0, 1, 0), lambda a, b: P(a, -60, b)),
        "right": ((1, 0, 0), lambda a, b: P(-60, a, b)), "left": ((-1, 0, 0), lambda a, b: P(180, a, b))}


def hit(face, a, b, only=None, start=None):
    """cast onto the shell. top/bottom: (x, y); rear/front: (x, z); right/left: (y, z). Returns (loc, normal, object)."""
    d, o = DIRS[face]; o = start if start is not None else o(a, b); d = Vector(d)
    best = None
    for name, t in BVH.items():
        if only and name not in only: continue
        loc, nor, idx, dist = t.ray_cast(o, d)
        if loc is not None and (best is None or dist < best[3]): best = (loc, nor, name, dist)
    if best is None: raise RuntimeError("no surface hit %s %s %s" % (face, a, b))
    n = best[1]
    if n.dot(d) > 0: n = -n
    return best[0], n.normalized(), best[2]

# ----------------------------------------------------------------------------------------------- parts
ANCH = []  # (anchor name, parent object, world location, normal)


def anchor(part_obj, name, loc, normal, lift=0.3):
    ANCH.append((name, part_obj, Vector(loc) + Vector(normal) * lift * mm, Vector(normal)))


def motion(ob, kind, axis=None, rng=None, **kw):
    ob["ff_motion"] = kind
    if axis is not None: ob["ff_axis"] = three_axis(axis)
    if rng is not None: ob["ff_range"] = list(rng)
    for k, v in kw.items(): ob["ff_" + k] = v


def button(name, face, a, b, r, proud, c, marking=None, mark_h=None, mark_w=None, up=(0, 0, 1), cap="button", ring=True, text=None):
    """round push button: base sunk 1 mm into the surface, dome cap `proud` mm above it, optional bezel ring and marking"""
    loc, n, _ = hit(face, a, b)
    prof = [(0, -1.0), (r, -1.0), (r, proud - 0.45), (r - 0.25, proud - 0.1), (r * 0.6, proud), (0, proud + 0.03)]
    ob = new_obj(name, lathe(name, prof, 48), c); set_mat(ob, M[cap])
    orient(ob, loc, n, up)
    motion(ob, "press", axis=-n, rng=[0, 0.0006])
    if ring:
        rg = new_obj("BODY_" + name[5:] + "Bezel", lathe("bezel", [(r + 0.15, -0.6), (r + 0.75, -0.6), (r + 0.75, 0.25), (r + 0.35, 0.45), (r + 0.15, 0.4)], 48), c)
        set_mat(rg, M["body"]); orient(rg, loc, n, up)
    if marking or text:
        me = text_mesh(name + "_Mark", text, mark_h) if text else svg_mesh(name + "_Mark", marking, mark_h, width_mm=mark_w)
        mk = new_obj(name + "_Mark", me, "MATERIAL_DETAILS"); set_mat(mk, M["print"])
        orient(mk, loc + n * (proud + 0.03) * mm, n, up); parent_keep(mk, ob)
    anchor(ob, "ANCHOR_" + name[5:], loc + n * proud * mm, n)
    return ob, loc, n


def conform(ob, n, lift=0.06, only=None):
    """drop every vertex of a flat marking onto the surface below it along -n, so text follows curved panels"""
    bpy.context.view_layer.update()
    bm = bmesh.new(); bm.from_mesh(ob.data)  # densify long glyph triangles so they can follow the curve
    for _ in range(3):
        long_e = [e for e in bm.edges if e.calc_length() > 0.5 * mm]
        if not long_e: break
        bmesh.ops.subdivide_edges(bm, edges=long_e, cuts=1, use_grid_fill=True)
        bmesh.ops.triangulate(bm, faces=bm.faces)
    bm.to_mesh(ob.data); bm.free()
    mw = ob.matrix_world; inv = mw.inverted(); n = Vector(n).normalized()
    for v in ob.data.vertices:
        w = mw @ v.co; best = None
        for name, t in BVH.items():
            if only and name not in only: continue
            loc, nor, i, d = t.ray_cast(w + n * 2.5 * mm, -n, 6 * mm)
            if loc is not None and (best is None or d < best[1]): best = (loc, d)
        if best: v.co = inv @ (best[0] + n * lift * mm)


def printed(name, face, a, b, body=None, icon=None, h=1.5, w=None, up=(0, 0, 1), m="print", parent=None, lift=0.03, at=None, nrm=None):
    if at is None: loc, n, _ = hit(face, a, b)
    else: loc, n = at, nrm
    me = text_mesh(name, body, h) if body else svg_mesh(name, icon, h, width_mm=w)
    ob = new_obj(name, me, "MATERIAL_DETAILS"); set_mat(ob, M[m]); orient(ob, loc + n * lift * mm, n, up)
    conform(ob, n, lift=max(lift, 0.05))
    if parent: parent_keep(ob, parent)
    return ob


def parent_keep(child, parent):
    """parent without moving the child (refreshes matrices first, so freshly set locations count)"""
    bpy.context.view_layer.update()
    child.parent = parent; child.matrix_parent_inverse = parent.matrix_world.inverted()


def pivot_to(ob, world_pt):
    """move object origin to world_pt without moving its geometry"""
    mw = ob.matrix_world.copy(); local = mw.inverted() @ Vector(world_pt)
    ob.data.transform(Matrix.Translation(-local)); ob.matrix_world = mw @ Matrix.Translation(local)


def build_top():
    m = MEAS
    # shutter button: glossy dome in a collar on the grip top (top ~71 mm)
    sx, sy = m["shutter-button"]["x"], m["shutter-button"]["y"]
    loc, n, _ = hit("top", sx, sy)
    base = loc.copy(); topz = P(0, 0, 71.0).z
    h = (topz - base.z) / mm
    sb = new_obj("PART_ShutterButton", lathe("PART_ShutterButton", [(0, -1), (4.6, -1), (4.6, h - 1.0), (4.2, h - 0.35), (2.5, h - 0.02), (0, h)], 64), "TOP_CONTROLS")
    set_mat(sb, M["gloss"]); sb.location = base; motion(sb, "press", axis=(0, 0, -1), rng=[0, 0.0007])
    col = new_obj("BODY_ShutterCollar", lathe("collar", [(4.75, -1), (6.2, -1), (6.2, h - 1.6), (5.6, h - 1.1), (4.75, h - 1.2)], 64), "TOP_CONTROLS")
    set_mat(col, M["body"]); col.location = base
    anchor(sb, "ANCHOR_ShutterButton", base + Vector((0, 0, h * mm)), Vector((0, 0, 1)))

    # Dial: knurled wheel rolled front-to-back, axis along X
    d = m["dial"]; c = P(d["x"], d["y"], 69.2)
    wheel = new_obj("PART_Dial", lathe("PART_Dial", [(0, -d["w"] / 2), (5.4, -d["w"] / 2), (6.0, -d["w"] / 2 + 0.6), (6.0, d["w"] / 2 - 0.6), (5.4, d["w"] / 2), (0, d["w"] / 2)], 72, star=(36, 0.35), uv_rep=12), "TOP_CONTROLS")
    set_mat(wheel, M["knurl"]); wheel.matrix_world = Matrix.Translation(c) @ Matrix.Rotation(math.pi / 2, 4, "Y")
    motion(wheel, "rotate", axis=(1, 0, 0), rng=[-TAU, TAU])
    anchor(wheel, "ANCHOR_Dial", c + Vector((0, 0, 6.0 * mm)), Vector((0, 0, 1)))

    # movie shooting button: dark ring with red centre
    mv = m["movie-shooting-button"]; loc, n, _ = hit("top", mv["x"], mv["y"])
    ring = new_obj("BODY_MovieButtonRing", lathe("ring", [(1.4, -1), (3.3, -1), (3.3, 0.7), (2.9, 1.0), (1.4, 0.9)], 48), "TOP_CONTROLS"); set_mat(ring, M["button"]); orient(ring, loc, n, (0, -1, 0))
    mb = new_obj("PART_MovieShootingButton", lathe("PART_MovieShootingButton", [(0, -1), (1.35, -1), (1.35, 0.8), (1.0, 1.15), (0, 1.25)], 32), "TOP_CONTROLS")
    set_mat(mb, M["red"]); orient(mb, loc, n, (0, -1, 0)); motion(mb, "press", axis=-n, rng=[0, 0.0005])
    anchor(mb, "ANCHOR_MovieShootingButton", loc + n * 1.25 * mm, n)

    # Mode dial: knurled rim, flat top carrying Canon's mode icons in physical ring order
    md = m["mode-dial"]; c0 = P(md["x"], md["y"], 67.0); R = md["d"] / 2
    dial = new_obj("PART_ModeDial", lathe("PART_ModeDial", [(0, 0), (R - 0.3, 0), (R, 0.4), (R, 5.9), (R - 0.5, 6.5), (0, 6.5)], 96, star=(60, 0.3), uv_rep=20), "TOP_CONTROLS")
    set_mat(dial, M["knurl"]); dial.location = c0
    top_cap = new_obj("BODY_ModeDialCap", lathe("cap", [(0, 6.5), (R - 0.55, 6.5), (R - 0.55, 6.52), (0, 6.52)], 96), "TOP_CONTROLS")
    set_mat(top_cap, M["button"]); top_cap.location = c0; parent_keep(top_cap, dial)
    order = ["A+", "HYB", "SCN", "FX", "MOV", "M", "Av", "Tv", "P"]
    icons = {"A+": ("icon_mode-auto", 2.0), "HYB": ("icon_movie_plus", 1.8), "SCN": ("icon_modedial-scn", 1.5), "FX": ("icon_creativefilter-mode", 2.0), "MOV": (None, 2.0)}
    for i, k in enumerate(order):
        a = math.radians(40 * i)  # A+ sits at the index mark (toward +X); the ring runs counter-clockwise seen from above
        rr = R - 2.6
        pt = c0 + Vector((math.cos(a) * rr * mm, math.sin(a) * rr * mm, 6.55 * mm))
        radial = Vector((math.cos(a), math.sin(a), 0))
        if k in icons and icons[k][0]: me = svg_mesh("MODE_" + k, icons[k][0], icons[k][1], width_mm=3.2)
        elif k == "MOV":  # movie mode glyph: a camera body with a lens hood (drawn, Canon icon not in the manual set)
            me = prism("MODE_MOV", [(-1.4, -0.7), (0.4, -0.7), (0.4, -0.2), (1.3, -0.7), (1.3, 0.7), (0.4, 0.2), (0.4, 0.7), (-1.4, 0.7)], 0.04)
        else: me = text_mesh("MODE_" + k, k, 1.7, font_bold=True)
        ob = new_obj("MODE_" + k, me, "MATERIAL_DETAILS"); set_mat(ob, M["print"])
        orient(ob, pt, Vector((0, 0, 1)), radial); parent_keep(ob, dial)
    motion(dial, "rotate", axis=(0, 0, 1), rng=[0, TAU], order=order, step_deg=-40.0, index_angle_deg=0.0)
    anchor(dial, "ANCHOR_ModeDial", c0 + Vector((0, 0, 6.55 * mm)), Vector((0, 0, 1)))
    im = md["index_mark"]; loc, n, _ = hit("top", im["x"], im["y"])
    idx = new_obj("BODY_ModeDialIndex", rbox("idx", 2.4, 0.5, 0.08, 0.05), "MATERIAL_DETAILS"); set_mat(idx, M["print"]); orient(idx, loc, n, (0, -1, 0))

    # power switch: lever pivoting about the mode dial axis on its grip side; ON forward, OFF back
    ps = m["power-switch"]
    lev = new_obj("PART_PowerSwitch", prism("PART_PowerSwitch", [(-R - 0.2, -1.6), (-R - 5.6, -1.4), (-R - 6.2, -0.6), (-R - 6.2, 0.6), (-R - 5.6, 1.4), (-R - 0.2, 1.6)], 1.8, bevel=0.3), "TOP_CONTROLS")
    set_mat(lev, M["button"]); lev.location = c0 + Vector((0, 0, 0.2 * mm))
    motion(lev, "rotate", axis=(0, 0, 1), rng=[-0.14, 0.14], on=0.14, off=-0.14)
    anchor(lev, "ANCHOR_PowerSwitch", c0 + Vector((-(R + 4.0) * mm, 0, 2.2 * mm)), Vector((0, 0, 1)))
    for txt, (x, y) in (("ON", (7.1, 38.8)), ("OFF", (7.6, 44.1))):
        printed("PRINT_Power" + txt, "top", x, y, body=txt, h=1.6, up=(0, -1, 0))

    # hot shoe: dark base plate, then the metal shoe with rails and contacts
    hs = m["hot-shoe"]; zt = 83.3
    base = new_obj("BODY_HotShoeBase", rbox("shoebase", 22.0, 32.0, 1.0, 0.6), "HOT_SHOE"); set_mat(base, M["body"]); base.location = P(hs["x"], 41.0, zt)
    shoe = new_obj("PART_HotShoe", rbox("PART_HotShoe", 20.0, 19.0, 0.5, 0.3), "HOT_SHOE"); set_mat(shoe, M["shoe"]); shoe.location = P(hs["x"], 43.5, zt + 1.0)
    for sgn in (-1, 1):
        rail = new_obj("PART_HotShoe_Rail", rbox("rail", 2.6, 19.0, 1.2, 0.2), "HOT_SHOE"); set_mat(rail, M["shoe"])
        rail.location = P(hs["x"] + sgn * 8.9, 43.5, zt + 1.2); parent_keep(rail, shoe)
    for (dx, dy, r) in ((0, 1.5, 1.7), (0, -3.5, 0.75), (-1.8, -5.2, 0.6), (1.8, -5.2, 0.6), (-1.8, -7.0, 0.6), (1.8, -7.0, 0.6)):
        ct = new_obj("PART_HotShoe_Contact", lathe("ct", [(0, 0), (r, 0), (r, 0.12), (0, 0.12)], 24), "HOT_SHOE"); set_mat(ct, M["gold" if r < 1 else "shoe"])
        ct.location = P(hs["x"] + dx, 43.5 + dy, zt + 1.5); parent_keep(ct, shoe)
    anchor(shoe, "ANCHOR_HotShoe", P(hs["x"], 43.5, zt + 1.6), Vector((0, 0, 1)))

    # microphone holes (on the shoe base, ahead of the shoe) and speaker holes (mic-side shoulder)
    mic = new_obj("PART_Microphone", bpy.data.meshes.new("PART_Microphone"), "TOP_CONTROLS")
    bm = bmesh.new()
    for i in (-1, 0, 1):
        bmesh.ops.create_circle(bm, cap_ends=True, radius=0.38 * mm, segments=16, matrix=Matrix.Translation(P(m["microphone"]["x"] + i * 1.5, m["microphone"]["y"] - 0.6, zt + 1.03)))
    bm.to_mesh(mic.data); bm.free(); set_mat(mic, M["chip"])
    anchor(mic, "ANCHOR_Microphone", P(m["microphone"]["x"], m["microphone"]["y"] - 0.6, zt + 1.03), Vector((0, 0, 1)))
    sp = m["speaker"]; spk = new_obj("PART_Speaker", bpy.data.meshes.new("PART_Speaker"), "TOP_CONTROLS"); bm = bmesh.new()
    for i in (-1, 0, 1):
        loc, n, _ = hit("top", sp["x"], sp["y"] + i * 1.7)
        bmesh.ops.create_circle(bm, cap_ends=True, radius=0.4 * mm, segments=16, matrix=Matrix.Translation(loc + n * 0.02 * mm) @ n.to_track_quat("Z", "Y").to_matrix().to_4x4())
    bm.to_mesh(spk.data); bm.free(); set_mat(spk, M["chip"])
    loc, n, _ = hit("top", sp["x"], sp["y"]); anchor(spk, "ANCHOR_Speaker", loc, n)
    fp = m["focal-plane-mark"]
    fpm = printed("PART_FocalPlaneMark", "top", fp["x"], fp["y"], icon="icon_focal-plane", h=2.4, w=3.4, up=(0, -1, 0))
    loc, n, _ = hit("top", fp["x"], fp["y"]); anchor(fpm, "ANCHOR_FocalPlaneMark", loc, n)
    printed("PRINT_ModelName", "top", 98.6, 38.8, body="EOS R100", h=2.0, up=(0, -1, 0))


def build_front():
    m = MEAS; mx, mz, yf = 69.3, 34.9, 11.6
    c = P(mx, yf, mz); fwd = Vector((0, -1, 0))
    rot = Matrix.Translation(c) @ Matrix.Rotation(math.pi / 2, 4, "X")  # lathe Z -> world -Y (forward)
    # silver bayonet flange and black base ring
    ring = new_obj("PART_LensMount", lathe("PART_LensMount", [(27.3, 0), (34.4, 0), (34.6, -0.3), (34.6, -2.0), (27.3, -2.0)], 128), "FRONT_COMPONENTS")
    set_mat(ring, M["alu"]); ring.matrix_world = rot
    base = new_obj("BODY_MountBase", lathe("mountbase", [(27.3, -2.0), (35.4, -2.0), (35.4, -5.6), (27.3, -5.6)], 128), "FRONT_COMPONENTS"); set_mat(base, M["body"]); base.matrix_world = rot
    for k, a0 in enumerate((70, 190, 310)):  # three bayonet tabs inside the throat
        tab = bpy.data.meshes.new("tab"); bm = bmesh.new()
        segs = 12; pts = []
        for i in range(segs + 1):
            a = math.radians(a0 + 48 * i / segs); pts.append((a, 24.6));
        outer = [bm.verts.new((math.cos(a) * 27.4 * mm, math.sin(a) * 27.4 * mm, z * mm)) for (a, _) in pts for z in (-1.0, -2.0)]
        inner = [bm.verts.new((math.cos(a) * 24.8 * mm, math.sin(a) * 24.8 * mm, z * mm)) for (a, _) in pts for z in (-1.0, -2.0)]
        for i in range(segs):
            o0, o1 = outer[2 * i:2 * i + 2], outer[2 * i + 2:2 * i + 4]; i0, i1 = inner[2 * i:2 * i + 2], inner[2 * i + 2:2 * i + 4]
            for quad in ([o0[0], o1[0], i1[0], i0[0]], [o0[1], i0[1], i1[1], o1[1]], [i0[0], i1[0], i1[1], i0[1]], [o0[0], o0[1], o1[1], o1[0]]):
                bm.faces.new(quad)
        bm.faces.new([outer[0], inner[0], inner[1], outer[1]]); bm.faces.new([outer[-2], outer[-1], inner[-1], inner[-2]])
        bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
        t = new_obj("PART_LensMount_Tab%d" % k, finish(bm, "tab"), "FRONT_COMPONENTS"); set_mat(t, M["alu"]); t.matrix_world = rot
        parent_keep(t, ring)
    for (px, py) in ((437, 358), (757, 358), (381, 700), (815, 700), (597, 822)):  # mount screws (front photo, preview px)
        dx, dz = (px - 597) * 0.1181, -(py - 568) * 0.1155
        s = new_obj("BODY_MountScrew", lathe("screw", [(0, 0.25), (0.95, 0.15), (1.0, 0), (1.0, -0.2), (0, -0.2)], 20), "FRONT_COMPONENTS"); set_mat(s, M["alu"])
        s.matrix_world = Matrix.Translation(P(mx + dx, yf, mz + dz)) @ Matrix.Rotation(math.pi / 2, 4, "X"); parent_keep(s, ring)
    anchor(ring, "ANCHOR_LensMount", P(mx - 31.0, yf, mz), fwd)
    idx = new_obj("PART_RfLensMountIndex", lathe("PART_RfLensMountIndex", [(0, 0), (0.85, 0), (0.85, 0.1), (0, 0.12)], 24), "FRONT_COMPONENTS")
    set_mat(idx, M["red"]); idx.matrix_world = Matrix.Translation(P(mx, yf - 0.02, mz + 31.4)) @ Matrix.Rotation(math.pi / 2, 4, "X")
    anchor(idx, "ANCHOR_RfLensMountIndex", P(mx, yf, mz + 31.4), fwd)
    lp = m["lens-lock-pin"]
    pin = new_obj("PART_LensLockPin", lathe("PART_LensLockPin", [(0, -1), (0.9, -1), (0.9, 0.6), (0.6, 0.9), (0, 0.9)], 20), "FRONT_COMPONENTS")
    set_mat(pin, M["steel"]); pin.matrix_world = Matrix.Translation(P(lp["x"], yf, lp["z"])) @ Matrix.Rotation(math.pi / 2, 4, "X")
    motion(pin, "press", axis=(0, 1, 0), rng=[0, 0.0009]); anchor(pin, "ANCHOR_LensLockPin", P(lp["x"], yf - 0.9, lp["z"]), fwd)
    # contacts: 12 gold pins on a dark block at the bottom of the throat
    blk = new_obj("BODY_ContactBlock", rbox("cblock", 30.0, 3.0, 2.2, 0.4), "FRONT_COMPONENTS"); set_mat(blk, M["chip"])
    blk.matrix_world = Matrix.Translation(P(mx, 13.6, mz - 24.6)) @ Matrix.Rotation(math.pi / 2, 4, "X")
    cts = new_obj("PART_Contacts", bpy.data.meshes.new("PART_Contacts"), "FRONT_COMPONENTS"); bm = bmesh.new()
    for i in range(12):
        a = math.radians(-118 + (i / 11) * 63)
        q = P(mx + math.cos(a) * 22.8, 13.0, mz + math.sin(a) * 22.8)
        bmesh.ops.create_cone(bm, cap_ends=True, segments=12, radius1=0.42 * mm, radius2=0.42 * mm, depth=0.8 * mm, matrix=Matrix.Translation(q) @ Matrix.Rotation(math.pi / 2, 4, "X"))
    bm.to_mesh(cts.data); bm.free(); set_mat(cts, M["gold"]); anchor(cts, "ANCHOR_Contacts", P(mx, 12.6, mz - 22.8), fwd)
    # image sensor 20 mm behind the mount face, in its package, with the shutter (educational) in front
    sen = new_obj("PART_ImageSensor", rbox("PART_ImageSensor", 22.3, 14.9, 0.3, 0.05), "FRONT_COMPONENTS"); set_mat(sen, M["sensor"])
    sen.matrix_world = Matrix.Translation(P(mx, yf + 20.0, mz)) @ Matrix.Rotation(-math.pi / 2, 4, "X")
    pk = new_obj("BODY_SensorPackage", rbox("pkg", 30.0, 23.0, 1.0, 0.4), "FRONT_COMPONENTS"); set_mat(pk, M["chip"]); pk.matrix_world = Matrix.Translation(P(mx, yf + 20.3, mz)) @ Matrix.Rotation(-math.pi / 2, 4, "X")
    plate = new_obj("BODY_SensorPlate", lathe("plate", [(0, 0), (27.6, 0), (27.6, 1.0), (0, 1.0)], 64), "FRONT_COMPONENTS"); set_mat(plate, M["body"])
    plate.matrix_world = Matrix.Translation(P(mx, yf + 21.3, mz)) @ Matrix.Rotation(-math.pi / 2, 4, "X")
    anchor(sen, "ANCHOR_ImageSensor", P(mx, yf + 19.8, mz), fwd)
    # lens release button: rounded tab on the front face beside the mount
    lr = m["lens-release-button"]; loc, n, _ = hit("front", lr["x"], lr["z"], only=["BODY_Leatherette", "BODY_Shell"])
    tab = new_obj("PART_LensReleaseButton", prism("PART_LensReleaseButton", [(-4.0, -4.35), (3.0, -4.35), (5.0, -2.0), (5.0, 2.0), (3.0, 4.35), (-4.0, 4.35), (-5.0, 3.0), (-5.0, -3.0)], 3.6, bevel=1.2), "FRONT_COMPONENTS")
    set_mat(tab, M["button"]); orient(tab, loc - n * 0.8 * mm, n, (0, 0, 1)); motion(tab, "press", axis=-n, rng=[0, 0.001])
    anchor(tab, "ANCHOR_LensReleaseButton", loc + n * 2.8 * mm, n)
    af = m["af-lamp"]; loc, n, _ = hit("front", af["x"], af["z"])
    lamp = new_obj("PART_AfLamp", lathe("PART_AfLamp", [(0, -0.8), (2.25, -0.8), (2.25, 0.3), (1.6, 0.85), (0, 1.0)], 32), "FRONT_COMPONENTS"); set_mat(lamp, M["lamp"]); orient(lamp, loc, n, (0, 0, 1))
    anchor(lamp, "ANCHOR_AfLamp", loc + n * 1.0 * mm, n)
    # front printing (plain type, not the Canon logotype)
    printed("PRINT_FrontBrand", "front", 69.1, 76.6, body="Canon", h=4.2)
    printed("PRINT_FrontEOS", "front", 106.9, 58.6, body="EOS", h=3.2)
    # grip: anchor on the front of the covering
    loc, n, _ = hit("front", 15.0, 40.0, only=["PART_Grip"]); anchor(bpy.data.objects["PART_Grip"], "ANCHOR_Grip", loc, n)
    # body cap: no mesh (the model is shown with a lens or open); anchor sits on the mount opening
    anchor(ring, "ANCHOR_BodyCap", P(mx, yf - 2.0, mz), fwd)


def build_rear():
    m = MEAS
    # screen: glossy frame proud of the back, with the display surface the app paints the menu onto
    sc = m["screen"]; loc, n, _ = hit("rear", sc["x"], sc["z"], only=["BODY_Shell"])
    scr = new_obj("PART_Screen", rbox("PART_Screen", sc["w_frame"], sc["h_frame"], 0.9, 1.2), "LCD_ASSEMBLY"); set_mat(scr, M["screen"])
    orient(scr, P(sc["x"], 52.6, sc["z"]), Vector((0, 1, 0)), (0, 0, 1))
    disp_me = bpy.data.meshes.new("SCREEN_Display"); bm = bmesh.new(); uvl = bm.loops.layers.uv.new("UVMap")
    w, hh = sc["w_active"] * mm / 2, sc["h_active"] * mm / 2
    vs = [bm.verts.new(p) for p in ((-w, -hh, 0), (w, -hh, 0), (w, hh, 0), (-w, hh, 0))]
    f = bm.faces.new(vs)
    for l, t in zip(f.loops, ((1, 0), (0, 0), (0, 1), (1, 1))): l[uvl].uv = t  # viewed from behind: u runs toward -X
    bm.to_mesh(disp_me); bm.free()
    disp = new_obj("SCREEN_Display", disp_me, "LCD_ASSEMBLY"); set_mat(disp, M["display"])
    orient(disp, P(sc["active_center_x"], 53.52, sc["z"]), Vector((0, 1, 0)), (0, 0, 1)); parent_keep(disp, scr)
    anchor(scr, "ANCHOR_Screen", P(sc["active_center_x"], 53.5, sc["z"]), Vector((0, 1, 0)))
    up = (0, 0, 1)
    b = m["ae-lock-button"]; button("PART_AeLockButton", "rear", b["x"], b["z"], 2.6, 2.6, "REAR_CONTROLS", marking="icon_ae-lock", mark_h=2.2)
    b = m["af-point-button"]; button("PART_AfPointButton", "rear", b["x"], b["z"], 2.6, 2.6, "REAR_CONTROLS", marking="icon_af-frame-button", mark_h=2.0, mark_w=2.6)
    # magnify / index glyphs are printed on the rounded grip-side corner beside those two buttons
    printed("PRINT_Magnify", "right", 50.4, 51.5, icon="icon_magnify", h=1.7, up=(0, 0, 1))
    printed("PRINT_Index", "right", 50.4, 42.4, icon="icon_index", h=1.5, up=(0, 0, 1))
    b = m["info-button"]; button("PART_InfoButton", "rear", b["x"], b["z"], 3.3, 1.6, "REAR_CONTROLS", marking="icon_info", mark_h=1.2, mark_w=4.3)
    b = m["playback-button"]; button("PART_PlaybackButton", "rear", b["x"], b["z"], 3.3, 1.6, "REAR_CONTROLS", marking="icon_playback", mark_h=1.8)
    b = m["menu-button"]; button("PART_MenuButton", "rear", b["x"], b["z"], 3.3, 1.6, "REAR_CONTROLS", text="MENU", mark_h=1.1)
    # cross keys: one ring around Q/SET with Canon's four markings; child anchors for each press point
    ck = m["cross-keys"]; loc, n, _ = hit("rear", ck["x"], ck["z"])
    ring = new_obj("PART_CrossKeys", lathe("PART_CrossKeys", [(3.1, -1.0), (9.2, -1.0), (9.2, 0.8), (8.8, 1.25), (6.0, 1.45), (3.4, 1.3), (3.1, 1.0)], 96), "REAR_CONTROLS")
    set_mat(ring, M["button"]); orient(ring, loc, n, up); motion(ring, "tilt", axis=None, rng=[0, 0.12])
    bez = new_obj("BODY_CrossKeysBezel", lathe("ckbez", [(9.4, -0.6), (10.2, -0.6), (10.2, 0.2), (9.7, 0.5), (9.4, 0.45)], 96), "REAR_CONTROLS"); set_mat(bez, M["body"]); orient(bez, loc, n, up)
    xr = Vector((-1, 0, 0))  # from behind, the user's right is -X
    marks = {"up": [("icon_exp-com", -1.1, 5.9, 1.6), ("icon_erase", 1.2, 5.9, 1.6)], "down": [("icon_continuous-shooting", -1.2, -5.9, 1.5), ("icon_Self_timer", 1.2, -5.9, 1.6)],
             "left": [("TXT:ISO", -6.0, 0, 1.2)], "right": [("icon_flash", 6.0, 0, 1.8)]}
    for d, lst in marks.items():
        for (ic, dx, dz, hh) in lst:
            pt = loc + xr * dx * mm + Vector((0, 0, dz * mm)) + n * 1.47 * mm
            me = text_mesh("CK_" + d, ic[4:], hh) if ic.startswith("TXT:") else svg_mesh("CK_" + d, ic, hh)
            ob = new_obj("PART_CrossKeys_Mark_" + d, me, "MATERIAL_DETAILS"); set_mat(ob, M["print"]); orient(ob, pt, n, up)
            parent_keep(ob, ring)
    anchor(ring, "ANCHOR_CrossKeys", loc + n * 1.45 * mm + Vector((0, 0, 7.2 * mm)), n)
    for d, v in (("Up", Vector((0, 0, 1))), ("Down", Vector((0, 0, -1))), ("Left", -xr), ("Right", xr)):
        anchor(ring, "ANCHOR_CrossKeys_" + d, loc + n * 1.45 * mm + v * 6.2 * mm, n)
    setb = new_obj("PART_QuickControlSet", lathe("PART_QuickControlSet", [(0, -1), (2.8, -1), (2.8, 1.5), (2.5, 1.85), (0, 1.95)], 48), "REAR_CONTROLS")
    set_mat(setb, M["button"]); orient(setb, loc, n, up); motion(setb, "press", axis=-n, rng=[0, 0.0005])
    for txt, dz, hh in (("Q", 0.85, 1.0), ("SET", -0.75, 0.8)):
        ob = new_obj("PART_QuickControlSet_Mark" + txt, text_mesh("QS" + txt, txt, hh), "MATERIAL_DETAILS"); set_mat(ob, M["print"])
        orient(ob, loc + n * 1.97 * mm + Vector((0, 0, dz * mm)), n, up); parent_keep(ob, setb)
    anchor(setb, "ANCHOR_QuickControlSet", loc + n * 1.95 * mm, n)
    al = m["access-lamp"]; loc, n, _ = hit("rear", al["x"], al["z"])
    lamp = new_obj("PART_AccessLamp", lathe("PART_AccessLamp", [(0, -0.5), (0.75, -0.5), (0.75, 0.15), (0, 0.2)], 16), "REAR_CONTROLS"); set_mat(lamp, M["lamp"]); orient(lamp, loc, n, up)
    anchor(lamp, "ANCHOR_AccessLamp", loc, n)
    loc, n, _ = hit("rear", 15.0, 40.0, only=["BODY_ThumbRest"]); anchor(bpy.data.objects["BODY_ThumbRest"], "ANCHOR_ThumbRest", loc, n)


def build_viewfinder():
    m = MEAS; ey = bpy.data.objects["PART_Eyecup"]
    loc, n, _ = hit("rear", 82.0, 70.0, only=["PART_Eyecup"]); anchor(ey, "ANCHOR_Eyecup", loc, n)
    # eyepiece window: dark recess frame in the eyecup with the coated glass and the eye sensor beside it
    ep = m["viewfinder-eyepiece"]; yb = max(v.co.y for v in ey.data.vertices) / mm + OFF[1]
    well = new_obj("BODY_EyepieceWell", rbox("well", 19.5, 13.8, 6.0, 1.6), "VIEWFINDER"); set_mat(well, M["chip"])
    orient(well, P(67.4, yb - 5.6, 69.0), Vector((0, 1, 0)), (0, 0, 1))
    gl = new_obj("PART_ViewfinderEyepiece", rbox("PART_ViewfinderEyepiece", ep["w"], ep["h"], 0.6, 0.6), "VIEWFINDER"); set_mat(gl, M["glass"])
    orient(gl, P(ep["x"], yb + 0.42, ep["z"]), Vector((0, 1, 0)), (0, 0, 1)); anchor(gl, "ANCHOR_ViewfinderEyepiece", P(ep["x"], yb + 1.0, ep["z"]), Vector((0, 1, 0)))
    vs = m["viewfinder-sensor"]
    sen = new_obj("PART_ViewfinderSensor", rbox("PART_ViewfinderSensor", vs["w"], vs["h"], 0.5, 0.4), "VIEWFINDER"); set_mat(sen, M["gloss"])
    orient(sen, P(vs["x"], yb + 0.42, vs["z"]), Vector((0, 1, 0)), (0, 0, 1)); anchor(sen, "ANCHOR_ViewfinderSensor", P(vs["x"], yb + 0.9, vs["z"]), Vector((0, 1, 0)))
    # dioptric adjustment slider under the viewfinder housing
    da = m["dioptric-adjustment-slider"]
    loc, n, _ = hit("bottom", da["x"], 56.0, start=P(da["x"], 56.0, 40.0))
    sl = new_obj("PART_DioptricAdjustmentSlider", rbox("PART_DioptricAdjustmentSlider", 6.0, 2.8, 1.1, 0.4), "VIEWFINDER"); set_mat(sl, M["knurl"])
    orient(sl, loc, n, (0, 1, 0)); motion(sl, "slide", axis=(1, 0, 0), rng=[-0.0025, 0.0025])
    anchor(sl, "ANCHOR_DioptricAdjustmentSlider", loc + n * 1.1 * mm, n)


def build_flash():
    fl = bpy.data.objects["PART_BuiltInFlash"]
    zs = [v.co.z for v in fl.data.vertices]; ys = [v.co.y for v in fl.data.vertices]
    hinge = Vector((P(69.2, 0, 0).x, max(ys) - 0.8 * mm, max(zs) - 1.2 * mm))
    pivot_to(fl, hinge); motion(fl, "hinge", axis=(1, 0, 0), rng=[0, 0.95], open=0.95)
    loc, n, _ = hit("front", 69.2, 80.0, only=["PART_BuiltInFlash"])
    win = new_obj("PART_BuiltInFlash_Window", rbox("flashwin", 24.0, 2.6, 0.12, 0.4), "BUILT_IN_FLASH"); set_mat(win, M["flashwin"])
    orient(win, loc - n * 0.08 * mm, n, (0, 0, 1)); parent_keep(win, fl)
    loc, n, _ = hit("top", 69.2, 18.0, only=["PART_BuiltInFlash"]); anchor(fl, "ANCHOR_BuiltInFlash", loc, n)


def build_sides():
    m = MEAS
    # covers hinge at their front edge; ports sit in the shell beneath
    for name, face, (ya, za), hinge_y in (("PART_TerminalCoverRight", "right", (38.0, 38.0), 30.4), ("PART_TerminalCoverLeft", "left", (33.0, 47.0), 28.4), ("PART_TerminalCoverLeftRemote", "left", (40.0, 36.0), 37.8)):
        ob = bpy.data.objects[name]; loc, n, _ = hit(face, ya, za, only=[name])
        pivot_to(ob, Vector((loc.x, P(0, hinge_y, 0).y, loc.z)))
        motion(ob, "hinge", axis=(0, 0, 1 if face == "right" else -1), rng=[0, 1.6], open=1.6)
        if name != "PART_TerminalCoverLeftRemote": anchor(ob, "ANCHOR_" + name[5:], loc, n)
    # cover markings (embossed): USB + HDMI on the grip side, MIC on the mic side
    rc = bpy.data.objects["PART_TerminalCoverRight"]
    loc, n, _ = hit("right", 36.6, 44.5, only=["PART_TerminalCoverRight"])
    printed("PRINT_CoverUSB", None, 0, 0, icon="icon_terminal_digi", h=3.0, up=(0, -1, 0), m="print_dark", parent=rc, at=loc, nrm=n, lift=0.05)
    loc, n, _ = hit("right", 36.6, 30.5, only=["PART_TerminalCoverRight"])
    printed("PRINT_CoverHDMI", None, 0, 0, body="HDMI", h=2.0, up=(0, -1, 0), m="print_dark", parent=rc, at=loc, nrm=n, lift=0.05)
    lc = bpy.data.objects["PART_TerminalCoverLeft"]; loc, n, _ = hit("left", 33.0, 51.5, only=["PART_TerminalCoverLeft"])
    printed("PRINT_CoverMIC", None, 0, 0, body="MIC", h=2.6, up=(0, 0, 1), m="print_dark", parent=lc, at=loc, nrm=n, lift=0.05)
    # sockets (USB-C, HDMI D, MIC, remote) are modelled in build_details.py, in the port bays carved by tools/hull.py
    dc = m["dc-cord-hole"]; loc, n, _ = hit("right", dc["y"], dc["z"], only=["BODY_Shell"])
    hole = new_obj("PART_DcCordHole", rbox("PART_DcCordHole", 4.0, 2.0, 0.3, 0.6), "SIDE_PORTS"); set_mat(hole, M["chip"]); orient(hole, loc - n * 0.2 * mm, n, (0, 0, 1))
    anchor(hole, "ANCHOR_DcCordHole", loc, n)
    # strap mounts: slot housing with a metal bar
    for name, face, y, z in (("PART_StrapMountRight", "right", m["strap-mount-right"]["y"], m["strap-mount-right"]["z"]), ("PART_StrapMountLeft", "left", m["strap-mount-left"]["y"], m["strap-mount-left"]["z"])):
        loc, n, _ = hit(face, y, z)
        hous = new_obj(name, prism(name, [(-4.6, -1.9), (4.6, -1.9), (5.2, 0), (4.6, 1.9), (-4.6, 1.9), (-5.2, 0)], 2.0, bevel=0.8), "CAMERA_BODY"); set_mat(hous, M["body"])
        orient(hous, loc - n * 0.6 * mm, n, (0, 0, 1))
        bar = new_obj(name + "_Bar", lathe("bar", [(0, -3.6), (0.7, -3.6), (0.7, 3.6), (0, 3.6)], 16), "CAMERA_BODY"); set_mat(bar, M["shoe"])
        bar.matrix_world = Matrix.Translation(loc + n * 1.1 * mm) @ Matrix.Rotation(math.pi / 2, 4, "X"); parent_keep(bar, hous)
        anchor(hous, "ANCHOR_" + name[5:], loc + n * 1.4 * mm, n)


def build_bottom():
    m = MEAS
    tp = m["tripod-socket"]; loc, n, _ = hit("bottom", tp["x"], tp["y"])
    sock = new_obj("PART_TripodSocket", lathe("PART_TripodSocket", [(3.17, -6.0), (3.17, 0.05), (4.6, 0.05), (4.6, -0.3), (5.4, -0.3), (5.4, 0.0)], 48), "TRIPOD_MOUNT"); set_mat(sock, M["alu"])
    orient(sock, loc, n, (0, 1, 0))
    hole = new_obj("BODY_TripodHole", lathe("thole", [(0, -6.0), (3.1, -6.0), (3.1, 0.0), (0, 0.0)], 32), "TRIPOD_MOUNT"); set_mat(hole, M["chip"]); orient(hole, loc - n * 0.05 * mm, n, (0, 1, 0))
    anchor(sock, "ANCHOR_TripodSocket", loc, n)
    door = bpy.data.objects["PART_CardBatteryCover"]
    xs = [v.co.x for v in door.data.vertices]; zs = [v.co.z for v in door.data.vertices]
    pivot_to(door, Vector((max(xs) - 0.6 * mm, P(0, 30.0, 0).y, min(zs) + 0.6 * mm)))
    motion(door, "hinge", axis=(0, 1, 0), rng=[0, -1.55], open=-1.55)
    loc, n, _ = hit("bottom", 33.0, 30.0, only=["PART_CardBatteryCover"]); anchor(door, "ANCHOR_CardBatteryCover", loc, n)
    lk = m["card-battery-cover-lock"]; loc, n, _ = hit("bottom", lk["x"], lk["y"], only=["PART_CardBatteryCover"])
    lock = new_obj("PART_CardBatteryCoverLock", rbox("PART_CardBatteryCoverLock", 4.6, 9.0, 1.0, 0.8), "BATTERY_COMPARTMENT"); set_mat(lock, M["knurl"])
    orient(lock, loc, n, (0, 1, 0)); parent_keep(lock, door); motion(lock, "slide", axis=(1, 0, 0), rng=[0, 0.002])
    anchor(lock, "ANCHOR_CardBatteryCoverLock", loc + n * 1.0 * mm, n)
    for txt, x, y, h in (("OPEN", 29.0, 28.3, 1.6), ("LOCK", 12.0, 28.3, 1.6), ("CARD/BATT.", 22.0, 36.0, 1.6)):
        loc, n, _ = hit("bottom", x, y, only=["PART_CardBatteryCover"])
        printed("PRINT_Door" + txt[:4], None, 0, 0, body=txt, h=h, up=(0, 1, 0), m="print_dark", parent=door, at=loc, nrm=n, lift=0.05)
    # serial-number label area
    sn = m["serial-number"]; cx, cy = sum(sn["x"]) / 2, sum(sn["y"]) / 2
    loc, n, _ = hit("bottom", cx, cy)
    lab = new_obj("PART_SerialNumber", rbox("PART_SerialNumber", sn["x"][1] - sn["x"][0], sn["y"][1] - sn["y"][0], 0.08, 0.8), "BATTERY_COMPARTMENT"); set_mat(lab, M["label"]); orient(lab, loc, n, (0, 1, 0))
    wl = new_obj("PART_SerialNumber_Panel", rbox("snpanel", 19.5, 2.6, 0.03, 0.1), "MATERIAL_DETAILS"); set_mat(wl, M["print"])
    orient(wl, loc + n * 0.09 * mm + Vector((0, -2.6 * mm, 0)), n, (0, 1, 0)); parent_keep(wl, lab)
    anchor(lab, "ANCHOR_SerialNumber", loc, n)
    for (px, py) in ((68, 320), (495, 503), (683, 503), (495, 567), (683, 567), (916, 567)):  # bottom screws (bottom photo, preview px)
        x = px * 0.1181; y = (py - 216) * 0.1176
        loc, n, _ = hit("bottom", x, y)
        s = new_obj("BODY_Screw", lathe("screw", [(0, 0.1), (0.95, 0.05), (1.0, -0.1), (0, -0.1)], 16), "MATERIAL_DETAILS"); set_mat(s, M["steel"]); orient(s, loc, n, (0, 1, 0))


def build_internal():
    m = MEAS; mx, mz = 69.3, 34.9
    sh = new_obj("PART_Shutter", prism("PART_Shutter", [(-17, -13), (17, -13), (17, 13), (-17, 13)], 1.2), "INTERNAL_EDUCATIONAL"); set_mat(sh, M["chip"])
    bm = bmesh.new(); bm.from_mesh(sh.data)  # open frame: cut the 24 x 16 mm aperture so the sensor shows through
    bmesh.ops.delete(bm, geom=[f for f in bm.faces], context="FACES")
    for (x0, x1, y0, y1) in ((-17, 17, 8.2, 13), (-17, 17, -13, -8.2), (-17, -12.2, -8.2, 8.2), (12.2, 17, -8.2, 8.2)):
        bmesh.ops.create_cube(bm, size=1.0, matrix=Matrix.Translation(Vector(((x0 + x1) / 2, (y0 + y1) / 2, 0.6)) * mm) @ Matrix.Diagonal(((x1 - x0) * mm, (y1 - y0) * mm, 1.2 * mm, 1)))
    bm.to_mesh(sh.data); bm.free()
    sh.matrix_world = Matrix.Translation(P(mx, 29.8, mz)) @ Matrix.Rotation(-math.pi / 2, 4, "X")
    for k, dz in ((1, 16.5), (2, -16.5)):  # curtains parked above and below the opening
        cu = new_obj("PART_Shutter_Curtain%d" % k, rbox("curtain", 25.0, 16.5, 0.15, 0.1), "INTERNAL_EDUCATIONAL"); set_mat(cu, M["steel"])
        cu.matrix_world = Matrix.Translation(P(mx, 30.5, mz + dz)) @ Matrix.Rotation(-math.pi / 2, 4, "X")
        parent_keep(cu, sh); motion(cu, "slide", axis=(0, 0, 1), rng=[-0.0165, 0.0165])
    anchor(sh, "ANCHOR_Shutter", P(mx, 29.2, mz + 10.0), Vector((0, -1, 0)))
    pcb = new_obj("PART_Processor", rbox("PART_Processor", 80.0, 54.0, 1.2, 1.0), "INTERNAL_EDUCATIONAL"); set_mat(pcb, M["pcb"])
    pcb.matrix_world = Matrix.Translation(P(66.0, 44.5, 34.0)) @ Matrix.Rotation(-math.pi / 2, 4, "X")
    chip = new_obj("PART_Processor_Chip", rbox("chip", 14.0, 14.0, 1.4, 0.4), "INTERNAL_EDUCATIONAL"); set_mat(chip, M["chip"])
    chip.matrix_world = Matrix.Translation(P(52.0, 45.7, 40.0)) @ Matrix.Rotation(-math.pi / 2, 4, "X"); parent_keep(chip, pcb)
    anchor(pcb, "ANCHOR_Processor", P(52.0, 46.0, 40.0), Vector((0, 1, 0)))
    # the LP-E17 battery and SD card are full models in build_details.py
    for o in COL["INTERNAL_EDUCATIONAL"].objects: o["ff_educational"] = True


def make_anchors():
    for name, par, loc, n in ANCH:
        e = bpy.data.objects.new(name, None); e.empty_display_type = "SPHERE"; e.empty_display_size = 0.0008
        COL["INTERACTION_ANCHORS"].objects.link(e)
        e.matrix_world = Matrix.Translation(loc) @ n.to_track_quat("Z", "Y").to_matrix().to_4x4()
        parent_keep(e, par)
        e["ff_normal"] = three_axis(n)


build_top(); build_front(); build_rear(); build_viewfinder(); build_flash(); build_sides(); build_bottom(); build_internal()
sys.path.insert(0, HERE)
import build_details
DETAILS = build_details.build(dict(P=P, M=M, COL=COL, new_obj=new_obj, set_mat=set_mat, orient=orient, hit=hit, anchor=anchor, motion=motion, rbox=rbox,
                                   prism=prism, lathe=lathe, text_mesh=text_mesh, svg_mesh=svg_mesh, parent_keep=parent_keep, finish=finish, MEAS=MEAS))

# hierarchy: everything under one body root so the app can move the camera as a unit
root = bpy.data.objects.new("R100_Body", None); COL["CAMERA_BODY"].objects.link(root)
bpy.context.view_layer.update()
for o in list(bpy.data.objects):
    if o is root or o.parent or o.type == "CAMERA" or o.name.startswith("LENS_") or o.name.startswith("R100_Lens") or o.name.startswith("R100_Speedlite"): continue
    mw = o.matrix_world.copy(); o.parent = root; o.matrix_world = mw
root["ff_profile"] = "canon-eos-r100"; root["ff_units"] = "meters"
root["ff_source"] = "Visual hull of the Canon EOS R100 product photos + measured part positions (blender/eos-r100). Hand-built, not a scan."
make_anchors()

sys.path.insert(0, HERE)
import build_lens
build_lens.build(COL, M, mat, lathe, rbox, text_mesh, new_obj, set_mat, motion, anchor_fn=lambda *a: None)
make_anchors_lens = getattr(build_lens, "ANCH", [])
for name, par, loc, n in make_anchors_lens:
    e = bpy.data.objects.new(name, None); e.empty_display_type = "SPHERE"; e.empty_display_size = 0.0008
    COL["INTERACTION_ANCHORS"].objects.link(e)
    e.matrix_world = Matrix.Translation(loc) @ n.to_track_quat("Z", "Y").to_matrix().to_4x4(); parent_keep(e, par)
    e["ff_normal"] = three_axis(n)

# the other shelf lenses (Canon photo profiles), each under its own R100_Lens_<id> root
import build_lenses
build_lenses.build(COL, M, lathe, text_mesh, new_obj, set_mat, motion, build_lens.wrap_text, HERE)
for name, par, loc, n in build_lenses.ANCH:
    e = bpy.data.objects.new(name, None); e.empty_display_type = "SPHERE"; e.empty_display_size = 0.0008
    COL["INTERACTION_ANCHORS"].objects.link(e)
    e.matrix_world = Matrix.Translation(loc) @ n.to_track_quat("Z", "Y").to_matrix().to_4x4(); parent_keep(e, par)
    e["ff_normal"] = three_axis(n); e.hide_render = True

for o in bpy.data.objects:
    if o.type == "CAMERA": bpy.data.objects.remove(o)
out = os.path.join(HERE, "Canon_EOS_R100.blend")
bpy.ops.wm.save_as_mainfile(filepath=out, compress=True)
tris = sum(sum(len(p.vertices) - 2 for p in o.data.polygons) for o in bpy.data.objects if o.type == "MESH")
print("BUILT", out, "objects", len(bpy.data.objects), "anchors", len([o for o in bpy.data.objects if o.name.startswith("ANCHOR_")]), "tris", tris)
