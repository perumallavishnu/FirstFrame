"""Shelf lenses from Canon photos: lathe models driven by lens_profiles/<id>.json and lens_bands.json.
Called by build_r100.py after the kit lens. Each lens gets its own root R100_Lens_<id> at the mount (hidden in Blender
renders; the app shows one lens at a time) with objects named <Kind>__<id>:
  LENS_Bayonet, LENS_Trim, LENS_Barrel (fixed), LENS_ZoomRing (+ LENS_ZoomScale with focal marks), LENS_FocusRing (ribbed
  focus ring on primes), LENS_ControlRing (knurled), LENS_InnerBarrel (slides forward to zoom), LENS_FrontElement,
  LENS_Aperture, LENS_Elements, and ANCHOR_<Part>__<id> for each lens part in the camera profile.
Lens local frame: +Z forward along the optical axis, +Y = top (mount index), profile units mm.
"""
import bpy, bmesh, json, math, os
from mathutils import Vector, Matrix

mm = 0.001
ANCH = []


def _P(x, y, z):
    return Vector(((x - 58.15) / 1000, (y - 34.4) / 1000, (z - 42.75) / 1000))


def profile_rows(here, spec):
    """[(t, r)] mount->front, every 0.5 mm, scaled so the widest point matches Canon's diameter"""
    if "synthetic" in spec: pts = spec["synthetic"]
    else:
        j = json.load(open(os.path.join(here, "lens_profiles", spec["profile"] + ".json")))
        rows = j["rows"]; rmax = max(r[1] for r in rows); k = (spec["dia"] / 2) / rmax
        pts = [(r[0], r[1] * k) for r in rows]
    out, t = [], pts[0][0]
    while t <= pts[-1][0]:
        lo = max([p for p in pts if p[0] <= t], key=lambda p: p[0]); hi = min([p for p in pts if p[0] >= t], key=lambda p: p[0])
        r = lo[1] if hi[0] == lo[0] else lo[1] + (hi[1] - lo[1]) * (t - lo[0]) / (hi[0] - lo[0])
        out.append((round(t, 2), r)); t += 0.5
    # light smoothing (photo edge noise) while keeping steps sharper than 0.6 mm
    sm = [out[0]]
    for i in range(1, len(out) - 1):
        a, b, c = out[i - 1][1], out[i][1], out[i + 1][1]
        sm.append((out[i][0], b if abs(a - c) > 0.6 else (a + 2 * b + c) / 4))
    sm.append(out[-1])
    return sm


def rdp(pts, eps):
    """Ramer-Douglas-Peucker simplification of a (r, t) polyline"""
    if len(pts) < 3: return pts
    (x0, y0), (x1, y1) = pts[0], pts[-1]; L = math.hypot(x1 - x0, y1 - y0) or 1e-9
    d = [abs((y1 - y0) * x - (x1 - x0) * y + x1 * y0 - y1 * x0) / L for (x, y) in pts]
    i = max(range(1, len(pts) - 1), key=lambda k: d[k])
    if d[i] <= eps: return [pts[0], pts[-1]]
    return rdp(pts[:i + 1], eps)[:-1] + rdp(pts[i:], eps)


