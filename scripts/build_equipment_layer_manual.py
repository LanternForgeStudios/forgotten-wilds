"""Builds equipment-layer sprite sheets from HAND-POSITIONED frames (the manual-edit working
folder handed back after the automated anchor-guess approach - build_equipment_layer.py's
ANCHORS/grip/target_h math - produced unusable results ("looks like junk"). Each source file is
already an exact 72x96 canvas with the item positioned exactly where it should land relative to
the base body's own 72x96 frame at that (direction, frame index) - so building the final sheet is
just direct placement, no scaling/anchor math at all.

A "paired" item (boots, gloves) has two source files per cell (left-foot/right-foot or
left-hand/right-hand) that get composited together into one frame.

Also extracts a reusable ANCHOR TABLE per item - the bounding-box center of the item's own pixels
within each of its 16 (direction, frame) canvases - and merges it into
docs/equipment-layer-anchors.json, keyed by CATEGORY (not item id). A future item in the SAME
category (e.g. another 'armor'-slot cloak-like piece, another left-hand-held item) can then be
auto-scaled/centered on that measured anchor instead of requiring full manual positioning again -
see that file's own header comment for how to use it. This table is only as good as the frames it
was measured from, so re-run this after every newly hand-positioned item to refine it.

Usage: python scripts/build_equipment_layer_manual.py
Reads:  art-staging/equipment-layers-manual/<item>/<direction>-frame<N>[-left-foot|-right-foot|
        -left-hand|-right-hand].png
Writes: public/assets/sprites/equipment/<item>-male-animated.png (288x768, 8 rows x 4 cols of
        72x96 - walk rows 0-3 real, run rows 4-7 duplicate walk, matching sprite.player.male's own
        convention), docs/equipment-layer-anchors.json (merged/updated, not overwritten wholesale).
"""

import json
import os
from PIL import Image

FRAME_SIZE = (72, 96)
DIRECTIONS = ["down", "left", "up", "right"]
WALK_ROW = {"down": 0, "left": 1, "up": 2, "right": 3}

STAGING_ROOT = os.path.join("art-staging", "equipment-layers-manual")
OUT_DIR = os.path.join("public", "assets", "sprites", "equipment")
ANCHOR_TABLE_PATH = os.path.join("docs", "equipment-layer-anchors.json")

# item -> (category, kind, directions_needed)
#   category: the reusable-anchor bucket future same-slot items should look up.
#   kind: "single" (one file per cell) or "paired" (two files per cell, suffixed -left-<part>/-right-<part>).
ITEM_SPEC = {
    "keepers-lantern": {"category": "held-left-hand", "kind": "single", "directions": ["down", "left", "up"]},
    "traveler-boots": {"category": "paired-feet", "kind": "paired", "part": "foot", "directions": DIRECTIONS},
    # Registered here ahead of time so re-running this script picks them up automatically the
    # moment their manual-edit folders land in art-staging/equipment-layers-manual/ - no code
    # change needed for the next 3 items, just `cp` the finished folder in and re-run.
    "travelers-cloak": {"category": "worn-torso", "kind": "single", "directions": DIRECTIONS},
    "weathered-walking-staff": {"category": "held-right-hand", "kind": "single", "directions": ["down", "up", "right", "left"]},
    "work-gloves": {"category": "paired-hands", "kind": "paired", "part": "hand", "directions": DIRECTIONS},
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
    canvas = Image.new("RGBA", FRAME_SIZE, (0, 0, 0, 0))
    found = False
    for path in (left_path, right_path):
        if os.path.exists(path):
            canvas.alpha_composite(Image.open(path).convert("RGBA"))
            found = True
    return canvas if found else None


def build_item(item_name, spec):
    item_dir = os.path.join(STAGING_ROOT, item_name)
    if not os.path.isdir(item_dir):
        print(f"skipping {item_name}: {item_dir} not found (not handed back yet)")
        return None

    sheet = Image.new("RGBA", (FRAME_SIZE[0] * 4, FRAME_SIZE[1] * 8), (0, 0, 0, 0))
    anchors = {}

    for direction in spec["directions"]:
        row = WALK_ROW[direction]
        anchors[direction] = []
        for frame in range(4):
            if spec["kind"] == "single":
                frame_im = load_single(item_dir, direction, frame)
            else:
                frame_im = load_paired(item_dir, direction, frame, spec["part"])

            if frame_im is not None:
                sheet.paste(frame_im, (frame * FRAME_SIZE[0], row * FRAME_SIZE[1]))
                anchors[direction].append(bbox_center(frame_im))
            else:
                anchors[direction].append(None)

    # Running rows (4-7) duplicate walking (0-3) - no run cycle for this pilot, matching every
    # other equipment-layer item's own convention.
    for row in range(4):
        for col in range(4):
            frame = sheet.crop((col * FRAME_SIZE[0], row * FRAME_SIZE[1], (col + 1) * FRAME_SIZE[0], (row + 1) * FRAME_SIZE[1]))
            sheet.paste(frame, (col * FRAME_SIZE[0], (row + 4) * FRAME_SIZE[1]))

    os.makedirs(OUT_DIR, exist_ok=True)
    out_path = os.path.join(OUT_DIR, f"{item_name}-male-animated.png")
    sheet.save(out_path, format="PNG", optimize=True)
    print(f"{item_name}: -> {out_path} ({os.path.getsize(out_path) / 1024:.0f}KB)")
    return anchors


ANCHOR_TABLE_README = (
    "Per-category equipment-layer anchor data, measured from real hand-positioned art (not "
    "guessed) - see scripts/build_equipment_layer_manual.py's own header for the full story. "
    "Each category (e.g. 'held-left-hand', 'worn-torso') maps item-id -> direction -> [4 frames], "
    "each frame either null (item has no art for that direction) or {cx, cy, w, h} - the bounding-"
    "box center/size (in px, within the item's own 72x96 canvas) of where that item's art actually "
    "sits once correctly positioned. To place a NEW item in an already-populated category: scale "
    "the new item's own art so its height is close to an existing entry's h for that "
    "direction/frame, then center it on that entry's (cx, cy) as a starting point - this should "
    "land close for a similarly-shaped item (e.g. another cloak, another one-handed held prop) but "
    "always do a quick visual check/nudge afterward, since the anchor tells you WHERE on the body "
    "to attach, not how a differently-shaped item's own art should be positioned within itself."
)


def update_anchor_table(item_name, category, anchors):
    table = {"_readme": ANCHOR_TABLE_README}
    if os.path.exists(ANCHOR_TABLE_PATH):
        with open(ANCHOR_TABLE_PATH, "r", encoding="utf-8") as f:
            table = json.load(f)
            table["_readme"] = ANCHOR_TABLE_README
    table.setdefault(category, {})
    table[category][item_name] = anchors
    os.makedirs(os.path.dirname(ANCHOR_TABLE_PATH), exist_ok=True)
    with open(ANCHOR_TABLE_PATH, "w", encoding="utf-8") as f:
        json.dump(table, f, indent=2)
        f.write("\n")


if __name__ == "__main__":
    for item_name, spec in ITEM_SPEC.items():
        anchors = build_item(item_name, spec)
        if anchors is not None:
            update_anchor_table(item_name, spec["category"], anchors)
    print("done")
