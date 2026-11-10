"""Step 2: the EOS R100 shell as a visual hull of the six Canon silhouettes.

Usage: python -I hull.py <mask_dir> <out_dir> [voxel_mm]
A point is inside the shell only if it projects inside the camera outline in every photo. Each silhouette becomes
a 2D signed distance field (mm, negative inside), extruded along its viewing axis. The three axis groups are
combined with a smooth max so edges where two views meet get a fillet, as on the moulded body. Volumes that belong
to separate parts (hot shoe, dials, buttons, mount ring, strap lugs) are clipped out so they can be modelled on their own.

Frame (mm): x 0 = grip-side edge to 116.3 = mic side; y 0 = front of grip to 68.8 = back of eyecup; z 0 = bottom to 85.5.
Then splits off the separate panels in ../panels.json (covers, door, flash head, eyecup, thumb rest, leatherette).
Writes one cropped <ObjectName>.npy per part (float32, x/y/z order, positive outside) and parts_manifest.json.
"""
import sys, os, json
import numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage as ndi

W, D, H = 116.3, 68.8, 85.5
# silhouette pixel extents (full-res) measured by masks.py; the gallery crops each view tight to the object
CAL = {
    "front":  {"u": (2, 1997, "x"),  "v": (255, 1747, "z-")},
    "rear":   {"u": (2, 1997, "x-"), "v": (251, 1751, "z-")},
    "top":    {"u": (2, 1997, "x-"), "v": (416, 1583, "y")},
    "bottom": {"u": (2, 1997, "x"),  "v": (433, 1565, "y")},
    "right":  {"u": (223, 1775, "y-"), "v": (2, 1997, "z-")},
    "left":   {"u": (240, 1759, "y"),  "v": (2, 1997, "z-")},
}
SPAN = {"x": W, "y": D, "z": H}


def sdf2d(mask):
    inside = ndi.distance_transform_edt(mask)
    outside = ndi.distance_transform_edt(~mask)
    return (outside - inside).astype(np.float32)  # pixels, positive outside


def to_px(cal, coords):
    """map frame coordinates to pixel position along one image axis"""
    a, b, ax = cal
    neg = ax.endswith("-"); k = ax[0]
    t = coords[k] / SPAN[k]
    if neg: t = 1 - t
    return a + t * (b - a), (b - a) / SPAN[k]  # pixel, px per mm


def view_field(mask, cal, xs, ys, zs, smooth=0.35):
    """2D signed distance (mm) of a photo-space mask, sampled on the frame grid of the two axes the view sees.
    Returned with axes in x,y,z order and size 1 along the viewing axis, so it broadcasts as an extrusion."""
    s = sdf2d(mask)
    px_mm = 0.5 * (abs(cal["u"][1] - cal["u"][0]) / SPAN[cal["u"][2][0]] + abs(cal["v"][1] - cal["v"][0]) / SPAN[cal["v"][2][0]])
    if smooth: s = ndi.gaussian_filter(s, sigma=smooth * px_mm)
    ka, kb = cal["u"][2][0], cal["v"][2][0]
    G = {"x": xs, "y": ys, "z": zs}
    ga, gb = np.meshgrid(G[ka], G[kb], indexing="ij")
    u, _ = to_px(cal["u"], {ka: ga}); vv, _ = to_px(cal["v"], {kb: gb})
    d = ndi.map_coordinates(s, [vv, u], order=1, mode="nearest") / px_mm
    axes = ["xyz".index(ka), "xyz".index(kb)]
    missing = [i for i in range(3) if i not in axes][0]
    return np.transpose(np.expand_dims(d, 2), np.argsort(axes + [missing]))


def smax(a, b, k):
    h = np.clip(k - np.abs(a - b), 0, None) / k
    return np.maximum(a, b) + h * h * k * 0.25


