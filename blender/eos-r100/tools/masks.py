"""Step 1: silhouette masks from the Canon product photos.

Usage: python -I masks.py <reference_dir> <out_dir>
Writes <view>_mask.png (full-res binary) and <view>_overlay.png (half-res check image), and prints the
pixel bounding box of each silhouette so the calibration in hull.py can be checked.
"""
import sys, os, json
import numpy as np
from PIL import Image
from scipy import ndimage as ndi

VIEWS = {"front": "r100_01_front.webp", "rear": "r100_02_rear.webp", "top": "r100_05_top.webp",
         "bottom": "r100_06_bottom.webp", "right": "r100_07_right.webp", "left": "r100_08_left.webp"}


def mask_of(path):
    im = np.asarray(Image.open(path).convert("RGB")).astype(np.int16)
    h, w, _ = im.shape
    # background colour from a 40 px border band (the product never covers all four borders)
    band = np.concatenate([im[:40].reshape(-1, 3), im[-40:].reshape(-1, 3), im[:, :40].reshape(-1, 3), im[:, -40:].reshape(-1, 3)])
    bg = np.median(band, axis=0)
    diff = np.abs(im - bg).max(axis=2)
    m = diff > 22
    m = ndi.binary_closing(m, iterations=2)
    m = ndi.binary_fill_holes(m)
    lab, n = ndi.label(m)
    if n > 1:
        sizes = ndi.sum(m, lab, range(1, n + 1))
        m = lab == (1 + int(np.argmax(sizes)))
    return m, im, bg


def main(ref, out):
    os.makedirs(out, exist_ok=True)
    info = {}
    for v, f in VIEWS.items():
        m, im, bg = mask_of(os.path.join(ref, f))
        ys, xs = np.where(m)
        info[v] = {"x": [int(xs.min()), int(xs.max())], "y": [int(ys.min()), int(ys.max())], "bg": bg.tolist(), "size": list(m.shape[::-1])}
        Image.fromarray((m * 255).astype(np.uint8)).save(os.path.join(out, v + "_mask.png"))
        edge = m ^ ndi.binary_erosion(m, iterations=3)
        ov = im.astype(np.uint8).copy(); ov[edge] = [255, 40, 0]
        Image.fromarray(ov).resize((1000, 1000), Image.LANCZOS).save(os.path.join(out, v + "_overlay.png"))
        print(v, info[v])
    json.dump(info, open(os.path.join(out, "mask_info.json"), "w"), indent=1)


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])
