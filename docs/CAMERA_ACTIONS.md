# Camera state and the action dispatcher

Brief Prompt 7, done 2026-11-10. One camera state (`FF.cam.state`), one solved exposure (`FF.cam.eff`), and one way to change them: `FF.act.dispatch(type, payload, source)` in `js/cam_actions.js`.

```
simulator deck ─┐
viewfinder ─────┤
rear menu / Q ──┼─► FF.act.dispatch ─► validate for the mode ─► clamp ─► write FF.cam.state
3D buttons ─────┤                       (refuse with a reason)            │
missions ───────┘                                                          ▼
                                     re-solve exposure + AF ─► notify every view once (FF.act.on)
                                                                 deck · HUD · rear LCD · 3D model
capture / review ◄── reads FF.cam.eff (the same numbers the HUD shows)
```

## Rules
- **Never write `FF.cam.state.x = …` from a view.** Dispatch an action. The only remaining direct write is the focus motor snapping to its target inside the capture step (`sim_view.js`).
- **Refusals carry a reason.** For example, dispatching `aperture/step` in Tv returns `{ ok: false, reason: 'Aperture is set by the camera in Tv.' }`. The deck shows the reason as a message and the rear LCD shows it on screen.
- **No-op changes are silent.** A change that leaves the state as it was doesn't notify anyone.
- **Every action carries its source** (`deck`, `viewfinder`, `menu`, `3d`, `mission`), so a view can ignore its own echoes. The 3D viewer does this.
- **`FF.act.log`** holds the last 50 actions for debugging.

## Actions
- **Mode:** `mode/set`, `scn/set`
- **Exposure:** `aperture/step|set`, `shutter/step|set`, `iso/step|set|auto|max`, `ec/set|step`, `meter/set`, `ae/lock`
- **Focus:** `af/mode|area|face|point|press`, `mf/set`
- **Image:** `wb/set`, `style/set`, `nr/set`, `corr/set`
- **Drive and support:** `drive/set`, `flash/set|pop`, `stab/set`, `is/set`, `pan/set`
- **Lens:** `lens/set`, `focal/set`
- **Scene in front of the camera:** `scene/set|light|cct|subject|move|pause`
- **Missions:** `mission/setup` (a known baseline in one action)

## What changed for the user
- **Rear-menu changes take effect at once.** Exposure compensation, metering, flash and ISO set from the menu now re-solve the exposure immediately; before, the numbers stayed stale until the simulator loop happened to re-meter, and on the 3D page they never updated.
- **The 3D model follows the camera.** Its mode dial, flash, mounted lens and zoom follow changes made in the simulator, the menu or a mission. Its own buttons change the same state.
- **The left cross key opens ISO speed** on the shooting screen, as on the R100. It used to only show a message. ISO speed is a new item on the second shooting-menu page.
- **LCD messages show on every screen**, including the reason a setting can't change.
- **Fixed a latent NaN.** Switching mode before the first exposure solve copied undefined step indices into the state.

## Tests
`node --test tests/camera.test.js` runs 13 tests with no dependencies, using the real physics, data, core and dispatcher with a flat stand-in light meter. They cover:
- reciprocity and the third-stop scales;
- Av, Tv and M behaviour;
- exposure carried across a mode switch;
- exposure compensation, and its refusal in A+;
- lens aperture clamping;
- the flash sync limit;
- notification once per change, with its source;
- rejection of invalid values;
- mission setup;
- the fresh-page regression.

Note: the camera stores exact third-stop values (2^(-k/3)) behind nominal labels, so 1/32 s shows as 1/30 and the flash sync step as 1/200 (exactly 1/203). Tests compare against nominal values within a third of a stop.

## Simplified compared with the real camera
- Only P, Tv, Av, M, A+ and SCN (portrait, landscape, sports) are simulated. The Hybrid Auto, creative-filter and movie dial positions are explained, not simulated.
- The Dial turning shutter/aperture, and holding exposure compensation to change aperture in M, aren't modelled as separate inputs. The deck steppers and arrow keys stand in for them.
- The menu's ISO list is in whole stops (the camera also offers third stops), and the Quick Control list is shorter than the camera's.
