"""Render the model from the six reference directions with framing identical to the Canon photos, plus a
three-quarter hero view. Run inside Blender:

blender -b <file.blend> --python render_views.py -- <out_dir> [workbench|eevee] [px]
Each ortho render covers exactly the frame region its photo covers, so compare.py can overlay them 1:1.
"""
import bpy, sys, os, math
from mathutils import Vector, Matrix

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import views as V

args = sys.argv[sys.argv.index("--") + 1:]
out = args[0]; engine = args[1] if len(args) > 1 else "workbench"; px = int(args[2]) if len(args) > 2 else 1000
os.makedirs(out, exist_ok=True)
sc = bpy.context.scene
sc.render.engine = "BLENDER_WORKBENCH" if engine == "workbench" else "BLENDER_EEVEE"
sc.render.film_transparent = True
sc.render.image_settings.file_format = "PNG"
sc.render.image_settings.color_mode = "RGBA"
if engine == "workbench":
    sh = sc.display.shading
    sh.light = "STUDIO"; sh.color_type = os.environ.get("FF_COLOR", "MATERIAL"); sh.show_cavity = True; sh.cavity_type = "BOTH"
    sh.show_specular_highlight = True
else:
    sc.eevee.taa_render_samples = 64
    sc.view_settings.view_transform = "AgX"
    # product-photo studio: bright soft key from above-front, fills left/right, rim from behind, pale world
    w = bpy.data.worlds.new("W_Studio"); w.use_nodes = True; sc.world = w
    w.node_tree.nodes["Background"].inputs["Color"].default_value = (0.75, 0.76, 0.77, 1); w.node_tree.nodes["Background"].inputs["Strength"].default_value = 0.45
    for nm, loc, energy, size in (("LGT_Key", (0.05, -0.35, 0.45), 7, 0.5), ("LGT_FillL", (0.45, -0.1, 0.1), 3, 0.6), ("LGT_FillR", (-0.45, -0.1, 0.1), 3, 0.6),
                                  ("LGT_Rim", (0.0, 0.45, 0.25), 4, 0.5), ("LGT_Under", (0.0, -0.2, -0.4), 1.2, 0.6)):
        ld = bpy.data.lights.new(nm, "AREA"); ld.energy = energy; ld.size = size
        lo = bpy.data.objects.new(nm, ld); sc.collection.objects.link(lo); lo.location = loc
        lo.rotation_euler = (-Vector(loc)).to_track_quat("-Z", "Y").to_euler()
if os.environ.get("FF_HIDE_LENS"):
    for o in bpy.data.objects:
        if o.name.startswith("LENS_") or o.name.startswith("R100_Lens"): o.hide_render = True

for o in [o for o in bpy.data.objects if o.type == "CAMERA" and o.name.startswith("CAM_Check")]:
    bpy.data.objects.remove(o)
cd = bpy.data.cameras.new("CAM_Check"); cam = bpy.data.objects.new("CAM_Check", cd); sc.collection.objects.link(cam)
sc.camera = cam


def place(view):
    c = V.CAM[view]
    (au, u0, u1), (av, v0, v1) = V.extent(view)
    wu, wv = u1 - u0, v1 - v0
    centre = {au: (u0 + u1) / 2, av: (v0 + v1) / 2}
    depth_axis = [k for k in "xyz" if k not in centre][0]
    centre[depth_axis] = V.SPAN[depth_axis] / 2
    pos_mm = Vector([(centre[k] - V.OFF[k]) for k in "xyz"])
    fwd = Vector(c["fwd"]); right = Vector(c["right"]); up = Vector(c["up"])
    cam.matrix_world = Matrix((right, up, -fwd)).transposed().to_4x4()
    cam.location = (pos_mm - fwd * 400) / 1000.0
    cd.type = "ORTHO"; cd.ortho_scale = max(wu, wv) / 1000.0; cd.clip_start = 0.01; cd.clip_end = 2.0
    cd.sensor_fit = "HORIZONTAL" if wu >= wv else "VERTICAL"
    sc.render.resolution_x = px if wu >= wv else round(px * wu / wv)
    sc.render.resolution_y = px if wv >= wu else round(px * wv / wu)


for v in V.CAM:
    place(v)
    sc.render.filepath = os.path.join(out, "render_%s.png" % v)
    bpy.ops.render.render(write_still=True)

# three-quarter hero view (perspective), roughly matching photo 03
for o in bpy.data.objects:  # hero: the kit lens only (shelf lenses all sit on the mount, suffixed __<id>)
    if (o.name.startswith("LENS_") or o.name.startswith("R100_Lens")) and "__" not in o.name and o.name.startswith(("LENS_", "R100_Lens_Kit")):
        o.hide_render = bool(os.environ.get("FF_HIDE_LENS_HERO"))
cd.type = "PERSP"; cd.lens = 85; cd.sensor_fit = "AUTO"
sc.render.resolution_x = sc.render.resolution_y = px
d = Vector((0.33, -0.62, 0.16)).normalized()
cam.location = d * 0.42
cam.rotation_euler = (-d).to_track_quat("-Z", "Y").to_euler()
sc.render.filepath = os.path.join(out, "render_front34.png")
bpy.ops.render.render(write_still=True)
print("RENDERED", out)
