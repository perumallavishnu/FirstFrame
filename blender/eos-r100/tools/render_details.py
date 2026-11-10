"""Close-up check renders: shell finish, open port bays, battery/card out, Speedlite on the shoe.
blender -b Canon_EOS_R100.blend --python render_details.py -- <out_dir>"""
import bpy, sys, os, math
from mathutils import Vector, Matrix
out = sys.argv[sys.argv.index("--") + 1]; os.makedirs(out, exist_ok=True)
sc = bpy.context.scene; sc.render.engine = "BLENDER_EEVEE"; sc.render.film_transparent = False
sc.eevee.taa_render_samples = 64; sc.view_settings.view_transform = "AgX"
w = bpy.data.worlds.new("W"); w.use_nodes = True; sc.world = w
w.node_tree.nodes["Background"].inputs["Color"].default_value = (0.18, 0.2, 0.23, 1); w.node_tree.nodes["Background"].inputs["Strength"].default_value = 0.8
for nm, loc, e in (("K", (0.1, -0.3, 0.4), 6), ("F", (-0.4, -0.2, 0.1), 3), ("R", (0.0, 0.4, 0.3), 4), ("U", (0.2, 0.1, -0.4), 2)):
    ld = bpy.data.lights.new(nm, "AREA"); ld.energy = e; ld.size = 0.6; lo = bpy.data.objects.new(nm, ld); sc.collection.objects.link(lo); lo.location = loc
    lo.rotation_euler = (-Vector(loc)).to_track_quat("-Z", "Y").to_euler()
O = bpy.data.objects
for o in O:  # kit lens on, other lenses off
    if "__" in o.name or (o.name.startswith("R100_Lens_") and o.name != "R100_Lens_Kit"): o.hide_render = True


def turn(ob, axis_b, ang):
    p = ob.matrix_world.translation.copy(); ob.matrix_world = Matrix.Translation(p) @ Matrix.Rotation(ang, 4, Vector(axis_b)) @ Matrix.Translation(-p) @ ob.matrix_world


def shift(ob, v):
    ob.matrix_world = Matrix.Translation(Vector(v)) @ ob.matrix_world


cd = bpy.data.cameras.new("c"); cam = bpy.data.objects.new("c", cd); sc.collection.objects.link(cam); sc.camera = cam; cd.lens = 70; cd.clip_start = 0.003
sc.render.resolution_x, sc.render.resolution_y = 1100, 800


def shot(name, target, direction, dist):
    t = Vector(target); d = Vector(direction).normalized(); cam.location = t + d * dist
    cam.rotation_euler = (-d).to_track_quat("-Z", "Y").to_euler(); sc.render.filepath = os.path.join(out, name + ".png"); bpy.ops.render.render(write_still=True)


shot("finish_top", (0.0, 0.0, 0.02), (0.35, 0.45, 0.8), 0.24)
turn(O["PART_TerminalCoverRight"], (0, 0, 1), 1.6); turn(O["PART_TerminalCoverLeft"], (0, 0, -1), 1.6); turn(O["PART_TerminalCoverLeftRemote"], (0, 0, -1), 1.6)
shot("ports_right", (-0.058, 0.004, 0.0), (-1, -0.25, 0.1), 0.085)
shot("ports_left", (0.058, 0.004, 0.003), (1, -0.25, 0.1), 0.085)
turn(O["PART_CardBatteryCover"], (0, 1, 0), -1.55)
shot("chamber", (-0.033, -0.004, -0.04), (-0.2, -0.3, -1), 0.12)
shift(O["PART_Battery"], (0, 0, -0.062)); shift(O["PART_Battery"], (-0.01, -0.06, 0.0))
shift(O["PART_Card"], (0, 0, -0.045)); shift(O["PART_Card"], (0.03, -0.035, 0.0))
shot("battery_card_out", (-0.03, -0.06, -0.07), (-0.3, -1, 0.35), 0.17)
shot("battery_contacts", (-0.04, -0.06, -0.06), (-0.3, -0.6, 1), 0.1)
shot("card_back", (0.0, -0.035, -0.072), (0.3, 1, 0.2), 0.08)
for o in [O["R100_Speedlite"]] + list(O["R100_Speedlite"].children_recursive): o.hide_render = False
shot("speedlite_front", (0.01, 0.0, 0.06), (0.55, -1, 0.35), 0.38)
shot("speedlite_rear", (0.01, 0.0, 0.06), (-0.4, 1, 0.4), 0.38)
print("RENDERED", out)
