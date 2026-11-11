# Pipeline commands

Run everything from the project root. Use `python -I` for any script that reads downloaded files. Blender needs absolute paths after `--`. The examples use the R100 paths; for a new camera, substitute `blender/<camera-id>/` once the shared tools exist (see SKILL.md step 0).

| # | Command | Produces |
|---|---------|----------|
| 1 | `python -I blender/eos-r100/tools/fetch_refs.py` | Reference photos, manual pages, icons and lens photos in `assets/models/<id>/reference/` |
| 2 | `python -I blender/eos-r100/tools/masks.py assets/models/canon-eos-r100/reference <maskdir>` | One binary silhouette PNG per view, plus overlays to check by eye. Put `<maskdir>` in the scratchpad. |
| 3 | `python -I blender/eos-r100/tools/crop.py <photo> <out.png> x0 y0 x1 y1 [grid_px]` | Labelled zoom crops with mm rulers, for measuring parts into `measurements.json` |
| 4 | `python -I blender/eos-r100/tools/hull.py <maskdir> blender/eos-r100/build 0.25` | Signed distance fields per part (`.npy`) plus `parts_manifest.json`. The last argument is the voxel size in mm (0.25 for final builds; 0.5 for quick iteration). |
| 5 | `blender -b --factory-startup --python blender/eos-r100/tools/sdf_to_mesh.py -- <abs build dir>` | `build/shell.blend`, with one mesh per hull part |
| 6 | `blender -b blender/eos-r100/build/shell.blend --python blender/eos-r100/tools/render_views.py -- ...` | Six renders framed to each photo's calibration. `FF_HIDE_LENS=1` hides lenses. |
| 7 | `python -I blender/eos-r100/tools/compare.py <ref mask> <render> <out sheet>` | IoU and overshoot per view, plus overlay sheets (git-ignored) |
| 8 | `blender -b blender/eos-r100/build/shell.blend --python blender/eos-r100/build_r100.py -- <abs project root>` | `Canon_EOS_R100.blend`, with all parts, markings, materials and anchors. It runs `build_lens.py`, `build_lenses.py` and `build_details.py`. |
| 9 | `python -I blender/eos-r100/tools/lens_profile.py <side photo> <official dia mm> <out.json> [debug.png]`, then `render_lenses.py` and `compare_lenses.py` | Lens radius profiles (`lens_profiles/*.json`), lens IoU and length check |
| 10 | `blender -b <model>.blend --python blender/eos-r100/tools/render_details.py -- ...` | Close-ups of ports, battery, card and flash (camera `clip_start` 0.003) |
| 11 | `blender -b blender/eos-r100/Canon_EOS_R100.blend --python blender/eos-r100/tools/export_glb.py -- <abs .glb>` | Desktop GLB (Draco, 16-bit positions, WebP textures) |
| 12 | Same as 11, plus `--mobile` | Mobile LOD (decimated to 0.4) |
| 13 | `node scripts/validate-camera-profile.js` | Registry ↔ GLB check (meshes, anchors, unmapped `PART_*`) |
| 14 | `node --test tests/` | App unit tests |
| 15 | Preview: `.claude/launch.json` serves `python -m http.server 8765`; open `http://localhost:8765` | Browser check |

Read each script's docstring for its exact arguments before running it; the docstrings are kept up to date.

## Iteration loop for the shell
masks → hull (0.5 mm voxels) → mesh → render → compare → fix the masks, cuts or clamps → repeat. Move to 0.25 mm only once IoU passes. A full 0.25 mm hull takes a few minutes, so run it in the background.

## File naming contract (Blender → app)
- `PART_<PascalId>`: one object per registry part; the app maps it with `MESH` overrides when the name differs.
- `ANCHOR_<PascalId>`: an Empty; its local +Y (in Three.js) is the surface normal. For per-function anchors, use `ANCHOR_<PascalId>_<Fn>`.
- `<Kind>__<lensId>` and `ANCHOR_<Part>__<lensId>`: per-lens objects.
- `SCREEN_Display`: the rear LCD plane with clean 0..1 UVs.
- Detail children are `<registered>_<suffix>` (for example `PART_Battery_Contacts`), so the validator accepts them.
- Custom properties (exported as glTF extras):
  - `ff_motion`: `hinge`, `rotate`, `press`, `slide` or `popup`;
  - `ff_axis`: Three.js axis;
  - `ff_range`: radians or mm;
  - `ff_open`;
  - `ff_approximate`: true when not photo-verified.
