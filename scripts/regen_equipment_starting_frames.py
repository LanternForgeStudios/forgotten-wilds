"""Regenerates neutral starting-point item frames for a working folder (running-pose, female-
walking, female-running, etc.) directly from the LIVE, already-built male walking sheets in
public/assets/sprites/equipment/ - not from the original art-staging/equipment-layers-manual/
source frames, which go stale the moment a sheet gets a direct touch-up edit after the fact
(happened once already with traveler-boots/travelers-cloak) or predate a later follow-up round
(weathered-walking-staff's first batch predated its own west/left-frame round entirely).

Paired items (boots/gloves): down/up show BOTH sides with a real transparent gap between them
(confirmed by direct pixel inspection, not assumed), so those get a genuine connected-component
split, assigned to left/right via the same anatomical anchor convention the original
build_equipment_layer.py ANCHORS table used (down: higher-x=left, lower-x=right; up: lower-x=left,
higher-x=right - screen-left is the character's own right hand when facing the viewer, and their
own left hand when facing away). left/right (profile) directions show only ONE side by design (the
occlusion rule already documented on these items' registry entries), so both output files there
just duplicate the single visible blob rather than risk mis-slicing one glove/boot into two
garbage pieces - same fallback used whenever a down/up frame doesn't cleanly show the expected
2 segments (printed as a warning so it can be checked/trimmed by hand).

Usage: python scripts/regen_equipment_starting_frames.py <out_root> [--pose=running] [item ...]
  out_root: the working-folder root to (re)populate, e.g. a scratchpad path like
            .../manual-edit-running or .../manual-edit-female-walking.
  --pose=running: crop from the sheet's running rows (4-7) instead of its walking rows (0-3) -
            use when reseeding a manual-edit-running (or female-running) folder from a sheet
            whose running pass is itself now finished/live, same "always crop from the live sheet,
            never stale source frames" reasoning as the walking case. Defaults to walking.
  With no item names given, regenerates all 5 pilot items. Safe to re-run - always regenerates
  fresh from the current live sheets, overwriting whatever was there before.
"""

import os
import sys
from PIL import Image

FRAME = (72, 96)
WALK_ROW = {"down": 0, "left": 1, "up": 2, "right": 3}

ITEM_SPEC = {
    "keepers-lantern": {"kind": "single", "directions": ["down", "left", "up", "right"]},
    "traveler-boots": {"kind": "paired", "part": "foot", "directions": ["down", "left", "up", "right"]},
    "travelers-cloak": {"kind": "single", "directions": ["down", "left", "up", "right"]},
    "weathered-walking-staff": {"kind": "single", "directions": ["down", "up", "right", "left"]},
    "work-gloves": {"kind": "paired", "part": "hand", "directions": ["down", "left", "up", "right"]},
}

SHEET_DIR = os.path.join("public", "assets", "sprites", "equipment")


def cell(sheet, row, col):
    x0, y0 = col * FRAME[0], row * FRAME[1]
    return sheet.crop((x0, y0, x0 + FRAME[0], y0 + FRAME[1]))


def neutral_from_crop(cropped):
    canvas = Image.new("RGBA", FRAME, (0, 0, 0, 0))
    canvas.alpha_composite(cropped, (0, 0))
    return canvas


def find_segments(im):
    w, h = im.size
    px = im.load()
    has_content = [any(px[x, y][3] > 10 for y in range(h)) for x in range(w)]
    bbox = im.getbbox()
    if not bbox:
        return []
    l, r = bbox[0], bbox[2]
    segs, in_seg, start = [], False, 0
    for x in range(l, r):
        if has_content[x] and not in_seg:
            in_seg, start = True, x
        elif not has_content[x] and in_seg:
            in_seg = False
            segs.append((start, x))
    if in_seg:
        segs.append((start, r))
    return segs


def regen(out_root, items, pose="walking"):
    row_offset = 4 if pose == "running" else 0
    for item_name in items:
        spec = ITEM_SPEC[item_name]
        sheet_path = os.path.join(SHEET_DIR, f"{item_name}-male-animated.png")
        sheet = Image.open(sheet_path).convert("RGBA")
        out_dir = os.path.join(out_root, item_name)
        os.makedirs(out_dir, exist_ok=True)
        for direction in spec["directions"]:
            row = WALK_ROW[direction] + row_offset
            for frame in range(4):
                full_cell = cell(sheet, row, frame)
                bbox = full_cell.getbbox()
                if bbox is None:
                    continue
                if spec["kind"] == "single":
                    neutral_from_crop(full_cell.crop(bbox)).save(os.path.join(out_dir, f"{direction}-frame{frame}.png"))
                    continue

                part = spec["part"]
                if direction in ("down", "up"):
                    segs = find_segments(full_cell)
                    if len(segs) == 2:
                        (s0, e0), (s1, e1) = segs
                        gap_mid = (e0 + s1) // 2
                        lower_piece = full_cell.crop((0, 0, gap_mid, full_cell.height))
                        higher_piece = full_cell.crop((gap_mid, 0, full_cell.width, full_cell.height))
                        # down: higher-x=left, lower-x=right. up: lower-x=left, higher-x=right.
                        left_piece, right_piece = (higher_piece, lower_piece) if direction == "down" else (lower_piece, higher_piece)
                        neutral_from_crop(left_piece.crop(left_piece.getbbox())).save(os.path.join(out_dir, f"{direction}-frame{frame}-left-{part}.png"))
                        neutral_from_crop(right_piece.crop(right_piece.getbbox())).save(os.path.join(out_dir, f"{direction}-frame{frame}-right-{part}.png"))
                        continue
                    print(f"  {item_name} {direction}-frame{frame}: expected 2 segments, found {len(segs)} - duplicating whole cell instead")

                # left/right (single visible side by design) or a down/up fallback: duplicate the
                # whole blob into both files rather than risk a bad slice - flagged above for the
                # user to trim/separate by hand if needed.
                cropped = neutral_from_crop(full_cell.crop(bbox))
                cropped.save(os.path.join(out_dir, f"{direction}-frame{frame}-left-{part}.png"))
                cropped.save(os.path.join(out_dir, f"{direction}-frame{frame}-right-{part}.png"))
        print(item_name, "-> regenerated in", out_dir)


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("usage: python scripts/regen_equipment_starting_frames.py <out_root> [--pose=running] [item ...]")
        sys.exit(1)
    out_root = sys.argv[1]
    rest = sys.argv[2:]
    pose_arg = "walking"
    remaining = []
    for a in rest:
        if a.startswith("--pose="):
            pose_arg = a.split("=", 1)[1]
        else:
            remaining.append(a)
    requested = remaining or list(ITEM_SPEC.keys())
    regen(out_root, requested, pose=pose_arg)
    print("done")
