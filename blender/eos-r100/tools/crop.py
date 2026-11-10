"""Labelled zoom crop of a reference photo for tracing outlines.
python -I crop.py <photo> <out.png> x0 y0 x1 y1 [step]   (full-res 2000 px coordinates)
Draws a grid every <step> px (default 50) labelled with full-res coordinates.
"""
import sys
from PIL import Image, ImageDraw
p, out = sys.argv[1], sys.argv[2]
x0, y0, x1, y1 = map(int, sys.argv[3:7]); step = int(sys.argv[7]) if len(sys.argv) > 7 else 50
im = Image.open(p).convert("RGB").crop((x0, y0, x1, y1))
s = 1000 / max(x1 - x0, y1 - y0)
im = im.resize((round((x1 - x0) * s), round((y1 - y0) * s)), Image.LANCZOS)
d = ImageDraw.Draw(im)
for gx in range((x0 // step + 1) * step, x1, step):
    X = (gx - x0) * s; d.line([(X, 0), (X, im.height)], fill=(255, 0, 0) if gx % (step * 2) == 0 else (255, 150, 150), width=1)
    if gx % (step * 2) == 0: d.text((X + 2, 2), str(gx), fill=(255, 255, 0))
for gy in range((y0 // step + 1) * step, y1, step):
    Y = (gy - y0) * s; d.line([(0, Y), (im.width, Y)], fill=(255, 0, 0) if gy % (step * 2) == 0 else (255, 150, 150), width=1)
    if gy % (step * 2) == 0: d.text((2, Y + 2), str(gy), fill=(255, 255, 0))
im.save(out)
