"""Download Canon gallery photos for the shelf lenses (reference only; not shipped).
python -I fetch_lens_refs.py <out_dir>
Writes <out_dir>/<lens id>/<lens id>_<n>.webp only for images Canon's CDN actually serves.
"""
import os, sys, urllib.request

Q = "?aspect=1%3A1&bg=rgb%28245%2C246%2C246%29&fmt=webp&qlt=100&sm=aspect&w=1600"
LENSES = {  # lens id: Canon UK gallery image bases (product code + name), from the Canon UK store pages
    "prime": ["4515C005_RF-50mm-F1.8-STM"], "tele": ["5824C005_RF-S-55-210mm-F5-7.1-IS-STM"],
    "wide": ["6262C005_RF-S-10-18mm-F4.5-6.3-IS-STM"], "travel": ["5564C005_RF-S18-150mm-F3.5-6.3-IS-STM"],
    "p16": ["5051C005_RF-16mm-F2.8-STM"], "p28": ["6128C005_RF-28mm-F2.8-STM"],
    "p35": ["2973C005_RF35mm-Side", "2973C005_RF35mm-Slant", "2973C005_RF-35mm-f-1.8-IS-Macro-STM"],
    "p85": ["4234C005_RF-85mm-F2-MACRO-IS-STM", "4234C005_RF85mm"], "super": ["5050C005_RF-100-400mm-F5.6-8-IS-USM"],
}


def get(url):
    try:
        with urllib.request.urlopen(urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"}), timeout=30) as r:
            return r.read() if r.status == 200 else None
    except Exception:
        return None


out = sys.argv[1]
for lid, bases in LENSES.items():
    os.makedirs(os.path.join(out, lid), exist_ok=True); n = 0
    for b in bases:
        for suffix in [""] + ["_%02d" % i for i in range(1, 9)]:
            data = get("https://i1.adis.ws/i/canon/" + b + suffix + Q)
            if data and len(data) > 2000:
                n += 1
                open(os.path.join(out, lid, "%s_%02d.webp" % (lid, n)), "wb").write(data)
    print(lid, n)
