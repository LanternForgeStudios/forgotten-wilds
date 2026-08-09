"""Builds the 7 Mirehaven building-facade placeholder sprites (Town Hall, Archive, Inn, General
Store, Blacksmith, Armory, Herbalist) - every one of Mirehaven's building entrances rendered as the
generic pulsing exit marker until this pass, since none had ever had facade art generated
(BUILDING_MARKERS in TownScene.tsx had zero Mirehaven entries).

Unlike Ash Hallow's 10 building facades (externally-sourced painterly renders, real alpha or a
near-white background - see build_structure_icon.py), these are pixellab MCP `create_map_object`
placeholders (300x300, isometric-style building renders) with a baked-in mid-gray background despite
the API reporting "background: transparent" - the gray varies in brightness per image (some images'
corner sample is near-white ~250, others mid-gray ~140), so a fixed brightness threshold like
build_structure_icon.py's `remove_near_white_gray_bg` doesn't work uniformly here. Instead: flood-fill
transparency from each corner, using THAT image's own sampled corner color as the match target (a
generous per-pixel color-distance threshold), which also handles the soft shadow-gradient each
render has under the building without a fixed global threshold.

These are explicitly PLACEHOLDERS, not a stylistic match for Ash Hallow's painterly facades - see
docs/Asset-Production-Checklist.md's "Things Claude can't generate itself" section.

Source: art-staging/icons/mirehaven-{slug}-source.png (300x300)
Output: public/assets/sprites/structures/mirehaven-{slug}.png (144x144)
"""

import os
import shutil
from collections import deque
from PIL import Image

SLUGS = [
    "mirehaven-town-hall",
    "mirehaven-archive",
    "mirehaven-inn",
    "mirehaven-general-store",
    "mirehaven-blacksmith",
    "mirehaven-armory",
    "mirehaven-herbalist",
    "highwind-crossing-chiefs-lodge",
    "highwind-crossing-spirit-lodge",
    "highwind-crossing-inn",
    "highwind-crossing-general-store",
    "highwind-crossing-blacksmith",
    "highwind-crossing-armory",
]

TARGET_SIZE = (144, 144)
SRC_DIR = os.path.join("art-staging", "icons")
OUT_DIR = os.path.join("public", "assets", "sprites", "structures")
ORIGINALS_ROOT = os.path.join(OUT_DIR, "original")


def flood_fill_transparent(im: Image.Image, tol: int = 28) -> Image.Image:
    """BFS flood-fill from all 4 corners, punching alpha=0 into any pixel connected to a corner
    and within `tol` RGB distance of ITS OWN corner's sampled color (not a fixed global color) -
    handles both the near-white and mid-gray background variants, and the soft shadow gradient,
    since adjacent pixels along that gradient stay within tolerance of each other step by step."""
    im = im.convert("RGBA")
    w, h = im.size
    px = im.load()

    def dist2(a, b):
        return (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2

    visited = bytearray(w * h)
    queue = deque()
    for cx, cy in [(0, 0), (w - 1, 0), (0, h - 1), (w - 1, h - 1)]:
        idx = cy * w + cx
        if not visited[idx]:
            visited[idx] = 1
            queue.append((cx, cy, px[cx, cy][:3]))

    tol2 = tol * tol
    while queue:
        x, y, seed_rgb = queue.popleft()
        r, g, b, _a = px[x, y]
        px[x, y] = (r, g, b, 0)
        for nx, ny in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
            if 0 <= nx < w and 0 <= ny < h:
                nidx = ny * w + nx
                if not visited[nidx]:
                    npix = px[nx, ny][:3]
                    if dist2(npix, seed_rgb) <= tol2:
                        visited[nidx] = 1
                        queue.append((nx, ny, seed_rgb))
    return im


def crop_to_square_bbox(im: Image.Image, pad: int = 6) -> Image.Image:
    bbox = im.getbbox()
    if bbox is None:
        return im
    l, t, r, b = bbox
    l = max(0, l - pad)
    t = max(0, t - pad)
    r = min(im.width, r + pad)
    b = min(im.height, b + pad)
    cropped = im.crop((l, t, r, b))
    w, h = cropped.size
    side = max(w, h)
    square = Image.new("RGBA", (side, side), (0, 0, 0, 0))
    square.paste(cropped, ((side - w) // 2, (side - h) // 2))
    return square


os.makedirs(OUT_DIR, exist_ok=True)
os.makedirs(ORIGINALS_ROOT, exist_ok=True)

for slug in SLUGS:
    src_path = os.path.join(SRC_DIR, f"{slug}-source.png")
    if not os.path.exists(src_path):
        print(f"skipping {slug}: {src_path} not found")
        continue

    im = Image.open(src_path)
    transparent = flood_fill_transparent(im)
    squared = crop_to_square_bbox(transparent)
    resized = squared.resize(TARGET_SIZE, Image.LANCZOS)

    out_path = os.path.join(OUT_DIR, f"{slug}.png")
    resized.save(out_path, format="PNG", optimize=True)
    print(f"{slug}: {im.size} -> squared {squared.size} -> {TARGET_SIZE} -> {out_path} "
          f"({os.path.getsize(out_path) / 1024:.1f}KB)")

    archive_path = os.path.join(ORIGINALS_ROOT, f"{slug}-source.png")
    if not os.path.exists(archive_path):
        shutil.copy2(src_path, archive_path)
    os.remove(src_path)
    print(f"  archived source to {archive_path}, removed from staging")
