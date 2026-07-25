"""Build an enemy's battle-idle ("fight stance") animation sprite sheet from a pixellab.ai export
(art-staging/enemies/{enemy}/animations/{anim_folder}/south/frame_00N.png - pixellab's own
animation-folder name varies per export ("Fight_Stance_Idle" for most, plain "Idle" for at least
one - e.g. Cliff Wolf), so the folder is auto-detected as whichever subfolder of animations/ has a
south/ directory, rather than assumed. The first three enemies processed were staged under
art-staging/characters/ before the user split enemies into their own art-staging/enemies/ folder;
this script checks enemies/ first, falling back to characters/ for anything not yet moved over).

Only the south-facing frames are used - BattleScene.ts only ever shows an enemy front-on, and (via
the same generic idle-animation machinery ExplorationScene.ts's upsertEntity uses for NPCs) this
same sheet also becomes that enemy's overworld field-encounter icon animation, which likewise only
ever renders facing down (see useFieldEncounters.ts + upsertEntity).

Frame count varies per enemy (pixellab gave these enemies 8-frame idle loops, vs. 4 for the NPC
idle sheets built so far) - animationLayoutForSprite (src/animation/characterAnimations.ts) derives
frame count from dimensions.width / frameSize.width rather than assuming a fixed count, so any
frame count staged here just works without a code change.

Output is a single-row sheet at TARGET_SIZE per frame (128x128 regular tier / 256x256 boss tier,
matching the existing battle.enemy.* static-sprite convention - see build_enemy_sprite.py) so an
idle-animated enemy renders at the same on-screen size a static one would.
"""

import os
import shutil
from PIL import Image

# Per-enemy: crop box (measured by hand against that enemy's own union content-bbox across its
# staged idle frames - see this script's session notes for the measurements) and target frame size
# (128 regular tier, 256 boss tier). "staged_folder" is optional - only needed when the staged
# directory name doesn't match the slug (pixellab's default export names are the full generation
# prompt, e.g. "Briar_Wraith_monster_Briar_Spirits_Thorny_vine-wra" - renaming these to match the
# slug is the usual convention, but isn't required, since a Windows permission lock on the freshly
# staged folder can make the rename itself fail; pointing the script at the actual name works
# just as well without waiting on that).
ENEMIES = {
    "mothling": {
        "crop_box": (20, 21, 100, 101),  # same crop as the static battle sprite - same character/canvas
        "target_size": (128, 128),
    },
    "greater-mothling": {
        "crop_box": (20, 20, 104, 104),  # union bbox (33,32)-(89,88) on a 124x124 canvas
        "target_size": (128, 128),
    },
    "restless-miner": {
        "crop_box": (20, 20, 104, 104),  # union bbox (40,34)-(93,93) on a 124x124 canvas
        "target_size": (128, 128),
    },
    "foreman-wraith": {
        "crop_box": (18, 18, 98, 98),  # union bbox (44,30)-(72,88) on a 116x116 canvas
        "target_size": (128, 128),
    },
    "coal-spirit": {
        "staged_folder": "Coal_spirit_-_monster_made",
        "crop_box": (49, 55, 191, 197),  # union bbox (84,71)-(156,181) on a 240x240 canvas
        "target_size": (128, 128),
    },
    "coal-wraith": {
        "staged_folder": "Coal_Wraith_Coal_Spirits_Larger_more_menacing",
        "crop_box": (49, 51, 196, 198),  # union bbox (84,67)-(161,182) on a 244x244 canvas
        "target_size": (128, 128),
    },
    "cliff-wolf": {
        "staged_folder": "Cliff_Wolf_monster_Cliff_Dwellers_Lean_grey_mounta",
        "crop_box": (70, 70, 183, 183),  # union bbox (101,86)-(152,167) on a 240x240 canvas; anim folder is "Idle" not "Fight_Stance_Idle"
        "target_size": (128, 128),
    },
    "ridge-hawk": {
        "staged_folder": "Ridge_Hawk_monster_Cliff_Dwellers_Sharp_mountain",
        "crop_box": (46, 43, 203, 200),  # union bbox (68,59)-(181,184) on a 248x248 canvas
        "target_size": (128, 128),
    },
    "pool-wisp": {
        "staged_folder": "Pool_Wisp_monster_Water_Spirits_Small_blue-white",
        "crop_box": (45, 50, 185, 190),  # union bbox (79,66)-(151,174) on a 228x228 canvas
        "target_size": (128, 128),
    },
    "falls-siren": {
        "staged_folder": "Falls_Siren_monster_Water_Spirits_Ethereal_water",
        "crop_box": (48, 52, 194, 199),  # union bbox (82,68)-(160,183) on a 244x244 canvas
        "target_size": (128, 128),
    },
    "briar-wraith": {
        "staged_folder": "Briar_Wraith_monster_Briar_Spirits_Thorny_vine-wra",
        "crop_box": (53, 56, 198, 201),  # union bbox (88,72)-(163,185) on a 248x248 canvas
        "target_size": (128, 128),
    },
    "cemetery-shade": {
        "staged_folder": "Cemetery_Shade_monster_Briar_Spirits_Dark_cloaked",
        "crop_box": (44, 47, 194, 197),  # union bbox (79,63)-(159,181) on a 240x240 canvas
        "target_size": (128, 128),
    },
    "coalbound-warden": {
        "staged_folder": "The_Coalbound_Warden_boss_monster_Boss_Massive",
        "crop_box": (53, 57, 204, 208),  # union bbox (94,73)-(163,192) on a 248x248 canvas - boss tier
        "target_size": (256, 256),
    },
}

