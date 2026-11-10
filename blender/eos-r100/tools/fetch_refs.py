"""Re-download every Canon reference the EOS R100 build uses (they are Canon's copyright, so not kept in git).

python -I blender/eos-r100/tools/fetch_refs.py            (run from the project root)
Writes into assets/models/canon-eos-r100/reference/:
  r100_0N_<view>.webp        seven body views (Canon gallery, 2000 px)
  lens_rf-s_18-45/           kit lens views
  lenses/<id>/               shelf lens views (via fetch_lens_refs.py)
  canon_manual/              Part Names page, diagrams, mode-dial images and the manual's icon SVGs
Only files Canon actually serves are written. See reference/SOURCES.md for provenance.
"""
import os, re, sys, runpy, urllib.request

ROOT = os.getcwd()
REF = os.path.join(ROOT, "assets", "models", "canon-eos-r100", "reference")
Q = "?aspect=1%3A1&bg=rgb%28245%2C246%2C246%29&fmt=webp&qlt=100&sm=aspect&w={w}"
MAN = "https://cam.start.canon/en/C015/manual/html/"


def get(url):
    try:
        with urllib.request.urlopen(urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"}), timeout=30) as r:
            return r.read() if r.status == 200 else None
    except Exception:
        return None


def save(path, data):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    open(path, "wb").write(data); return True


n = 0
for num, view in (("01", "front"), ("02", "rear"), ("03", "front34"), ("05", "top"), ("06", "bottom"), ("07", "right"), ("08", "left")):
    d = get("https://i1.adis.ws/i/canon/6052C061_EOS-R100_" + num + Q.format(w=2000))
    if d: n += save(os.path.join(REF, "r100_%s_%s.webp" % (num, view)), d)
for i in range(1, 11):
    d = get("https://i1.adis.ws/i/canon/4858C005_RF-S18-45mm-F4.5-6.3-IS-STM_%02d" % i + Q.format(w=1600))
    if d: n += save(os.path.join(REF, "lens_rf-s_18-45", "rfs1845_%02d.webp" % i), d)
page = get(MAN + "UG-00_Before_0110.html")
if page:
    n += save(os.path.join(REF, "canon_manual", "part_names.html"), page)
    html = page.decode("utf-8", "replace")
    for f in sorted(set(re.findall(r'src="screens/([^"]+\.(?:svg|png))"', html))):
        d = get(MAN + "screens/" + f)
        if not d: continue
        sub = "icons" if f.startswith("icon_") else ""
        n += save(os.path.join(REF, "canon_manual", sub, f), d)
print("body, kit lens and manual files:", n)
sys.argv = ["fetch_lens_refs.py", os.path.join(REF, "lenses")]
runpy.run_path(os.path.join(os.path.dirname(os.path.abspath(__file__)), "fetch_lens_refs.py"), run_name="__main__")
