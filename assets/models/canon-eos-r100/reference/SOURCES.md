# EOS R100 reference sources

Accessed 2026-11-10. These are reference material for modelling, not app assets. They are Canon's copyright, so don't ship them in the public build.

## Product photos (Canon official gallery, 2000 x 2000 WebP)
`https://i1.adis.ws/i/canon/6052C061_EOS-R100_<NN>?...&w=2000`

| File | View | Notes |
|---|---|---|
| `r100_01_front.webp` | Front, body only | Fills the frame horizontally. Mount, sensor, contacts, lamp, release button |
| `r100_02_rear.webp` | Rear | Screen, eyecup, all rear buttons and markings |
| `r100_03_front34.webp` | Front three-quarter | Depth cues only. Perspective, so don't measure from it |
| `r100_05_top.webp` | Top, front facing up | Dials, shoe, power switch, mic/speaker holes |
| `r100_06_bottom.webp` | Bottom, front facing up | Door, lock, tripod socket, label, diopter slider |
| `r100_07_right.webp` | Grip side | USB/HDMI cover, strap mount. Fills the frame vertically |
| `r100_08_left.webp` | Mic side | MIC/remote covers, strap mount. Fills the frame vertically |

All views are product photography with mild perspective, not orthographic. Measurements scale each view to the official size separately per axis (see `blender/eos-r100/measurements.json`).

## Canon manual (`canon_manual/`)
- `part_names.html`, `UG-00_i0140.svg` (front/bottom diagram), `UG-00_i0180.svg` (rear diagram), `UG-00_i0210/0220/0230.png` (mode dial): https://cam.start.canon/en/C015/manual/html/UG-00_Before_0110.html
- `icons/`: Canon's own glyph SVGs used in the manual (AE lock, AF frame, magnify, index, exp. comp, erase, drive, self-timer, flash, ISO, playback, menu, info, Q/SET, terminals). These are the reference for physical button markings.
- Specifications: https://cam.start.canon/en/C015/manual/html/UG-11_Reference_0080.html (not saved; values recorded in `js/camera/eos_r100_profile.js`)

## Unresolved (needs a better reference)
- Access lamp: not visible in any photo. Placed from back diagram item 8 (next to the thumb rest, above the cross keys).
- DC cord hole: placed from back diagram item 22 at the bottom of the grip-side terminal cover. Exact flap outline unknown.
- Microphone vs speaker holes: mic = 3 holes on the hump top in front of the shoe; speaker = 3 holes on the mic-side shoulder. Inferred from diagram leader lines 11 and 12, not stated in text.
- Inner mount and shutter geometry and the camera's interior are not documented; anything modelled there is educational.
- RF 85mm F2 Macro and RF 100-400mm: no Canon product photos found (see below); both are built from dimensions with a generic layout.

## Shelf lenses (`lens_rf-s_18-45/`, `lenses/<id>/`)
Canon UK gallery images (`https://i1.adis.ws/i/canon/<code>_<name>[_NN]`), fetched by `blender/eos-r100/tools/fetch_lens_refs.py`, 2026-11-10. Product codes from the Canon UK store pages: RF 50 4515C005, RF-S 55-210 5824C005, RF-S 10-18 6262C005, RF-S 18-150 5564C005, RF 16 5051C005, RF 28 6128C005, RF 35 Macro 2973C005, RF 85 Macro 4234C005 (no images served), RF 100-400 5050C005 (the gallery holds sample photos only, no product shots).
Dimensions: canon.co.uk `/lenses/<slug>/specifications/` for the RF 50 (69.2 x 40.5), RF 16 (69.2 x 40.2), RF 28 (69.2 x 24.7), RF-S 10-18 (69 x 44.9), RF-S 18-150 (69 x 84.5) and RF-S 18-45 (69 x 44.3); the RF-S 55-210 page says 69 x 135, which disagrees with its own photo (93.6 mm).
