"""Baseline "resize + first paint pass" for the 6 outdoor/dungeon maps (Ash Hallow, Ironwood Trail,
Raven Ridge, Whisper Falls, Black Briar Forest, Hollow Rail Mine), ahead of the user's own hand
authoring in Tiled. Two things, both requested directly:

1. Grow each map's tile-grid width/height to a more production-appropriate size. Existing content
   is anchored at the top-left (no shift) - new space is added strictly to the right and bottom.
   IMPORTANT: all 6 of these maps use an edge-to-edge overworld travel convention (the transition
   to the next region + its paired incoming spawnPoint sit right at the map's physical right edge,
   e.g. raven-ridge's transition to whisper-falls at x=528 when width=34 tiles/544px). Growing the
   map without relocating those would strand the exit in the middle of the new map instead of at
   its edge. So: any point object within the last 3 tiles of the OLD right edge gets shifted right
   by exactly the added width, landing it back at the new right edge with its original offset
   preserved. Nothing else moves (no map here has a north/south edge transition).
2. Paint the new region actually using the new pixellab-generated tilesets rather than leaving it
   empty pending manual work: the `ground` layer's new cells get a proper Wang-corner autotiled
   fill (see WANG_ID_TO_COL_ROW below) from that map's own region-specific terrain tileset, and the
   `decorations-1` layer's new cells get a sparse random scatter of that region's decor tileset
   item(s) (using the same mixed-footprint LAYOUTS as build_decor_objects.py). The OLD area's tile
   data is left completely untouched - a visible seam between old placeholder art and new terrain
   at the boundary is expected and fine, this is a baseline for hand-editing, not finished art.

Wang corner-id math: pixellab's create_topdown_tileset 4x4 grid is a standard 16-tile marching-
squares Wang set. Confirmed (by reading 3 different tilesets' archived metadata.json) that the
id -> grid (col,row) mapping is IDENTICAL across every tileset generated this way, and that
id = NW*8 + NE*4 + SW*2 + SE*1 (1 = "upper" terrain corner, 0 = "lower"), matching each tile's own
`corners` metadata exactly. WANG_ID_TO_COL_ROW below was read directly off overworld-terrain's
archived metadata (public/assets/tilesets/original/overworld-terrain/metadata.json).

Some of the 5 region-specific terrain tilesets (raven-ridge-terrain, whisper-falls-terrain,
black-briar-terrain, mine-floor-terrain) were generated and registered in a prior session but never
actually wired into their map's `tilesets` array - this script adds them if missing, same
convention as wire_new_tilesets.py.

Run once per map from repo root: `python scripts/resize_and_paint_maps.py`
"""

import json
import os
import random

MAPS_DIR = os.path.join("public", "assets", "maps")
TILE = 16

# Universal Wang autotile id -> (col, row) in the built 4x4 grid PNG. Same for every
# create_topdown_tileset-generated set (verified across overworld-terrain/town-terrain/
# mine-floor-terrain's archived metadata.json).
WANG_ID_TO_COL_ROW = {
    0: (2, 1), 1: (3, 1), 2: (2, 2), 3: (1, 2), 4: (2, 0), 5: (3, 2), 6: (0, 1), 7: (3, 3),
    8: (1, 1), 9: (2, 3), 10: (1, 0), 11: (0, 2), 12: (3, 0), 13: (0, 0), 14: (1, 3), 15: (0, 3),
}
WANG_COLS = 4

# Mixed-footprint decor item layouts, copied from build_decor_objects.py (col, row, w_tiles, h_tiles
# within that tileset's own source grid - each set's tileset PNG has 4 columns).
DECOR_LAYOUTS = {
    "mine-decor": {
        "rubble": (0, 0, 1, 1), "crate": (1, 0, 1, 1), "support-beam": (2, 0, 1, 1),
        "pickaxe": (3, 0, 1, 1), "mine-cart": (0, 1, 2, 2), "rail-track": (2, 1, 2, 1),
    },
    "graveyard-decor": {
        "gravestone": (0, 0, 1, 2), "stone-cross": (1, 0, 1, 2), "stone-urn": (2, 0, 1, 1),
        "wilted-flowers": (3, 0, 1, 1), "dead-bramble": (2, 1, 2, 2),
    },
    "overworld-decor2": {
        "boulder": (0, 0, 2, 2), "fallen-log": (2, 0, 2, 1), "mushroom": (2, 1, 1, 1),
        "tree-stump": (3, 1, 1, 1), "wildflower": (0, 2, 1, 1),
    },
}
DECOR_COLS = 4

