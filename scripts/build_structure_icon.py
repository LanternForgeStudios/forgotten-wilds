"""Build the 10 building-facade/shrine icons from staged painterly renders
(art-staging/icons/*.png, ~1024-1254px square) into the 72x72 structure.* registry assets.

Two source styles are mixed in this staged batch: 4 files already have real PNG alpha
(archive/elias-rowan-home/shrine/town-hall), the other 6 instead have a baked-in near-white/gray
background from whatever export pipeline produced them - those get an alpha punched in first via
a gray+bright per-pixel heuristic (not a fixed color match, since the near-white tone/gradient
varied slightly per file). Every file is then: crop to its content bbox, padded to a square
(centered, transparent fill) so the resize doesn't distort, then resized to 72x72.

LANCZOS (not NEAREST) is used for the resize deliberately - unlike this project's pixel-art
character/enemy sprites, these are painterly high-res renders being downsampled, where a smooth
filter avoids aliasing instead of preserving crisp pixel edges.

The entire staged icons folder is archived as-is (per-file, since these aren't multi-file
rotation/animation sets like the character scripts) before being removed from staging.
"""

import os
import shutil
from PIL import Image

# filename in art-staging/icons/ -> (registry slug, needs baked-in-background removal)
STRUCTURES = {
    "apothecary-willows.png": ("apothecary", True),
    "archive-ash-hallow.png": ("archive", False),
    "armory-ash-hallow.png": ("armory", True),
    "blacksmith-ash-hallow-forge.png": ("blacksmith", True),
    "elias-rowan-home.png": ("house", False),
    "inn-ash-hallow.png": ("inn", True),
    "mine-office-ash-hallow.png": ("mine-office", True),
    "shop-mara-ash.png": ("shop", True),
    "shrine.png": ("shrine", False),
    "town-hall-ash-hallow.png": ("town-hall", False),
}

TARGET_SIZE = (72, 72)
SRC_DIR = os.path.join("art-staging", "icons")
ORIGINALS_ROOT = os.path.join("public", "assets", "sprites", "structures", "original")
OUT_DIR = os.path.join("public", "assets", "sprites", "structures")


def remove_near_white_gray_bg(im: Image.Image, gray_tol: int = 6, brightness_min: int = 232) -> Image.Image:
    """Punches transparency into a near-white/gray baked-in background. Classifies a pixel as
    background if it's both low-saturation (max-min channel spread <= gray_tol) and bright
    (average channel value >= brightness_min) - a global per-pixel heuristic rather than matching
    exact checker color values, since those varied per source file."""
    im = im.convert("RGB")
    w, h = im.size
    px = list(im.getdata())
    out_alpha = bytearray(len(px))
    for i, (r, g, b) in enumerate(px):
        is_gray = max(r, g, b) - min(r, g, b) <= gray_tol
        avg = (r + g + b) / 3
        out_alpha[i] = 0 if (is_gray and avg >= brightness_min) else 255
    out = im.convert("RGBA")
    out.putalpha(Image.frombytes("L", (w, h), bytes(out_alpha)))
    return out


def crop_to_square_bbox(im: Image.Image) -> Image.Image:
    bbox = im.getbbox()
    if bbox is None:
        return im
    cropped = im.crop(bbox)
    w, h = cropped.size
    side = max(w, h)
    square = Image.new("RGBA", (side, side), (0, 0, 0, 0))
    square.paste(cropped, ((side - w) // 2, (side - h) // 2))
    return square


os.makedirs(OUT_DIR, exist_ok=True)
os.makedirs(ORIGINALS_ROOT, exist_ok=True)

for fname, (slug, needs_bg_removal) in STRUCTURES.items():
    src_path = os.path.join(SRC_DIR, fname)
    if not os.path.exists(src_path):
        print(f"skipping {slug}: no staged {fname} found")
        continue

    im = Image.open(src_path)
    if needs_bg_removal:
        im = remove_near_white_gray_bg(im)
    else:
        im = im.convert("RGBA")

    squared = crop_to_square_bbox(im)
    resized = squared.resize(TARGET_SIZE, Image.LANCZOS)

    out_path = os.path.join(OUT_DIR, f"{slug}.png")
    resized.save(out_path, format="PNG", optimize=True)
    print(f"{slug}: {im.size} -> squared {squared.size} -> {TARGET_SIZE} -> {out_path} "
          f"({os.path.getsize(out_path) / 1024:.1f}KB)")

    archive_path = os.path.join(ORIGINALS_ROOT, fname)
    if not os.path.exists(archive_path):
        shutil.copy2(src_path, archive_path)
    os.remove(src_path)
    print(f"  archived source to {archive_path}, removed from staging")
