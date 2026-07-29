"""Seeds a brand-new item's manual-edit working folder (art-staging/equipment-layers-manual/<item>/)
with the item's own flat icon art sitting at a neutral (0,0) starting point on an otherwise-empty
72x96 canvas, per direction/frame - the same starting state travelers-cloak/weathered-walking-staff
were originally handed to the user in, before any hand-positioning existed. Only for "single" kind
items (one piece of worn/held art, not a paired left/right item like boots/gloves) - a paired item
needs the source icon manually split into two halves first, which this script doesn't attempt.

The icon is cropped to its own alpha bounding box (so no wasted transparent margin skews the
neutral starting position), then scaled down with LANCZOS only if it doesn't already fit within
the 72x96 frame - never scaled up, since these are 128x128-generated icons and upscaling would
just soften them further before the user has even started positioning.

Usage: python scripts/seed_equipment_layer_manual.py <item-id> <icon-path> [direction ...]
  (directions default to down left up right if omitted)
"""

import os
import sys
from PIL import Image

FRAME_SIZE = (72, 96)
DIRECTIONS_DEFAULT = ["down", "left", "up", "right"]

STAGING_ROOT = os.path.join("art-staging", "equipment-layers-manual")


def seed_item(item_name: str, icon_path: str, directions):
    icon = Image.open(icon_path).convert("RGBA")
    bbox = icon.getbbox()
    if bbox is not None:
        icon = icon.crop(bbox)

    if icon.width > FRAME_SIZE[0] or icon.height > FRAME_SIZE[1]:
        scale = min(FRAME_SIZE[0] / icon.width, FRAME_SIZE[1] / icon.height)
        icon = icon.resize((max(1, round(icon.width * scale)), max(1, round(icon.height * scale))), Image.LANCZOS)

    out_dir = os.path.join(STAGING_ROOT, item_name)
    os.makedirs(out_dir, exist_ok=True)

    for direction in directions:
        for frame in range(4):
            canvas = Image.new("RGBA", FRAME_SIZE, (0, 0, 0, 0))
            canvas.alpha_composite(icon, (0, 0))
            out_path = os.path.join(out_dir, f"{direction}-frame{frame}.png")
            canvas.save(out_path, format="PNG")

    print(f"{item_name}: seeded {len(directions) * 4} starting frames in {out_dir} from {icon_path} ({icon.size})")


if __name__ == "__main__":
    if len(sys.argv) < 3:
        print("usage: python scripts/seed_equipment_layer_manual.py <item-id> <icon-path> [direction ...]")
        sys.exit(1)
    item_id = sys.argv[1]
    icon_path_arg = sys.argv[2]
    dirs = sys.argv[3:] or DIRECTIONS_DEFAULT
    seed_item(item_id, icon_path_arg, dirs)
