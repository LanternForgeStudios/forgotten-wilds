"""Build a stationary Crimson Bayou NPC's idle-animation sprite sheet, same shape/convention as
build_npc_idle_sheet.py (single-row 4-frame south-facing sheet, 72x96 per frame), but computing
the crop box automatically (union alpha bbox across the 4 staged frames) instead of a hand-measured
per-NPC constant - equivalent to what that measurement already was, just not requiring a human to
eyeball pixel coordinates first.

Source layout: art-staging/characters/<npc>/animations/animating/south/frame_00{0-3}.png
Output: public/assets/sprites/characters/<npc>-idle.png
"""

import os
import shutil
import sys
from PIL import Image

FRAME_SIZE = (72, 96)
SRC_ROOT = os.path.join("art-staging", "characters")
OUT_DIR = os.path.join("public", "assets", "sprites", "characters")
ORIGINALS_ROOT = os.path.join(OUT_DIR, "original")


def fit_aspect(crop_box, target_size, canvas_size):
    """Expand the shorter dimension of crop_box (symmetrically) so its aspect ratio matches
    target_size's, before any resize happens - resizing a crop straight into a differently-shaped
    target without this stretches the content non-uniformly (verified: 1.7x-2.24x more horizontal
    stretch than vertical across every Bayou NPC/enemy built before this fix). Clamped to the
    source canvas; if there isn't room to fully expand (rare, character near a canvas edge), takes
    as much as fits rather than leaving the box unexpanded."""
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


def build(slug):
    staging_dir = os.path.join(SRC_ROOT, slug)
    src_dir = os.path.join(staging_dir, "animations", "animating", "south")
    if not os.path.isdir(src_dir):
        print(f"skipping {slug}: no staged frames found at {src_dir}")
        return

    frame_files = sorted(f for f in os.listdir(src_dir) if f.startswith("frame_") and f.endswith(".png"))
    images = [Image.open(os.path.join(src_dir, f)).convert("RGBA") for f in frame_files]

    # Union bbox across all frames - a breathing-idle loop shifts slightly frame to frame, so a
    # per-frame bbox would misalign them; one shared box (same as the hand-measured convention)
    # keeps the character anchored consistently across the loop.
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

    # Pad slightly and keep it square-ish/centered like the hand-measured examples do, clamped to
    # the source canvas.
    w, h = images[0].size
    pad = 4
    crop_box = (max(0, l - pad), max(0, t - pad), min(w, r + pad), min(h, b + pad))
    crop_box = fit_aspect(crop_box, FRAME_SIZE, (w, h))

    sheet = Image.new("RGBA", (FRAME_SIZE[0] * len(images), FRAME_SIZE[1]), (0, 0, 0, 0))
    for i, im in enumerate(images):
        cropped = im.crop(crop_box)
        resized = cropped.resize(FRAME_SIZE, Image.NEAREST)
        sheet.paste(resized, (i * FRAME_SIZE[0], 0))

    out_path = os.path.join(OUT_DIR, f"{slug}-idle.png")
    os.makedirs(OUT_DIR, exist_ok=True)
    sheet.save(out_path, format="PNG", optimize=True, compress_level=9)
    print(f"{slug}: crop_box={crop_box} -> {sheet.width}x{sheet.height} -> {out_path}")

    archive_dir = os.path.join(ORIGINALS_ROOT, slug)
    if not os.path.exists(archive_dir):
        shutil.copytree(staging_dir, archive_dir)
    shutil.rmtree(staging_dir)


if __name__ == "__main__":
    slugs = sys.argv[1:]
    if not slugs:
        print("usage: python scripts/build_bayou_npc_idle_sheet.py <slug> [slug ...]")
        sys.exit(1)
    for s in slugs:
        build(s)
    print("done")
