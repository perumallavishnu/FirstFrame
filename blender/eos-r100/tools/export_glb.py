"""Export Canon_EOS_R100.blend to the web GLB and report what went in.

blender -b blender/eos-r100/Canon_EOS_R100.blend --python export_glb.py -- <out.glb> [--mobile] [--no-draco]
Keeps object names (PART_*, ANCHOR_*, LENS_*, SCREEN_Display), custom properties as glTF extras
(ff_motion, ff_axis, ff_range, ff_normal...), +Y up, metres. Textures are written as WebP (EXT_texture_webp).
--mobile   decimates the heavy photo-derived panels to ~40% and halves the normal-map resolution (phones)
Draco mesh compression is on by default (the app loads Three.js's DRACOLoader decoder from the same CDN).
The .blend itself is never saved by this script.
"""
import bpy, sys, os, json, struct

args = sys.argv[sys.argv.index("--") + 1:]
out = args[0]; mobile = "--mobile" in args; draco = "--no-draco" not in args
os.makedirs(os.path.dirname(out), exist_ok=True)

if mobile:
    for o in bpy.data.objects:
        if o.type == "MESH" and len(o.data.polygons) > 2500:
            d = o.modifiers.new("lod", "DECIMATE"); d.ratio = 0.4
    for img in bpy.data.images:
        if img.name.startswith("T_R100_") and img.size[0] > 256: img.scale(256, 256)

for o in bpy.data.objects:
    o.hide_set(False); o.hide_render = False
    o.select_set(o.type in ("MESH", "EMPTY"))
bpy.ops.export_scene.gltf(filepath=out, export_format="GLB", use_selection=True, export_extras=True, export_yup=True,
                          export_apply=True, export_cameras=False, export_lights=False, export_image_format="WEBP",
                          export_texcoords=True, export_normals=True, export_materials="EXPORT", export_animations=False,
                          export_draco_mesh_compression_enable=draco, export_draco_mesh_compression_level=6,
                          export_draco_position_quantization=16, export_draco_normal_quantization=10,
                          export_draco_texcoord_quantization=12, export_draco_generic_quantization=12)

with open(out, "rb") as f:
    data = f.read()
jlen = struct.unpack_from("<I", data, 12)[0]
gj = json.loads(data[20:20 + jlen])
names = [n.get("name", "") for n in gj["nodes"]]
tris = 0
for m in gj["meshes"]:
    for p in m["primitives"]:
        if "indices" in p: tris += gj["accessors"][p["indices"]]["count"] // 3
print("GLB %s  %.2f MB  nodes %d  meshes %d  materials %d  images %d  tris %d  draco %s  mobile %s" % (
    out, len(data) / 1e6, len(names), len(gj["meshes"]), len(gj.get("materials", [])), len(gj.get("images", [])), tris, draco, mobile))
