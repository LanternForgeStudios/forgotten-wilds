"""EXPERIMENTAL: auto-generates a new equipment-layer sheet for an item whose silhouette genuinely
differs from its family's already-hand-positioned reference item (unlike
palette_swap_equipment_layer.py's same-shape recolor case) - e.g. Spiritwood Walking Staff is a
straight rod with no crook handle, vs. Weathered Walking Staff's cane shape. Reuses the reference
item's per-frame ROTATION and TRIM (both hand-tuned, not re-derivable from scratch) rather than
re-deriving them, since only the reference frame's finished art - not an "untrimmed"
intermediate - still exists:

Per frame:
  1. Estimate the reference frame's own rotation angle via PCA on its alpha-mask pixel
     coordinates - the major axis of an elongated rod-like prop's pixel cloud is a solid proxy
     for "which way it's tilted" in that frame.
  2. Estimate the NEW item's own native rotation angle the same way, from its raw icon art.
  3. Rotate the new item's raw art by (reference_angle - native_angle) around its own centroid.
  4. Uniformly scale the rotated art so its axis-aligned bounding-box HEIGHT matches the anchor
     table's recorded `h` for this (item-category, direction, frame) - the same height-matching
     metric the original (now-abandoned) fully-automated pipeline used, just applied to an already-
     correctly-posed reference instead of a raw unposed guess.
  5. Center it on the anchor table's recorded (cx, cy).
  6. Clip the result to the REFERENCE frame's own alpha silhouette (intersection) - this
     reproduces the reference's hand-tuned grip-trim notch for free, and prevents the new item's
     shape from sticking out past where the old one was deliberately kept within the body's
     silhouette. Trade-off: the new item's own silhouette width/shape is constrained to the
     reference's - fine for a same-family item of similar diameter (a walking staff), not
     appropriate for a much thicker/thinner item.

This is meaningfully less certain than the palette-swap script's same-shape case - ALWAYS visually
QA the result (composited against the base body) before treating it as final; expect some frames
may need manual touch-up.

Usage: python scripts/estimate_transform_equipment_layer.py <reference_item> <target_item> <category> [directions...] [--pose=running] [--gender=female]
  reference_item: an item with an already-built sheet + recorded anchor-table entries.
  target_item: the new item id - sourced from its own existing flat icon at
               public/assets/icons/original/<target_item>.png (already a clean, transparent,
               single-object image for every equipment item in this project - no separate raw
               map-object generation needed).
  category: the anchor-table bucket to read the reference's per-frame (cx,cy,w,h) from.
  directions: which directions to process (defaults to whatever the reference item covers).
  --gender=female: run against the female base body/reference sheet instead of male (default
    male) - matches palette_swap_equipment_layer.py's own <item>-<gender>-animated.png convention.
    Anchor data is read/written under a "-female" suffixed item key within the SAME category
    bucket (e.g. category["ironwood-walking-staff-female"]) so it never collides with the male
    entries for the same reference item.
Writes: public/assets/sprites/equipment/<target_item>-<gender>-animated.png (walking rows only -
        running needs its own reference-frame-informed pass once walking is confirmed good).
"""

import json
import math
import os
import sys
from PIL import Image

FRAME_SIZE = (72, 96)
WALK_ROW = {"down": 0, "left": 1, "up": 2, "right": 3}
RUN_ROW = {"down": 4, "left": 5, "up": 6, "right": 7}

ICON_DIR = os.path.join("public", "assets", "icons", "original")
SHEET_DIR = os.path.join("public", "assets", "sprites", "equipment")
ANCHOR_TABLE_PATH = os.path.join("docs", "equipment-layer-anchors.json")


def alpha_points(im):
    """List of (x, y) for every pixel with alpha > threshold."""
    w, h = im.size
    px = im.load()
    return [(x, y) for y in range(h) for x in range(w) if px[x, y][3] > 30]


