"""Build a Crimson Bayou enemy's battle-idle ("fight stance") animation sprite sheet from a
pixellab.ai export, same shape/convention as build_enemy_idle_sheet.py (single-row sheet, 128x128
per frame regular/elite tier, 256x256 boss tier, south-facing frames only - this same sheet also
becomes the overworld field-encounter icon, see that script's own doc comment), but computing the
crop box automatically (union alpha bbox across all staged idle frames) instead of a hand-measured
per-enemy constant - same technique as build_bayou_npc_idle_sheet.py, just with a caller-supplied
target size and an auto-detected staging folder name (pixellab's own export folder name is
sanitized from the character's `name` and doesn't always match its file-slug 1:1).

Source layout: art-staging/enemies/<staged_folder>/animations/<anim_folder>/south/frame_00N.png
Output: public/assets/sprites/enemies/<slug>-idle.png
"""

import os
import shutil
import sys
from PIL import Image

STAGING_ROOTS = [os.path.join("art-staging", "enemies"), os.path.join("art-staging", "characters")]
ORIGINALS_ROOT = os.path.join("public", "assets", "sprites", "enemies", "original")
OUT_DIR = os.path.join("public", "assets", "sprites", "enemies")


def build(slug, staged_folder, target_size):
    staging_dir = next(
        (os.path.join(root, staged_folder) for root in STAGING_ROOTS if os.path.isdir(os.path.join(root, staged_folder))),
        None,
    )
    if staging_dir is None:
        print(f"skipping {slug}: not staged under art-staging/enemies/ or art-staging/characters/ (looked for {staged_folder})")
        return

    animations_dir = os.path.join(staging_dir, "animations")
    anim_folder = next(
        (f for f in os.listdir(animations_dir) if os.path.isdir(os.path.join(animations_dir, f, "south"))),
        None,
    ) if os.path.isdir(animations_dir) else None
    if anim_folder is None:
        print(f"skipping {slug}: no staged animation with south/ frames found under {animations_dir}")
        return
    src_dir = os.path.join(animations_dir, anim_folder, "south")

    frame_files = sorted(f for f in os.listdir(src_dir) if f.startswith("frame_") and f.endswith(".png"))
    images = [Image.open(os.path.join(src_dir, f)).convert("RGBA") for f in frame_files]

    l, t, r, b = None, None, None, None
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

    w, h = images[0].size
    pad = max(4, round(w * 0.02))
    crop_box = (max(0, l - pad), max(0, t - pad), min(w, r + pad), min(h, b + pad))

    sheet = Image.new("RGBA", (target_size[0] * len(images), target_size[1]), (0, 0, 0, 0))
    for i, im in enumerate(images):
        cropped = im.crop(crop_box)
        resized = cropped.resize(target_size, Image.NEAREST)
        sheet.paste(resized, (i * target_size[0], 0))

    out_path = os.path.join(OUT_DIR, f"{slug}-idle.png")
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


# slug -> (staged_folder, target_size)
ENEMIES = {
    "marsh-crocodile": ("Marsh_Crocodile", (128, 128)),
    "bog-ravager": ("Bog_Ravager", (128, 128)),
    "bog-hag": ("Bog_Hag", (128, 128)),
    "cypress-witch": ("Cypress_Witch", (128, 128)),
    "rougarou-stalker": ("Rougarou_Stalker", (128, 128)),
    "alpha-rougarou": ("Alpha_Rougarou", (128, 128)),
    "ancient-serpent-guardian": ("Ancient_Serpent_Guardian", (256, 256)),
}

if __name__ == "__main__":
    slugs = sys.argv[1:] or list(ENEMIES.keys())
    for s in slugs:
        if s not in ENEMIES:
            print(f"skipping {s}: no entry in ENEMIES map")
            continue
        staged_folder, target_size = ENEMIES[s]
        build(s, staged_folder, target_size)
    print("done")