STAGING_ROOTS = [os.path.join("art-staging", "enemies"), os.path.join("art-staging", "characters")]
ORIGINALS_ROOT = os.path.join("public", "assets", "sprites", "enemies", "original")
OUT_DIR = os.path.join("public", "assets", "sprites", "enemies")

for slug, cfg in ENEMIES.items():
    folder_name = cfg.get("staged_folder", slug)
    staging_dir = next((os.path.join(root, folder_name) for root in STAGING_ROOTS if os.path.isdir(os.path.join(root, folder_name))), None)
    if staging_dir is None:
        print(f"skipping {slug}: not staged under art-staging/enemies/ or art-staging/characters/ (looked for {folder_name})")
        continue
    animations_dir = os.path.join(staging_dir, "animations")
    anim_folder = next(
        (f for f in os.listdir(animations_dir) if os.path.isdir(os.path.join(animations_dir, f, "south"))),
        None,
    ) if os.path.isdir(animations_dir) else None
    if anim_folder is None:
        print(f"skipping {slug}: no staged animation with south/ frames found under {animations_dir}")
        continue
    src_dir = os.path.join(animations_dir, anim_folder, "south")

    frame_files = sorted(f for f in os.listdir(src_dir) if f.startswith("frame_") and f.endswith(".png"))
    crop_box = cfg["crop_box"]
    target_size = cfg["target_size"]

    frames = []
    for fname in frame_files:
        im = Image.open(os.path.join(src_dir, fname)).convert("RGBA")
        cropped = im.crop(crop_box)
        frames.append(cropped.resize(target_size, Image.NEAREST))

    sheet = Image.new("RGBA", (target_size[0] * len(frames), target_size[1]), (0, 0, 0, 0))
    for i, frame in enumerate(frames):
        sheet.paste(frame, (i * target_size[0], 0))

    out_path = os.path.join(OUT_DIR, f"{slug}-idle.png")
    sheet.save(out_path, format="PNG", optimize=True, compress_level=9)
    print(f"{slug}: {len(frames)} frames -> {sheet.width}x{sheet.height} -> {out_path} ({os.path.getsize(out_path) / 1024:.0f}KB)")

    archive_dir = os.path.join(ORIGINALS_ROOT, slug)
    if os.path.exists(archive_dir):
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