def pca_angle_deg(points):
    """Angle (degrees, 0=vertical/up-down, positive=clockwise) of the major axis of a point
    cloud's covariance matrix - a standard 2D PCA orientation estimate."""
    n = len(points)
    if n < 2:
        return 0.0
    mx = sum(p[0] for p in points) / n
    my = sum(p[1] for p in points) / n
    sxx = sum((p[0] - mx) ** 2 for p in points) / n
    syy = sum((p[1] - my) ** 2 for p in points) / n
    sxy = sum((p[0] - mx) * (p[1] - my) for p in points) / n
    # Principal eigenvector angle of [[sxx, sxy], [sxy, syy]].
    theta = 0.5 * math.atan2(2 * sxy, sxx - syy)
    # atan2 gives angle from the x-axis; convert to "degrees from vertical" to match how a
    # staff/rod's tilt is usually reasoned about (0 = straight up-down).
    return math.degrees(theta) - 90.0


def frame_from_sheet(sheet, row, col):
    x0, y0 = col * FRAME_SIZE[0], row * FRAME_SIZE[1]
    return sheet.crop((x0, y0, x0 + FRAME_SIZE[0], y0 + FRAME_SIZE[1]))


def transform_frame(raw_art, native_angle, target_angle, target_h, target_cx, target_cy, stencil):
    """Rotate raw_art by (target_angle - native_angle), scale to target_h, center at
    (target_cx, target_cy) on a fresh 72x96 canvas, then clip to stencil's alpha."""
    delta = target_angle - native_angle
    rotated = raw_art.rotate(-delta, expand=True, resample=Image.BICUBIC)
    bbox = rotated.getbbox()
    if bbox is None:
        return Image.new("RGBA", FRAME_SIZE, (0, 0, 0, 0))
    cropped = rotated.crop(bbox)
    cur_h = cropped.height
    scale = target_h / cur_h if cur_h > 0 else 1.0
    new_size = (max(1, round(cropped.width * scale)), max(1, round(cropped.height * scale)))
    resized = cropped.resize(new_size, Image.LANCZOS)

    canvas = Image.new("RGBA", FRAME_SIZE, (0, 0, 0, 0))
    paste_x = round(target_cx - resized.width / 2)
    paste_y = round(target_cy - resized.height / 2)
    canvas.alpha_composite(resized, (paste_x, paste_y))

    # Clip to the reference's own silhouette (reproduces its grip-trim notch for free).
    canvas_px = canvas.load()
    stencil_px = stencil.load()
    for y in range(FRAME_SIZE[1]):
        for x in range(FRAME_SIZE[0]):
            if stencil_px[x, y][3] <= 10:
                r, g, b, a = canvas_px[x, y]
                canvas_px[x, y] = (r, g, b, 0)
    return canvas


