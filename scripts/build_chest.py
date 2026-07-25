"""Build the two chest structure assets from pixellab MCP object exports:

- structure.chest (closed): an ANIMATED single-row N-frame sheet (pulsing glow loop), built the
  same way an NPC/enemy idle sheet is - the game's existing generic idle-animation mechanism
  (animationLayoutForSprite's fallback branch in characterAnimations.ts, already used by every
  enemy and several NPCs) plays any frameSize'd sprite's single row automatically, so a chest
  glow-loop needs zero new game code, just a registry entry with frameSize set.
- structure.chest-open (open): a plain static image, no animation - generated as a
  create_object_state variant of the SAME closed-chest object, not independently, so the two
  states share the same body/palette (matches the checklist doc's explicit requirement).

Source layout: art-staging/icons/chest-closed-extract/animations/<anim-name>/unknown/frame_NNN.png
(the closed chest's glow loop, exported as a zip since it's a real animated pixellab "object", not
a single-shot create_map_object image) and art-staging/icons/structure-chest-open-source.png (a
plain PNG, single image, downloaded directly from create_object_state's own download link).

One shared square-crop-then-resize treatment (LANCZOS - painterly renders, not pixel art, same
choice build_structure_icon.py made) for both, each frame/image cropped to its own tight bbox with
a small pad, squared, and resized to the final 48x48 target.
"""

import os
import shutil
from PIL import Image

FRAME_SIZE = (48, 48)
CLOSED_ANIM_DIR = os.path.join(
    "art-staging", "icons", "chest-closed-extract", "animations",
    "gently_pulsing_warm_golden_magical_glow_breathing", "unknown",
)
OPEN_SRC = os.path.join("art-staging", "icons", "structure-chest-open-source.png")
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

# --- Closed chest: animated glow-loop sheet ---
if os.path.isdir(CLOSED_ANIM_DIR):
    frame_files = sorted(f for f in os.listdir(CLOSED_ANIM_DIR) if f.startswith("frame_") and f.endswith(".png"))
    frames = []
    for fname in frame_files:
        im = Image.open(os.path.join(CLOSED_ANIM_DIR, fname)).convert("RGBA")
        squared = crop_to_square_bbox(im)
        frames.append(squared.resize(FRAME_SIZE, Image.LANCZOS))

    sheet = Image.new("RGBA", (FRAME_SIZE[0] * len(frames), FRAME_SIZE[1]), (0, 0, 0, 0))
    for i, frame in enumerate(frames):
        sheet.paste(frame, (i * FRAME_SIZE[0], 0))

    out_path = os.path.join(OUT_DIR, "chest-closed-glow.png")
    sheet.save(out_path, format="PNG", optimize=True)
    print(f"chest (closed): {len(frames)} frames -> {sheet.width}x{sheet.height} -> {out_path} "
          f"({os.path.getsize(out_path) / 1024:.1f}KB)")

    archive_dir = os.path.join(ORIGINALS_ROOT, "chest-closed")
    if not os.path.exists(archive_dir):
        shutil.copytree(os.path.dirname(os.path.dirname(CLOSED_ANIM_DIR)), archive_dir)
    print(f"  archived source to {archive_dir}")
else:
    print(f"skipping chest (closed): {CLOSED_ANIM_DIR} not found")

# --- Open chest: static image ---
if os.path.exists(OPEN_SRC):
    im = Image.open(OPEN_SRC).convert("RGBA")
    squared = crop_to_square_bbox(im)
    resized = squared.resize(FRAME_SIZE, Image.LANCZOS)

    out_path = os.path.join(OUT_DIR, "chest-open.png")
    resized.save(out_path, format="PNG", optimize=True)
    print(f"chest (open): {im.size} -> {FRAME_SIZE} -> {out_path} ({os.path.getsize(out_path) / 1024:.1f}KB)")

    archive_path = os.path.join(ORIGINALS_ROOT, "chest-open.png")
    if not os.path.exists(archive_path):
        shutil.copy2(OPEN_SRC, archive_path)
    print(f"  archived source to {archive_path}")
else:
    print(f"skipping chest (open): {OPEN_SRC} not found")

# Clear staging now that both are archived/built.
if os.path.isdir(os.path.join("art-staging", "icons", "chest-closed-extract")):
    shutil.rmtree(os.path.join("art-staging", "icons", "chest-closed-extract"))
for f in ("structure-chest-closed.zip", "structure-chest-open-source.png"):
    p = os.path.join("art-staging", "icons", f)
    if os.path.exists(p):
        os.remove(p)
print("cleared chest staging files")
