"""Overlay model renders on the Canon photos and score the silhouette match.

python -I compare.py <reference_dir> <render_dir> <out_dir>
For each view writes cmp_<view>.png: photo on the left, render on the right, and in the middle the photo with
the render silhouette outline (cyan) and the photo outline (red). Prints silhouette IoU per view.
"""
import sys, os
import numpy as np
from PIL import Image
from scipy import ndimage as ndi

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import views as V

ref, ren, out = sys.argv[1:4]
os.makedirs(out, exist_ok=True)
N = 1000
for v, f in V.PHOTOS.items():
    rp = os.path.join(ren, "render_%s.png" % v)
    if not os.path.exists(rp): continue
    photo = Image.open(os.path.join(ref, f)).convert("RGB").resize((N, N), Image.LANCZOS)
    r = Image.open(rp).convert("RGBA").resize((N, N), Image.LANCZOS)
    pa = np.asarray(photo).astype(np.int16)
    pm = np.abs(pa - np.array([246, 246, 246])).max(2) > 22
    pm = ndi.binary_fill_holes(ndi.binary_closing(pm, iterations=2))
    rm = np.asarray(r)[..., 3] > 128
    iou = (pm & rm).sum() / max(1, (pm | rm).sum())
    ov = np.asarray(photo).copy()
    ov[pm ^ ndi.binary_erosion(pm, iterations=2)] = [255, 40, 0]
    ov[rm ^ ndi.binary_erosion(rm, iterations=2)] = [0, 230, 255]
    bg = Image.new("RGB", (N, N), (246, 246, 246)); bg.paste(r, (0, 0), r)
    strip = Image.new("RGB", (3 * N, N)); strip.paste(photo, (0, 0)); strip.paste(Image.fromarray(ov), (N, 0)); strip.paste(bg, (2 * N, 0))
    strip.resize((1800, 600), Image.LANCZOS).save(os.path.join(out, "cmp_%s.png" % v))
    # where the render overshoots (cyan-only) or falls short (red-only), as % of photo area
    over = (rm & ~pm).sum() / pm.sum() * 100; under = (pm & ~rm).sum() / pm.sum() * 100
    print("%-6s IoU %.3f  model outside photo %.1f%%  photo not covered %.1f%%" % (v, iou, over, under))
