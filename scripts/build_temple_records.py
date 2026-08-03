"""Builds the Temple Records interactable's two states (dormant/found and collected), replacing
the generic structure.chest/chest-open placeholder it launched with (see DungeonScene.tsx's
WORLD_ITEM_INTERACTABLES table) with real thematic art - a waterlogged records cache resting in a
reflecting pool, gently shimmering until collected, then an empty stone basin.

Same pixellab MCP "object" pipeline as build_chest.py: create_1_direction_object + animate_object
for the dormant/shimmering state (a real animated object, not a one-shot create_map_object image),
then create_object_state for the collected/emptied variant so both states share the same body.

Source layout: art-staging/structures/temple-records-dormant/animations/shimmer/unknown/
frame_NNN.png (9-frame shimmer loop) and art-staging/structures/temple-records-collected-source.png
(plain static image, downloaded directly from create_object_state's own download link).
"""

import os
import shutil
from PIL import Image

FRAME_SIZE = (64, 64)
DORMANT_ANIM_DIR = os.path.join("art-staging", "structures", "temple-records-dormant", "animations", "shimmer", "unknown")
COLLECTED_SRC = os.path.join("art-staging", "structures", "temple-records-collected-source.png")
OUT_DIR = os.path.join("public", "assets", "sprites", "structures")
ORIGINALS_ROOT = os.path.join(OUT_DIR, "original")


def crop_to_square_bbox(im: Image.Image, pad: int = 6) -> Image.Image:
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

# --- Dormant/found: animated shimmer-loop sheet ---
if os.path.isdir(DORMANT_ANIM_DIR):
    frame_files = sorted(f for f in os.listdir(DORMANT_ANIM_DIR) if f.startswith("frame_") and f.endswith(".png"))
    frames = []
    for fname in frame_files:
        im = Image.open(os.path.join(DORMANT_ANIM_DIR, fname)).convert("RGBA")
        squared = crop_to_square_bbox(im)
        frames.append(squared.resize(FRAME_SIZE, Image.LANCZOS))

    sheet = Image.new("RGBA", (FRAME_SIZE[0] * len(frames), FRAME_SIZE[1]), (0, 0, 0, 0))
    for i, frame in enumerate(frames):
        sheet.paste(frame, (i * FRAME_SIZE[0], 0))

    out_path = os.path.join(OUT_DIR, "temple-records-dormant.png")
    sheet.save(out_path, format="PNG", optimize=True)
    print(f"temple-records (dormant): {len(frames)} frames -> {sheet.width}x{sheet.height} -> {out_path}")

    archive_dir = os.path.join(ORIGINALS_ROOT, "temple-records-dormant")
    if not os.path.exists(archive_dir):
        shutil.copytree(os.path.join("art-staging", "structures", "temple-records-dormant"), archive_dir)
    print(f"  archived source to {archive_dir}")
else:
    print(f"skipping temple-records (dormant): {DORMANT_ANIM_DIR} not found")

# --- Collected: static image ---
if os.path.exists(COLLECTED_SRC):
    im = Image.open(COLLECTED_SRC).convert("RGBA")
    squared = crop_to_square_bbox(im)
    resized = squared.resize(FRAME_SIZE, Image.LANCZOS)

    out_path = os.path.join(OUT_DIR, "temple-records-collected.png")
    resized.save(out_path, format="PNG", optimize=True)
    print(f"temple-records (collected): {im.size} -> {FRAME_SIZE} -> {out_path}")

    archive_path = os.path.join(ORIGINALS_ROOT, "temple-records-collected-source.png")
    if not os.path.exists(archive_path):
        shutil.copy2(COLLECTED_SRC, archive_path)
    print(f"  archived source to {archive_path}")
else:
    print(f"skipping temple-records (collected): {COLLECTED_SRC} not found")

# Clear staging now that both are archived/built.
if os.path.isdir(os.path.join("art-staging", "structures", "temple-records-dormant")):
    shutil.rmtree(os.path.join("art-staging", "structures", "temple-records-dormant"))
if os.path.exists(COLLECTED_SRC):
    os.remove(COLLECTED_SRC)
print("cleared temple-records staging files")
