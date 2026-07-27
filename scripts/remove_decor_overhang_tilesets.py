"""One-time cleanup: removes the 6 create_tiles_pro decoration/overhang tilesets (town-decor,
town-overhang, overworld-decor, overworld-overhang, dungeon-decor, dungeon-overhang) from every map
that had them wired in. Each create_tiles_pro "tiles" output bakes its own opaque, non-matching
ground color into every tile (unlike a Wang tileset, which is purpose-built for seamless tiling) -
not usable as a transparent overlay for a decorations-N/overhang-N layer painted over arbitrary
terrain. The terrain autotile sets (town-terrain, overworld-terrain, overworld-water,
dungeon-building-kit) don't have this problem and are kept.

Since these were always appended at the END of each map's tilesets array (see
wire_new_tilesets.py) and nothing was ever added after them, removing them needs no firstgid
renumbering for anything else in the file.

Run once.
"""

import json
import os

MAPS_DIR = os.path.join("public", "assets", "maps")

REMOVE_NAMES = {
    "town-decor",
    "town-overhang",
    "overworld-decor",
    "overworld-overhang",
    "dungeon-decor",
    "dungeon-overhang",
}

for filename in os.listdir(MAPS_DIR):
    if not filename.endswith(".json"):
        continue
    path = os.path.join(MAPS_DIR, filename)
    with open(path, "r", encoding="utf-8") as f:
        data = json.load(f)

    before = len(data["tilesets"])
    data["tilesets"] = [ts for ts in data["tilesets"] if ts["name"] not in REMOVE_NAMES]
    removed = before - len(data["tilesets"])

    if removed == 0:
        continue

    with open(path, "w", encoding="utf-8", newline="\n") as f:
        json.dump(data, f, indent=2)
        f.write("\n")

    print(f"{filename}: removed {removed} tileset(s)")

print("done")
