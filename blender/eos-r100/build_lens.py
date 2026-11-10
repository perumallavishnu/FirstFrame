"""RF-S 18-45mm F4.5-6.3 IS STM kit lens, modelled from the four Canon gallery photos
(assets/models/canon-eos-r100/reference/lens_rf-s_18-45). Called by build_r100.py.

Canon spec: 69.0 mm diameter, 44.3 mm long (retracted, mount flange to front), 49 mm filter.
Measured from the side photo at 0.117 mm/px (t = mm forward of the mount flange):
  bayonet t -6.9..0 r 26.3 | base flare r 34.5 -> 31.0 at t 0..4.4 with the red mount index | fixed barrel r 31.0 to t 14.6
  zoom ring r 30.7 t 14.8..31.0 (numbers band to 18.7, ribs above) | control ring r 31.0 knurled t 32.2..38.6
  inner barrel: front lip r 26.3 to t 43.3, tube r 28.9 behind it, extends about 34 mm when unparked (photo 04)
Lens local frame: +Z = forward along the optical axis, +Y = top (the mount index), units mm in the profiles.
"""
import bpy, bmesh, math
from mathutils import Vector, Matrix

ANCH = []
mm = 0.001
TAU = math.tau


def _P(x, y, z):
    return Vector(((x - 58.15) / 1000, (y - 34.4) / 1000, (z - 42.75) / 1000))


def wrap_text(text_mesh, name, body, size, R, t0, ang0_deg, depth=0.04):
    """flat text (x = arc, y = axial) wrapped onto a cylinder of radius R (mm) about local Z, centred on ang0, at t0"""
    me = text_mesh(name, body, size, depth)
    a0 = math.radians(ang0_deg)
    for v in me.vertices:
        x, y, z = v.co.x / mm, v.co.y / mm, v.co.z / mm
        a = a0 + x / R; rr = R + 0.02 + z
        v.co = Vector((rr * math.cos(a) * mm, rr * math.sin(a) * mm, (t0 + y) * mm))
    return me