# Terrain tileset PNGs that exist in the registry but may not yet be wired into their map.
TERRAIN_TILESET_SPECS = {
    "raven-ridge-terrain": ("raven-ridge-terrain.png", 64, 64),
    "whisper-falls-terrain": ("whisper-falls-terrain.png", 64, 64),
    "black-briar-terrain": ("black-briar-terrain.png", 64, 64),
    "mine-floor-terrain": ("mine-floor-terrain.png", 64, 64),
}

# map filename -> (new_width, new_height, terrain_tileset_name, [decor_tileset_names])
MAP_CONFIG = {
    "ash-hallow.json": (64, 40, "town-terrain", []),
    "ironwood-trail.json": (72, 48, "ironwood-trail-terrain", ["overworld-decor2"]),
    "raven-ridge.json": (64, 40, "raven-ridge-terrain", ["overworld-decor2"]),
    "whisper-falls.json": (64, 40, "whisper-falls-terrain", ["overworld-decor2"]),
    "black-briar-forest.json": (64, 40, "black-briar-terrain", ["graveyard-decor", "overworld-decor2"]),
    "hollow-rail-mine.json": (64, 40, "mine-floor-terrain", ["mine-decor"]),
}

EDGE_MARGIN_TILES = 3
random.seed(20260727)


