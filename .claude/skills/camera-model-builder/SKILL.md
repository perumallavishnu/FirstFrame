---
name: camera-model-builder
description: Build an accurate, interactive 3D model of a real camera (body, lenses, ports, battery, card, accessories) for FirstFrame from official manufacturer photos and manuals, then wire it into the app as a new camera profile. Use whenever the user names a camera to add ("add the Nikon Z50 II", "model the Sony a6400", "new camera for the app", "another camera to practise on"), or asks to improve, re-measure or validate an existing camera model. Covers sourcing, calibration, the visual-hull shell, part placement, markings, lenses, connectors, validation, GLB export and app integration, with the accuracy gates that must pass before a camera ships.
---

# Camera model builder (FirstFrame)

This turns a camera name into a photo-accurate, interactive GLB plus a camera profile in FirstFrame. The Canon EOS R100 (`blender/eos-r100/`, `js/camera/eos_r100_profile.js`) is the reference implementation: copy its structure, never its numbers.

**Prime rule: every shape, position, name and marking comes from a cited official source.** Use the manufacturer's manual, spec page and product photos. Never guess from memory, from another model, or from AI imagery. When a detail cannot be confirmed, mark it `approximate` in the registry and say so to the user.

Read these before starting:
- `references/sources.md`: what to collect and how to find it (manuals, part-name diagrams, gallery CDNs, specs)
- `references/pipeline.md`: every command, in order, with what each step produces
- `references/accuracy-gates.md`: the checks that must pass, and their thresholds
- `references/gotchas.md`: every bug already hit once (read it; it saves hours)
- `references/standards.md`: connector, battery, card and hot-shoe dimensions
- `references/app-integration.md`: adding the camera to the app (profile, selector, simulator specs)
- `templates/`: starting files for a new camera

## Workflow

Track these steps with the task list, and report to the user after each stage.

### 0. One-time: make the pipeline multi-camera (only when adding the SECOND camera)
The R100 pipeline still hard-codes R100 values. They include the frame offsets 58.15/34.4/42.75 mm and the 116.3 × 85.5 × 68.8 mm size; the per-view photo extents (`CAL` in `tools/views.py` and a duplicate in `tools/hull.py`); the cut boxes and the rear clamp in `hull.py`; the part positions in `build_r100.py`; the R100 file names in `export_glb.py` and `fetch_refs.py`; and the single-camera app (`FF.camera`, `FF.BODY`). Before building camera #2:
1. Move the generic tools to `blender/_shared/tools/` (masks, hull, sdf_to_mesh, views, render_views, compare, lens_profile, render_lenses, compare_lenses, export_glb, crop). Make each tool read a per-camera `blender/<camera-id>/camera.json` (template: `templates/camera.json`): size, frame offsets, CAL, cuts, rear clamp, mount, panels file, output names.
2. Keep R100 working: give it a `camera.json` with its current numbers, rebuild, and confirm the R100 GLB and its silhouette IoU are unchanged before touching the new camera.
3. Do the app generalisation in `references/app-integration.md` (profile registry, camera selector, per-camera simulator specs).
Do this as its own commit, and test it, so a regression can't hide inside the new camera.

### 1. Identify and source (stage report: the sources table)
- **Fix the exact model and region code**, for example "Nikon Z50 II body, product code VOA120AE". Confirm it with the user if the name is ambiguous (Mark I vs II, kit vs body).
- **Collect everything in `references/sources.md`:**
  - the official manual's **part-names page**, saved as HTML plus its diagrams;
  - the **spec page** (size W × H × D, weight, sensor, mount, ports, battery, card, flash, screen type);
  - the manual's **control-icon SVGs or PNGs**;
  - the **official gallery photos**: front, rear, top, bottom, left, right, three-quarter;
  - the **official lens photos and specs** for every lens on the shelf.
- **Save them** under `assets/models/<camera-id>/reference/`, which is git-ignored (manufacturer copyright). Write `SOURCES.md` with every URL, the access date, and anything unresolved.
- **Add the camera to `fetch_refs.py`**, so a fresh clone can re-download everything.
- **Never commit manufacturer photos or comparison sheets that contain them.**

### 2. Registry first (stage report: parts list and conflicts)
- Create `js/camera/<camera-id>_profile.js` from `templates/profile.js`.
- **List every numbered item on the manufacturer's part-names diagrams**, using their exact wording. Give each a stable kebab-case id, a short UI alias, a view, the printed marking, a plain-language description, how to use it, a status and a source.
- **Multi-function buttons are one part with `functions`.** For example, Canon's cross keys carry four press points, each with its own anchor. Never split one physical control into several.
- **Status values:**
  - `verified`: name and position from the diagram and photos;
  - `approximate`: name verified, position estimated;
  - `educational`: an internal illustration.
- **Never add a control, port or behaviour the diagrams don't show.** Note the common traps: touch screens, joysticks, headphone jacks, a second card slot, IBIS.

### 3. Measure (stage report: measurements and cross-checks)
- **Segment the six orthographic photos**: `masks.py`, then check the overlays by eye.
- **Calibrate each photo independently per axis** to the published W/H/D. Galleries usually crop tight to the product, so the silhouette extent is the full dimension. Verify that by checking that the masks touch the frame.
- **Measure every part's position** with `crop.py` labelled zoom crops and the scales. Record it in `measurements.json`, in the frame x (from the grip side) / y (from the grip front) / z (from the bottom), in mm, with sizes.
- **Trace every separate panel outline** in `panels.json`, in photo pixels: covers, battery door, flash head, eyecup, thumb rest, grip covering.
- **Cross-check before modelling.** The mount throat diameter, the sensor width and the lens-axis alignment (mount, hot shoe, tripod socket, eyepiece) must each agree within about 1 mm. If they don't, the calibration is wrong: fix it now.

