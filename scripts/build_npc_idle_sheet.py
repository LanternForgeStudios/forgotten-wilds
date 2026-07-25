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

# Per-NPC: which pixellab animation folder holds the idle frames, the fixed crop box (measured by
# hand against that NPC's own union content-bbox - see this script's session notes), and the
# output filename. Frame count is however many frame_NNN.png files are actually staged (all NPC
# idle loops so far happen to be 4, but this isn't assumed - see build_enemy_idle_sheet.py, whose
# enemies came in at 8). "staged_folder" is optional - only needed when the staged directory name
# doesn't match the slug (pixellab's default export name is the full generation prompt, e.g.
# "Mara_Ash_NPC_General_Store_Owner_Middle-aged") - renaming to match the slug is the usual
# convention but isn't required if a Windows permission lock on a freshly staged folder blocks it.
NPCS = {
    "elias-rowan": {
        # Regenerated via the pixellab MCP - same reason/pattern as finn-rowan below. Superseded
        # website-workflow archive preserved as original/elias-rowan-website-v1/.
        "anim_folder": "animating",
        "crop_box": (24, 6, 113, 124),  # union bbox (48,14)-(89,116) on a 136x136 canvas
        "out_name": "elias-rowan-idle.png",
    },
    "finn-rowan": {
        # Regenerated via the pixellab MCP (create_character, not the manual pixellab.ai website
        # workflow the rest of this file's entries used) - the original website-generated art
        # didn't match the newer MCP-generated NPCs' consistent style. Original original/finn-rowan/
        # archive preserved as original/finn-rowan-website-v1/ rather than overwritten.
        "anim_folder": "animating",
        "crop_box": (25, 8, 113, 126),  # union bbox (51,16)-(87,118) on a 136x136 canvas
        "out_name": "finn-rowan-idle.png",
    },
    "mara-ash": {
        # Regenerated via the pixellab MCP - same reason/pattern as finn-rowan above. Superseded
        # website-workflow archive preserved as original/mara-ash-website-v1/.
        "anim_folder": "animating",
        "crop_box": (18, 0, 118, 133),  # union bbox (51,8)-(85,125) on a 136x136 canvas
        "out_name": "mara-ash-idle.png",
    },
    "silas-flint": {
        # Regenerated via the pixellab MCP - same reason/pattern as finn-rowan above. Superseded
        # website-workflow archive preserved as original/silas-flint-website-v1/.
        "anim_folder": "animating",
        "crop_box": (19, 0, 117, 130),  # union bbox (43,7)-(93,121) on a 136x136 canvas
        "out_name": "silas-flint-idle.png",
    },
    "juniper-reed": {
        # First NPC generated via the pixellab MCP server directly (create_character +
        # animate_character) instead of the manual pixellab.ai website + zip-export workflow - the
        # MCP names its own animation-group folder "animating" rather than the website export's
        # "Breathing_Idle", another instance of "pixellab's own folder naming varies, the script
        # just maps whatever it is to the game's 'idle' concept" (see this file's own docstring).
        "anim_folder": "animating",
        "crop_box": (22, 1, 115, 124),  # union bbox (52,9)-(85,116) on a 136x136 canvas
        "out_name": "juniper-reed-idle.png",
    },
    "aldren-stone": {
        "anim_folder": "animating",
        "crop_box": (24, 7, 112, 125),  # union bbox (50,15)-(86,117) on a 136x136 canvas
        "out_name": "aldren-stone-idle.png",
    },
    "tessa-ironhand": {
        "anim_folder": "animating",
        "crop_box": (26, 9, 112, 125),  # union bbox (51,17)-(87,117) on a 136x136 canvas
        "out_name": "tessa-ironhand-idle.png",
    },
    "willow-briar": {
        "anim_folder": "animating",
        "crop_box": (25, 9, 112, 124),  # union bbox (52,17)-(85,116) on a 136x136 canvas
        "out_name": "willow-briar-idle.png",
    },
    "mayor-eleanor-ashcroft": {
        "anim_folder": "animating",
        "crop_box": (24, 9, 112, 125),  # union bbox (51,17)-(85,117) on a 136x136 canvas
        "out_name": "mayor-eleanor-ashcroft-idle.png",
    },
    "historian-miriam": {
        "anim_folder": "animating",
        "crop_box": (26, 8, 112, 123),  # union bbox (50,16)-(88,115) on a 136x136 canvas
        "out_name": "historian-miriam-idle.png",
    },
}

SRC_ROOT = os.path.join("art-staging", "characters")
OUT_DIR = os.path.join("public", "assets", "sprites", "characters")
ORIGINALS_ROOT = os.path.join(OUT_DIR, "original")

for slug, cfg in NPCS.items():
    staging_dir = os.path.join(SRC_ROOT, cfg.get("staged_folder", slug))
    src_dir = os.path.join(staging_dir, "animations", cfg["anim_folder"], "south")
    if not os.path.isdir(src_dir):
        print(f"skipping {slug}: no staged {cfg['anim_folder']}/south frames found")
        continue
    crop_box = cfg["crop_box"]
    frame_files = sorted(f for f in os.listdir(src_dir) if f.startswith("frame_") and f.endswith(".png"))

    frames = []
    for fname in frame_files:
        im = Image.open(os.path.join(src_dir, fname)).convert("RGBA")
        cropped = im.crop(crop_box)
        frames.append(cropped.resize(FRAME_SIZE, Image.NEAREST))

    sheet = Image.new("RGBA", (FRAME_SIZE[0] * len(frames), FRAME_SIZE[1]), (0, 0, 0, 0))
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
