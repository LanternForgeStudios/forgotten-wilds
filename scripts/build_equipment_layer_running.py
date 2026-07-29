"""Patches the RUNNING rows (4-7) of an already-built equipment-layer sheet in place, from
hand-positioned running-pose frames - the round-2 counterpart to
build_equipment_layer_manual.py's walking pass (see docs/Equipment-Layering-Plan.md's "Phased
delivery" section for the full workflow history, including the gotcha this script is deliberately
designed to avoid).

Deliberately does NOT rebuild the whole sheet from scratch the way the walking-pass script does.
That script rebuilds every item's full output every run (fine when every item's source is the
finished walking art), which already once silently clobbered a user's direct hand-touch-up to an
already-committed output PNG. This script instead:
  1. opens the EXISTING output PNG (must already exist - run the walking pass first)
  2. overwrites ONLY the running-row (4-7) cell for each (direction, frame) that has a real
     running-pose source file staged
  3. leaves every walking-row (0-3) pixel, and every running-row cell WITHOUT a staged source
     frame (still the old walking-frame duplicate placeholder), completely untouched
  4. saves back to the same path

So this is safe to run repeatedly, incrementally, per item, in any order, without risk of
clobbering a different item's sheet or a not-yet-updated direction's still-placeholder cell.

Usage: python scripts/build_equipment_layer_running.py [item ...]
  With no arguments, processes every item that has a staged folder. Pass specific item names to
  process only those.
Reads:  art-staging/equipment-layers-manual-running/<item>/<direction>-frame<N>[-left-foot|
        -right-foot|-left-hand|-right-hand].png
Writes: public/assets/sprites/equipment/<item>-male-animated.png (in place),
        docs/equipment-layer-anchors.json (adds/updates a top-level "running" bucket, keyed the
        same way as the existing walking-pose category->item->direction->frames shape - the
        existing top-level category entries are the walking pose and are never touched by this
        script).
"""

import json
import os
import sys
from PIL import Image

FRAME_SIZE = (72, 96)
RUN_ROW = {"down": 4, "left": 5, "up": 6, "right": 7}

STAGING_ROOT = os.path.join("art-staging", "equipment-layers-manual-running")
OUT_DIR = os.path.join("public", "assets", "sprites", "equipment")
ANCHOR_TABLE_PATH = os.path.join("docs", "equipment-layer-anchors.json")

# item -> (category, kind, directions_needed) - same shape/values as
# build_equipment_layer_manual.py's ITEM_SPEC (kept as a separate copy rather than a shared
# import so this script has no dependency on that one's module-load side effects).
ITEM_SPEC = {
    "keepers-lantern": {"category": "held-left-hand", "kind": "single", "directions": ["down", "left", "up"]},
    "traveler-boots": {"category": "paired-feet", "kind": "paired", "part": "foot", "directions": ["down", "left", "up", "right"]},
    "travelers-cloak": {"category": "worn-torso", "kind": "single", "directions": ["down", "left", "up", "right"]},
    "weathered-walking-staff": {"category": "held-right-hand", "kind": "single", "directions": ["down", "up", "right", "left"]},
    "work-gloves": {"category": "paired-hands", "kind": "paired", "part": "hand", "directions": ["down", "left", "up", "right"]},
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


ANCHOR_TABLE_README = (
    "Per-category equipment-layer anchor data, measured from real hand-positioned art - see "
    "scripts/build_equipment_layer_manual.py's header for the walking-pose shape and how to use "
    "it as a starting point for a new item. Top-level keys are pose buckets: entries directly "
    "under a category name (e.g. 'held-left-hand') are the WALKING pose; entries under the "
    "'running' key follow the identical category->item->direction->frames shape but for the "
    "running pose (rows 4-7) - see scripts/build_equipment_layer_running.py."
)


def patch_item(item_name, spec):
    src_dir = os.path.join(STAGING_ROOT, item_name)
    if not os.path.isdir(src_dir):
        print(f"skipping {item_name}: {src_dir} not found (no running edits staged yet)")
        return None

    out_path = os.path.join(OUT_DIR, f"{item_name}-male-animated.png")
    if not os.path.exists(out_path):
        print(f"skipping {item_name}: {out_path} doesn't exist yet - run the walking pass first")
        return None

    sheet = Image.open(out_path).convert("RGBA")
    anchors = {}
    patched_count = 0

    for direction in spec["directions"]:
        row = RUN_ROW[direction]
        anchors[direction] = []
        for frame in range(4):
            if spec["kind"] == "single":
                frame_im = load_single(src_dir, direction, frame)
            else:
                frame_im = load_paired(src_dir, direction, frame, spec["part"])

            if frame_im is not None:
                cell_box = (frame * FRAME_SIZE[0], row * FRAME_SIZE[1], (frame + 1) * FRAME_SIZE[0], (row + 1) * FRAME_SIZE[1])
                # Clear the old walking-duplicate placeholder before compositing, so a
                # transparent pixel in the new frame doesn't let the old one show through.
                sheet.paste(Image.new("RGBA", FRAME_SIZE, (0, 0, 0, 0)), cell_box)
                sheet.alpha_composite(frame_im, (frame * FRAME_SIZE[0], row * FRAME_SIZE[1]))
                anchors[direction].append(bbox_center(frame_im))
                patched_count += 1
            else:
                anchors[direction].append(None)

    if patched_count == 0:
        print(f"{item_name}: no running frames found in {src_dir}, nothing patched")
        return None

    sheet.save(out_path, format="PNG", optimize=True)
    print(f"{item_name}: patched {patched_count} running-row cell(s) -> {out_path}")
    return anchors


def update_anchor_table(item_name, category, anchors):
    table = {"_readme": ANCHOR_TABLE_README}
    if os.path.exists(ANCHOR_TABLE_PATH):
        with open(ANCHOR_TABLE_PATH, "r", encoding="utf-8") as f:
            table = json.load(f)
            table["_readme"] = ANCHOR_TABLE_README
    table.setdefault("running", {})
    table["running"].setdefault(category, {})
    table["running"][category][item_name] = anchors
    with open(ANCHOR_TABLE_PATH, "w", encoding="utf-8") as f:
        json.dump(table, f, indent=2)
        f.write("\n")


if __name__ == "__main__":
    requested = sys.argv[1:] or list(ITEM_SPEC.keys())
    for item_name in requested:
        spec = ITEM_SPEC.get(item_name)
        if spec is None:
            print(f"skipping {item_name}: unknown item")
            continue
        anchors = patch_item(item_name, spec)
        if anchors is not None:
            update_anchor_table(item_name, spec["category"], anchors)
    print("done")
