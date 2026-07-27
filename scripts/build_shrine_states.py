"""Builds structure.shrine-dormant and structure.shrine-activated, replacing the single static
structure.shrine (which had no activation-state concept). Both share one base geometry - activated
is the create_map_object base, dormant is a create_object_state variant of it (same technique as
structure.chest/chest-open) - so TownScene.tsx/OverworldScene.tsx can switch sprites based on
staminaUnlocked without the two states visibly being different shrines.

- structure.shrine-dormant: plain static image, cropped to its own square content bbox + resized to
  144x144 (matching the old structure.shrine's own size), same pipeline as build_structure_icon.py.
- structure.shrine-activated: animated single-row 9-frame glow-pulse sheet (animate_object,
  "the spirit-light glow pulsating and flickering warmly"), same pipeline as structure.chest's own
  glow loop (build_chest.py) - animationLayoutForSprite's generic frameSize'd idle-loop fallback
  plays it with zero new game code.

Source: art-staging/structures/shrine-dormant-source.png,
art-staging/structures/shrine-activated-glow/frame_NNN.png
Output: public/assets/sprites/structures/shrine-dormant.png,
public/assets/sprites/structures/shrine-activated-glow.png
"""

import os
import shutil
from PIL import Image

STAGING = os.path.join("art-staging", "structures")
OUT_DIR = os.path.join("public", "assets", "sprites", "structures")
ORIGINALS_ROOT = os.path.join(OUT_DIR, "original")

DORMANT_SIZE = (144, 144)
ACTIVATED_FRAME_SIZE = (144, 144)


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

# --- Dormant: static ---
dormant_src = os.path.join(STAGING, "shrine-dormant-source.png")
if os.path.exists(dormant_src):
    im = Image.open(dormant_src).convert("RGBA")
    squared = crop_to_square_bbox(im)
    resized = squared.resize(DORMANT_SIZE, Image.LANCZOS)
    out_path = os.path.join(OUT_DIR, "shrine-dormant.png")
    resized.save(out_path, format="PNG", optimize=True)
    print(f"shrine-dormant: {im.size} -> {DORMANT_SIZE} -> {out_path}")
    shutil.copy2(dormant_src, os.path.join(ORIGINALS_ROOT, "shrine-dormant-source.png"))
    os.remove(dormant_src)
else:
    print(f"skipping shrine-dormant: {dormant_src} not found")

# --- Activated: animated glow loop ---
anim_dir = os.path.join(STAGING, "shrine-activated-glow")
if os.path.isdir(anim_dir):
    frame_files = sorted(f for f in os.listdir(anim_dir) if f.startswith("frame_") and f.endswith(".png"))
    frames = []
    for fname in frame_files:
        im = Image.open(os.path.join(anim_dir, fname)).convert("RGBA")
        squared = crop_to_square_bbox(im)
        frames.append(squared.resize(ACTIVATED_FRAME_SIZE, Image.LANCZOS))

    sheet = Image.new("RGBA", (ACTIVATED_FRAME_SIZE[0] * len(frames), ACTIVATED_FRAME_SIZE[1]), (0, 0, 0, 0))
    for i, frame in enumerate(frames):
        sheet.paste(frame, (i * ACTIVATED_FRAME_SIZE[0], 0))

    out_path = os.path.join(OUT_DIR, "shrine-activated-glow.png")
    sheet.save(out_path, format="PNG", optimize=True)
    print(f"shrine-activated: {len(frames)} frames -> {sheet.width}x{sheet.height} -> {out_path}")

    archive_dir = os.path.join(ORIGINALS_ROOT, "shrine-activated-glow")
    if not os.path.exists(archive_dir):
        shutil.copytree(anim_dir, archive_dir)
    shutil.rmtree(anim_dir)
else:
    print(f"skipping shrine-activated: {anim_dir} not found")

print("done")