def run(reference_item, target_item, category, directions, pose="walking", use_rotation=True, gender="male"):
    raw_path = os.path.join(ICON_DIR, f"{target_item}.png")
    if not os.path.exists(raw_path):
        print(f"aborting: {raw_path} not found")
        return
    raw_art = Image.open(raw_path).convert("RGBA")
    native_angle = pca_angle_deg(alpha_points(raw_art)) if use_rotation else 0.0
    print(f"{target_item} raw art native angle: {native_angle:.1f} deg" if use_rotation else f"{target_item}: rotation estimation disabled (not an elongated/held item)")

    ref_sheet_path = os.path.join(SHEET_DIR, f"{reference_item}-{gender}-animated.png")
    ref_sheet = Image.open(ref_sheet_path).convert("RGBA")
    row_map = WALK_ROW if pose == "walking" else RUN_ROW

    # Female anchor data is kept in the SAME category bucket as male, under a "-female" suffixed
    # key on the reference item id, so it never collides with the male entries already recorded
    # for that same reference item.
    anchor_item_key = reference_item if gender == "male" else f"{reference_item}-female"

    with open(ANCHOR_TABLE_PATH, "r", encoding="utf-8") as f:
        table = json.load(f)
    anchor_bucket = table.get(category, {}) if pose == "walking" else table.get("running", {}).get(category, {})
    ref_anchors = anchor_bucket.get(anchor_item_key)
    if ref_anchors is None:
        print(f"aborting: no {pose}-pose anchor entries for {anchor_item_key} in category {category}")
        return

    # Walking builds a fresh 8-row sheet (running rows filled in by a separate pass, or left as
    # walking-duplicates like every other item's still-open running gap); running patches only
    # rows 4-7 of an ALREADY-BUILT sheet in place, same clobber-safety as
    # build_equipment_layer_running.py - never touches rows 0-3 or any other item's file.
    if pose == "walking":
        out_sheet = Image.new("RGBA", (FRAME_SIZE[0] * 4, FRAME_SIZE[1] * 8), (0, 0, 0, 0))
    else:
        out_path_existing = os.path.join(SHEET_DIR, f"{target_item}-{gender}-animated.png")
        if not os.path.exists(out_path_existing):
            print(f"aborting: {out_path_existing} doesn't exist yet - run the walking pass first")
            return
        out_sheet = Image.open(out_path_existing).convert("RGBA")

    new_anchors = {}
    for direction in directions:
        if direction not in ref_anchors:
            continue
        row = row_map[direction]
        new_anchors[direction] = []
        for frame in range(4):
            entry = ref_anchors[direction][frame] if frame < len(ref_anchors[direction]) else None
            stencil = frame_from_sheet(ref_sheet, row, frame)
            if entry is None or stencil.getbbox() is None:
                new_anchors[direction].append(None)
                continue
            target_angle = pca_angle_deg(alpha_points(stencil)) if use_rotation else 0.0
            result = transform_frame(raw_art, native_angle, target_angle, entry["h"], entry["cx"], entry["cy"], stencil)
            cell_box = (frame * FRAME_SIZE[0], row * FRAME_SIZE[1], (frame + 1) * FRAME_SIZE[0], (row + 1) * FRAME_SIZE[1])
            out_sheet.paste(Image.new("RGBA", FRAME_SIZE, (0, 0, 0, 0)), cell_box)
            out_sheet.alpha_composite(result, (frame * FRAME_SIZE[0], row * FRAME_SIZE[1]))
            bbox = result.getbbox()
            new_anchors[direction].append(
                {"cx": round((bbox[0] + bbox[2]) / 2, 1), "cy": round((bbox[1] + bbox[3]) / 2, 1), "w": bbox[2] - bbox[0], "h": bbox[3] - bbox[1]}
                if bbox else None
            )

    out_path = os.path.join(SHEET_DIR, f"{target_item}-{gender}-animated.png")
    out_sheet.save(out_path, format="PNG", optimize=True)
    print(f"{target_item} ({gender}): estimated-transform {pose} build -> {out_path}")

    target_anchor_key = target_item if gender == "male" else f"{target_item}-female"
    if pose == "walking":
        table.setdefault(category, {})[target_anchor_key] = new_anchors
    else:
        table.setdefault("running", {}).setdefault(category, {})[target_anchor_key] = new_anchors
    with open(ANCHOR_TABLE_PATH, "w", encoding="utf-8") as f:
        json.dump(table, f, indent=2)
        f.write("\n")


if __name__ == "__main__":
    if len(sys.argv) < 4:
        print("usage: python scripts/estimate_transform_equipment_layer.py <reference_item> <target_item> <category> [directions...] [--pose=running] [--gender=female]")
        sys.exit(1)
    reference_item, target_item, category = sys.argv[1], sys.argv[2], sys.argv[3]
    rest = sys.argv[4:]
    pose = "walking"
    use_rotation = True
    gender = "male"
    directions = []
    for arg in rest:
        if arg.startswith("--pose="):
            pose = arg.split("=", 1)[1]
        elif arg.startswith("--gender="):
            gender = arg.split("=", 1)[1]
        elif arg == "--no-rotation":
            use_rotation = False
        else:
            directions.append(arg)
    directions = directions or ["down", "left", "up", "right"]
    run(reference_item, target_item, category, directions, pose, use_rotation, gender)
    print("done")
