"""Build a player skin's animated overworld sprite sheet from a pixellab.ai export
(art-staging/characters/{skin}/animations/Walking/{south,west,north,east}/frame_00{0-3}.png).

Every source frame for a given skin shares the same square canvas with the character consistently
centered (verified by comparing each skin's own union content-bbox across all its staged frames/
rotations before picking CROP_BOX below) - so one fixed crop box per skin, applied identically to
every frame, never clips the character and never introduces the frame-to-frame jitter a per-frame
auto-crop would risk. Each crop is a 60x80 box (aspect 0.75), scaling cleanly to 72x96 - the same
per-frame size every other character sprite in the registry already uses, so the player doesn't
suddenly render at a different scale than NPCs.

Output is an 8-row x 4-column sheet (PLAYER_ANIMATION_LAYOUT's existing shape: rows 0-3 walking
down/left/up/right, rows 4-7 running down/left/up/right) - pixellab only exported a Walking cycle,
no separate Running one, so rows 4-7 duplicate rows 0-3. This means Dash reuses the walk cycle's
frames (just plays faster) rather than a distinct run animation - a deliberate, low-risk choice:
matching the existing 8-row shape needs zero changes to ExplorationScene.ts's animation code, which
hardcodes that shape today rather than deriving it per-asset.

The entire staged folder (including the unused 8-directional "rotations") is archived as-is once
processed, then removed from staging - nothing is lost, staging just stays limited to work still
awaiting processing.
"""

import os
import shutil
from PIL import Image

FRAME_SIZE = (72, 96)
# Facing order matches Facing type / PLAYER_ANIMATION_LAYOUT's row order: down, left, up, right.
DIRECTIONS = [("south", "down"), ("west", "left"), ("north", "up"), ("east", "right")]
FRAMES_PER_DIRECTION = 4

# Per-skin: source folder name under art-staging/characters/, the fixed crop box (measured by hand
# against that skin's own union content-bbox across all staged frames - see this script's own
# session notes for the measurements), and the output filename.
SKINS = {
    "male-player": {
        "crop_box": (32, 22, 92, 102),  # union bbox (40,31)-(83,94) on a 124x124 canvas
        "out_name": "player-male-animated.png",
    },
    "female-player": {
        "crop_box": (34, 24, 94, 104),  # union bbox (43,32)-(84,97) on a 128x128 canvas
        "out_name": "player-female-animated.png",
    },
}

OUT_DIR = os.path.join("public", "assets", "sprites", "characters")

for skin, cfg in SKINS.items():
    staging_dir = os.path.join("art-staging", "characters", skin)
    src_dir = os.path.join(staging_dir, "animations", "Walking")
    if not os.path.isdir(src_dir):
        print(f"skipping {skin}: no staged Walking animation found")
        continue
    crop_box = cfg["crop_box"]

    frames_by_direction = {}
    for src_name, _facing in DIRECTIONS:
        frames = []
        for i in range(FRAMES_PER_DIRECTION):
            src_path = os.path.join(src_dir, src_name, f"frame_{i:03d}.png")
            im = Image.open(src_path).convert("RGBA")
            cropped = im.crop(crop_box)
            resized = cropped.resize(FRAME_SIZE, Image.NEAREST)
            frames.append(resized)
        frames_by_direction[src_name] = frames

    sheet_w = FRAME_SIZE[0] * FRAMES_PER_DIRECTION
    sheet_h = FRAME_SIZE[1] * 8  # 4 walking rows + 4 duplicated running rows
    sheet = Image.new("RGBA", (sheet_w, sheet_h), (0, 0, 0, 0))

    row_order = [name for name, _facing in DIRECTIONS] * 2
    for row_index, src_name in enumerate(row_order):
        for col_index, frame in enumerate(frames_by_direction[src_name]):
            sheet.paste(frame, (col_index * FRAME_SIZE[0], row_index * FRAME_SIZE[1]))

    out_path = os.path.join(OUT_DIR, cfg["out_name"])
    sheet.save(out_path, format="PNG", optimize=True, compress_level=9)
    print(f"{skin}: {sheet_w}x{sheet_h} -> {out_path} ({os.path.getsize(out_path) / 1024:.0f}KB)")

    archive_dir = os.path.join(OUT_DIR, "original", skin)
    if not os.path.exists(archive_dir):
        shutil.copytree(staging_dir, archive_dir)
    shutil.rmtree(staging_dir)
    print(f"  archived staged files to {archive_dir}, cleared {staging_dir}")
