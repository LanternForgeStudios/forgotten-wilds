"""Build a "wandering" NPC's combined idle+walk sprite sheet - one of the small set of NPCs that
actually moves around the map (see `wanderRadius` in useWanderingNpcs.ts / NPC_WALK_ASSET_IDS in
characterAnimations.ts), unlike every other NPC's idle-only sheet (build_npc_idle_sheet.py).

Output is a fixed 5-row sheet matching NPC_WALK_ANIMATION_LAYOUT's hardcoded row order exactly:
row 0 = idle (south-facing breathing loop), rows 1-4 = walking down/left/up/right (south/west/
north/east). 4 frames per row, 72x96 per frame - same per-frame size as every other NPC sheet.

Source layout (pixellab MCP export, art-staging/characters/{npc}/animations/): the idle and walk
animations are two separate "groups" that may both come back named the same thing (e.g.
"animating") when queued in separate animate_character calls - the MCP zip disambiguates a second
same-named group with a "-<group-id-prefix>" suffix, so folder names aren't reliable, only their
*shape* is: a folder containing exactly one "south" subfolder is the idle group; a folder
containing all four cardinal subfolders (south/west/north/east) is the walk group. Classified by
that shape rather than by name.

One shared crop box per NPC (not one per direction) - measured against the union content-bbox
across every direction's frames AND the idle frames combined, so a single consistent crop still
correctly frames every pose (a walk-cycle's silhouette when facing sideways differs from standing
still facing down, so the box has to be wide/tall enough for all of them at once).
"""

import os
import shutil
from PIL import Image

FRAME_SIZE = (72, 96)
# Row order matches NPC_WALK_ANIMATION_LAYOUT in src/animation/characterAnimations.ts exactly -
# do not reorder without updating that file too.
ROW_ORDER = ["idle", "south", "west", "north", "east"]

# Per-NPC: fixed crop box (measured by hand against the union bbox across every idle+walk frame -
# see this script's session notes for the measurements), and the output filename.
WALKING_NPCS = {
    "nell-ashby": {
        "crop_box": (22, 4, 114, 128),  # union bbox (41,12)-(95,120) on a 136x136 canvas
        "out_name": "nell-ashby-walk.png",
    },
    "hunter-garrick": {
        "crop_box": (21, 10, 109, 127),  # union bbox (36,18)-(94,119) on a 136x136 canvas
        "out_name": "hunter-garrick-walk.png",
    },
    "spirit-child": {
        "crop_box": (23, 8, 113, 127),  # union bbox (41,16)-(95,119) on a 136x136 canvas
        "out_name": "spirit-child-walk.png",
    },
    "ranger-caleb": {
        "crop_box": (23, 6, 113, 127),  # union bbox (42,14)-(94,119) on a 136x136 canvas
        "out_name": "ranger-caleb-walk.png",
    },
}

SRC_ROOT = os.path.join("art-staging", "characters")
OUT_DIR = os.path.join("public", "assets", "sprites", "characters")
ORIGINALS_ROOT = os.path.join(OUT_DIR, "original")


def classify_animation_folders(staging_dir):
    """Returns (idle_south_dir, {facing: dir}) by inspecting each animation folder's own
    subdirectory shape rather than trusting its name (see module docstring)."""
    animations_dir = os.path.join(staging_dir, "animations")
    idle_dir = None
    walk_dirs = {}
    for folder in os.listdir(animations_dir):
        folder_path = os.path.join(animations_dir, folder)
        if not os.path.isdir(folder_path):
            continue
        subdirs = {d for d in os.listdir(folder_path) if os.path.isdir(os.path.join(folder_path, d))}
        if {"south", "west", "north", "east"} <= subdirs:
            for facing in ("south", "west", "north", "east"):
                walk_dirs[facing] = os.path.join(folder_path, facing)
        elif subdirs == {"south"}:
            idle_dir = os.path.join(folder_path, "south")
    return idle_dir, walk_dirs


for slug, cfg in WALKING_NPCS.items():
    staging_dir = os.path.join(SRC_ROOT, slug)
    if not os.path.isdir(staging_dir):
        print(f"skipping {slug}: not staged under {staging_dir}")
        continue

    idle_dir, walk_dirs = classify_animation_folders(staging_dir)
    missing = [name for name, d in [("idle", idle_dir), *[(f, walk_dirs.get(f)) for f in ("south", "west", "north", "east")]] if not d]
    if missing:
        print(f"skipping {slug}: missing animation folder(s) for {missing}")
        continue

    crop_box = cfg["crop_box"]
    row_dirs = {"idle": idle_dir, "south": walk_dirs["south"], "west": walk_dirs["west"], "north": walk_dirs["north"], "east": walk_dirs["east"]}

    rows = []
    for row_name in ROW_ORDER:
        src_dir = row_dirs[row_name]
        frame_files = sorted(f for f in os.listdir(src_dir) if f.startswith("frame_") and f.endswith(".png"))
        frames = []
        for fname in frame_files:
            im = Image.open(os.path.join(src_dir, fname)).convert("RGBA")
            cropped = im.crop(crop_box)
            frames.append(cropped.resize(FRAME_SIZE, Image.NEAREST))
        rows.append(frames)

    frame_count = len(rows[0])
    if any(len(r) != frame_count for r in rows):
        print(f"skipping {slug}: uneven frame counts across rows {[len(r) for r in rows]}")
        continue

    sheet = Image.new("RGBA", (FRAME_SIZE[0] * frame_count, FRAME_SIZE[1] * len(ROW_ORDER)), (0, 0, 0, 0))
    for row_i, frames in enumerate(rows):
        for col_i, frame in enumerate(frames):
            sheet.paste(frame, (col_i * FRAME_SIZE[0], row_i * FRAME_SIZE[1]))

    out_path = os.path.join(OUT_DIR, cfg["out_name"])
    sheet.save(out_path, format="PNG", optimize=True, compress_level=9)
    print(f"{slug}: {len(ROW_ORDER)} rows x {frame_count} frames -> {sheet.width}x{sheet.height} -> {out_path} "
          f"({os.path.getsize(out_path) / 1024:.0f}KB)")

    archive_dir = os.path.join(ORIGINALS_ROOT, slug)
    if not os.path.exists(archive_dir):
        shutil.copytree(staging_dir, archive_dir)
    shutil.rmtree(staging_dir)
    print(f"  archived staged files to {archive_dir}, cleared {staging_dir}")
