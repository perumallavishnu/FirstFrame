# FirstFrame: Stage 1 audit (2026-11-10)

Scope: the EOS R100 3D model and everything that depends on it. Nothing in the app has been modified yet.

## Runtime
- Static `index.html` loads 6 CSS files and 29 IIFE scripts sharing `window.FF`. No build step, no backend, no package.json, not a git repo.
- Three.js r160 is loaded lazily from jsDelivr (`FF.loadThree` in `js/cam3d.js`), as the global UMD build. No GLTFLoader yet (the UMD build doesn't include it; it has to be added from `three@0.160.0/examples/js/loaders/GLTFLoader.js` or the app has to switch to the module build).

## 3D camera: who builds it, who uses it
| File | Role |
|---|---|
| `js/cam3d_model.js` (`FF.cam3dModel`) | Procedural body (`buildBody`) and lenses (`buildLens`) from boxes/cylinders, in cm. Also owns `K.PARTS` (part text), `K.MODES`/`K.DIAL` (mode dial), `K.MOUNT`. |
| `js/cam3d.js` (`FF.cam3d.create`) | Viewer: lighting, orbit, raycast picking via `userData.part`, hotspots (`HOT` list + `placeHots()`), `ACTION`/`KEYS` maps to `FF.menu.key`, tweens, shutter/flash/door/cover/dial/power animation, explode, x-ray, lens detach/attach/drag. |
| `js/explore.js` | 3D Camera page: view buttons, part `<select>`, guided `TOUR`, `SIDE` view map, info panel, working rear LCD + keys, lens shelf. |
| `js/landing.js` | Uses `FF.cam3d.create(stage, {scroll:true, lens:'kit'})` for the cinematic scroll section. |

The `A` handle object returned by `buildBody` is the contract the viewer animates: `A.units` (explode groups with `userData.base/ex`), `A.flash`, `A.door`, `A.cover`, `A.cover2`, `A.dial`, `A.power`, `A.shutterBtn`, `A.curtain1/2`, `A.flashGlass`, `A.battery`, `A.card`, `A.lcd`, `A.shellMats`, plus per-button meshes for press animation. A GLB replacement must provide the same handles (or the viewer must be adapted) so landing and explorer keep working.

## Accuracy problems found (compared with the Canon product photos)
1. **Rear right column is wrong.** The model places AE lock (✱) and AF point side by side horizontally on the top shoulder. On the real camera they are stacked vertically on the right edge of the thumb rest, with magnify/index glyphs beside them.
2. **Cross keys are four separate boxes** (`crossup/down/left/right`). The R100 has one cross-key ring around Q/SET.
3. **Hotspots use bounding boxes + face direction** (`placeHots`): the dot sits at bbox centre pushed along a face normal, not on the button.
4. **Three parallel lists can drift:** `K.PARTS`, `HOT` (cam3d.js), `SIDE` + `TOUR` (explore.js), `ACTION`/`KEYS` (cam3d.js). `crossdown/left/right` exist in `K.PARTS` and `SIDE` but not in `HOT`.
5. **Names differ from Canon's Part Names page:** "Movie button" (Canon: Movie shooting button), "Q / SET button" (Quick Control / Set button), "Electronic viewfinder" (Viewfinder eyepiece / Eyecup), "Rear screen" (Screen), "Main dial" (Dial).
6. **Mode dial list needs checking:** `K.MODES` includes `HYB` (Hybrid Auto). Check against the R100 manual before keeping it.
7. **`speaker` part text says "Stereo microphones";** Canon lists a monaural microphone.
8. **Specs need source + date per value:** AF zone count, eye detection, burst rates, 4K crop/frame rates, size (Canon: 116.3 × 85.5 × 68.8 mm).
9. Parts on Canon's list with no model/registry entry: speaker (separate), DC cord hole, serial number, body cap, lens lock pin, RF mount index, remote control terminal and mic IN as separate parts, digital terminal and HDMI as separate parts.

## Tooling status
- Blender 5.2.2 LTS installed at `C:\Program Files\Blender Foundation\Blender 5.2\blender.exe`. Headless scripting, EEVEE render and the glTF exporter all work.
- The Blender MCP server is configured but **not connected**: Blender isn't running with the add-on (interactive mode), and `BLENDER_PATH` is unset (CLI mode). Fix either to use MCP; headless `blender -b --python` works without it.
- `arjun988/blender-skills` installed to `.claude/skills/` at commit `904f095` (Markdown only, reviewed; nothing executable). Its `.mcp.json` (third-party `uvx blender-mcp`) was deliberately **not** installed.

## Plan (stages)
1. Audit (this document).
2. References: save the seven Canon gallery photos + Part Names diagram to `assets/models/canon-eos-r100/reference/`. Build the canonical part registry (`js/camera/eos_r100_parts.js`): Canon name, UI alias, view, mesh name, anchor name, action, lesson, source URL, date.
3. Blender: scripted hard-surface build at real scale (mm to m), with reference planes calibrated to 116.3 × 85.5 × 68.8 mm, separate `PART_*` objects, `ANCHOR_*` empties, collections as specified. Save `Canon_EOS_R100.blend`.
4. Validation: render the 7 reference angles next to the photos; fix mismatches.
5. Three.js: add GLTFLoader, load the GLB, map nodes to the existing `A` handle contract, project `ANCHOR_*` for hotspots, drive all lists from the registry, keep the procedural model as the fallback if the GLB fails.
6. Motion: intro reveal, focus-on-part camera moves, mechanical animations on real pivots, reduced-motion support.
7. QA: browser test of explorer, landing, simulator; console clean; mobile widths.
8. Handover: technical report.

## Honest limits
- The model is built from product photos and published dimensions, not a scan or CAD. Expect roughly millimetre-level proportion accuracy on major forms; fine curvature will be approximate.
- Higgsfield output is never used as geometry reference.
