# Sourcing a camera

Accuracy is capped by the sources. Collect all of them before measuring anything, and record each one in `assets/models/<camera-id>/reference/SOURCES.md` (URL, access date, what it was used for).

## Priority order
1. **Official online manual**: the part-names page with numbered diagrams, the battery/card insertion page, the terminals page, and the control-icon images. This decides what exists and what it is called.
2. **Official spec page**: W × H × D (and what the depth excludes, for example "from grip to monitor"), weight, mount and flange distance, sensor size, screen size/type, ports, battery model, card type, flash guide number, viewfinder.
3. **Official product gallery**: orthographic views (front, rear, top, bottom, both sides) on a plain background, at the largest size the CDN serves. These are the measuring photos.
4. **Official lens pages**: diameter × length, filter size, weight, plus a straight side photo.
5. **Official accessory pages**: flash, battery, grip.
6. **Standards documents** for connectors and cards: see `standards.md`.

Never use: AI-generated images, renders by third parties, retailer photos with perspective, memory, or another camera's numbers. A forum teardown may help you understand a detail but is never a measurement source.

## Finding the gallery images (CDN probing)
Manufacturer stores serve product images from a CDN with predictable names. Open the product page in the built-in browser, read the network requests or the `<img>`/`srcset` URLs, then strip the resize parameters and ask for the largest width.
- **Canon:** `https://i1.adis.ws/i/canon/<SKU>_<Name>_<NN>?...&w=2000`. NN = 01 front, 02 rear, 03 three-quarter, 05 top, 06 bottom, 07 right, 08 left (it varies by product: check each). See `blender/eos-r100/tools/fetch_refs.py`.
- **Canon manual:** `https://cam.start.canon/en/<code>/manual/html/`. The part-names page is `UG-00_Before_0110.html`, and the icons are under `screens/icon_*.svg`.
- **Nikon, Sony, Fujifilm, Panasonic, OM System:** use the same method. Find the gallery image URL, then probe numbered siblings and larger widths. Record the pattern in `fetch_refs.py`.
- Probe politely: one request at a time, a normal User-Agent, and stop on errors.

## Check each measuring photo
- **Orthographic:** parallel edges stay parallel, and the front view shows no top surface. Reject three-quarter shots for measuring, though they are fine for checking.
- **Cropped tight:** the silhouette touches the image edges on the long axis, or you know the margin.
- **Same body configuration:** with or without a lens, and with the eyecup on. Note what the photo shows; a body cap changes the front silhouette.
- **Plain background**, so segmentation is clean.

## Copyright
Manufacturer photos, manual pages and icons are copyrighted. Store them only under `assets/models/<camera-id>/reference/` (git-ignored except `SOURCES.md`) and make `fetch_refs.py` re-download them. Never commit them, renders that composite them (comparison sheets), or logos. A render of our own model is our own work and can be committed.

## Unresolved items
When sources disagree (for example, Canon UK lists the 55-210 at 69 mm diameter but the photo measures 93.6 mm), trust what can be measured and cross-checked, record both in `SOURCES.md` and the report, and tell the user.
