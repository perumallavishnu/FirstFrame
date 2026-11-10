"""Shared calibration: how each Canon photo maps onto the model frame, and the matching orthographic cameras.

Frame (mm): x 0 = grip-side edge .. 116.3; y 0 = front of grip .. 68.8; z 0 = bottom .. 85.5.
Blender (m): X = (x - 58.15)/1000, Y = (y - 34.4)/1000, Z = (z - 42.75)/1000. Front faces -Y.
"""
W, D, H = 116.3, 68.8, 85.5
SPAN = {"x": W, "y": D, "z": H}
OFF = {"x": 58.15, "y": 34.4, "z": 42.75}
PHOTOS = {"front": "r100_01_front.webp", "rear": "r100_02_rear.webp", "top": "r100_05_top.webp",
          "bottom": "r100_06_bottom.webp", "right": "r100_07_right.webp", "left": "r100_08_left.webp"}
# pixel extent of the silhouette in the 2000 px photo along image u (right) and v (down), the frame axis it
# spans, and its direction ('-' = frame value decreases as the pixel index grows)
CAL = {
    "front":  {"u": (2, 1997, "x"),  "v": (255, 1747, "z-")},
    "rear":   {"u": (2, 1997, "x-"), "v": (251, 1751, "z-")},
    "top":    {"u": (2, 1997, "x-"), "v": (416, 1583, "y")},
    "bottom": {"u": (2, 1997, "x"),  "v": (433, 1565, "y")},
    "right":  {"u": (223, 1775, "y-"), "v": (2, 1997, "z-")},
    "left":   {"u": (240, 1759, "y"),  "v": (2, 1997, "z-")},
}
# camera viewing direction and image-right / image-up directions in Blender axes
CAM = {
    "front":  {"fwd": (0, 1, 0),  "right": (1, 0, 0),  "up": (0, 0, 1)},
    "rear":   {"fwd": (0, -1, 0), "right": (-1, 0, 0), "up": (0, 0, 1)},
    "top":    {"fwd": (0, 0, -1), "right": (-1, 0, 0), "up": (0, -1, 0)},
    "bottom": {"fwd": (0, 0, 1),  "right": (1, 0, 0),  "up": (0, -1, 0)},
    "right":  {"fwd": (1, 0, 0),  "right": (0, -1, 0), "up": (0, 0, 1)},
    "left":   {"fwd": (-1, 0, 0), "right": (0, 1, 0),  "up": (0, 0, 1)},
}


def px_to_mm(cal_axis, p):
    a, b, ax = cal_axis
    t = (p - a) / (b - a)
    if ax.endswith("-"): t = 1 - t
    return t * SPAN[ax[0]]


def extent(view, size=2000):
    """frame-mm range covered by the whole photo along u and v: ((axis, lo, hi), (axis, lo, hi))"""
    out = []
    for k in ("u", "v"):
        c = CAL[view][k]
        m0, m1 = px_to_mm(c, 0), px_to_mm(c, size)
        out.append((c[2][0], min(m0, m1), max(m0, m1)))
    return out
