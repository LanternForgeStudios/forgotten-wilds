"""Build an enemy's battle sprite from a pixellab.ai rotation export
(art-staging/characters/{enemy}/rotations/south.png) - the front-facing "battle stance" pose the
Asset-Production-Checklist spec calls for (regular tier 128x128, boss tier 256x256).

Only the south rotation is used - BattleScene.ts renders a single static front-facing image per
enemy, no walk/idle animation for enemies today. Crops out each source image's own padding first
(pixellab exports a much bigger canvas than the actual creature, apparently sized to fit every
rotation angle without clipping) before resizing up to the target size - skipping the crop would
leave BattleScene's own size-scaling formula (which scales off the full image width, not the
creature's actual pixel footprint) rendering the creature far smaller on the battle stage than a
tightly-cropped sprite of the same registered dimensions would.

The entire staged folder (every rotation angle, not just south) is archived as-is once processed,
then removed from staging - nothing is lost, staging just stays limited to work still awaiting
processing.
"""

import os
import shutil
from PIL import Image

# Per-enemy: crop box (measured by hand against that enemy's own south.png content bbox, then
# padded a bit) and the target size (128 regular tier, 256 boss tier - see the checklist doc).
ENEMIES = {
    "mothling": {
        "crop_box": (20, 21, 100, 101),  # content bbox (32,33)-(88,89) on a 120x120 canvas
        "target_size": (128, 128),
        "out_name": "mothling.png",
    },
}

SRC_ROOT = os.path.join("art-staging", "characters")
ORIGINALS_ROOT = os.path.join("public", "assets", "sprites", "enemies", "original")
OUT_DIR = os.path.join("public", "assets", "sprites", "enemies")

for slug, cfg in ENEMIES.items():
    staging_dir = os.path.join(SRC_ROOT, slug)
    src_path = os.path.join(staging_dir, "rotations", "south.png")
    if not os.path.exists(src_path):
        print(f"skipping {slug}: no staged south.png found")
        continue

    im = Image.open(src_path).convert("RGBA")
    cropped = im.crop(cfg["crop_box"])
    resized = cropped.resize(cfg["target_size"], Image.NEAREST)

    out_path = os.path.join(OUT_DIR, cfg["out_name"])
    resized.save(out_path, format="PNG", optimize=True, compress_level=9)
    w, h = cfg["target_size"]
    print(f"{slug}: {im.size} -> crop {cfg['crop_box']} -> {w}x{h} -> {out_path} ({os.path.getsize(out_path) / 1024:.0f}KB)")

    archive_dir = os.path.join(ORIGINALS_ROOT, slug)
    if not os.path.exists(archive_dir):
        shutil.copytree(staging_dir, archive_dir)
    shutil.rmtree(staging_dir)
    print(f"  archived staged files to {archive_dir}, cleared {staging_dir}")
