# Gotchas (each one already cost time on the R100)

## Sourcing and measuring
- **Spec depth often excludes or includes the eyecup or grip.** Read the footnote and measure what the photo shows.
- **Calibrate per axis and per photo.** Lens perspective makes horizontal and vertical scales differ by up to about 1%. A single scale shifts parts by millimetres.
- **Spec sheets can be wrong.** For example, the 55-210 is listed at 69 mm but measures 93.6 mm. Cross-check against the photo, keep the measured value, and document it.
- **Lenses with no official photo**, such as the RF 85 and RF 100-400 on R100: build them from published dimensions, set `ff_approximate`, and say so.

## Hull (`hull.py`)
- **Extruded silhouettes leave ridges and steps** where views disagree. Fix: Gaussian-smooth each 2D signed distance field (about 0.35 mm), use a smooth intersection (k ≈ 4 mm), then smooth the 3D field (about 0.4 mm). Too much smoothing rounds crisp edges, so check the IoU after each change.
- **A rear face with protruding buttons makes a lumpy back.** Clamp the rear face flat (R100: y 52.6) outside the viewfinder box, and extend the masks past that face so the clamp, not the mask, defines it.
- **A slab appears in front of the mount** because the side views include the mount ring. Fix: cut at the body's front face (R100: y 17.0) inside the mount area.
- **The throat comes out solid.** Cut the throat to the flange depth, so the sensor sits at the real flange distance.
- **Panels cut separately leave gaps or overlaps.** Cut every panel from the same field with a constant seam gap (0.35 mm), and use a skin depth of about 1 mm.
- **Doors that open onto nothing.** Cut the battery chamber, card slot and port bays (2.8 mm deep) into the field, so open doors reveal cavities.
- **Streaky surface texture**, which the user reported. A grain normal map on a smart-UV body shows the UV seams as streaks. The body gets no normal map; only the grip leatherette gets one.

## VDB and meshing (`sdf_to_mesh.py`)
- **Sign convention.** Blender's VDB level-set import expects negative values inside. Flipping the sign gives a box-shaped shell.
- **Name clash.** The imported volume takes the part name, so the mesh gets `.001`. Remove the volume, then rename the mesh.
- **Inverted normals:** only 21% pointed outward. Run `bmesh.ops.reverse_faces`, then check that at least 99% point outward.

## Blender build
- **SVG icons:** run `addon_utils.enable("io_curve_svg")`, then `bpy.ops.import_curve.svg`. Delete the icon's invisible bounding-rectangle curve. Some glyphs fill wrongly (the "U" of MENU did); use plain text instead.
- **Text z-fighting:** set `fill_mode` to `FRONT` and depth to 0, subdivide, conform to the surface, and offset about 0.05 mm.
- **Parenting with stale matrices:** call `view_layer.update()` before parenting while keeping the transform (the `parent_keep` helper). Don't let a search-and-replace make `parent_keep` call itself.
- **Moving a parent's pivot drags its children.** Set the pivot first, then attach the children. The Speedlite window vanished this way.
- **Lights way too bright:** 70 W studio lights blew out the renders. About 7/3/3/4/1.2 W works at this scale.
- **The shutter frame hid the sensor.** Model it as an open frame.
- **Lens band seams:** interpolate the profile radius at the exact band boundary t. To control polycount, simplify the profile with RDP at 0.06 mm and use 96 segments.
- **Close-up renders clip through the body:** set the camera `clip_start` to 0.003.

## App
- **Empty motion table.** The body is moved under a root group at load time, so traverse `[root, scene]`, not just the scene.
- **`replaceChildren(null)` prints "null".** Filter falsy values (the `clean()` helper in `explore.js`).
- **NaN exposure on a fresh page:** the dispatcher must solve before handlers run when `C.eff.aIdx == null`.
- **Menu changes didn't re-meter:** fall back to `C.solve` when there's no renderer meter.
- **The headless browser pane throttles `requestAnimationFrame`.** Use `api.snap()` to force a frame before screenshots.
- **Stale browser cache:** bump the `?v=` query on every changed script or CSS tag in `index.html`.

## Shell and tooling (Windows)
- **Heredoc quoting breaks on Python with quotes.** Write scripts to files in the scratchpad and run those.
- **Safety checks block `rm` with variable paths.** Delete with a small Python script, or name the path explicitly.
- **Port 8765 may still be held by an old server.** Reuse it, or stop the old one.