def main(mdir, out, vox=0.25):
    pad = 2.0
    xs = np.arange(-pad, W + pad, vox, dtype=np.float32)
    ys = np.arange(-pad, D + pad, vox, dtype=np.float32)
    zs = np.arange(-pad, H + pad, vox, dtype=np.float32)
    print("grid", len(xs), len(ys), len(zs))
    def load(v):
        m = np.asarray(Image.open(os.path.join(mdir, v + "_mask.png"))) > 127
        if v in ("top", "bottom", "left", "right"):
            # let the rear face come only from the measured clamp plane below: extend these silhouettes 2.5 mm
            # past it (outside the viewfinder), so button bumps and perspective in the photos can't ridge the back
            m = m.copy(); cal = CAL[v]
            if v in ("top", "bottom"):
                yr, _ = to_px(cal["v"], {"y": np.float32(55.0)}); yr = int(yr)
                for u in range(m.shape[1]):
                    x = (u - cal["u"][0]) / (cal["u"][1] - cal["u"][0]) * W
                    if cal["u"][2].endswith("-"): x = W - x
                    rows = np.where(m[:, u])[0]
                    if len(rows): m[rows.min():yr, u] = True  # only adds; the eyecup behind it stays as photographed
            else:
                yr, _ = to_px(cal["u"], {"y": np.float32(55.0)}); yr = int(yr)
                for r in range(m.shape[0]):
                    z = H - (r - cal["v"][0]) / (cal["v"][1] - cal["v"][0]) * H
                    cols = np.where(m[r])[0]
                    if len(cols) and z < 56.5:
                        if v == "right": m[r, yr:cols.max()] = True
                        else: m[r, cols.min():yr] = True
        return m
    F = {v: view_field(load(v), cal, xs, ys, zs) for v, cal in CAL.items()}
    ext = F.__getitem__
    XZ = np.maximum(ext("front"), ext("rear"))
    XY = np.maximum(ext("top"), ext("bottom"))
    YZ = np.maximum(ext("left"), ext("right"))
    k = 4.0  # mm fillet where two views meet
    sdf = smax(smax(XZ, XY, k), YZ, k)

    X = xs[:, None, None]; Y = ys[None, :, None]; Z = zs[None, None, :]
    def cut_cyl_z(cx, cy, r, zmin):  # remove a vertical cylinder above zmin
        return np.maximum(np.sqrt((X - cx) ** 2 + (Y - cy) ** 2) - r, zmin - Z)
    def cut_box(x0, x1, y0, y1, z0, z1):
        r = np.maximum(x0 - X, X - x1)
        for t in (y0 - Y, Y - y1, z0 - Z, Z - z1): r = np.maximum(r, t)
        return r
    cuts = [
        cut_box(-9, 200, -9, 200, 83.3, 99),                 # hot shoe sits on a flat hump top
        cut_cyl_z(25.4, 40.2, 7.6, 67.4),                    # mode dial
        cut_cyl_z(23.3, 6.1, 5.4, 69.3),                     # shutter button
        cut_cyl_z(33.1, 26.1, 3.4, 69.8),                    # movie shooting button
        np.maximum(np.maximum(14.2 - X, X - 29.8), np.sqrt((Y - 19.8) ** 2 + (Z - 69.2) ** 2) - 6.2),  # dial wheel (axis along x)
        # mount ring and lens release protrude ahead of the front face, which sits at y 17.0 beside the mount
        # (measured from the top and bottom masks at x 104-112). Between grip and hump the cut runs full height.
        cut_box(34.7, 120, -9, 17.0, -9, 69.8),
        cut_box(34.7, 46.0, -9, 17.0, 69.8, 99),
        cut_box(-9, 1.2, 35, 43, 57, 65),                    # strap lug, grip side
        cut_box(115.1, 130, 29, 37, 60, 69),                 # strap lug, mic side
    ]
    for c in cuts:
        sdf = np.maximum(sdf, -c)
    # rear face: buttons stand ~3 mm proud of it in the side/top photos and would smear into ridges, so clamp the
    # back flat at y 52.6 (measured 52.0-53.0 across views) everywhere outside the viewfinder housing
    vf = np.maximum(np.maximum(44.0 - X, X - 94.0), np.maximum(56.5 - Z, Z - 90.0))
    sdf = np.maximum(sdf, np.minimum(Y - 52.6, vf))
    # mount throat: 54 mm opening running back to the sensor box
    sdf = np.maximum(sdf, -np.maximum(np.sqrt((X - 69.3) ** 2 + (Z - 34.9) ** 2) - 27.2, Y - 32.2))  # sensor 20 mm behind the 11.6 mount face

    # ---- panels: each is cut from the same field, so seams line up exactly ----
    panels = json.load(open(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "panels.json")))
    def poly_field(view, poly):
        cal = CAL[view]
        canvas = Image.new("L", (2000, 2000), 0); ImageDraw.Draw(canvas).polygon([tuple(p) for p in poly], fill=255)
        return view_field(np.asarray(canvas) > 127, cal, xs, ys, zs, smooth=0.1)
    GAP = 0.35
    # 0.4 mm smoothing of the whole field: removes the 0.25 mm voxel stair-steps that glossy reflections turned into
    # visible ripples, while real edges (fillets of several mm) survive
    sdf = ndi.gaussian_filter(sdf, sigma=0.4 / vox).astype(np.float32)
    base = sdf.copy()
    parts = {}
    def skin(R, t): return np.maximum(np.maximum(base, R), -(base + t))
    for key, name in [("terminal-cover-right", "PART_TerminalCoverRight"), ("terminal-cover-left-mic", "PART_TerminalCoverLeft"),
                      ("terminal-cover-left-remote", "PART_TerminalCoverLeftRemote"), ("thumb-rest", "BODY_ThumbRest"),
                      ("card-battery-cover", "PART_CardBatteryCover")]:
        pn = panels[key]
        # a prism runs right through the body, so keep only the half facing the photo
        half = {"right": X - 20.0, "left": 96.0 - X, "rear": 45.0 - Y, "bottom": Z - 10.0}[pn["photo"]]
        parts[name] = skin(np.maximum(poly_field(pn["photo"], pn["poly"]), half), pn["skin_mm"])
    fl = panels["built-in-flash"]
    # the pop-up head is only the front of the hump cap, hinged just ahead of the hot shoe (Canon flash-up diagram)
    parts["PART_BuiltInFlash"] = np.maximum(np.maximum(np.maximum(base, poly_field("right", fl["poly"])), fl["z_min_mm"] - Z), Y - fl["y_max_mm"])
    box_eye = np.maximum(np.maximum(47.9 - X, X - 89.1), np.maximum(59.3 - Z, Z - 81.8))
    parts["PART_Eyecup"] = np.maximum(np.maximum(base, box_eye), 60.0 - Y)
    zb = np.where(X < 69, 61.2, 55.5); yb = np.where(X < 58, 30.4, 28.0)
    R = np.maximum(np.maximum(Z - zb, Y - yb), 1.5 - Z)
    parts["PART_Grip"] = skin(np.maximum(R, X - 34.2), 0.8)          # Canon "Grip": the covering on the hand grip
    parts["BODY_Leatherette"] = skin(np.maximum(R, 34.2 - X), 0.8)   # same covering across the rest of the front
    for name, f in parts.items():
        sdf = np.maximum(sdf, GAP - f)  # shell minus each panel grown by the seam gap

    # ---- cavities that become visible when doors open ----
    def box(x0, x1, y0, y1, z0, z1):
        r = np.maximum(x0 - X, X - x1)
        for t in (y0 - Y, Y - y1, z0 - Z, Z - z1): r = np.maximum(r, t)
        return r
    # battery chamber for the LP-E17 (33.0 x 14.0 x 49.4 mm, contacts up) and the SD slot behind it (card label faces
    # the front, Canon manual "Inserting/Removing the Battery and Card"); both open onto the card/battery door
    sdf = np.maximum(sdf, -box(8.2, 41.8, 19.3, 34.1, -2, 51.2))
    sdf = np.maximum(sdf, -box(14.2, 39.8, 36.0, 38.9, -2, 34.0))
    # port bays: a 2.8 mm deep recess under each terminal cover, so an open cover shows the sockets in their well
    def bay(view, polys, half):
        pr = None
        for poly in polys:
            f = poly_field(view, poly); pr = f if pr is None else np.minimum(pr, f)
        return np.maximum(np.maximum(np.maximum(pr, half), base), -(base + 2.8))
    sdf = np.maximum(sdf, -bay("right", [panels["terminal-cover-right"]["poly"]], X - 20.0))
    sdf = np.maximum(sdf, -bay("left", [panels["terminal-cover-left-mic"]["poly"], panels["terminal-cover-left-remote"]["poly"]], 96.0 - X))
    parts["BODY_Shell"] = sdf

    manifest = {"voxel_mm": vox, "parts": {}}
    for name, f in parts.items():
        inside = f < 0.5
        idx = [np.where(inside.any(axis=tuple(j for j in range(3) if j != i)))[0] for i in range(3)]
        lo = [max(0, int(a.min()) - 4) for a in idx]; hi = [min(f.shape[i], int(idx[i].max()) + 5) for i in range(3)]
        crop = f[lo[0]:hi[0], lo[1]:hi[1], lo[2]:hi[2]].astype(np.float32)
        np.save(os.path.join(out, name + ".npy"), crop)
        manifest["parts"][name] = {"origin_mm": [float(xs[lo[0]]), float(ys[lo[1]]), float(zs[lo[2]])], "shape": list(crop.shape)}
        print("%-30s %s  vol %.2f cm3" % (name, crop.shape, (crop < 0).sum() * vox ** 3 / 1000))
    json.dump(manifest, open(os.path.join(out, "parts_manifest.json"), "w"), indent=1)


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2], float(sys.argv[3]) if len(sys.argv) > 3 else 0.25)
