"""Builds the two "would read better animated than static" decor objects picked up per the
standing "circle back and add animations to any objects/decorations that would be better served
as an object with animation" ask - structure.decor-fireplace (interior furniture, previously
unplaced - interior-decor's fireplace tile was never actually painted onto any map) and
structure.decor-glowing-mushroom (a new bioluminescent-fungus variant, distinct from
overworld-decor2's plain static mushroom tile which stays as ordinary ambient ground decor).

Same pipeline as build_shrine_states.py/build_landmark_objects.py: crop to square content bbox,
resize with LANCZOS, animation frames laid out single-row for animationLayoutForSprite's generic
frameSize'd idle-loop fallback (no new game code needed for the animation itself - only for
placing/rendering these as objects, see TownScene.tsx/OverworldScene.tsx/DungeonScene.tsx).

Source: art-staging/structures/{fireplace,glowing-mushroom}-glow/frame_NNN.png
Output: public/assets/sprites/structures/decor-{fireplace,glowing-mushroom}-glow.png
"""

import os
import shutil
from PIL import Image

STAGING = os.path.join("art-staging", "structures")
OUT_DIR = os.path.join("public", "assets", "sprites", "structures")
ORIGINALS_ROOT = os.path.join(OUT_DIR, "original")

# staging subdir -> (output slug, frame size)
ANIMATED = {
    "fireplace-glow": ("decor-fireplace-glow", (96, 96)),
    "glowing-mushroom-glow": ("decor-glowing-mushroom-glow", (64, 64)),
}


def crop_to_square_bbox(im: Image.Image, pad: int = 4) -> Image.Image:
    bbox = im.getbbox()
    if bbox is None:
        return im
    l, t, r, b = bbox
    l = max(0, l - pad)
    t = max(0, t - pad)
    r = min(im.width, r + pad)
    b = min(im.height, b + pad)
    cropped = im.crop((l, t, r, b))
    w, h = cropped.size
    side = max(w, h)
    square = Image.new("RGBA", (side, side), (0, 0, 0, 0))
    square.paste(cropped, ((side - w) // 2, (side - h) // 2))
    return square


os.makedirs(OUT_DIR, exist_ok=True)
os.makedirs(ORIGINALS_ROOT, exist_ok=True)

for staging_subdir, (slug, frame_size) in ANIMATED.items():
    anim_dir = os.path.join(STAGING, staging_subdir)
    if not os.path.isdir(anim_dir):
        print(f"skipping {slug}: {anim_dir} not found")
        continue

    frame_files = sorted(f for f in os.listdir(anim_dir) if f.startswith("frame_") and f.endswith(".png"))
    frames = []
    for fname in frame_files:
        im = Image.open(os.path.join(anim_dir, fname)).convert("RGBA")
        squared = crop_to_square_bbox(im)
        frames.append(squared.resize(frame_size, Image.LANCZOS))

    sheet = Image.new("RGBA", (frame_size[0] * len(frames), frame_size[1]), (0, 0, 0, 0))
    for i, frame in enumerate(frames):
        sheet.paste(frame, (i * frame_size[0], 0))

    out_path = os.path.join(OUT_DIR, f"{slug}.png")
    sheet.save(out_path, format="PNG", optimize=True)
    print(f"{slug}: {len(frames)} frames -> {sheet.width}x{sheet.height} -> {out_path}")

    archive_dir = os.path.join(ORIGINALS_ROOT, staging_subdir)
    if not os.path.exists(archive_dir):
        shutil.copytree(anim_dir, archive_dir)
    shutil.rmtree(anim_dir)

print("done")
