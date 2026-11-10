"""Detail models for the EOS R100 build: terminal sockets, LP-E17 battery, SD card, battery lock lever, Speedlite EL-100.
Called by build_r100.py with its helpers in H. Sizes from the standards / Canon documentation:
  USB Type-C receptacle   opening 8.34 x 2.56 mm (stadium), tongue 6.69 x 0.70 mm, 12 + 12 contacts at 0.5 mm pitch
  HDMI Type D (micro)     opening 6.4 x 2.8 mm, two chamfered corners, 19 contacts at 0.4 mm pitch
  External mic IN         3.5 mm stereo mini jack (Canon spec);  remote: RS-60E3 = E3 type, 2.5 mm sub-mini jack
  Battery Pack LP-E17     33.0 x 14.0 x 49.4 mm, 7.2 V 1040 mAh, contacts on the end that goes in first (Canon manual)
  SD card                 24 x 32 x 2.1 mm, chamfer top-right seen from the label, 9 contacts on the back, write-protect
                          switch on the left edge; goes in with the label facing the FRONT of the camera (Canon manual)
  Speedlite EL-100        64.6 x 91.7 x 71.0 mm (Canon UK spec), shaped from Canon's four gallery photos
Every port faces outward, long axis vertical, as in Canon's rear part diagram.
"""
import bpy, bmesh, math
from mathutils import Vector, Matrix

mm = 0.001


