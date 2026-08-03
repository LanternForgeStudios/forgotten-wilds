"""Builds the 4 fragment-landmark map markers (Fallen Watchtower, "a faint glimmer in the pool",
"a hidden cache behind the falls", "an overlooked maintenance tunnel") that OverworldScene.tsx used
to fall back to structure.shrine-dormant/activated for, even though none of them are shrines - a
copy-paste artifact from the interactableEntities mapping's ternary chain (registry.ts's own
POINT_LANDMARK_KIND classifies these as 'fragment', not 'shrine').

Same pipeline as build_structure_icon.py/build_shrine_states.py: crop to square content bbox,
resize to 144x144 (matching the shrine/facade landmark scale, not the smaller 48x48 chest scale -
these read as places on the map, not containers) with LANCZOS.

water-glimmer is additionally animated (create_map_object + animate_object, "the magical shard
glimmering and pulsing softly beneath the water" - a genuine motion candidate per the standing
"animate decor that would read better with motion" ask), same single-row idle-loop mechanism as
structure.chest/structure.shrine-activated (animationLayoutForSprite's generic frameSize'd
fallback - no new game code needed).

Source: art-staging/structures/{watchtower-ruin,frost-cache,tunnel-entrance,water-glimmer}-source.png,
        art-staging/structures/water-glimmer-glow/frame_NNN.png
Output: public/assets/sprites/structures/landmark-{watchtower,frost-cache,tunnel-entrance}.png,
        public/assets/sprites/structures/landmark-water-glimmer-glow.png
"""

import os
import shutil
from PIL import Image

STAGING = os.path.join("art-staging", "structures")
OUT_DIR = os.path.join("public", "assets", "sprites", "structures")
ORIGINALS_ROOT = os.path.join(OUT_DIR, "original")

TARGET_SIZE = (144, 144)

STATIC = {
    "watchtower-ruin-source.png": "landmark-watchtower",
    "frost-cache-source.png": "landmark-frost-cache",
    "tunnel-entrance-source.png": "landmark-tunnel-entrance",
    "heart-seed-source.png": "landmark-heart-seed",
    "heart-seed-collected-source.png": "landmark-heart-seed-collected",
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

# --- Static landmarks ---
for fname, slug in STATIC.items():
    src_path = os.path.join(STAGING, fname)
    if not os.path.exists(src_path):
        print(f"skipping {slug}: {src_path} not found")
        continue
    im = Image.open(src_path).convert("RGBA")
    squared = crop_to_square_bbox(im)
    resized = squared.resize(TARGET_SIZE, Image.LANCZOS)
    out_path = os.path.join(OUT_DIR, f"{slug}.png")
    resized.save(out_path, format="PNG", optimize=True)
    print(f"{slug}: {im.size} -> {TARGET_SIZE} -> {out_path}")
    shutil.copy2(src_path, os.path.join(ORIGINALS_ROOT, fname))
    os.remove(src_path)

# --- Water glimmer: animated glow loop ---
anim_dir = os.path.join(STAGING, "water-glimmer-glow")
if os.path.isdir(anim_dir):
    frame_files = sorted(f for f in os.listdir(anim_dir) if f.startswith("frame_") and f.endswith(".png"))
    frames = []
    for fname in frame_files:
        im = Image.open(os.path.join(anim_dir, fname)).convert("RGBA")
        squared = crop_to_square_bbox(im)
        frames.append(squared.resize(TARGET_SIZE, Image.LANCZOS))

    sheet = Image.new("RGBA", (TARGET_SIZE[0] * len(frames), TARGET_SIZE[1]), (0, 0, 0, 0))
    for i, frame in enumerate(frames):
        sheet.paste(frame, (i * TARGET_SIZE[0], 0))

    out_path = os.path.join(OUT_DIR, "landmark-water-glimmer-glow.png")
    sheet.save(out_path, format="PNG", optimize=True)
    print(f"landmark-water-glimmer: {len(frames)} frames -> {sheet.width}x{sheet.height} -> {out_path}")

    archive_dir = os.path.join(ORIGINALS_ROOT, "water-glimmer-glow")
    if not os.path.exists(archive_dir):
        shutil.copytree(anim_dir, archive_dir)
    shutil.rmtree(anim_dir)
else:
    print(f"skipping landmark-water-glimmer: {anim_dir} not found")

print("done")
