"""Build structure.exit-marker from a pixellab MCP object export: an ANIMATED single-row N-frame
sheet (pulsing glow loop), the exact same pipeline as structure.chest's own closed-chest glow loop
(create_1_direction_object + animate_object + crop-to-square-bbox + resize) - see build_chest.py's
own module docstring for why this needs zero new game code (animationLayoutForSprite's generic
frameSize'd single-row idle-loop fallback already plays it).

Replaces the old structure.door placeholder used by every non-building-facade transition tile
across Town/Overworld/Dungeon (see docs/Equipment-Layering-Plan.md's sibling doc,
Asset-Production-Checklist.md, for the prior spec) with a real animated "Exit" indicator: a
weathered wooden sign, red arrow + "EXIT" text, pulsating - generic enough to read as an exit
marker in a town street, a dungeon corridor, or a building interior alike.

Source layout: art-staging/icons/exit-marker-extract/animations/<anim-name>/unknown/frame_NNN.png
"""

import os
import shutil
from PIL import Image

FRAME_SIZE = (48, 48)
ANIM_DIR = os.path.join("art-staging", "icons", "exit-marker-extract", "animations")
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

if not os.path.isdir(ANIM_DIR):
    print(f"skipping exit marker: {ANIM_DIR} not found")
else:
    anim_names = os.listdir(ANIM_DIR)
    if not anim_names:
        print(f"skipping exit marker: no animation subfolder under {ANIM_DIR}")
    else:
        frame_dir = os.path.join(ANIM_DIR, anim_names[0], "unknown")
        frame_files = sorted(f for f in os.listdir(frame_dir) if f.startswith("frame_") and f.endswith(".png"))
        frames = []
        for fname in frame_files:
            im = Image.open(os.path.join(frame_dir, fname)).convert("RGBA")
            squared = crop_to_square_bbox(im)
            frames.append(squared.resize(FRAME_SIZE, Image.LANCZOS))

        sheet = Image.new("RGBA", (FRAME_SIZE[0] * len(frames), FRAME_SIZE[1]), (0, 0, 0, 0))
        for i, frame in enumerate(frames):
            sheet.paste(frame, (i * FRAME_SIZE[0], 0))

        out_path = os.path.join(OUT_DIR, "exit-marker-glow.png")
        sheet.save(out_path, format="PNG", optimize=True)
        print(f"exit marker: {len(frames)} frames -> {sheet.width}x{sheet.height} -> {out_path} "
              f"({os.path.getsize(out_path) / 1024:.1f}KB)")

        archive_dir = os.path.join(ORIGINALS_ROOT, "exit-marker")
        if not os.path.exists(archive_dir):
            shutil.copytree(os.path.join("art-staging", "icons", "exit-marker-extract"), archive_dir)
        print(f"  archived source to {archive_dir}")

        shutil.rmtree(os.path.join("art-staging", "icons", "exit-marker-extract"))
        print("cleared exit-marker staging files")
