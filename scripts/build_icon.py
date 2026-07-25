"""Build a single-object UI icon from a pixellab MCP `create_map_object` export
(art-staging/icons/{slug}.png, a raw downloaded PNG - unlike character exports, a map object's
download link is a plain PNG, not a zip) into its final in-game size.

Per docs/Asset-Production-Checklist.md's "Icons" section: every icon is generated at 128x128
regardless of its final in-game size, so a future re-resize (as already happened once with the
building facades) has a real high-res source to work from instead of needing to regenerate the
art. This script does the downscale (LANCZOS - these are painterly/flat-shaded icons, not pixel
art, so a smooth filter is correct here, matching the building-facade icon pipeline's own choice)
and archives the full 128x128 original before clearing it from staging.
"""

import os
import shutil
from PIL import Image

# filename (without extension) in art-staging/icons/ -> (output filename, final size)
ICONS = {
    "currency-gold": (32, 32),
    "currency-spirit-essence": (32, 32),
    "currency-festival-tokens": (32, 32),
    "currency-premium-currency": (32, 32),
}

SRC_DIR = os.path.join("art-staging", "icons")
OUT_DIR = os.path.join("public", "assets", "icons")
ORIGINALS_ROOT = os.path.join(OUT_DIR, "original")

os.makedirs(OUT_DIR, exist_ok=True)
os.makedirs(ORIGINALS_ROOT, exist_ok=True)

for name, final_size in ICONS.items():
    src_path = os.path.join(SRC_DIR, f"{name}.png")
    if not os.path.exists(src_path):
        print(f"skipping {name}: no staged {name}.png found")
        continue

    im = Image.open(src_path).convert("RGBA")
    resized = im.resize(final_size, Image.LANCZOS)

    out_path = os.path.join(OUT_DIR, f"{name}.png")
    resized.save(out_path, format="PNG", optimize=True)
    print(f"{name}: {im.size} -> {final_size} -> {out_path} ({os.path.getsize(out_path) / 1024:.1f}KB)")

    archive_path = os.path.join(ORIGINALS_ROOT, f"{name}.png")
    if not os.path.exists(archive_path):
        shutil.copy2(src_path, archive_path)
    os.remove(src_path)
    print(f"  archived 128x128 source to {archive_path}, removed from staging")
