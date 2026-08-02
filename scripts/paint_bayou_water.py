"""Carves proper Wang-blended water shapes into the `ground` layer of a freshly-generated Crimson
Bayou field map, using tileset.crimson-bayou-water-marsh's own exact corner metadata (not a
hardcoded/assumed lookup) - the map starts as a uniform all-marsh-grass fill from genMapRicher.mjs
(which only supports single-tileId regions, not per-cell Wang-aware blending), and this script
overwrites just the ground layer's tile data with correctly-blended water/marsh-edge tiles for a
hand-specified lake/river shape.

Usage: python scripts/paint_bayou_water.py <map.json> <x0> <y0> <x1> <y1> [<x0> <y0> <x1> <y1> ...]
  Each (x0,y0,x1,y1) is one rectangular water region in TILE coordinates (inclusive), unioned
  together before corner-detection - so an L-shaped or winding river can be built from a few
  overlapping/adjacent rectangles.
"""

import json
import os
import sys

MAPS_DIR = os.path.join("public", "assets", "maps")
METADATA_PATH = os.path.join("public", "assets", "tilesets", "original", "crimson-bayou-water-marsh", "metadata.json")


def load_wid_to_index():
    with open(METADATA_PATH, "r", encoding="utf-8") as f:
        data = json.load(f)
    tiles = data["tileset_data"]["tiles"]
    table = {}
    for i, t in enumerate(tiles):
        c = t["corners"]
        nw = 1 if c["NW"] == "upper" else 0
        ne = 1 if c["NE"] == "upper" else 0
        sw = 1 if c["SW"] == "upper" else 0
        se = 1 if c["SE"] == "upper" else 0
        wid = nw * 8 + ne * 4 + sw * 2 + se * 1
        table[wid] = i
    return table


def paint(map_path, rects):
    with open(map_path, "r", encoding="utf-8") as f:
        data = json.load(f)

    w, h = data["width"], data["height"]
    wid_to_index = load_wid_to_index()

    ground_layer = next(layer for layer in data["layers"] if layer["name"] == "ground")
    terrain_ts = next(ts for ts in data["tilesets"] if "water-marsh" in ts["name"])
    firstgid = terrain_ts["firstgid"]

    # (w+1) x (h+1) vertex grid: True = water ("lower" terrain), False = marsh grass ("upper").
    is_water_vertex = [[False] * (w + 1) for _ in range(h + 1)]
    for (x0, y0, x1, y1) in rects:
        for vy in range(y0, y1 + 2):
            for vx in range(x0, x1 + 2):
                if 0 <= vy <= h and 0 <= vx <= w:
                    is_water_vertex[vy][vx] = True

    for row in range(h):
        for col in range(w):
            nw = 0 if is_water_vertex[row][col] else 1
            ne = 0 if is_water_vertex[row][col + 1] else 1
            sw = 0 if is_water_vertex[row + 1][col] else 1
            se = 0 if is_water_vertex[row + 1][col + 1] else 1
            wid = nw * 8 + ne * 4 + sw * 2 + se * 1
            index = wid_to_index[wid]
            ground_layer["data"][row * w + col] = firstgid + index

    with open(map_path, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2)
        f.write("\n")
    print(f"{map_path}: painted {len(rects)} water region(s)")


if __name__ == "__main__":
    if len(sys.argv) < 6 or (len(sys.argv) - 2) % 4 != 0:
        print("usage: python scripts/paint_bayou_water.py <map.json> <x0> <y0> <x1> <y1> [...]")
        sys.exit(1)
    map_arg = sys.argv[1]
    nums = [int(a) for a in sys.argv[2:]]
    rect_list = [tuple(nums[i:i + 4]) for i in range(0, len(nums), 4)]
    paint(map_arg, rect_list)
    print("done")
