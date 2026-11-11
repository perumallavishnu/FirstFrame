# Adding a camera to the app

## What exists today (R100 only)
- **`js/camera/eos_r100_profile.js`** registers `FF.cameraProfiles['canon-eos-r100']` and sets `FF.camera` (the active profile) when none is set. The profile holds the parts registry, `modelUrl`/`mobileModelUrl`, `bodyRoot`, `lensRoots`, `screenMesh`, the `modeDial` order and cited `specs`.
- **`js/data.js` `FF.BODY`** holds the simulator constants: specs table, flash GN and sync, AF limit, fps, buffer, EC range. These are read by `cam_core`, `sim_ui`, `analyze`, `cam_capture`, `pages` and `sim_view`.
- **`js/cam3d_glb.js`** loads the GLB and reads `FF.camera`. Some regexes are R100-specific: EXPLODE groups, SHELL names, `LENS_PART`, and the Speedlite and battery/card take-out names.
- **`js/cam3d.js`** is the viewer, with hotspots built from `ANCHOR_*`. It has the `REG_COND` / `REG_ACTION` / `REG_LEGACY` tables.
- **`js/explore.js`** provides the part list, tour and toggles (flash, Speedlite, battery out, card out).
- **`js/cam_actions.js`** is the single dispatcher, `FF.act.dispatch(type, payload, source)`. It works for any camera, but the handler limits (mode list, ISO range) come from the active profile and `FF.BODY`.
- **`scripts/validate-camera-profile.js`** and **`tests/camera.test.js`** assume the R100 profile.

## One-time generalisation (do it with the second camera, as its own commit)
1. **Move the simulator constants into the profile.** Add `profile.sim = { flash:{gn,sync,label}, afLimitEV, afLimitAperture, maxFps, servoFps, buffer, ecRange, isoRange, shutterRange, modes }`. Make `FF.BODY` a getter that builds the old shape from `FF.camera`, so existing callers keep working, then migrate the callers.
2. **Add a profile switcher.** Add `FF.setCamera(id)`: it sets `FF.camera`, rebuilds `FF.BODY`, disposes and reloads the 3D viewer, resets the simulator state, and fires a `camera/changed` event. Store the choice in `localStorage` (no account, no tracking).
3. **Add a camera picker** to Explore and the simulator header. List `Object.values(FF.cameraProfiles)` with their display names, and mark any with `status:'beta'` while gates are open.
4. **Make the regexes data.** Move the EXPLODE groups, SHELL names, take-out object names, Speedlite root and `LENS_PART` patterns into `profile.model = { explode:{...}, shell:[...], takeOut:{battery, card}, accessories:{...} }`.
5. **Make the validator and tests loop over every profile:** `node scripts/validate-camera-profile.js [id]`, defaulting to all.
6. **Lenses:** keep the lens shelf per mount (`profile.mount`). Only show the lenses that fit the active camera.
7. **Load order in `index.html`:** add each profile script after `eos_r100_profile.js`, each with its own `?v=`.
8. **Keep the procedural fallback** generic: when a profile has no GLB, the viewer shows the procedural body with the profile's part list.

## Per camera
- **Profile:** `js/camera/<camera-id>_profile.js`, from `templates/profile.js`. Register it, but don't overwrite `FF.camera` (use `FF.camera = FF.camera || profile`).
- **Model files:** `assets/models/<camera-id>/<Name>.glb` and `<Name>_mobile.glb`.
- **Script tag:** add one to `index.html` and bump the `?v=` on every changed file.
- **Specs:** every `specs` and `sim` value needs a `sourceUrl` and a `verifiedAt` date.
- **Mode dial and menu:** a camera with no mode dial (for example, a Fujifilm with dedicated shutter and ISO dials) needs its own control mapping in the dispatcher. Model the real controls; never force the Canon layout onto it.
- **Lessons:** link a part to a lesson only when that part really does what the lesson teaches on this camera.
- **README:** add the camera to the supported-cameras list, with screenshots from our own renders.
- **Report:** `docs/<camera-id>_MODEL_REPORT.md`.

## Browser check (built-in browser, `http://localhost:8765`)
1. Pick the new camera in the picker, then check it again after a reload.
2. Snap to all six views: every hotspot dot sits on its part and hides when its part faces away.
3. Click every part: the name, description and source are correct.
4. Toggle every door and cover, battery out, card out, flash and accessories, and swap lenses.
5. Simulator: modes, dials and menu respond, the exposure meters, and capture works.
6. At phone width (375 px), the mobile LOD loads and the primary hotspots are usable.
7. `read_console_messages` shows no errors.
8. Switch back to the R100: it still works exactly as before.
