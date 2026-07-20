"""Resize newly staged NPC overworld sprites (art-staging/characters/npc-*.png) down to the 72x96
single-frame spec (matching sprite.player.male/female - see docs/Asset-Production-Checklist.md),
archive the originals, write the optimized result into public/assets/sprites/characters/, then
clear the processed file out of staging. Not wired into any npm script - run by hand
(`python scripts/resize_npc_sprites.py`) whenever a new batch of staged NPC sprites lands.
"""

import os
from PIL import Image

STAGING_DIR = os.path.join("art-staging", "characters")
ORIGINALS_DIR = os.path.join("public", "assets", "sprites", "characters", "original")
OUTPUT_DIR = os.path.join("public", "assets", "sprites", "characters")
TARGET_SIZE = (72, 96)

files = sorted(f for f in os.listdir(STAGING_DIR) if f.startswith("npc-") and f.lower().endswith(".png"))

os.makedirs(ORIGINALS_DIR, exist_ok=True)

for fname in files:
    slug = fname[len("npc-"):-len(".png")]
    src_path = os.path.join(STAGING_DIR, fname)
    im = Image.open(src_path)
    if im.mode != "RGBA":
        im = im.convert("RGBA")
    w, h = im.size

    # Unlike the portraits (painted background, no transparency, cropped to a fixed square), these
    # are transparent-background character cutouts already authored at the 72:96 (3:4) aspect ratio
    # sprite.player.male/female use - a straight resize, no crop needed. Checked by hand against a
    # bright-color composited background before adopting this: LANCZOS does not introduce any dark
    # edge fringing on this art's binary (0/255, no soft edges) alpha channel, so no premultiplied-
    # alpha resize is needed here.
    im = im.resize(TARGET_SIZE, Image.LANCZOS)

    archive_path = os.path.join(ORIGINALS_DIR, fname)
    if not os.path.exists(archive_path):
        Image.open(src_path).save(archive_path)

    out_path = os.path.join(OUTPUT_DIR, f"{slug}.png")
    im.save(out_path, format="PNG", optimize=True, compress_level=9)

    # Once archived and written, the staging copy is redundant.
    os.remove(src_path)

    out_size_kb = os.path.getsize(out_path) / 1024
    print(f"{fname} ({w}x{h}) -> {slug}.png (72x96, {out_size_kb:.0f}KB)")

print(f"\n{len(files)} NPC sprites processed.")
