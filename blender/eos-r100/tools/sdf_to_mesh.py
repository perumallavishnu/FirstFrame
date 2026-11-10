"""Step 3 (inside Blender): mesh every part distance field from hull.py via OpenVDB.

blender -b --factory-startup --python sdf_to_mesh.py -- <build_dir>
Reads parts_manifest.json + <Name>.npy and writes <build_dir>/shell.blend with one mesh object per part, in metres,
Blender frame X = x - 58.15, Y = y - 34.4 (front faces -Y), Z = z - 42.75 (mm, then x 0.001).
"""
import bpy, sys, os, json
import numpy as np
import openvdb

build = sys.argv[sys.argv.index("--") + 1]
man = json.load(open(os.path.join(build, "parts_manifest.json")))
vox = man["voxel_mm"] / 1000.0
OFF = np.array([58.15, 34.4, 42.75])
bpy.ops.wm.read_factory_settings(use_empty=True)

for name, info in man["parts"].items():
    sdf = np.load(os.path.join(build, name + ".npy"))
    o = (np.array(info["origin_mm"]) - OFF) / 1000.0
    grid = openvdb.FloatGrid()
    grid.copyFromArray(np.ascontiguousarray(sdf))  # negative inside: Blender reads it with the level-set sign convention
    grid.name = "density"
    grid.transform = openvdb.createLinearTransform([[vox, 0, 0, 0], [0, vox, 0, 0], [0, 0, vox, 0], [o[0], o[1], o[2], 1]])
    vdb = os.path.join(build, name + ".vdb")
    openvdb.write(vdb, grids=[grid])
    bpy.ops.object.volume_import(filepath=vdb)
    vol = bpy.context.active_object
    me = bpy.data.meshes.new(name)
    ob = bpy.data.objects.new(name, me)
    bpy.context.scene.collection.objects.link(ob)
    m = ob.modifiers.new("v2m", "VOLUME_TO_MESH")
    m.object = vol; m.grid_name = "density"; m.threshold = 0.0; m.resolution_mode = "GRID"
    m.adaptivity = 0.0
    bpy.context.view_layer.objects.active = ob
    bpy.ops.object.modifier_apply(modifier=m.name)
    bpy.data.objects.remove(vol)
    ob.name = name; ob.data.name = name  # the imported volume briefly held this name
    for p in ob.data.polygons: p.use_smooth = True
    os.remove(vdb)
    print("MESH %-28s faces %d" % (name, len(ob.data.polygons)))

bpy.ops.wm.save_as_mainfile(filepath=os.path.join(build, "shell.blend"))