def outline_stadium(w, h, n=48):
    """stadium with its long axis along y (w across x, h along y), returned anticlockwise"""
    r = w / 2; c = h / 2 - r; pts = []
    for i in range(n // 2 + 1):
        a = math.pi * i / (n // 2); pts.append((r * math.cos(a), c + r * math.sin(a)))
    for i in range(n // 2 + 1):
        a = math.pi + math.pi * i / (n // 2); pts.append((r * math.cos(a), -c + r * math.sin(a)))
    return pts


def outline_hdmi_d(w, h, ch):
    """micro HDMI: long axis along y (h), w across x, corners chamfered on the -x side"""
    return [(w / 2, -h / 2), (w / 2, h / 2), (-w / 2 + ch, h / 2), (-w / 2, h / 2 - ch), (-w / 2, -h / 2 + ch), (-w / 2 + ch, -h / 2)]


def resample(poly, n):
    seg = [(poly[i], poly[(i + 1) % len(poly)]) for i in range(len(poly))]
    lens = [math.dist(a, b) for a, b in seg]; total = sum(lens); out = []
    for k in range(n):
        d = total * k / n
        for (a, b), L in zip(seg, lens):
            if d <= L or L == 0:
                t = 0 if L == 0 else d / L; out.append((a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t)); break
            d -= L
    return out


def socket_mesh(name, outer, inner, depth, finish):
    """front lip (outer->inner loop at z=0), inner wall down to -depth, closed back. Outlines in mm, local XY."""
    n = 64; A = resample(outer, n); B = resample(inner, n)
    bm = bmesh.new(); uvl = bm.loops.layers.uv.new("UVMap")
    va = [bm.verts.new((x * mm, y * mm, 0)) for x, y in A]
    vb = [bm.verts.new((x * mm, y * mm, 0)) for x, y in B]
    vc = [bm.verts.new((x * mm, y * mm, -depth * mm)) for x, y in B]
    for i in range(n):
        j = (i + 1) % n
        bm.faces.new([va[i], va[j], vb[j], vb[i]])
        bm.faces.new([vb[i], vb[j], vc[j], vc[i]])
    bm.faces.new(list(reversed(vc)))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    for f in bm.faces:
        for l in f.loops: l[uvl].uv = (l.vert.co.x * 100, l.vert.co.y * 100)
    return finish(bm, name, 40)


def build(H):
    P, M, COL, new_obj, set_mat, orient, hit, anchor, motion, rbox, prism, lathe, text_mesh, svg_mesh, parent_keep, finish, MEAS = (
        H[k] for k in ("P", "M", "COL", "new_obj", "set_mat", "orient", "hit", "anchor", "motion", "rbox", "prism", "lathe", "text_mesh", "svg_mesh", "parent_keep", "finish", "MEAS"))
    up = (0, 0, 1)

    def child(ob, parent):
        parent_keep(ob, parent); return ob

    # ------------------------------------------------------------------ sockets in the port bays
    def mount_socket(name, face, y, z, outer, inner, depth, tongue=None):
        loc, n, _ = hit(face, y, z, only=["BODY_Shell"])
        s = new_obj(name, socket_mesh(name, outer, inner, depth, finish), "SIDE_PORTS"); set_mat(s, M["steel"]); orient(s, loc + n * 0.02 * mm, n, up)
        if tongue:
            tw, tt, tl, pins, pitch, pw, sides = tongue  # width along y, thickness along x, length (depth), pins per side...
            t = new_obj(name + "_Tongue", rbox("tongue", tt, tw, tl, 0.08), "SIDE_PORTS"); set_mat(t, M["chip"])
            orient(t, loc - n * (depth - 0.05) * mm, n, up); child(t, s)
            bm = bmesh.new()
            for side, count in enumerate(sides):
                sx = (tt / 2 + 0.03) * (1 if side == 0 else -1)
                for k in range(count):
                    yy = (k - (count - 1) / 2) * pitch + (0 if side == 0 or count == sides[0] else pitch / 2)
                    bmesh.ops.create_cube(bm, size=1.0, matrix=Matrix.Translation(Vector((sx, yy, tl - 1.2)) * mm) @ Matrix.Diagonal((0.04 * mm, pw * mm, 2.0 * mm, 1)))
            me = bpy.data.meshes.new(name + "_Contacts"); bm.to_mesh(me); bm.free()
            c = new_obj(name + "_Contacts", me, "SIDE_PORTS"); set_mat(c, M["gold"]); orient(c, loc - n * (depth - 0.05) * mm, n, up); child(c, s)
        anchor(s, "ANCHOR_" + name[5:], loc, n)
        return s, loc, n

    m = MEAS
    mount_socket("PART_DigitalTerminal", "right", m["digital-terminal"]["y"], m["digital-terminal"]["z"],
                 outline_stadium(2.56 + 0.6, 8.34 + 0.6), outline_stadium(2.56, 8.34), 6.2, tongue=(6.69, 0.70, 4.6, 12, 0.5, 0.25, (12, 12)))
    mount_socket("PART_HdmiMicroOut", "right", m["hdmi-micro-out"]["y"], m["hdmi-micro-out"]["z"],
                 outline_hdmi_d(2.8 + 0.6, 6.4 + 0.6, 0.95), outline_hdmi_d(2.8, 6.4, 0.75), 5.6, tongue=(5.0, 0.60, 4.0, 10, 0.4, 0.2, (10, 9)))
    for name, key, r_hole, r_bez in (("PART_ExternalMicIn", "external-mic-in", 1.75, 3.1), ("PART_RemoteTerminal", "remote-terminal", 1.25, 2.4)):
        loc, n, _ = hit("left", m[key]["y"], m[key]["z"], only=["BODY_Shell"])
        jk = new_obj(name, lathe(name, [(r_bez, -0.6), (r_bez, 0.35), (r_bez - 0.35, 0.6), (r_hole + 0.35, 0.6), (r_hole + 0.15, 0.35), (r_hole, 0.2), (r_hole, -8.0), (0, -8.0)], 48), "SIDE_PORTS")
        set_mat(jk, M["chip"]); orient(jk, loc, n, up)
        sleeve = new_obj(name + "_Sleeve", lathe("sl", [(r_hole + 0.01, 0.15), (r_hole + 0.01, -2.5), (r_hole - 0.05, -2.5), (r_hole - 0.05, 0.15)], 40), "SIDE_PORTS"); set_mat(sleeve, M["steel"]); orient(sleeve, loc, n, up); child(sleeve, jk)
        anchor(jk, "ANCHOR_" + name[5:], loc + n * 0.6 * mm, n)
    # bay markings beside the sockets (Canon prints them in the bay as well as on the covers)
    loc, n, _ = hit("left", m["external-mic-in"]["y"] - 5.0, m["external-mic-in"]["z"], only=["BODY_Shell"])
    o = new_obj("PRINT_BayMIC", text_mesh("PRINT_BayMIC", "MIC", 1.3), "MATERIAL_DETAILS"); set_mat(o, M["print"]); orient(o, loc + n * 0.03 * mm, n, up)
    loc, n, _ = hit("right", m["digital-terminal"]["y"] + 4.6, m["digital-terminal"]["z"], only=["BODY_Shell"])
    o = new_obj("PRINT_BayUSB", svg_mesh("PRINT_BayUSB", "icon_terminal_digi", 1.6), "MATERIAL_DETAILS"); set_mat(o, M["print"]); orient(o, loc + n * 0.03 * mm, n, (0, -1, 0))
    loc, n, _ = hit("right", m["hdmi-micro-out"]["y"] + 4.6, m["hdmi-micro-out"]["z"], only=["BODY_Shell"])
    o = new_obj("PRINT_BayHDMI", text_mesh("PRINT_BayHDMI", "HDMI", 1.2), "MATERIAL_DETAILS"); set_mat(o, M["print"]); orient(o, loc + n * 0.03 * mm, n, (0, -1, 0))

    # ------------------------------------------------------------------ LP-E17 battery (contacts up, label to the front)
    bc = P(25.0, 26.7, 1.3)  # sits on the inside of the door (1.2 mm skin)
    bat = new_obj("PART_Battery", rbox("PART_Battery", 33.0, 14.0, 49.4, 1.3), "BATTERY_COMPARTMENT"); set_mat(bat, M["battery"]); bat.location = bc
    bpy.context.view_layer.update()
    for k, x in enumerate((-13.2, -10.0, -6.8, -3.6)):  # four recessed terminals on the end that goes in first
        slot = new_obj("PART_Battery_Slot%d" % k, rbox("slot", 1.9, 3.6, 0.04, 0.3), "BATTERY_COMPARTMENT"); set_mat(slot, M["chip"])
        slot.location = bc + Vector((x * mm, 1.6 * mm, 49.41 * mm)); child(slot, bat)
        g = new_obj("PART_Battery_Contact%d" % k, rbox("bpin", 0.7, 2.8, 0.04, 0.1), "BATTERY_COMPARTMENT"); set_mat(g, M["gold"])
        g.location = bc + Vector((x * mm, 1.6 * mm, 49.44 * mm)); child(g, bat)
    face = bc + Vector((0, -7.02 * mm, 0))
    for txt, z, h, mname in (("Canon", 32.0, 4.2, "print"), ("LP-E17", 24.0, 3.0, "print"), ("7.2V  1040mAh  Li-ion", 18.0, 1.6, "print")):
        o = new_obj("PART_Battery_Mark_" + txt[:5].strip(), text_mesh("bt", txt, h), "MATERIAL_DETAILS"); set_mat(o, M[mname])
        orient(o, face + Vector((0, 0, z * mm)), Vector((0, -1, 0)), up); child(o, bat)
    tri = new_obj("PART_Battery_Mark_Arrow", prism("tri", [(-1.6, 0), (1.6, 0), (0, 2.6)], 0.03), "MATERIAL_DETAILS"); set_mat(tri, M["print"])
    orient(tri, face + Vector((0, 0, 42.5 * mm)), Vector((0, -1, 0)), up); child(tri, bat)  # points toward the contacts: this end goes in first
    motion(bat, "slide", axis=(0, 0, -1), rng=[0, 0.062], out_offset=[0.0, -0.062, 0.035])
    anchor(bat, "ANCHOR_Battery", bc + Vector((0, -7.1 * mm, 30 * mm)), Vector((0, -1, 0)))
    anchor(bat, "ANCHOR_Battery_Contacts", bc + Vector((-8.4 * mm, 1.6 * mm, 49.6 * mm)), Vector((0, 0, 1)))
    # battery lock lever at the edge of the chamber (Canon: press it aside to release the battery)
    lev = new_obj("PART_BatteryLockLever", prism("PART_BatteryLockLever", [(0, -3.5), (2.6, -3.5), (2.6, 3.5), (0, 3.5)], 0.9, bevel=0.25), "BATTERY_COMPARTMENT")
    set_mat(lev, M["button"]); lev.location = P(40.3, 26.7, 1.35)  # tab over the battery's corner at the chamber edge; motion(lev, "slide", axis=(1, 0, 0), rng=[0, 0.0015])
    anchor(lev, "ANCHOR_BatteryLockLever", P(43.0, 26.7, 0.8), Vector((0, 0, -1)))

    # ------------------------------------------------------------------ SD card (label to the front, contacts edge up)
    cc = P(27.0, 38.55, 1.3)
    card = new_obj("PART_Card", prism("PART_Card", [(-12, 0), (12, 0), (12, 28), (8, 32), (-12, 32)], 2.1, bevel=0.25), "BATTERY_COMPARTMENT")
    set_mat(card, M["card"]); orient(card, cc, Vector((0, -1, 0)), up)   # local +z (label) -> front, +y -> up, +x -> viewer's right
    bpy.context.view_layer.update()
    W = lambda x, y, z: card.matrix_world @ Vector((x * mm, y * mm, z * mm))
    pins = bmesh.new()
    xs = [-10.4, -8.0, -5.5, -3.0, -0.5, 2.0, 4.5, 7.0, 9.3]  # nine contacts along the leading edge, on the back
    for x in xs: bmesh.ops.create_cube(pins, size=1.0, matrix=Matrix.Translation(Vector((x, 27.0, -0.02)) * mm) @ Matrix.Diagonal((1.6 * mm, 4.0 * mm, 0.04 * mm, 1)))
    me = bpy.data.meshes.new("PART_Card_Contacts"); pins.to_mesh(me); pins.free()
    cp = new_obj("PART_Card_Contacts", me, "BATTERY_COMPARTMENT"); set_mat(cp, M["gold"]); cp.matrix_world = card.matrix_world.copy(); child(cp, card)
    sw = new_obj("PART_Card_Lock", rbox("sw", 0.9, 3.2, 1.2, 0.2), "BATTERY_COMPARTMENT"); set_mat(sw, M["print"])
    sw.matrix_world = card.matrix_world @ Matrix.Translation(Vector((-12.2, 21.0, 0.45)) * mm); child(sw, card)  # write-protect switch, left edge
    for txt, y, h in (("SD", 13.0, 7.0), ("64GB", 5.0, 2.4)):
        o = new_obj("PART_Card_Mark_" + txt, text_mesh("sd", txt, h), "MATERIAL_DETAILS"); set_mat(o, M["print"])
        o.matrix_world = card.matrix_world @ Matrix.Translation(Vector((0, y, 2.13)) * mm); child(o, card)
    arr = new_obj("PART_Card_Mark_Arrow", prism("arr", [(-1.2, 0), (1.2, 0), (0, 2.0)], 0.03), "MATERIAL_DETAILS"); set_mat(arr, M["print"])
    arr.matrix_world = card.matrix_world @ Matrix.Translation(Vector((7.5, 24.5, 2.13)) * mm); child(arr, card)  # insert-this-way arrow
    motion(card, "slide", axis=(0, 0, -1), rng=[0, 0.042], out_offset=[0.0, -0.042, -0.032])
    anchor(card, "ANCHOR_Card", W(0, 16, 2.4), Vector((0, -1, 0)))
    anchor(card, "ANCHOR_Card_Contacts", W(0, 27, -0.3), Vector((0, 1, 0)))
    for o in (bat, card, lev): o["ff_educational"] = False

    # ------------------------------------------------------------------ Speedlite EL-100 on the hot shoe
    root = bpy.data.objects.new("R100_Speedlite", None); COL["HOT_SHOE"].objects.link(root)
    root.location = P(69.2, 43.5, 84.85); root["ff_accessory"] = "speedlite-el-100"; root["ff_name"] = "Speedlite EL-100"
    root["ff_dims"] = "64.6 x 91.7 x 71.0 mm (Canon UK)"; root["ff_slide_from"] = [0.0, 0.0, 0.035]  # slides in from the back (+Y Blender)
    bpy.context.view_layer.update()
    L = lambda x, y, z: root.matrix_world @ Vector((x * mm, y * mm, z * mm))

    def part(name, me, mat, x, y, z, parent=root):
        o = new_obj(name, me, "HOT_SHOE"); set_mat(o, M[mat]); o.location = L(x, y, z); child(o, parent); return o
    foot = part("PART_Speedlite_Foot", rbox("foot", 18.2, 17.0, 1.5, 0.3), "steel", 0, 0, 0.0)
    pins = bmesh.new()
    for (px, py, r) in ((0, -1.0, 1.6), (0, -5.0, 0.55), (-1.8, -6.6, 0.45), (1.8, -6.6, 0.45), (0, 4.2, 0.6)):
        bmesh.ops.create_cone(pins, cap_ends=True, segments=20, radius1=r * mm, radius2=r * mm, depth=0.12 * mm, matrix=Matrix.Translation(Vector((px, py, -0.05)) * mm))
    me = bpy.data.meshes.new("PART_Speedlite_FootContacts"); pins.to_mesh(me); pins.free()
    part("PART_Speedlite_FootContacts", me, "gold", 0, 0, 0, parent=foot).location = L(0, 0, 0)
    base = part("PART_Speedlite", rbox("PART_Speedlite", 50.0, 40.0, 9.0, 3.5), "gloss", 0, 2.0, 1.5)  # the clickable part: foot block + body
    child(foot, base)
    body = part("PART_Speedlite_Body", rbox("slbody", 64.6, 50.0, 50.5, 7.0), "body", 0, 1.0, 10.5, parent=base)
    part("PART_Speedlite_Sensor", rbox("slsens", 13.5, 0.6, 12.5, 2.0), "gloss", 19.5, -24.0, 33.0, parent=base)
    part("PART_Speedlite_Lock", rbox("sllock", 16.0, 3.0, 4.5, 1.0), "button", 0, 22.6, 3.0, parent=base)
    dial = part("PART_Speedlite_Dial", lathe("sldial", [(0, 0), (8.0, 0), (8.5, 0.6), (8.5, 2.6), (8.0, 3.2), (0, 3.2)], 48, star=(40, 0.25), uv_rep=10), "knurl", 0, 26.0, 28.0, parent=base)
    dial.rotation_euler = (-math.pi / 2, 0, 0)
    for txt, x, z in (("ON", -7.5, 34.5), ("OFF", -10.5, 29.5)):
        t = new_obj("PART_Speedlite_Mark_" + txt, text_mesh("sl", txt, 1.8), "MATERIAL_DETAILS"); set_mat(t, M["print"])
        orient(t, L(x, 26.05, z), Vector((0, 1, 0)), up); child(t, body)
    btn = part("PART_Speedlite_Test", lathe("sltest", [(0, 0), (2.4, 0), (2.4, 0.8), (1.9, 1.1), (0, 1.15)], 32), "button", 17.0, 26.0, 18.0, parent=base)
    btn.rotation_euler = (-math.pi / 2, 0, 0)
    t = new_obj("PART_Speedlite_Mark_Flash", svg_mesh("slf", "icon_flash", 2.4), "MATERIAL_DETAILS"); set_mat(t, M["print"]); orient(t, L(17.0, 26.05, 23.0), Vector((0, 1, 0)), up); child(t, body)
    t = new_obj("PART_Speedlite_Mark_Canon", text_mesh("slc", "Canon", 4.6), "MATERIAL_DETAILS"); set_mat(t, M["print"]); orient(t, L(-3.0, -24.05, 47.0), Vector((0, -1, 0)), up); child(t, body)
    # bounce head: tilts up to 90 degrees about a hinge at the top of the body
    head = new_obj("PART_Speedlite_Head", rbox("slhead", 64.6, 66.0, 28.5, 6.0), "HOT_SHOE"); set_mat(head, M["body"])
    head.location = L(0, -7.0, 62.0); child(head, base)
    # move the head's origin onto its hinge FIRST, then attach the window (moving a parent's origin drags its children)
    bpy.context.view_layer.update()
    hinge = L(0, 0, 61.5); mw = head.matrix_world.copy(); loc_local = mw.inverted() @ hinge
    head.data.transform(Matrix.Translation(-loc_local)); head.matrix_world = mw @ Matrix.Translation(loc_local)
    win = new_obj("PART_Speedlite_Window", rbox("slwin", 55.0, 0.8, 18.0, 2.0), "HOT_SHOE"); set_mat(win, M["fresnel"])
    win.location = L(0, -40.3, 67.5); child(win, head)
    motion(head, "hinge", axis=(1, 0, 0), rng=[0, -math.pi / 2], open=-math.pi / 2)
    anchor(base, "ANCHOR_Speedlite", L(-10.0, -24.4, 40.0), Vector((0, -1, 0)))
    anchor(win, "ANCHOR_Speedlite_Head", L(0, -40.8, 76.0), Vector((0, -1, 0)))
    root.hide_render = True
    for c in root.children_recursive: c.hide_render = True
    return {"speedlite": root}
