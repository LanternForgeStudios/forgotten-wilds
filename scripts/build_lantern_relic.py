"""Builds structure.lantern-relic-dormant and structure.lantern-relic-collected, giving the
Hollow Rail Mine "Lantern Relic" world-item interactable (miners-lost-lantern) a state pair
before/after pickup - the same dormant/activated technique already used for shrines
(build_shrine_states.py) and open/closed for the chest (build_chest.py). Previously this
interactable used a single static icon (icon.item.miners-lost-lantern) regardless of whether the
player had already collected it, which read as odd once every other one-time pickup in the game
(chests, shrines) already visually distinguishes "still there" from "already taken."

- structure.lantern-relic-dormant: animated single-row 9-frame glow-pulse sheet
  (animate_object, "the lantern's amber glow pulsating and flickering warmly"), same pipeline as
  structure.chest/structure.shrine-activated - animationLayoutForSprite's generic frameSize'd
  idle-loop fallback plays it with zero new game code.
- structure.lantern-relic-collected: plain static image, cropped-bbox + resized, a
  create_object_state variant of the SAME base object (edit: "the lantern is gone, leaving
  behind just an empty scattered pile of rubble") so both states share the same body/rubble-pile
  silhouette - same technique as structure.chest/chest-open.

Source: art-staging/structures/lantern-relic-glow/frame_NNN.png,
        art-staging/structures/lantern-relic-collected-source.png
Output: public/assets/sprites/structures/lantern-relic-glow.png,
        public/assets/sprites/structures/lantern-relic-collected.png
"""

import os
import shutil
from PIL import Image

STAGING = os.path.join("art-staging", "structures")
OUT_DIR = os.path.join("public", "assets", "sprites", "structures")
ORIGINALS_ROOT = os.path.join(OUT_DIR, "original")

FRAME_SIZE = (64, 64)


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

# --- Dormant: animated glow loop ---
anim_dir = os.path.join(STAGING, "lantern-relic-glow")
if os.path.isdir(anim_dir):
    frame_files = sorted(f for f in os.listdir(anim_dir) if f.startswith("frame_") and f.endswith(".png"))
    frames = []
    for fname in frame_files:
        im = Image.open(os.path.join(anim_dir, fname)).convert("RGBA")
        squared = crop_to_square_bbox(im)
        frames.append(squared.resize(FRAME_SIZE, Image.LANCZOS))

    sheet = Image.new("RGBA", (FRAME_SIZE[0] * len(frames), FRAME_SIZE[1]), (0, 0, 0, 0))
    for i, frame in enumerate(frames):
        sheet.paste(frame, (i * FRAME_SIZE[0], 0))

    out_path = os.path.join(OUT_DIR, "lantern-relic-glow.png")
    sheet.save(out_path, format="PNG", optimize=True)
    print(f"lantern-relic-dormant: {len(frames)} frames -> {sheet.width}x{sheet.height} -> {out_path}")

    archive_dir = os.path.join(ORIGINALS_ROOT, "lantern-relic-glow")
    if not os.path.exists(archive_dir):
        shutil.copytree(anim_dir, archive_dir)
    shutil.rmtree(anim_dir)
else:
    print(f"skipping lantern-relic-dormant: {anim_dir} not found")

# --- Collected: static rubble pile ---
collected_src = os.path.join(STAGING, "lantern-relic-collected-source.png")
if os.path.exists(collected_src):
    im = Image.open(collected_src).convert("RGBA")
    squared = crop_to_square_bbox(im)
    resized = squared.resize(FRAME_SIZE, Image.LANCZOS)
    out_path = os.path.join(OUT_DIR, "lantern-relic-collected.png")
    resized.save(out_path, format="PNG", optimize=True)
    print(f"lantern-relic-collected: {im.size} -> {FRAME_SIZE} -> {out_path}")
    shutil.copy2(collected_src, os.path.join(ORIGINALS_ROOT, "lantern-relic-collected-source.png"))
    os.remove(collected_src)
else:
    print(f"skipping lantern-relic-collected: {collected_src} not found")

print("done")