def build(COL, M, mat, lathe, rbox, text_mesh, new_obj, set_mat, motion, anchor_fn=None):
    c = _P(69.3, 11.6, 34.9)
    root = bpy.data.objects.new("R100_Lens_Kit", None); COL["LENS_ASSEMBLY"].objects.link(root)
    root.matrix_world = Matrix.Translation(c) @ Matrix.Rotation(math.pi / 2, 4, "X")  # local +Z -> world -Y (forward), +Y -> up
    root["ff_lens"] = "kit"; root["ff_name"] = "RF-S 18-45mm F4.5-6.3 IS STM"
    root["ff_axis"] = [0.0, 0.0, 1.0]  # Three.js: forward
    root["ff_mount_twist"] = 1.05      # radians turned to lock / unlock

    def child(name, me, m, coll="LENS_ASSEMBLY", parent=root):
        ob = new_obj(name, me, coll); set_mat(ob, M[m] if isinstance(m, str) else m)
        ob.parent = parent; ob.matrix_parent_inverse = Matrix.Identity(4); return ob

    def world(local_mm):
        return root.matrix_world @ Vector([v * mm for v in local_mm])

    def wdir(local):
        return (root.matrix_world.to_3x3() @ Vector(local)).normalized()

    # bayonet (metal) with three tabs, and a black rear cap ring
    bay = child("LENS_Bayonet", lathe("LENS_Bayonet", [(23.6, -6.9), (26.3, -6.9), (26.3, 0.0), (23.6, 0.0)], 96), "alu")
    for k, a0 in enumerate((40, 160, 280)):
        me = lathe("tab", [(26.2, -5.6), (28.4, -5.6), (28.4, -4.5), (26.2, -4.5)], 96)
        bm = bmesh.new(); bm.from_mesh(me)
        dels = [v for v in bm.verts if not (math.radians(a0) <= (math.atan2(v.co.y, v.co.x) % TAU) <= math.radians(a0 + 50))]
        bmesh.ops.delete(bm, geom=dels, context="VERTS"); bm.to_mesh(me); bm.free()
        child("LENS_Bayonet_Tab%d" % k, me, "alu", parent=bay)
    cts = bpy.data.meshes.new("LENS_Contacts"); bm = bmesh.new()
    for i in range(12):
        a = math.radians(-118 + (i / 11) * 63)
        bmesh.ops.create_cube(bm, size=1.0, matrix=Matrix.Translation(Vector((math.cos(a) * 22.8, math.sin(a) * 22.8, -6.2)) * mm) @ Matrix.Diagonal((0.9 * mm, 0.9 * mm, 0.4 * mm, 1)))
    bm.to_mesh(cts); bm.free(); child("LENS_Contacts", cts, "gold", parent=bay)

    # fixed barrel: flare with the mount index, the printed section, and the core under the rings
    bar = child("LENS_Barrel", lathe("LENS_Barrel", [(23.6, 0.0), (34.5, 0.0), (34.5, 1.5), (33.9, 2.3), (31.6, 3.9), (31.0, 4.5), (31.0, 14.6),
                                                     (30.2, 14.8), (30.2, 38.4), (29.5, 38.6), (29.5, 30.0), (24.0, 30.0), (23.6, 0.0)], 128), "body")
    child("LENS_TrimRing", lathe("trim", [(34.52, 1.45), (34.62, 1.45), (34.62, 2.1), (34.4, 2.2)], 128), "alu", parent=bar)
    idx = child("LENS_MountIndex", lathe("lidx", [(0, 0), (0.75, 0), (0.75, 0.05), (0, 0.06)], 16), "red", parent=bar)
    idx.matrix_parent_inverse = Matrix.Identity(4)
    idx.matrix_basis = Matrix.Translation(Vector((0, 33.0, 2.9)) * mm) @ Matrix.Rotation(-math.radians(55), 4, "X")
    child("LENS_ZoomIndex", lathe("zidx", [(0, 0), (0.5, 0), (0.5, 0.05), (0, 0.06)], 12), "print", parent=bar).matrix_basis = Matrix.Translation(Vector((0, 31.03, 13.4)) * mm) @ Matrix.Rotation(-math.pi / 2, 4, "X")
    child("LENS_PrintBrand", wrap_text(text_mesh, "LENS_PrintBrand", "Canon", 2.6, 31.0, 8.6, 90), "print", parent=bar)
    child("LENS_PrintFocal", wrap_text(text_mesh, "LENS_PrintFocal", "18-45", 2.0, 31.0, 8.6, 58), "print", parent=bar)

    # zoom ring: ribbed grip plus the focal-length scale band; rotates about the axis to zoom (18 -> 45 = -55 deg)
    zr = child("LENS_ZoomRing", lathe("LENS_ZoomRing", [(30.2, 18.6), (30.7, 18.8), (30.7, 30.8), (30.2, 31.0)], 128, star=(96, 0.25), uv_rep=16), "ribs")
    band = child("LENS_ZoomScale", lathe("zband", [(30.2, 14.8), (30.6, 15.0), (30.6, 18.6), (30.2, 18.6)], 128), "body", parent=zr)
    for f, da in ((18, 0), (24, 17), (28, 28), (35, 41), (45, 55)):
        child("LENS_Scale_%d" % f, wrap_text(text_mesh, "LENS_Scale_%d" % f, str(f), 1.6, 30.6, 16.6, 90 + da), "print", parent=band)
    motion(zr, "rotate", rng=[0.0, -math.radians(55)], focal=[18, 45])
    zr["ff_axis"] = [0.0, 0.0, 1.0]

    # control (focus) ring: fine diamond knurl
    cr = child("LENS_ControlRing", lathe("LENS_ControlRing", [(30.2, 32.2), (31.0, 32.4), (31.0, 38.4), (30.2, 38.6)], 128, star=(120, 0.15), uv_rep=24), "knurl")
    motion(cr, "rotate", rng=[-TAU, TAU]); cr["ff_axis"] = [0.0, 0.0, 1.0]

    # inner barrel: slides forward ~34 mm when the lens is unparked
    ib = child("LENS_InnerBarrel", lathe("LENS_InnerBarrel", [(26.5, 6.0), (28.9, 6.0), (28.9, 38.4), (26.3, 39.0), (26.3, 43.0), (25.9, 43.3), (24.6, 43.3),
                                                               (24.6, 41.6), (16.2, 40.8), (16.2, 39.8), (26.0, 39.8), (26.5, 6.0)], 128), "body")
    motion(ib, "slide", rng=[0.0, 0.034]); ib["ff_axis"] = [0.0, 0.0, 1.0]
    fe = child("LENS_FrontElement", lathe("LENS_FrontElement", [(0, 41.3), (8.0, 41.05), (14.0, 40.3), (16.0, 39.9), (16.0, 39.4), (0, 39.4)], 64), "glass", coll="LENS_GLASS", parent=ib)

    # internal (educational): aperture diaphragm and glass groups
    ap = child("LENS_Aperture", lathe("LENS_Aperture", [(6.0, 22.0), (23.5, 22.0), (23.5, 22.5), (6.0, 22.5)], 7), "chip", coll="LENS_GLASS")
    ap["ff_educational"] = True; ap["ff_blades"] = 7
    els = bpy.data.meshes.new("LENS_Elements"); bm = bmesh.new()
    for t, r, th in ((4.0, 13.0, 2.2), (12.0, 15.5, 2.6), (27.0, 12.0, 3.0), (33.0, 14.0, 2.4)):
        bmesh.ops.create_cone(bm, cap_ends=True, segments=48, radius1=r * mm, radius2=r * mm, depth=th * mm, matrix=Matrix.Translation(Vector((0, 0, t)) * mm))
    bm.to_mesh(els); bm.free(); el = child("LENS_Elements", els, "glass", coll="LENS_GLASS"); el["ff_educational"] = True

    for o in [o for o in bpy.data.objects if o.name.startswith("LENS_") and o.type == "MESH"]:
        for p in o.data.polygons: p.use_smooth = True

    up = wdir((0, 1, 0)); fw = wdir((0, 0, 1))
    ANCH.extend([
        ("ANCHOR_Lens", bar, world((0, 31.3, 10.0)), up),
        ("ANCHOR_ZoomRing", zr, world((0, 31.0, 25.0)), up),
        ("ANCHOR_FocusRing", cr, world((0, 31.3, 35.4)), up),
        ("ANCHOR_FrontElement", fe, world((0, 0, 41.5)), fw),
        ("ANCHOR_ApertureDiaphragm", ap, world((0, 14.0, 22.6)), fw),
        ("ANCHOR_LensElements", el, world((0, 15.5, 12.0)), up),
    ])
    return root
