"""Patches a NEW walking-row direction into an already-built equipment-layer sheet in place,
for an item that shipped with fewer than 4 walking directions and later turned out to need one
more (e.g. keepers-lantern was built with down/left/up only, assumed fully occluded facing east -
the hand turned out to sometimes be visible there too, so a real right-frame set was hand-
positioned afterward).

Same safety model as build_equipment_layer_running.py, generalized to the walking rows (0-3)
instead of the running rows (4-7): overwrites ONLY the specified direction's cell in each of the
walking row's 4 frame columns, for whichever items/directions are passed in. Every other pixel in
the sheet - the item's own already-shipped directions, and every other item's sheet entirely - is
left completely untouched. Safe to run even though other items' sheets have direct hand-touch-ups
that don't exist in their own art-staging source frames (the walking-pass full-rebuild script,
build_equipment_layer_manual.py, is NOT safe to re-run once that's happened - see
docs/Equipment-Layering-Plan.md's "Gotcha" note).

Usage: python scripts/build_equipment_layer_add_direction.py <item> <direction> [kind] [part]
  item: e.g. keepers-lantern
  direction: down | left | up | right
  kind: single (default) or paired
  part: required if kind=paired, e.g. hand or foot
Reads:  art-staging/equipment-layers-manual/<item>/<direction>-frame<N>[-left-<part>|
        -right-<part>].png
Writes: public/assets/sprites/equipment/<item>-male-animated.png (in place, walking row only),
        docs/equipment-layer-anchors.json (merges the new direction into the item's existing
        walking-pose category entry - does NOT overwrite previously recorded directions).
"""

import json
import os
import sys
from PIL import Image

FRAME_SIZE = (72, 96)
WALK_ROW = {"down": 0, "left": 1, "up": 2, "right": 3}

STAGING_ROOT = os.path.join("art-staging", "equipment-layers-manual")
OUT_DIR = os.path.join("public", "assets", "sprites", "equipment")
ANCHOR_TABLE_PATH = os.path.join("docs", "equipment-layer-anchors.json")

# item -> category (must match the item's existing anchor-table bucket, from
# build_equipment_layer_manual.py's ITEM_SPEC).
ITEM_CATEGORY = {
    "keepers-lantern": "held-left-hand",
    "traveler-boots": "paired-feet",
    "travelers-cloak": "worn-torso",
    "weathered-walking-staff": "held-right-hand",
    "work-gloves": "paired-hands",
}


def bbox_center(im: Image.Image):
    bbox = im.getbbox()
    if bbox is None:
        return None
    l, t, r, b = bbox
    return {"cx": round((l + r) / 2, 1), "cy": round((t + b) / 2, 1), "w": r - l, "h": b - t}


def load_single(item_dir, direction, frame):
    path = os.path.join(item_dir, f"{direction}-frame{frame}.png")
    return Image.open(path).convert("RGBA") if os.path.exists(path) else None


def load_paired(item_dir, direction, frame, part):
    left_path = os.path.join(item_dir, f"{direction}-frame{frame}-left-{part}.png")
    right_path = os.path.join(item_dir, f"{direction}-frame{frame}-right-{part}.png")
    if not os.path.exists(left_path) and not os.path.exists(right_path):
        return None
    canvas = Image.new("RGBA", FRAME_SIZE, (0, 0, 0, 0))
    for path in (left_path, right_path):
        if os.path.exists(path):
            canvas.alpha_composite(Image.open(path).convert("RGBA"))
    return canvas


def patch_direction(item_name, direction, kind, part):
    src_dir = os.path.join(STAGING_ROOT, item_name)
    out_path = os.path.join(OUT_DIR, f"{item_name}-male-animated.png")
    if not os.path.exists(out_path):
        print(f"aborting: {out_path} doesn't exist yet")
        return None

    sheet = Image.open(out_path).convert("RGBA")
    row = WALK_ROW[direction]
    anchors = []
    patched = 0

    for frame in range(4):
        frame_im = load_single(src_dir, direction, frame) if kind == "single" else load_paired(src_dir, direction, frame, part)
        if frame_im is not None:
            cell_box = (frame * FRAME_SIZE[0], row * FRAME_SIZE[1], (frame + 1) * FRAME_SIZE[0], (row + 1) * FRAME_SIZE[1])
            sheet.paste(Image.new("RGBA", FRAME_SIZE, (0, 0, 0, 0)), cell_box)
            sheet.alpha_composite(frame_im, (frame * FRAME_SIZE[0], row * FRAME_SIZE[1]))
            anchors.append(bbox_center(frame_im))
            patched += 1
        else:
            anchors.append(None)

    if patched == 0:
        print(f"{item_name} {direction}: no staged frames found in {src_dir}, nothing patched")
        return None

    # Running rows (4-7) for this direction still duplicate whatever was there before (transparent,
    # since this direction is new) - left as-is, matching every other item's still-open running gap.
    sheet.save(out_path, format="PNG", optimize=True)
    print(f"{item_name}: patched {patched} walking-row cell(s) for '{direction}' -> {out_path}")
    return anchors


def update_anchor_table(item_name, category, direction, anchors):
    if not os.path.exists(ANCHOR_TABLE_PATH):
        print("no existing anchor table found - skipping anchor record")
        return
    with open(ANCHOR_TABLE_PATH, "r", encoding="utf-8") as f:
        table = json.load(f)
    table.setdefault(category, {}).setdefault(item_name, {})
    table[category][item_name][direction] = anchors
    with open(ANCHOR_TABLE_PATH, "w", encoding="utf-8") as f:
        json.dump(table, f, indent=2)
        f.write("\n")


if __name__ == "__main__":
    if len(sys.argv) < 3:
        print("usage: python scripts/build_equipment_layer_add_direction.py <item> <direction> [kind] [part]")
        sys.exit(1)
    item_name, direction = sys.argv[1], sys.argv[2]
    kind = sys.argv[3] if len(sys.argv) > 3 else "single"
    part = sys.argv[4] if len(sys.argv) > 4 else None
    category = ITEM_CATEGORY.get(item_name)
    if category is None:
        print(f"unknown item: {item_name}")
        sys.exit(1)
    anchors = patch_direction(item_name, direction, kind, part)
    if anchors is not None:
        update_anchor_table(item_name, category, direction, anchors)
    print("done")
