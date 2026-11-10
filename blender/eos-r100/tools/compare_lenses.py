"""Overlay lens renders on the Canon side photos and score the outline match.
python -I compare_lenses.py <lens_profiles_dir> <render_dir> <out_dir>"""
import sys, os, json
import numpy as np
from PIL import Image
from scipy import ndimage as ndi
pdir, rdir, out = sys.argv[1:4]; os.makedirs(out, exist_ok=True); N = 1000; tiles = []
for f in sorted(os.listdir(pdir)):
    lid = f[:-5]; rp = os.path.join(rdir, "lens_%s.png" % lid)
    if not os.path.exists(rp): continue
    j = json.load(open(os.path.join(pdir, f)))
    photo = Image.open(j["photo"]).convert("RGB").resize((N, N)); a = np.asarray(photo).astype(int)
    pm = ndi.binary_fill_holes(np.abs(a - a[8, 8]).max(2) > 24)
    r = Image.open(rp).convert("RGBA").resize((N, N)); rm = np.asarray(r)[..., 3] > 128
    iou = (pm & rm).sum() / max(1, (pm | rm).sum())
    ov = a.astype(np.uint8).copy(); ov[pm ^ ndi.binary_erosion(pm, iterations=2)] = [255, 40, 0]; ov[rm ^ ndi.binary_erosion(rm, iterations=2)] = [0, 230, 255]
    bg = Image.new("RGB", (N, N), (246, 246, 246)); bg.paste(r, (0, 0), r)
    t = Image.new("RGB", (2 * N, N)); t.paste(Image.fromarray(ov), (0, 0)); t.paste(bg, (N, 0)); tiles.append(t.resize((800, 400)))
    print("%-7s IoU %.3f" % (lid, iou))
sheet = Image.new("RGB", (1600, 400 * ((len(tiles) + 1) // 2)), (255, 255, 255))
for i, t in enumerate(tiles): sheet.paste(t, ((i % 2) * 800, (i // 2) * 400))
sheet.save(os.path.join(out, "lenses_compare.png"))