def build_tileset_entry(name, firstgid, filename, w, h):
    return {
        "firstgid": firstgid,
        "name": name,
        "image": f"../../../public/assets/tilesets/{filename}",
        "imagewidth": w,
        "imageheight": h,
        "tilewidth": TILE,
        "tileheight": TILE,
        "margin": 0,
        "spacing": 0,
        "columns": w // TILE,
        "tilecount": (w // TILE) * (h // TILE),
        "properties": [{"name": "tilesetAssetId", "type": "string", "value": f"tileset.{name}"}],
    }


def ensure_tileset(data, name):
    """Returns the tileset's firstgid, adding it (built from TERRAIN_TILESET_SPECS) if not present."""
    for ts in data["tilesets"]:
        if ts["name"] == name:
            return ts["firstgid"]
        # also match by tilesetAssetId in case name differs from registry id
        for p in ts.get("properties", []):
            if p["name"] == "tilesetAssetId" and p["value"] == f"tileset.{name}":
                return ts["firstgid"]
    filename, w, h = TERRAIN_TILESET_SPECS[name]
    last = data["tilesets"][-1]
    firstgid = last["firstgid"] + last["tilecount"]
    data["tilesets"].append(build_tileset_entry(name, firstgid, filename, w, h))
    return firstgid


def find_tileset_firstgid(data, name):
    for ts in data["tilesets"]:
        if ts["name"] == name:
            return ts["firstgid"]
    raise KeyError(f"tileset {name} not found")


def wang_gid(nw, ne, sw, se, firstgid):
    wid = nw * 8 + ne * 4 + sw * 2 + se * 1
    col, row = WANG_ID_TO_COL_ROW[wid]
    return firstgid + row * WANG_COLS + col


def build_corner_mask(new_w, new_h, old_w, old_h, rng):
    """(new_w+1) x (new_h+1) boolean corner grid - mostly 'lower' with scattered 'upper' blobs,
    centered anywhere that touches the new region (col>=old_w-2 or row>=old_h-2 keeps blobs mostly
    away from wasted work deep inside the untouched old area)."""
    cw, ch = new_w + 1, new_h + 1
    corner = [[0] * cw for _ in range(ch)]
    new_area = (new_w - old_w) * new_h + old_w * (new_h - old_h)
    num_blobs = max(2, new_area // 140)
    for _ in range(num_blobs):
        # bias blob centers into the new region (right strip or bottom strip)
        if random.random() < 0.5 and new_w > old_w:
            cx = rng.randint(max(0, old_w - 2), cw - 1)
            cy = rng.randint(0, ch - 1)
        else:
            cx = rng.randint(0, cw - 1)
            cy = rng.randint(max(0, old_h - 2), ch - 1)
        radius = rng.randint(2, 4)
        for yy in range(max(0, cy - radius), min(ch, cy + radius + 1)):
            for xx in range(max(0, cx - radius), min(cw, cx + radius + 1)):
                if (xx - cx) ** 2 + (yy - cy) ** 2 <= radius * radius:
                    corner[yy][xx] = 1
    return corner


def is_new_cell(col, row, old_w, old_h):
    return col >= old_w or row >= old_h


def process_map(map_filename, new_w, new_h, terrain_name, decor_names):
    path = os.path.join(MAPS_DIR, map_filename)
    if not os.path.exists(path):
        print(f"skipping {map_filename}: not found")
        return

    with open(path, "r", encoding="utf-8") as f:
        data = json.load(f)

    old_w, old_h = data["width"], data["height"]
    if new_w < old_w or new_h < old_h:
        print(f"skipping {map_filename}: target {new_w}x{new_h} smaller than current {old_w}x{old_h}")
        return
    if new_w == old_w and new_h == old_h:
        print(f"{map_filename}: already {old_w}x{old_h}, nothing to resize")
        return

    rng = random.Random(f"{map_filename}-{new_w}-{new_h}")

    terrain_firstgid = ensure_tileset(data, terrain_name)
    decor_firstgids = {name: find_tileset_firstgid(data, name) for name in decor_names}

    corner = build_corner_mask(new_w, new_h, old_w, old_h, rng)

    # --- Tile layers: ground gets autotiled fill, everything else just gets zero-padded ---
    for layer in data["layers"]:
        if layer.get("type") != "tilelayer":
            continue
        old_data = layer["data"]
        new_data = [0] * (new_w * new_h)
        for row in range(old_h):
            for col in range(old_w):
                new_data[row * new_w + col] = old_data[row * old_w + col]

        if layer["name"] == "ground":
            for row in range(new_h):
                for col in range(new_w):
                    if not is_new_cell(col, row, old_w, old_h):
                        continue
                    nw_c, ne_c = corner[row][col], corner[row][col + 1]
                    sw_c, se_c = corner[row + 1][col], corner[row + 1][col + 1]
                    new_data[row * new_w + col] = wang_gid(nw_c, ne_c, sw_c, se_c, terrain_firstgid)

        layer["data"] = new_data
        layer["width"] = new_w
        layer["height"] = new_h

    # --- Decor scatter on decorations-1, new cells only ---
    decorations_layer = next((l for l in data["layers"] if l.get("name") == "decorations-1"), None)
    if decorations_layer is not None and decor_names:
        occupied = set()
        new_cells = [
            (col, row) for row in range(new_h) for col in range(new_w)
            if is_new_cell(col, row, old_w, old_h)
        ]
        rng.shuffle(new_cells)
        num_items = max(3, len(new_cells) // 45)
        placed = 0
        for col, row in new_cells:
            if placed >= num_items:
                break
            set_name = rng.choice(decor_names)
            item_name, (icol, irow, iw, ih) = rng.choice(list(DECOR_LAYOUTS[set_name].items()))
            if col + iw > new_w or row + ih > new_h:
                continue
            footprint = [(col + dx, row + dy) for dy in range(ih) for dx in range(iw)]
            if any(c in occupied or not is_new_cell(c[0], c[1], old_w, old_h) for c in footprint):
                continue
            firstgid = decor_firstgids[set_name]
            for dy in range(ih):
                for dx in range(iw):
                    gid = firstgid + (irow + dy) * DECOR_COLS + (icol + dx)
                    fx, fy = col + dx, row + dy
                    decorations_layer["data"][fy * new_w + fx] = gid
            occupied.update(footprint)
            placed += 1
        print(f"  scattered {placed} decor items ({', '.join(decor_names)})")

    # --- Relocate edge-transition objects (transition + paired spawnPoint) to the new right edge ---
    delta_x = (new_w - old_w) * TILE
    edge_threshold = (old_w - EDGE_MARGIN_TILES) * TILE
    moved = 0
    for layer in data["layers"]:
        if layer.get("type") != "objectgroup":
            continue
        for obj in layer["objects"]:
            if obj.get("width", 0) == 0 and obj.get("height", 0) == 0 and obj["x"] >= edge_threshold:
                obj["x"] += delta_x
                moved += 1

    data["width"] = new_w
    data["height"] = new_h

    with open(path, "w", encoding="utf-8", newline="\n") as f:
        json.dump(data, f, indent=2)
        f.write("\n")

    print(f"{map_filename}: {old_w}x{old_h} -> {new_w}x{new_h}, relocated {moved} edge object(s)")


for map_filename, (new_w, new_h, terrain_name, decor_names) in MAP_CONFIG.items():
    process_map(map_filename, new_w, new_h, terrain_name, decor_names)

print("done")
