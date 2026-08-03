"""Build a wandering Crimson Bayou NPC's combined idle+walk sprite sheet - same 5-row layout as
build_npc_walk_sheet.py (row 0 idle, rows 1-4 walking down/left/up/right), but computing the shared
crop box automatically (union alpha bbox across every row's frames, aspect-corrected) instead of a
hand-measured per-NPC constant - same technique/rationale as build_bayou_npc_idle_sheet.py, just
extended to 5 rows instead of 1.

Source layout: art-staging/characters/<npc>/animations/<idle-group>/south/frame_00N.png (idle,
identified by having only a south/ subfolder) and .../<walk-group>/{south,west,north,east}/
frame_00N.png (walk, identified by having all 4 cardinal subfolders) - same shape-based
classification as build_npc_walk_sheet.py, since the MCP export's own folder naming isn't reliable.
Output: public/assets/sprites/characters/<slug>-walk.png
"""

import os
import shutil
import sys
from PIL import Image

FRAME_SIZE = (72, 96)
ROW_ORDER = ["idle", "south", "west", "north", "east"]
SRC_ROOT = os.path.join("art-staging", "characters")
OUT_DIR = os.path.join("public", "assets", "sprites", "characters")
ORIGINALS_ROOT = os.path.join(OUT_DIR, "original")


def fit_aspect(crop_box, target_size, canvas_size):
    """Same aspect-ratio correction as build_bayou_npc_idle_sheet.py's own fit_aspect - expands the
    shorter dimension of crop_box so its aspect ratio matches target_size's before any resize."""
    l, t, r, b = crop_box
    w, h = r - l, b - t
    target_w, target_h = target_size
    target_aspect = target_w / target_h
    current_aspect = w / h if h else target_aspect

    if current_aspect < target_aspect:
        new_w = h * target_aspect
        delta = (new_w - w) / 2
        l, r = l - delta, r + delta
    elif current_aspect > target_aspect:
        new_h = w / target_aspect
        delta = (new_h - h) / 2
        t, b = t - delta, b + delta

    cw, ch = canvas_size
    if l < 0:
        r -= l
        l = 0
    if t < 0:
        b -= t
        t = 0
    if r > cw:
        l -= r - cw
        r = cw
    if b > ch:
        t -= b - ch
        b = ch
    return (max(0, round(l)), max(0, round(t)), min(cw, round(r)), min(ch, round(b)))


def classify_animation_folders(staging_dir):
    """Returns (idle_south_dir, {facing: dir}) by inspecting each animation folder's own
    subdirectory shape, same convention as build_npc_walk_sheet.py."""
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


def build(slug):
    staging_dir = os.path.join(SRC_ROOT, slug)
    if not os.path.isdir(staging_dir):
        print(f"skipping {slug}: not staged under {staging_dir}")
        return

    idle_dir, walk_dirs = classify_animation_folders(staging_dir)
    missing = [name for name, d in [("idle", idle_dir), *[(f, walk_dirs.get(f)) for f in ("south", "west", "north", "east")]] if not d]
    if missing:
        print(f"skipping {slug}: missing animation folder(s) for {missing}")
        return

    row_dirs = {"idle": idle_dir, "south": walk_dirs["south"], "west": walk_dirs["west"], "north": walk_dirs["north"], "east": walk_dirs["east"]}
    row_images = {}
    for row_name, src_dir in row_dirs.items():
        frame_files = sorted(f for f in os.listdir(src_dir) if f.startswith("frame_") and f.endswith(".png"))
        row_images[row_name] = [Image.open(os.path.join(src_dir, f)).convert("RGBA") for f in frame_files]

    # Union bbox across every row's every frame - a walk cycle facing sideways has a different
    # silhouette than standing still facing down, so the shared crop box has to fit all of them.
    l, t, r, b = None, None, None, None
    for images in row_images.values():
        for im in images:
            bbox = im.getbbox()
            if bbox is None:
                continue
            l = bbox[0] if l is None else min(l, bbox[0])
            t = bbox[1] if t is None else min(t, bbox[1])
            r = bbox[2] if r is None else max(r, bbox[2])
            b = bbox[3] if b is None else max(b, bbox[3])
    if l is None:
        print(f"skipping {slug}: frames are fully transparent")
        return

    w, h = row_images["idle"][0].size
    pad = 4
    crop_box = (max(0, l - pad), max(0, t - pad), min(w, r + pad), min(h, b + pad))
    crop_box = fit_aspect(crop_box, FRAME_SIZE, (w, h))

    frame_count = len(row_images["idle"])
    if any(len(row_images[row]) != frame_count for row in ROW_ORDER):
        print(f"skipping {slug}: uneven frame counts across rows {[len(row_images[r]) for r in ROW_ORDER]}")
        return

    sheet = Image.new("RGBA", (FRAME_SIZE[0] * frame_count, FRAME_SIZE[1] * len(ROW_ORDER)), (0, 0, 0, 0))
    for row_i, row_name in enumerate(ROW_ORDER):
        for col_i, im in enumerate(row_images[row_name]):
            cropped = im.crop(crop_box)
            resized = cropped.resize(FRAME_SIZE, Image.NEAREST)
            sheet.paste(resized, (col_i * FRAME_SIZE[0], row_i * FRAME_SIZE[1]))

    out_path = os.path.join(OUT_DIR, f"{slug}-walk.png")
    os.makedirs(OUT_DIR, exist_ok=True)
    sheet.save(out_path, format="PNG", optimize=True, compress_level=9)
    print(f"{slug}: crop_box={crop_box} -> {sheet.width}x{sheet.height} -> {out_path}")

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


if __name__ == "__main__":
    slugs = sys.argv[1:]
    if not slugs:
        print("usage: python scripts/build_bayou_npc_walk_sheet.py <slug> [slug ...]")
        sys.exit(1)
    for s in slugs:
        build(s)
    print("done")
