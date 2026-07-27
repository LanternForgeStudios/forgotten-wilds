"""Build the pixellab-generated town/overworld/dungeon TERRAIN tilesets into game-ready 16x16-grid
PNGs. Terrain autotiles only (create_topdown_tileset / create_building_kit) - decoration/overhang
sets generated via create_tiles_pro were tried and dropped: each independent "tile" variation bakes
its own opaque, non-matching ground color into the image (unlike a Wang tileset, purpose-built for
seamless tiling), so it shows a visible mismatched rectangle wherever painted over real terrain.
Not attempting to fix that - just sticking to terrain autotiles + building kits, which don't have
this problem.

- create_topdown_tileset output (town-terrain, overworld-terrain, overworld-water,
  raven-ridge-terrain, whisper-falls-terrain, black-briar-terrain): already downloaded as a ready
  4x4 grid PNG (tileset.png) via the tool's own /image endpoint - just copied straight through.
- create_building_kit output (dungeon-building-kit, 56 pieces: floor/walls/doors/corners/pillar/
  stairs/partitions): downloaded as 56 separate tile_N.png files - assembled into an 8x7 grid
  (128x112), row-major by index. The tool's own placement_rules (role -> tile index) from
  get_tiles_pro is the legend for which grid cell is which piece - archived alongside as
  placement-rules.json since it's only returned by the generation API, not encoded in the image.

Source layout: art-staging/tilesets/<name>/ (either tileset.png, or tile_0.png..tile_N.png)
Output: public/assets/tilesets/<name>.png
"""

import os
import shutil
from PIL import Image

STAGING_ROOT = os.path.join("art-staging", "tilesets")
OUT_DIR = os.path.join("public", "assets", "tilesets")
ORIGINALS_ROOT = os.path.join(OUT_DIR, "original")

TILE = 16

# name -> (grid_cols, grid_rows, tile_count) for create_building_kit grid assembly
GRID_SETS = {
    "dungeon-building-kit": (8, 7, 56),
}

# name -> already-a-grid PNG from create_topdown_tileset, just copy through
DIRECT_COPY_SETS = [
    "town-terrain",
    "overworld-terrain",
    "overworld-water",
    "raven-ridge-terrain",
    "whisper-falls-terrain",
    "black-briar-terrain",
    "mine-floor-terrain",
    "ironwood-trail-terrain",
]

os.makedirs(OUT_DIR, exist_ok=True)
os.makedirs(ORIGINALS_ROOT, exist_ok=True)

for name, (cols, rows, count) in GRID_SETS.items():
    src_dir = os.path.join(STAGING_ROOT, name)
    if not os.path.isdir(src_dir):
        print(f"skipping {name}: {src_dir} not found")
        continue

    sheet = Image.new("RGBA", (cols * TILE, rows * TILE), (0, 0, 0, 0))
    for i in range(count):
        tile_path = os.path.join(src_dir, f"tile_{i}.png")
        if not os.path.exists(tile_path):
            continue
        tile = Image.open(tile_path).convert("RGBA").resize((TILE, TILE), Image.NEAREST)
        col, row = i % cols, i // cols
        sheet.paste(tile, (col * TILE, row * TILE))

    out_path = os.path.join(OUT_DIR, f"{name}.png")
    sheet.save(out_path, format="PNG", optimize=True)
    print(f"{name}: {count} tiles -> {sheet.width}x{sheet.height} -> {out_path}")

    archive_dir = os.path.join(ORIGINALS_ROOT, name)
    if not os.path.exists(archive_dir):
        shutil.copytree(src_dir, archive_dir)
    shutil.rmtree(src_dir)

for name in DIRECT_COPY_SETS:
    src_path = os.path.join(STAGING_ROOT, name, "tileset.png")
    if not os.path.exists(src_path):
        print(f"skipping {name}: {src_path} not found")
        continue
    out_path = os.path.join(OUT_DIR, f"{name}.png")
    shutil.copy2(src_path, out_path)
    im = Image.open(out_path)
    print(f"{name}: copied -> {im.size} -> {out_path}")

    archive_dir = os.path.join(ORIGINALS_ROOT, name)
    os.makedirs(archive_dir, exist_ok=True)
    shutil.copy2(src_path, os.path.join(archive_dir, "tileset.png"))
    meta_path = os.path.join(STAGING_ROOT, name, "metadata.json")
    if os.path.exists(meta_path):
        shutil.copy2(meta_path, os.path.join(archive_dir, "metadata.json"))
    shutil.rmtree(os.path.join(STAGING_ROOT, name))

print("done")
