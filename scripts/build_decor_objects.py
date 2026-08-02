"""Builds mine-decor, graveyard-decor, shrine-states, and overworld-decor2 into game-ready
16x16-tile-grid PNGs, from individually-generated pixellab MCP `create_map_object` exports (each
genuinely transparent - no baked-in ground color, unlike the earlier create_tiles_pro "tiles" sets
that were dropped for exactly that reason).

Each item is placed on its own footprint within the tile grid (LAYOUTS below) - some items (a mine
cart, a shrine, a mossy boulder) read better across a 2x2 or 2x1 block of cells than squeezed into
one 16x16 cell. This is still a completely ordinary Tiled tileset image (one uniform tilewidth/
tileheight declared for the whole sheet) - a "bigger" item is just drawn across N adjacent cells in
the source PNG; the Tiled author selects that whole rectangular block in the tile picker and stamps
it as one multi-tile brush, a standard technique for oversized props in a uniform-grid tileset.

Source layout: art-staging/tilesets/<set-name>/<item-name>.png (single object exports, ~128x128,
transparent background, already a clean single object - no cropping/background removal needed).
Output: public/assets/tilesets/<set-name>.png
"""

import os
import shutil
from PIL import Image

TILE = 16

# set-name -> {item-name: (col, row, w_tiles, h_tiles)}
LAYOUTS = {
    "mine-decor": {
        "rubble": (0, 0, 1, 1),
        "crate": (1, 0, 1, 1),
        "support-beam": (2, 0, 1, 1),
        "pickaxe": (3, 0, 1, 1),
        "mine-cart": (0, 1, 2, 2),
        "rail-track": (2, 1, 2, 1),
    },
    "graveyard-decor": {
        "gravestone": (0, 0, 1, 2),
        "stone-cross": (1, 0, 1, 2),
        "stone-urn": (2, 0, 1, 1),
        "wilted-flowers": (3, 0, 1, 1),
        "dead-bramble": (2, 1, 2, 2),
    },
    "shrine-states": {
        "dormant": (0, 0, 2, 2),
        "activated": (2, 0, 2, 2),
    },
    "overworld-decor2": {
        "boulder": (0, 0, 2, 2),
        "fallen-log": (2, 0, 2, 1),
        "mushroom": (2, 1, 1, 1),
        "tree-stump": (3, 1, 1, 1),
        "wildflower": (0, 2, 1, 1),
    },
    "crimson-bayou-decor": {
        "cypress-tree": (0, 0, 4, 6),
        "reeds": (4, 0, 2, 3),
        "dock-post": (6, 0, 2, 3),
        "lily-pad": (4, 3, 2, 2),
        "rowboat": (0, 6, 4, 3),
    },
}

STAGING_ROOT = os.path.join("art-staging", "tilesets")
OUT_DIR = os.path.join("public", "assets", "tilesets")
ORIGINALS_ROOT = os.path.join(OUT_DIR, "original")

os.makedirs(OUT_DIR, exist_ok=True)
os.makedirs(ORIGINALS_ROOT, exist_ok=True)

for set_name, items in LAYOUTS.items():
    src_dir = os.path.join(STAGING_ROOT, set_name)
    if not os.path.isdir(src_dir):
        print(f"skipping {set_name}: {src_dir} not found")
        continue

    grid_cols = max(col + w for col, row, w, h in items.values())
    grid_rows = max(row + h for col, row, w, h in items.values())
    sheet = Image.new("RGBA", (grid_cols * TILE, grid_rows * TILE), (0, 0, 0, 0))

    for item_name, (col, row, w, h) in items.items():
        src_path = os.path.join(src_dir, f"{item_name}.png")
        if not os.path.exists(src_path):
            print(f"  skipping {set_name}/{item_name}: source not found")
            continue
        im = Image.open(src_path).convert("RGBA")
        target_w, target_h = w * TILE, h * TILE
        # Fit within the footprint preserving aspect ratio, centered - a 1x1 item isn't stretched
        # to a non-square footprint, and a wide/tall item isn't squashed to fit a square one.
        scale = min(target_w / im.width, target_h / im.height)
        new_size = (max(1, round(im.width * scale)), max(1, round(im.height * scale)))
        resized = im.resize(new_size, Image.LANCZOS)
        paste_x = col * TILE + (target_w - new_size[0]) // 2
        paste_y = row * TILE + (target_h - new_size[1]) // 2
        sheet.alpha_composite(resized, (paste_x, paste_y))

    out_path = os.path.join(OUT_DIR, f"{set_name}.png")
    sheet.save(out_path, format="PNG", optimize=True)
    print(f"{set_name}: {len(items)} items -> {sheet.width}x{sheet.height} -> {out_path}")

    archive_dir = os.path.join(ORIGINALS_ROOT, set_name)
    if not os.path.exists(archive_dir):
        shutil.copytree(src_dir, archive_dir)
    shutil.rmtree(src_dir)

print("done")
