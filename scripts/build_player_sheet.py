"""Build (or update) a player skin's animated overworld sprite sheet from a pixellab.ai export
(art-staging/characters/{skin}/animations/{Walking,Running}/{south,west,north,east}/frame_00{0-3}.png).

Every source frame for a given skin shares the same square canvas with the character consistently
centered (verified by comparing each skin's own union content-bbox across all its staged frames/
rotations before picking CROP_BOX below) - so one fixed crop box per skin, applied identically to
every frame, never clips the character and never introduces the frame-to-frame jitter a per-frame
auto-crop would risk. Each crop is a 60x80 box (aspect 0.75), scaling cleanly to 72x96 - the same
per-frame size every other character sprite in the registry already uses, so the player doesn't
suddenly render at a different scale than NPCs.

Output is an 8-row x 4-column sheet (PLAYER_ANIMATION_LAYOUT's shape: rows 0-3 walking
down/left/up/right, rows 4-7 running down/left/up/right). Three supported staging shapes:
  - Walking only: fresh build, running rows duplicate the walking rows (no real run cycle yet).
  - Walking + Running: fresh build, both halves real.
  - Running only: an update to an *already-built* sheet (Walking was finalized in an earlier run
    and cleared from staging) - loads the existing output file and overwrites just rows 4-7,
    leaving the walking rows untouched.

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
        "crop_box": (32, 22, 92, 102),  # union bbox (40,31)-(83,94) on a 124x124 Walking canvas
        "out_name": "player-male-animated.png",
    },
    "female-player": {
        "crop_box": (34, 24, 94, 104),  # union bbox (43,32)-(84,97) on a 128x128 Walking canvas
        "out_name": "player-female-animated.png",
    },
    # Base bodies (equipment-layering plan) - one shared crop_box across all 8 gender x appearance
    # variants, since every one was generated with identical size/view/proportions/pose params
    # (see docs/pixellab-asset-ids.md), which is exactly what "identical proportions so equipment
    # layers are plug-and-play" requires. Measured against the union of male+female white-dark's
    # own content-bboxes on their shared 136x136 canvas: male (32,18)-(104,122), female
    # (32,13)-(102,120) -> combined (32,13)-(104,122). crop_box below is a 96x128 (0.75 aspect,
    # matching the 72x96 output) box centered on that combined bbox with margin for per-appearance
    # variance (hairstyles etc. may extend slightly differently across the other 6 variants).
    "male-player-white-dark": {
        "crop_box": (20, 3, 116, 131),
        "out_name": "player-base-male-white-dark-animated.png",
    },
    "female-player-white-dark": {
        "crop_box": (20, 3, 116, 131),
        "out_name": "player-base-female-white-dark-animated.png",
    },
    "male-player-black-dark": {
        "crop_box": (20, 3, 116, 131),
        "out_name": "player-base-male-black-dark-animated.png",
    },
    "female-player-black-dark": {
        "crop_box": (20, 3, 116, 131),
        "out_name": "player-base-female-black-dark-animated.png",
    },
    "male-player-white-blonde": {
        "crop_box": (20, 3, 116, 131),
        "out_name": "player-base-male-white-blonde-animated.png",
    },
    "female-player-white-blonde": {
        "crop_box": (20, 3, 116, 131),
        "out_name": "player-base-female-white-blonde-animated.png",
    },
    "male-player-asian-dark": {
        "crop_box": (20, 3, 116, 131),
        "out_name": "player-base-male-asian-dark-animated.png",
    },
    "female-player-asian-dark": {
        "crop_box": (20, 3, 116, 131),
        "out_name": "player-base-female-asian-dark-animated.png",
    },
}

OUT_DIR = os.path.join("public", "assets", "sprites", "characters")


def load_direction_frames(anim_dir, crop_box):
    by_direction = {}
    for src_name, _facing in DIRECTIONS:
        frames = []
        for i in range(FRAMES_PER_DIRECTION):
            src_path = os.path.join(anim_dir, src_name, f"frame_{i:03d}.png")
            im = Image.open(src_path).convert("RGBA")
            cropped = im.crop(crop_box)
            frames.append(cropped.resize(FRAME_SIZE, Image.NEAREST))
        by_direction[src_name] = frames
    return by_direction


def paste_rows(sheet, frames_by_direction, start_row):
    for row_offset, (src_name, _facing) in enumerate(DIRECTIONS):
        for col_index, frame in enumerate(frames_by_direction[src_name]):
            sheet.paste(frame, (col_index * FRAME_SIZE[0], (start_row + row_offset) * FRAME_SIZE[1]))


for skin, cfg in SKINS.items():
    staging_dir = os.path.join("art-staging", "characters", skin)
    walking_dir = os.path.join(staging_dir, "animations", "Walking")
    running_dir = os.path.join(staging_dir, "animations", "Running")
    has_walking = os.path.isdir(walking_dir)
    has_running = os.path.isdir(running_dir)
    if not has_walking and not has_running:
        print(f"skipping {skin}: no staged Walking or Running animation found")
        continue

    crop_box = cfg["crop_box"]
    out_path = os.path.join(OUT_DIR, cfg["out_name"])
    sheet_w = FRAME_SIZE[0] * FRAMES_PER_DIRECTION
    sheet_h = FRAME_SIZE[1] * 8

    if has_walking:
        sheet = Image.new("RGBA", (sheet_w, sheet_h), (0, 0, 0, 0))
        walking_frames = load_direction_frames(walking_dir, crop_box)
        paste_rows(sheet, walking_frames, start_row=0)
        running_frames = load_direction_frames(running_dir, crop_box) if has_running else walking_frames
        paste_rows(sheet, running_frames, start_row=4)
        mode = "walking+running" if has_running else "walking only (running rows duplicated)"
    else:
        if not os.path.exists(out_path):
            print(f"skipping {skin}: Running-only update but no existing sheet found at {out_path}")
            continue
        sheet = Image.open(out_path).convert("RGBA")
        running_frames = load_direction_frames(running_dir, crop_box)
        paste_rows(sheet, running_frames, start_row=4)
        mode = "running-only update"

    sheet.save(out_path, format="PNG", optimize=True, compress_level=9)
    print(f"{skin} ({mode}): {sheet_w}x{sheet_h} -> {out_path} ({os.path.getsize(out_path) / 1024:.0f}KB)")

    archive_dir = os.path.join(OUT_DIR, "original", skin)
    if os.path.exists(archive_dir):
        # A later batch (e.g. this Running-only follow-up) landing after an earlier archive already
        # exists - merge the new staged files in rather than skipping the whole archive step.
        for root, _dirs, files in os.walk(staging_dir):
            rel = os.path.relpath(root, staging_dir)
            dest_root = os.path.join(archive_dir, rel) if rel != "." else archive_dir
            os.makedirs(dest_root, exist_ok=True)
            for f in files:
                shutil.copy2(os.path.join(root, f), os.path.join(dest_root, f))
    else:
        shutil.copytree(staging_dir, archive_dir)
    shutil.rmtree(staging_dir)
    print(f"  archived staged files to {archive_dir}, cleared {staging_dir}")
