"""Build a stationary NPC's idle-animation sprite sheet from a pixellab.ai export
(art-staging/characters/{npc}/animations/{anim_folder}/south/frame_00{0-3}.png - pixellab's own
animation-folder name varies per export, e.g. "Breathing_Idle"; the game only ever calls this
concept "idle", per IDLE_ANIMATION_LAYOUT in src/animation/characterAnimations.ts).

Only the south-facing frames are used - NPCs always render facing 'down' today (see
ExplorationScene.ts's upsertEntity, which hardcodes that). Same crop-then-upscale approach as
build_player_sheet.py: one fixed crop box per NPC (measured against that NPC's own union content
bbox across its staged frames), scaled to 72x96 to match every other character sprite's scale.

Output is a single-row, 4-column sheet (IDLE_ANIMATION_LAYOUT's shape) - much smaller than the
player's 8-row walk/run sheet, since a stationary NPC only ever needs the one idle loop.

The entire staged folder (including the unused 8-directional "rotations", and any other pixellab
animation folders besides the one actually used) is archived as-is once processed, then removed
from staging - nothing is lost, staging just stays limited to work still awaiting processing.
"""

import os
import shutil
from PIL import Image

FRAME_SIZE = (72, 96)
FRAME_COUNT = 4

# Per-NPC: which pixellab animation folder holds the idle frames, the fixed crop box (measured by
# hand against that NPC's own union content-bbox - see this script's session notes), and the
# output filename.
NPCS = {
    "elias-rowan": {
        "anim_folder": "Breathing_Idle",
        "crop_box": (32, 22, 92, 102),  # union bbox (45,29)-(79,92) on a 124x124 canvas
        "out_name": "elias-rowan-idle.png",
    },
}

SRC_ROOT = os.path.join("art-staging", "characters")
OUT_DIR = os.path.join("public", "assets", "sprites", "characters")
ORIGINALS_ROOT = os.path.join(OUT_DIR, "original")

for slug, cfg in NPCS.items():
    staging_dir = os.path.join(SRC_ROOT, slug)
    src_dir = os.path.join(staging_dir, "animations", cfg["anim_folder"], "south")
    if not os.path.isdir(src_dir):
        print(f"skipping {slug}: no staged {cfg['anim_folder']}/south frames found")
        continue
    crop_box = cfg["crop_box"]

    frames = []
    for i in range(FRAME_COUNT):
        src_path = os.path.join(src_dir, f"frame_{i:03d}.png")
        im = Image.open(src_path).convert("RGBA")
        cropped = im.crop(crop_box)
        frames.append(cropped.resize(FRAME_SIZE, Image.NEAREST))

    sheet = Image.new("RGBA", (FRAME_SIZE[0] * FRAME_COUNT, FRAME_SIZE[1]), (0, 0, 0, 0))
    for i, frame in enumerate(frames):
        sheet.paste(frame, (i * FRAME_SIZE[0], 0))

    out_path = os.path.join(OUT_DIR, cfg["out_name"])
    sheet.save(out_path, format="PNG", optimize=True, compress_level=9)
    print(f"{slug}: {sheet.width}x{sheet.height} -> {out_path} ({os.path.getsize(out_path) / 1024:.0f}KB)")

    # This NPC may already have an unrelated archived original from an earlier, non-pixellab art
    # pass (e.g. elias-rowan's old static sprite source) - archive this batch under its own subpath
    # rather than colliding with that.
    archive_dir = os.path.join(ORIGINALS_ROOT, slug)
    if not os.path.exists(archive_dir):
        shutil.copytree(staging_dir, archive_dir)
    shutil.rmtree(staging_dir)
    print(f"  archived staged files to {archive_dir}, cleared {staging_dir}")