def build(COL, M, lathe, text_mesh, new_obj, set_mat, motion, wrap_text, here):
    spec_all = json.load(open(os.path.join(here, "lens_bands.json")))
    roots = []
    for lid, spec in spec_all.items():
        if lid.startswith("_"): continue
        prof = profile_rows(here, spec)
        root = bpy.data.objects.new("R100_Lens_" + lid, None); COL["LENS_ASSEMBLY"].objects.link(root)
        root.matrix_world = Matrix.Translation(_P(69.3, 11.6, 34.9)) @ Matrix.Rotation(math.pi / 2, 4, "X")
        root["ff_lens"] = lid; root["ff_name"] = spec["name"]; root["ff_dims_source"] = spec.get("dims_src", "")
        root["ff_approximate"] = bool(spec.get("approximate")); root["ff_mount_twist"] = 1.05
        S = lambda base: base + "__" + lid

        def obj(name, me, m, parent=root, coll="LENS_ASSEMBLY"):
            ob = new_obj(name, me, coll); set_mat(ob, M[m]); ob.parent = parent; ob.matrix_parent_inverse = Matrix.Identity(4)
            for p in ob.data.polygons: p.use_smooth = True
            return ob

        def seg(t0, t1, inset=0.0, star=None, rep=1):
            def r_at(t):  # radius interpolated at an exact t, so neighbouring bands share their boundary ring
                t = min(max(t, prof[0][0]), prof[-1][0])
                for (ta, ra), (tb, rb) in zip(prof, prof[1:]):
                    if ta <= t <= tb: return ra if tb == ta else ra + (rb - ra) * (t - ta) / (tb - ta)
                return prof[-1][1]
            a, b = max(t0, prof[0][0]), min(t1, prof[-1][0])
            pts = [(r_at(a) - inset, a)] + [(r - inset, t) for (t, r) in prof if a + 1e-6 < t < b - 1e-6] + [(r_at(b) - inset, b)]
            return rdp(pts, 0.06)  # drop points that don't change the outline by more than 0.06 mm

        zoom = None; ext = spec.get("ext", 0) / 1000.0
        parts = {"lens": None, "zoom": None, "focus": None, "front": None}
        bands = spec["bands"]
        for i, (kind, t0, t1) in enumerate(bands):
            pts = seg(t0, t1)
            if kind == "metal" and t1 <= 0.01 or (kind == "metal" and t0 < 0 and t1 > 0):
                # split: bayonet below the flange, trim ring above
                below = [p for p in pts if p[1] <= 0]; above = [p for p in pts if p[1] >= 0]
                if len(below) > 1: obj(S("LENS_Bayonet"), lathe(S("LENS_Bayonet"), [(below[0][0] - 2.5, below[0][1])] + below + [(below[-1][0] - 2.5, below[-1][1])], 96), "alu")
                if len(above) > 1: obj(S("LENS_Trim"), lathe(S("LENS_Trim"), above, 96), "alu")
                continue
            if kind == "metal": obj(S("LENS_Trim") + "_%d" % i, lathe("trim", pts, 96), "alu"); continue
            if kind == "body":
                o = obj(S("LENS_Barrel") if parts["lens"] is None else S("LENS_Barrel") + "_%d" % i, lathe("barrel", pts, 96), "body")
                parts["lens"] = parts["lens"] or (o, (t0 + t1) / 2, max(p[0] for p in pts)); continue
            if kind == "zoom":
                nm = S("LENS_FocusRing") if spec.get("zoom_is_focus") else S("LENS_ZoomRing")
                z = obj(nm, lathe(nm, pts, 96, uv_rep=18), "ribs")
                if not spec.get("zoom_is_focus"):
                    zoom = z; parts["zoom"] = (z, (t0 + t1) / 2, max(p[0] for p in pts))
                    marks = spec.get("scale", {}).get("marks", [])
                    motion(z, "rotate", rng=[0.0, -math.radians(marks[-1][1]) if marks else -1.0]); z["ff_axis"] = [0.0, 0.0, 1.0]
                    if marks: z["ff_focal"] = [marks[0][0], marks[-1][0]]
                else: parts["focus"] = parts["focus"] or (z, (t0 + t1) / 2, max(p[0] for p in pts))
                continue
            if kind == "focus":
                c = obj(S("LENS_ControlRing"), lathe(S("LENS_ControlRing"), pts, 96, uv_rep=26), "knurl")
                motion(c, "rotate", rng=[-math.tau, math.tau]); c["ff_axis"] = [0.0, 0.0, 1.0]
                parts["focus"] = (c, (t0 + t1) / 2, max(p[0] for p in pts)); continue
            if kind == "inner":
                rf = pts[-1][0]; rt = max(p[0] for p in pts)
                # the visible front barrel plus a hidden tube behind it that emerges as the lens zooms out
                tube = [(rt - 0.6, t0 - max(10.0, ext * 1000 + 4)), (rt - 0.6, t0)] + pts
                ib = obj(S("LENS_InnerBarrel"), lathe(S("LENS_InnerBarrel"), tube, 96), "body")
                motion(ib, "slide", rng=[0.0, ext]); ib["ff_axis"] = [0.0, 0.0, 1.0]
                parts["inner"] = ib
        # front: bezel annulus and recessed coated glass, inside the frontmost object
        tf, rf = prof[-1][0], prof[-1][1]; rg = rf * spec.get("glass_r", 0.5) / 0.5 * 0.5 * 1.0
        rg = rf * spec.get("glass_r", 0.5)
        front_parent = parts.get("inner") or root
        obj(S("LENS_FrontBezel"), lathe("bezel", [(rf - 0.4, tf), (rg + 1.0, tf - 1.2), (rg + 0.6, tf - 2.6)], 96), "body", parent=front_parent)
        dome = [(0, tf - 2.2), (rg * 0.6, tf - 2.45), (rg, tf - 3.0), (rg, tf - 3.6), (0, tf - 3.6)]
        fe = obj(S("LENS_FrontElement"), lathe(S("LENS_FrontElement"), dome, 64), "glass", parent=front_parent, coll="LENS_GLASS")
        parts["front"] = (fe, tf - 2.2)
        # internal (educational): aperture and element groups
        ta = tf * 0.45; ra = max(prof, key=lambda p: p[1])[1] * 0.62
        ap = obj(S("LENS_Aperture"), lathe(S("LENS_Aperture"), [(ra * 0.3, ta), (ra, ta), (ra, ta + 0.5), (ra * 0.3, ta + 0.5)], 7), "chip", coll="LENS_GLASS")
        ap["ff_educational"] = True; ap["ff_blades"] = 9 if lid == "p85" else 7
        els = bpy.data.meshes.new(S("LENS_Elements")); bm = bmesh.new()
        n = max(3, min(7, int(tf / 12) + 2))
        for k in range(n):
            t = 2 + (tf - 6) * k / (n - 1); r = ra * (0.75 + 0.3 * k / (n - 1))
            bmesh.ops.create_cone(bm, cap_ends=True, segments=40, radius1=r * mm, radius2=r * mm, depth=2.2 * mm, matrix=Matrix.Translation(Vector((0, 0, t)) * mm))
        bm.to_mesh(els); bm.free()
        el = obj(S("LENS_Elements"), els, "glass", coll="LENS_GLASS"); el["ff_educational"] = True
        # printing on the fixed barrel, focal marks on the zoom ring scale band
        for text, t, ang, h in spec.get("prints", []):
            r = next((rr for (tt, rr) in prof if tt >= t), prof[-1][1])
            obj(S("LENS_Print") + "_%s" % text[:6].replace(" ", ""), wrap_text(text_mesh, "lp", text, h, r, t, ang), "print")
        sc = spec.get("scale")
        if sc and zoom is not None:
            r = next((rr for (tt, rr) in prof if tt >= sc["t"]), prof[-1][1])
            for f, da in sc["marks"]:
                obj(S("LENS_Scale") + "_%d" % f, wrap_text(text_mesh, "ls", str(f), 1.6, r + 0.05, sc["t"], 90 + da), "print", parent=zoom)
            idx_t = sc["t"] - 2.4; r2 = next((rr for (tt, rr) in prof if tt >= idx_t), prof[-1][1])
            obj(S("LENS_ZoomIndex"), wrap_text(text_mesh, "zi", "•", 1.2, r2, idx_t, 90), "print")
        # red mount index on the base, at the top
        tb = 2.0; rb = next((rr for (tt, rr) in prof if tt >= tb), prof[-1][1])
        obj(S("LENS_MountIndex"), wrap_text(text_mesh, "mi", "●", 1.3, rb, tb, 90), "red")

        # anchors (lens-root local mm -> world)
        W = lambda v: root.matrix_world @ Vector([c * mm for c in v])
        up = (root.matrix_world.to_3x3() @ Vector((0, 1, 0))).normalized(); fw = (root.matrix_world.to_3x3() @ Vector((0, 0, 1))).normalized()
        if parts["lens"]: o, t, r = parts["lens"]; ANCH.append((S("ANCHOR_Lens"), o, W((0, r + 0.3, t)), up))
        if parts["zoom"]: o, t, r = parts["zoom"]; ANCH.append((S("ANCHOR_ZoomRing"), o, W((0, r + 0.3, t)), up))
        if parts["focus"]: o, t, r = parts["focus"]; ANCH.append((S("ANCHOR_FocusRing"), o, W((0, r + 0.3, t)), up))
        o, t = parts["front"]; ANCH.append((S("ANCHOR_FrontElement"), o, W((0, 0, t + 0.3)), fw))
        ANCH.append((S("ANCHOR_ApertureDiaphragm"), ap, W((0, ra * 0.65, ta + 0.6)), fw))
        ANCH.append((S("ANCHOR_LensElements"), el, W((0, ra, tf * 0.3)), up))
        root.hide_render = True
        for c in root.children_recursive: c.hide_render = True
        roots.append(root)
        tris = sum(sum(len(p.vertices) - 2 for p in c.data.polygons) for c in root.children_recursive if c.type == "MESH")
        print("LENS %-7s %-32s profile %s  tris %d" % (lid, spec["name"], "synthetic" if "synthetic" in spec else "photo", tris))
    return roots
