# Canon EOS R100 model: technical report

Date: 2026-11-10. This covers stages 1–5 of the brief (audit, references, Blender model, validation, Three.js integration) plus the motion work they needed. Earlier notes: [IMPLEMENTATION_AUDIT.md](IMPLEMENTATION_AUDIT.md).

## What you get

| Deliverable | Path |
|---|---|
| Editable Blender project | `blender/eos-r100/Canon_EOS_R100.blend` (219 objects, 17 collections) |
| Web model, desktop | `assets/models/canon-eos-r100/Canon_EOS_R100.glb` (1.90 MB Draco: body about 167k triangles plus all 10 lenses, only the mounted one is drawn; 25 PBR materials, 4 WebP textures) |
| Web model, mobile | `assets/models/canon-eos-r100/Canon_EOS_R100_mobile.glb` (1.60 MB Draco, decimated body panels, same 423 nodes, anchors and pivots) |
| Shelf lenses | `blender/eos-r100/build_lenses.py`, `lens_bands.json`, `lens_profiles/*.json`, comparisons in `renders/lenses/` |
| Part registry (single source of truth) | `js/camera/eos_r100_profile.js` (55 parts, Canon names, sources, mesh and anchor names) |
| Registry ↔ GLB validator | `node scripts/validate-camera-profile.js` |
| GLB loader + animation adapter | `js/cam3d_glb.js` |
| Viewer (GLB first, procedural fallback, anchor hotspots) | `js/cam3d.js` |
| Explorer page wired to the registry | `js/explore.js`, `css/explore.css` |
| Reference photos, Canon diagrams, icons, sources | `assets/models/canon-eos-r100/reference/` (`SOURCES.md`) |
| Measurements and traced panel outlines | `blender/eos-r100/measurements.json`, `panels.json` |
| Comparison renders (model next to each Canon photo) | `blender/eos-r100/renders/compare/` (+ `scores.txt`) |

## How the model is built

The body is not modelled by eye. It comes straight from Canon's photos:

1. **Silhouettes** (`tools/masks.py`): the six orthographic Canon gallery photos (front, rear, top, bottom, left, right) are segmented into camera outlines. Canon's gallery crops each photo tight to the camera, so each photo is calibrated to the published size, 116.3 × 85.5 × 68.8 mm (Canon Specifications page).
2. **Visual hull** (`tools/hull.py`): a point belongs to the shell only if it falls inside the outline in every photo. Each outline becomes a signed distance field, and the views are combined with a 4 mm smooth intersection, which gives moulded edge fillets. Volumes that are separate parts (hot shoe, dials, buttons, mount ring, strap lugs) are carved out. The back is clamped to the measured rear face (y 52.6 mm) so button bumps in the photos don't ripple it.
3. **Panels**: the eyecup, pop-up flash head, card/battery door, both terminal covers, thumb rest, grip covering and front leatherette are cut from the same field along outlines traced from the photos, with a 0.35 mm seam gap. Their seams line up exactly.
4. **Mesh** (`tools/sdf_to_mesh.py`): OpenVDB volume to mesh inside Blender, faces flipped outward, then decimated and UV-unwrapped at 10 mm per texture tile.
5. **Details** (`build_r100.py`, `build_lens.py`): each control is modelled as its own object and dropped onto the real surface by ray-casting at its measured position. Button markings use Canon's own manual glyph SVGs (✱, AF frame, magnify, index, INFO, playback, ISO, flash, exposure compensation, erase, drive, self-timer, the A+/Hybrid Auto/SCN/creative-filter mode icons, focal plane, USB, MIC), conformed to curved surfaces. MENU, Q/SET, HDMI, ON/OFF and the mode letters are plain text.
6. **Export** (`tools/export_glb.py`): GLB, +Y up, metres, custom properties as glTF extras, Draco mesh compression (16-bit positions). `--mobile` decimates the heavy panels to 40% and halves the normal maps.

### Rebuild from scratch (about 1 minute)
```bash
python -I blender/eos-r100/tools/masks.py assets/models/canon-eos-r100/reference blender/eos-r100/build/masks
python -I blender/eos-r100/tools/hull.py blender/eos-r100/build/masks blender/eos-r100/build 0.25
"C:/Program Files/Blender Foundation/Blender 5.2/blender.exe" -b --factory-startup --python blender/eos-r100/tools/sdf_to_mesh.py -- "<abs path>/blender/eos-r100/build"
"C:/Program Files/Blender Foundation/Blender 5.2/blender.exe" -b blender/eos-r100/build/shell.blend --python blender/eos-r100/build_r100.py -- "<abs project root>"
"C:/Program Files/Blender Foundation/Blender 5.2/blender.exe" -b blender/eos-r100/Canon_EOS_R100.blend --python blender/eos-r100/tools/export_glb.py -- "<abs path>/assets/models/canon-eos-r100/Canon_EOS_R100.glb"
"C:/Program Files/Blender Foundation/Blender 5.2/blender.exe" -b blender/eos-r100/Canon_EOS_R100.blend --python blender/eos-r100/tools/export_glb.py -- "<abs path>/assets/models/canon-eos-r100/Canon_EOS_R100_mobile.glb" --mobile
node scripts/validate-camera-profile.js
```
Validation renders: `FF_HIDE_LENS=1 blender -b Canon_EOS_R100.blend --python tools/render_views.py -- <out> eevee 1400`, then `python -I tools/compare.py <reference dir> <out> <out>/compare`.
`blender/eos-r100/build/` is a regenerable cache.

