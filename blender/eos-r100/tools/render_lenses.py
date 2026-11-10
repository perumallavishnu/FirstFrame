"""Render each shelf lens side-on with the same framing as its Canon photo (for tools/compare_lenses.py).
blender -b Canon_EOS_R100.blend --python render_lenses.py -- <out_dir>"""
import bpy, sys, os, json, math
from mathutils import Vector, Matrix
out = sys.argv[sys.argv.index("--") + 1]; os.makedirs(out, exist_ok=True)
here = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
sc = bpy.context.scene; sc.render.engine = "BLENDER_WORKBENCH"; sc.render.film_transparent = True
sc.display.shading.light = "STUDIO"; sc.display.shading.color_type = "MATERIAL"; sc.display.shading.show_cavity = True
cd = bpy.data.cameras.new("c"); cam = bpy.data.objects.new("c", cd); sc.collection.objects.link(cam); sc.camera = cam
roots = {o["ff_lens"]: o for o in bpy.data.objects if o.name.startswith("R100_Lens_") and "ff_lens" in o}
for o in bpy.data.objects:
    if o.type in ("MESH", "EMPTY"): o.hide_render = True
for lid, root in roots.items():
    pj = os.path.join(here, "lens_profiles", lid + ".json")
    if not os.path.exists(pj): continue
    j = json.load(open(pj)); W, H = j["size"]; ppm = j["px_per_mm"]
    for o in [root] + list(root.children_recursive): o.hide_render = o.type != "MESH" or o.name.startswith("ANCHOR")
    # flange centre in world; lens axis is world -Y. Photo: front up, flange at row flange_row, axis at column cx
    c = root.matrix_world.translation.copy()
    t_center = (j["flange_row"] - H / 2) / ppm          # mm in front of the flange at the photo centre
    x_off = (W / 2 - j["cx"]) / ppm
    centre = c + Vector((0, -t_center / 1000, 0))
    fwd = Vector((1, 0, 0)); up = Vector((0, -1, 0)); right = fwd.cross(up)
    cam.matrix_world = Matrix((right, up, -fwd)).transposed().to_4x4(); cam.location = centre - fwd * 0.5 - right * (x_off / 1000)
    cd.type = "ORTHO"; cd.ortho_scale = (W / ppm) / 1000; cd.clip_end = 2
    sc.render.resolution_x, sc.render.resolution_y = 1000, 1000
    sc.render.filepath = os.path.join(out, "lens_%s.png" % lid); bpy.ops.render.render(write_still=True)
    for o in [root] + list(root.children_recursive): o.hide_render = True
print("RENDERED", out)
