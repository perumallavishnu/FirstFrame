# Accuracy gates

A camera doesn't ship until every gate passes or each failure is documented and agreed with the user. Report the numbers in a table, never "looks right".

## Before modelling (calibration)
| Check | Pass |
|-------|------|
| Each photo's silhouette touches the frame on the axis used for scale (tight crop) | Yes, or a margin is measured |
| The same dimension measured from two views (for example width from front and top) | Within 0.5 mm |
| Mount throat diameter vs the mount standard (Canon RF 54 mm, Nikon Z 55 mm, Sony E 46.1 mm, Fujifilm X 43.5 mm, L 51.6 mm, MFT 38 mm) | Within 1 mm |
| Sensor opening width vs the spec | Within 0.5 mm |
| Lens axis: mount centre, hot shoe centre, tripod socket and eyepiece share an x (when the design centres them; confirm in the photo) | Within 1 mm |

If any check fails, the calibration or the photo choice is wrong. Fix it before building the shell.

## Shell
| Check | Pass |
|-------|------|
| IoU per view (front, rear, top, bottom, left, right) | ≥ 0.92 each (R100 reached 0.93–0.97) |
| Overshoot (model pixels outside the photo silhouette) | ≤ 4% |
| Bounding box vs the official W × H × D | Within 1 mm per axis |
| Surface | No streaks, ridges or steps visible in a raking-light render |
| Normals | ≥ 99% pointing outward |

## Parts
- Every registry part has a mesh and an anchor (the validator checks this).
- In an overlay against each photo, every visible control lands within about 1 mm (major parts) or 1.5 mm (small parts).
- The marking glyphs match the manual's icons and sit on the right face.
- Moving parts rotate about their real hinge or axis, and their range matches the photos or manual (for example, a cover opens to about 100–120°).

## Lenses
| Check | Pass |
|-------|------|
| Photo-measured length vs the official length | Within 1 mm |
| Side-render IoU vs the photo | ≥ 0.92 (R100 shelf reached 0.93–0.98) |
| Diameter | Official value, or the measured value with the discrepancy documented |
| Filter thread and mount | Match the spec |

## Details
- The connector opening matches the standard (see `standards.md`) to within 0.1 mm, with the right contact count and pitch.
- Battery and card dimensions match the published values, with the contact count and side from the manual drawing.
- The insertion orientation in the model and the app guide matches the manual's diagram.

## App
- `node scripts/validate-camera-profile.js` passes for desktop and mobile GLBs.
- `node --test tests/` passes.
- Browser:
  - every hotspot sits on its part in all six snap views;
  - there are no console errors;
  - the mobile LOD loads at phone width;
  - the procedural fallback still works when the GLB is missing.
- Desktop GLB ≤ about 2.5 MB; mobile GLB ≤ about 2 MB.

## Reporting
Write the tables into `docs/<camera-id>_MODEL_REPORT.md` with the date, and list every `approximate` item with its reason.