## Accuracy

Silhouette overlap with Canon's photos (body only, `renders/compare/scores.txt`):

| View | IoU | Model outside the photo | Photo not covered |
|---|---|---|---|
| Front | 0.966 | 0.6% | 2.9% |
| Rear | 0.969 | 1.1% | 2.0% |
| Top | 0.932 | 3.7% | 3.4% |
| Bottom | 0.942 | 1.9% | 4.0% |
| Right (grip) | 0.942 | 2.3% | 3.6% |
| Left (mic) | 0.936 | 4.1% | 2.6% |

Internal cross-checks of the photo calibration: the mount opening measures 54.8 mm (spec 54), the sensor 22.4 mm (spec 22.3), and the lens axis, hot shoe, tripod socket and eyepiece line up within 1 mm. Expect about ±1 mm on major forms and about ±1.5 mm on small controls. The rear and top comparison renders show every button, dial and marking landing on its photographed position.

Corrections to the previous app, now fixed:
- **Mode dial order** is the physical ring order A+ → Hybrid Auto → SCN → Creative filters → Movie → M → Av → Tv → P (was wrong).
- **AE lock and AF point buttons** are stacked vertically on the right edge (were side by side).
- **The cross keys** are one ring with four press points, carrying Canon's four official function names (were four separate buttons).
- **The dioptric adjustment slider** is under the viewfinder housing (Canon diagram + bottom photo).
- **The Dial** is a wheel rolled front-to-back.
- **The microphone** is monaural (text said stereo).
- **LP-E17 battery life** is about 320 shots (viewfinder) / 400 (screen) per Canon (was 340–430).
- **The RF-S kit lens** has a red mount index (was drawn white).
- **Front face, mount, sensor**: the sensor sits 20 mm behind the mount face (flange distance), and Canon's spec values now carry a source and date.

## In the app

- **Loading**: Three.js r160 now loads as an ES module through an import map in `index.html` and is exposed as `window.THREE` for the existing modules. `GLTFLoader`, with `DRACOLoader` (decoder from the same jsDelivr Three.js release), loads the GLB once; each viewer (explorer and landing) gets its own copy with its own materials. Screens under 700 px or devices reporting 4 GB of memory or less get the mobile build. `?lod=mobile` or `?lod=desktop` forces one.
- **Hotspots**: each dot is projected every frame from its `ANCHOR_*` node authored in Blender, at the centre of the clickable surface. Never bounding boxes. A dot hides when the part faces away (anchor normal test), when something else is in front of it (ray-cast once the view settles), or when its state hides it:
  - mount, contacts and lock pin only with the lens off;
  - ports only with their cover open;
  - battery and card only with the door open;
  - shutter and processor only in x-ray or the exploded view.
- **Highlight**: the selected part's own surfaces glow amber, and a hovered part lifts slightly. Each lit mesh gets a cached material clone, so parts that share a material don't light up together, and the highlight survives x-ray toggles.
- **Labels**: the selected part gets a label that moves to stay inside the stage. The dot never moves off its anchor.
- **Small stages**: phone-width viewers show only operable controls, plus the selection.
- **One registry**: the part list, guided tour, view jumps, hotspots, tooltips and detail card all come from `js/camera/eos_r100_profile.js`. The card shows the Canon name, the UI alias, what the part does, its printed marking, the lesson link, a verification status and the source.
- **Actions**: clicking a 3D control calls the same action as the on-page control: power, mode dial, flash, door, covers, shutter, MENU, INFO, Q/SET, playback, lens release. Clicking a sector of the cross-key ring presses that direction, and the detail card has the four press points as buttons.
- **Motion**: every motion uses the real pivot set in Blender.
  - Flash: hinge at the rear edge.
  - Door: inner-edge hinge.
  - Covers: front-edge hinges.
  - Mode dial: 40° steps.
  - Power lever: about the dial axis.
  - Shutter button: press travel.
  - Shutter curtains: slide.
  - Kit lens: the zoom ring turns 55° from 18 to 45 mm, the inner barrel extends, a 7-blade iris tracks the f-number, and the lens twists 60° to unlock.
  - Selecting a part turns the camera to face it, and the page opens with a short entrance swing. Both are instant with `prefers-reduced-motion`.
