"""Turn a side-on Canon lens photo (front up, mount down) into a lathe profile.

python -I lens_profile.py <photo> <max_diameter_mm> <out.json> [debug.png]

A lens is a solid of revolution, so in a side view the silhouette half-width at each row is the radius at that point
along the optical axis. The widest row is scaled to Canon's published maximum diameter. Rows below the mount flange
(where the width drops to the bayonet) get negative t. Each row is also classified by its texture:
  ribs  - strong left-right variation, little up-down variation (rubber zoom ring)
  knurl - strong variation both ways (control / focus ring)
  metal - bright and low-saturation (trim rings, bayonet)
  body  - everything else (moulded barrel)
Output: {"px_per_mm", "length_mm" (flange to front), "rows": [[t_mm, r_mm, zone], ...] from mount to front, "bands": [...]}
"""
import sys, json
import numpy as np
from PIL import Image
from scipy import ndimage as ndi

photo, dia, out = sys.argv[1], float(sys.argv[2]), sys.argv[3]
dbg = sys.argv[4] if len(sys.argv) > 4 else None
im = np.asarray(Image.open(photo).convert("RGB")).astype(np.float32)
H, W, _ = im.shape
bg = np.median(np.concatenate([im[:30].reshape(-1, 3), im[-30:].reshape(-1, 3)]), axis=0)
m = np.abs(im - bg).max(2) > 24
m = ndi.binary_fill_holes(ndi.binary_closing(m, iterations=2))
lab, n = ndi.label(m)
m = lab == (1 + int(np.argmax(ndi.sum(m, lab, range(1, n + 1)))))
rows = np.where(m.any(1))[0]; top, bot = rows.min(), rows.max()
left = np.array([np.argmax(m[r]) if m[r].any() else 0 for r in range(H)])
right = np.array([W - 1 - np.argmax(m[r][::-1]) if m[r].any() else 0 for r in range(H)])
width = (right - left + 1) * m.any(1)
cx = np.median(((left + right) / 2)[top:bot + 1])
wmax = np.percentile(width[top:bot + 1], 99.5)
ppm = wmax / dia

# the flange: lowest row (scanning up from the bottom) where the width is back above 90% of max after the narrow bayonet
w = width.astype(float)
flange = bot
for r in range(bot, top, -1):
    if w[r] > 0.9 * wmax:
        flange = r; break
# front: skip the rim ellipse (perspective) - first row from the top whose width reaches 97% of the rows just below it
front = top
for r in range(top, flange):
    if w[r] >= 0.97 * np.median(w[r + 3:r + 15]):
        front = r; break

gray = im.mean(2); sat = im.max(2) - im.min(2)
gx = np.abs(np.diff(gray, axis=1)); gy = np.abs(np.diff(gray, axis=0))
half = max(1, int(0.6 * ppm))  # average texture over +-0.6 mm of rows so printing and seams don't flip zones
res = []
for r in range(front, bot + 1):
    if w[r] <= 0: continue
    a, b = int(cx - w[r] * 0.28), int(cx + w[r] * 0.28)  # central strip, away from the shading at the edges
    r0, r1 = max(0, r - half), min(H - 2, r + half + 1)
    ex = gx[r0:r1, a:b].mean(); ey = gy[r0:r1, a:b].mean(); br = gray[r0:r1, a:b].mean(); st = sat[r0:r1, a:b].mean()
    zone = "metal" if (br > 110 and st < 30) else "knurl" if (ex > 5 and ey > 3.5) else "ribs" if (ex > 5 and ey < 0.55 * ex) else "body"
    res.append([round((flange - r) / ppm, 2), round(w[r] / 2 / ppm, 2), zone, round(float(ex), 1), round(float(ey), 1), round(float(br))])
res.reverse()
# smooth zones: a band must be at least 1.2 mm tall, otherwise it takes its neighbours' zone
z = [x[2] for x in res]; minrows = max(2, int(1.5 * ppm))
changed = True
while changed:
    changed = False; i = 0
    while i < len(z):
        j = i
        while j + 1 < len(z) and z[j + 1] == z[i]: j += 1
        if j - i + 1 < minrows and (i > 0 or j < len(z) - 1):
            nb = z[i - 1] if i > 0 else z[j + 1]
            for k in range(i, j + 1): z[k] = nb
            changed = True
        i = j + 1
bands = []
for k, x in enumerate(res):
    x[2] = z[k]
    if not bands or bands[-1][0] != z[k]: bands.append([z[k], x[0], x[0]])
    else: bands[-1][2] = x[0]
json.dump({"photo": photo, "flange_row": int(flange), "cx": float(cx), "size": [W, H], "px_per_mm": round(ppm, 3), "diameter_mm": dia, "length_mm": round((flange - front) / ppm, 2),
           "bayonet_mm": round((bot - flange) / ppm, 2), "rows": [x[:3] for x in res], "bands": bands}, open(out, "w"))
print("%s  px/mm %.2f  flange->front %.1f mm  bayonet %.1f mm  bands: %s" % (photo.split("/")[-1].split("\\")[-1], ppm, (flange - front) / ppm, (bot - flange) / ppm,
      " ".join("%s[%.1f-%.1f]" % (b[0], b[1], b[2]) for b in bands)))
if dbg:
    col = {"metal": (200, 200, 210), "knurl": (255, 170, 0), "ribs": (0, 170, 255), "body": (90, 90, 90)}
    o = im.astype(np.uint8).copy()
    for x in res:
        r = int(round(flange - x[0] * ppm))
        if 0 <= r < H: o[r, max(0, int(cx + w[r] / 2) + 6):min(W, int(cx + w[r] / 2) + 40)] = col[x[2]]
    o[flange, :] = (255, 0, 0); o[front, :] = (0, 200, 0)
    Image.fromarray(o).resize((500, 500)).save(dbg)
