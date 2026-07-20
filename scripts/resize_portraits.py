"""Resize newly staged character portraits (art-staging/characters/portrait-*.png) down to the
512x512 dialogue-portrait spec (docs/Asset-Production-Checklist.md), archive the originals, write
the optimized result into public/assets/portraits/, then clear the processed file out of staging
(the archived copy in public/assets/portraits/original/ is the one true copy from here on). Not
wired into any npm script - run by hand (`python scripts/resize_portraits.py`) whenever a new batch
of staged portraits lands.
"""

import os
from PIL import Image

STAGING_DIR = os.path.join("art-staging", "characters")
ORIGINALS_DIR = os.path.join("public", "assets", "portraits", "original")
OUTPUT_DIR = os.path.join("public", "assets", "portraits")
TARGET_SIZE = 512

files = sorted(f for f in os.listdir(STAGING_DIR) if f.startswith("portrait-") and f.lower().endswith(".png"))

os.makedirs(ORIGINALS_DIR, exist_ok=True)

for fname in files:
    slug = fname[len("portrait-"):-len(".png")]
    src_path = os.path.join(STAGING_DIR, fname)
    im = Image.open(src_path)
    if im.mode != "RGB":
        im = im.convert("RGB")
    w, h = im.size

    # Crop to a square before resizing so the game's fixed 72x72 dialogue box (which has no
    # object-fit set) never squashes a non-square source - the checklist's head-and-shoulders
    # framing puts the face/hair near the top of the frame, so a taller-than-wide source is
    # top-aligned (crop the excess off the bottom) rather than center-cropped, which would clip
    # into the hair. A wider-than-tall source is center-cropped horizontally instead.
    if h > w:
        crop_box = (0, 0, w, w)
    elif w > h:
        left = (w - h) // 2
        crop_box = (left, 0, left + h, h)
    else:
        crop_box = (0, 0, w, h)
    im = im.crop(crop_box)

    im = im.resize((TARGET_SIZE, TARGET_SIZE), Image.LANCZOS)

    archive_path = os.path.join(ORIGINALS_DIR, fname)
    if not os.path.exists(archive_path):
        Image.open(src_path).save(archive_path)

    out_path = os.path.join(OUTPUT_DIR, f"{slug}.png")
    im.save(out_path, format="PNG", optimize=True, compress_level=9)

    # Once archived and written, the staging copy is redundant - keeps art-staging/characters/
    # limited to files still awaiting processing rather than accumulating already-shipped ones.
    os.remove(src_path)

    out_size_kb = os.path.getsize(out_path) / 1024
    print(f"{fname} ({w}x{h}) -> {slug}.png (512x512, {out_size_kb:.0f}KB)")

print(f"\n{len(files)} portraits processed.")