- **Fallback**: if the GLB fails to load, the viewer uses the old procedural teaching model and says so on the stage. Tested by forcing a load failure.

## Known approximations and unresolved details

- **Hand-built, not a scan.** The shell is a visual hull, so concave areas that no single photo shows (the finger recess inside the grip, the curvature between the grip and the mount) are filled out to the nearest silhouette. Product photos have mild perspective, absorbed by separate scaling per view (about 1–2%).
- **Placed from Canon's diagrams, not visible in the photos:**
  - access lamp;
  - DC cord hole flap;
  - which set of holes is the microphone and which is the speaker.
  
  These are flagged `approximate` in the registry.
- **Internal parts** are illustrations, flagged `educational`: shutter unit, main board, battery and card placement, lens element groups and aperture. Canon publishes no internal geometry.
- **Kit lens** is a lathe model from four side and three-quarter photos. The barrel extension at each focal length is an estimate.
- **Shelf lenses**: seven (RF 50, RF 16, RF 28, RF 35 Macro, RF-S 55-210, RF-S 10-18, RF-S 18-150) are profiled from Canon side photos and cover the published lengths within 1 mm. Their ring bands were set partly by hand where printing fooled the texture classifier, and their focal scales were read off the photos. Two have no Canon product photo and are built from published dimensions with a generic layout, flagged `ff_approximate`: the RF 85 Macro (Canon's CDN serves none) and the RF 100-400 (its gallery holds only sample pictures). The 35, 85 and 100-400 diameters come from the app's data, not a Canon page. Canon UK lists the 55-210 as 69 x 135 mm, but its side photo measures 93.6 mm, matching the 93 mm the app already used. Switches, the switch panels and the RF 35's macro scale are not modelled.
- **The Canon logotype is not reproduced.** "Canon" and "EOS" are set in a plain typeface. The remote-terminal symbol on the left cover isn't drawn, because its glyph isn't in the manual icon set.
- **Mobile build** is a uniform decimation of the large panels, not a hand-made low-poly model; small parts are unchanged. Draco needs the decoder from jsDelivr: if that CDN is blocked, the viewer falls back to the teaching model.
- **Not used**: Higgsfield (no AI imagery was used as a geometry reference, by design), and the Blender MCP connection (Blender ran headless through scripts instead, which is reproducible).

## Shelf lenses
Pipeline: `tools/fetch_lens_refs.py` (Canon gallery photos) → `tools/lens_profile.py` (radius at every mm from the side photo, scaled to Canon's diameter, flange found where the bayonet narrows) → `lens_bands.json` (where each ring, trim, print and focal mark sits) → `build_lenses.py` (lathe objects, wrapped printing, anchors) → `tools/render_lenses.py` + `tools/compare_lenses.py` (side render with the photo's framing, outline IoU).

| Lens | Outline IoU vs Canon photo | Length check (photo vs Canon spec) |
|---|---|---|
| RF-S 18-45 (kit) | 0.943 | 44.5 vs 44.3 mm |
| RF 50 F1.8 | 0.975 | 40.4 vs 40.5 |
| RF 16 F2.8 | 0.982 | 40.5 vs 40.2 |
| RF 28 F2.8 | 0.927 | 23.8 vs 24.7 |
| RF 35 F1.8 Macro | 0.980 | 62.6 vs 62.8 (data.js) |
| RF-S 55-210 | 0.984 | 93.6 vs 92.8 (data.js) |
| RF-S 10-18 | 0.983 | 45.3 vs 44.9 |
| RF-S 18-150 | 0.976 | 85.0 vs 84.5 |
| RF 85 F2 Macro, RF 100-400 | no photo | built to 78 x 90.5 and 79.5 x 164.7 mm |

In the app every lens is the GLB model. Each one's zoom ring turns through its photographed focal scale, its inner barrel slides out by the app's extension value, a 7- or 9-blade iris follows the f-number, and its hotspots use `ANCHOR_<Part>__<lens id>` (the kit lens keeps the plain names). The procedural lenses remain as the fallback.

## Maintaining the model
- **Move a part**: edit its numbers in `measurements.json` (frame: x from the grip edge, y from the grip front, z from the bottom, in mm), rebuild, export, then run the validator.
- **Add a part**: add a row to `ROWS` in `js/camera/eos_r100_profile.js` (Canon name, view, legacy id, action, lesson, marking, text, status, source), model a `PART_<PascalId>` with an anchor in `build_r100.py`, rebuild, then run the validator. It fails if any part lacks a mesh or an anchor, or if a `PART_*` mesh has no registry entry.
- **Adding another camera** means a new profile file, a new reference set and the same pipeline. Nothing in `cam3d.js` is R100-specific except the fallback model.