### 4. Shell: the visual hull (stage report: IoU table and renders)
- **Run `hull.py`.** It intersects the six silhouettes as signed distance fields, applies a 4 mm smooth intersection for the moulded fillets, and then:
  - **carves out separate parts**: hot shoe, dials, buttons, protruding mount ring, strap lugs;
  - **clamps flat faces** that the photos can't define cleanly, such as the rear face where buttons protrude;
  - **cuts the mount throat** to the flange distance (Canon RF 20 mm; other mounts differ: look it up);
  - **cuts the battery chamber, card slot and port bays** that open when doors open;
  - **smooths the field by 0.4 mm**;
  - **splits panels from the same field** with a 0.35 mm seam gap.
- **Mesh** with `sdf_to_mesh.py` (OpenVDB).
- **Render the six calibrated views** with `render_views.py`, then score them with `compare.py`. Gate: IoU ≥ 0.92 in every view, with overshoot ("model outside photo") ≤ 4%. Iterate on the masks, cuts and clamps until it passes.

### 5. Parts, markings, materials, anchors (stage report: full renders vs photos)
- **Write `build_<camera-id>.py`** following `build_r100.py`. Model each control as its own object (`PART_<PascalId>`). Drop each onto the real shell surface with the `hit()` ray-cast at its measured position, and orient it to the surface normal.
- **Set the origin on the real pivot** for anything that moves (hinge edge, dial axis, press direction). Write `ff_motion`, `ff_axis` (in Three.js axes), `ff_range`, `ff_open` and so on as custom properties. **Set the pivot before attaching children.**
- **Markings:** use the manual's icon SVGs (drop the invisible bounding rectangle), or plain text where an SVG glyph fails to fill. Conform markings to curved surfaces.
- **Never reproduce a manufacturer logotype**: set brand words in a plain typeface.
- **Materials:**
  - **body:** smooth matte polymer with no grain normal map;
  - **grip:** a pebble normal map;
  - **metals:** real metals;
  - **screen:** a separate `SCREEN_Display` plane with clean UVs, so the app can paint the live menu onto it.
- **Anchors:** one `ANCHOR_<PascalId>` Empty per registry part, on the clickable surface centre plus 0.3 mm, parented to its part.
- **Render all views again**, compare them with the photos, and fix any mismatch in position, size or marking.

### 6. Lenses (stage report: lens IoU and length table)
For each shelf lens, use the official side photo:
1. `lens_profile.py` extracts the radius curve, scaled to the official diameter.
2. Set the ring bands in `lens_bands.json`: zoom (ribbed), focus/control (knurled), trim, inner (extending).
3. Set the print and focal-scale positions from the photo.
4. `build_lenses.py` builds the lens.

Gates: the photo-measured length must be within 1 mm of the official length, and the side-render IoU must be ≥ 0.92. Lenses without official photos are built from published dimensions and flagged `ff_approximate`.

### 7. Details: ports, battery, card, accessories (stage report: close-up renders)
- **Use `references/standards.md`** for the connector openings and contacts (USB-C, micro/mini-HDMI, 3.5/2.5 mm jacks, multi-terminals), the battery (manufacturer dimensions plus contact count from its drawing), the card (SD / microSD / CFexpress) and the hot-shoe foot.
- **Follow the manual's insertion orientation exactly** (which way the label and contacts face), and add matching guides in the app.
- **Accessories** such as flashes and grips are built from official photos and specs, as their own root that the app shows on demand.

### 8. Validate, export, integrate (stage report: validator output and browser checks)
- **Export** with `export_glb.py`: Draco desktop, plus `--mobile` LOD.
- **Register the profile** and run `node scripts/validate-camera-profile.js`. It must report every part with its mesh and anchor, and every `PART_*` mapped to a part.
- **Wire up the app** per `references/app-integration.md`.
- **Browser-test:**
  - every hotspot lands on its part, at all six views;
  - doors, covers, battery/card out, lens swap, flash and accessories all work;
  - the rear menu works;
  - there are no console errors;
  - mobile width and the mobile LOD work;
  - the procedural fallback still works.
- **Run `node --test tests/`.**
- **Write the per-camera report**: `docs/<camera-id>_MODEL_REPORT.md`, covering method, accuracy tables, approximations and sources.
- **Update the README's camera list**, add a vault log line, then commit (and push only if the user asks).

## Definition of done (all must be true)
- **Size:** within 1 mm of the official W/H/D on each axis. Allowed exception: protrusions the spec excludes, documented.
- **Silhouette:** IoU ≥ 0.92 in all six views, with overshoot ≤ 4%. Every lens with a photo meets the same gate, and its length is within 1 mm.
- **Parts:** every numbered part on the manufacturer's diagrams is in the registry with its official name and a source. Nothing is invented.
- **Validator:** passes for desktop and mobile GLBs.
- **Interaction:** every hotspot sits on its part in all views; all moving parts move on real pivots.
- **Honesty:** approximations are listed in the report and flagged in the registry.
- **Licensing:** no manufacturer photos, logos or comparison sheets are in git; `fetch_refs.py` restores the references.

Never claim scan-level accuracy. These models are hand-built from photos and published dimensions; say so in the UI note and the report.
