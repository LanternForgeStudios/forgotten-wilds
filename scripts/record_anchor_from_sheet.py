"""Computes and records anchor-table entries (per-direction, per-frame bounding-box center) for an
item DIRECTLY from its live, already-built public/assets/sprites/equipment/<item>-male-animated.png
sheet - for when a sheet was hand-touched-up as a finished full sheet (not built from
art-staging/equipment-layers-manual/ source frames via build_equipment_layer_manual.py, which
records anchors as a side effect of that build). Without this, an item edited this way would have
no anchor-table entry at all, going stale/missing the moment anyone tries to use it as a reference
for a future same-category sibling (palette-swap or estimate-transform).

For a paired item (boots/gloves), this records ONE bbox per (direction, frame) for the whole
composited cell (both feet/hands together) - matching build_equipment_layer_manual.py's own
bbox_center convention, not a per-foot/per-hand split.

Usage: python scripts/record_anchor_from_sheet.py <item> <category> [direction ...] [--gender=female]
  category: the anchor-table bucket to record under (e.g. 'paired-feet', 'worn-torso').
  directions: which directions to record (defaults to down left up right). Walking rows (0-3)
              recorded under the top-level category; running rows (4-7) recorded under the
              top-level "running" bucket's own copy of that category - same shape the other
              anchor-writing scripts already use.
  --gender=female: read <item>-female-animated.png instead of <item>-male-animated.png, and
              record under a "-female" suffixed item key within the same category bucket (e.g.
              category["ironwood-walking-staff-female"]) so it never collides with that same
              item's male entry - matches estimate_transform_equipment_layer.py's own convention.
"""

import json
import os
import sys
from PIL import Image

FRAME = (72, 96)
WALK_ROW = {"down": 0, "left": 1, "up": 2, "right": 3}
RUN_ROW = {"down": 4, "left": 5, "up": 6, "right": 7}

SHEET_DIR = os.path.join("public", "assets", "sprites", "equipment")
ANCHOR_TABLE_PATH = os.path.join("docs", "equipment-layer-anchors.json")


def bbox_center(cell):
    bbox = cell.getbbox()
    if bbox is None:
        return None
    l, t, r, b = bbox
    return {"cx": round((l + r) / 2, 1), "cy": round((t + b) / 2, 1), "w": r - l, "h": b - t}


def record(item, category, directions, gender="male"):
    sheet_path = os.path.join(SHEET_DIR, f"{item}-{gender}-animated.png")
    sheet = Image.open(sheet_path).convert("RGBA")

    walk_anchors = {}
    run_anchors = {}
    for direction in directions:
        walk_row = WALK_ROW[direction]
        run_row = RUN_ROW[direction]
        walk_anchors[direction] = []
        run_anchors[direction] = []
        for frame in range(4):
            wx0, wy0 = frame * FRAME[0], walk_row * FRAME[1]
            walk_cell = sheet.crop((wx0, wy0, wx0 + FRAME[0], wy0 + FRAME[1]))
            walk_anchors[direction].append(bbox_center(walk_cell))

            rx0, ry0 = frame * FRAME[0], run_row * FRAME[1]
            run_cell = sheet.crop((rx0, ry0, rx0 + FRAME[0], ry0 + FRAME[1]))
            run_anchors[direction].append(bbox_center(run_cell))

    anchor_item_key = item if gender == "male" else f"{item}-female"
    with open(ANCHOR_TABLE_PATH, "r", encoding="utf-8") as f:
        table = json.load(f)
    table.setdefault(category, {})[anchor_item_key] = walk_anchors
    table.setdefault("running", {}).setdefault(category, {})[anchor_item_key] = run_anchors
    with open(ANCHOR_TABLE_PATH, "w", encoding="utf-8") as f:
        json.dump(table, f, indent=2)
        f.write("\n")
    print(f"{item} ({gender}): recorded walking + running anchors under category '{category}' as '{anchor_item_key}'")


if __name__ == "__main__":
    if len(sys.argv) < 3:
        print("usage: python scripts/record_anchor_from_sheet.py <item> <category> [direction ...] [--gender=female]")
        sys.exit(1)
    item_arg = sys.argv[1]
    category_arg = sys.argv[2]
    rest = sys.argv[3:]
    gender_arg = "male"
    dirs = []
    for arg in rest:
        if arg.startswith("--gender="):
            gender_arg = arg.split("=", 1)[1]
        else:
            dirs.append(arg)
    dirs = dirs or ["down", "left", "up", "right"]
    record(item_arg, category_arg, dirs, gender_arg)
    print("done")
