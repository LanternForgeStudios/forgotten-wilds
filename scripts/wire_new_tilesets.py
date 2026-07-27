"""Adds the new pixellab-generated terrain/decoration/overhang tilesets as additional embedded
Tileset entries on the relevant map JSON files, per docs/Tiled-Map-Authoring.md's "Multiple
tilesets per map" convention - each gets its own `tilesetAssetId` custom property and a firstgid
continuing on from whatever's already in the map. Does NOT paint any tiles onto the ground/
decorations/overhang layers - it only makes the tiles available to pick from when the map is
opened in Tiled, which is the actual ask (hand-painting is a manual authoring step).

Run once. Safe to re-run: skips a map/tileset pair that's already present (matched by name).
"""

import json
import os

MAPS_DIR = os.path.join("public", "assets", "maps")

# name -> (png filename under public/assets/tilesets/, width, height)
TILESET_SPECS = {
    "town-terrain": ("town-terrain.png", 64, 64),
    "town-decor": ("town-decor.png", 64, 64),
    "town-overhang": ("town-overhang.png", 64, 64),
    "overworld-terrain": ("overworld-terrain.png", 64, 64),
    "overworld-water": ("overworld-water.png", 64, 64),
    "overworld-decor": ("overworld-decor.png", 64, 64),
    "overworld-overhang": ("overworld-overhang.png", 64, 64),
    "dungeon-building-kit": ("dungeon-building-kit.png", 128, 112),
    "dungeon-decor": ("dungeon-decor.png", 64, 64),
    "dungeon-overhang": ("dungeon-overhang.png", 64, 64),
}

TILE = 16

# map filename (under public/assets/maps/) -> list of new tileset names to add
MAP_TILESETS = {
    "ash-hallow.json": ["town-terrain", "town-decor", "town-overhang"],
    "ironwood-trail.json": ["overworld-terrain", "overworld-decor", "overworld-overhang"],
    "raven-ridge.json": ["overworld-terrain", "overworld-decor", "overworld-overhang"],
    "whisper-falls.json": ["overworld-terrain", "overworld-water", "overworld-decor", "overworld-overhang"],
    "black-briar-forest.json": ["overworld-terrain", "overworld-decor", "overworld-overhang"],
    "hollow-rail-mine.json": ["dungeon-building-kit", "dungeon-decor", "dungeon-overhang"],
    "ash-hallow-elias-house.json": ["dungeon-building-kit", "dungeon-decor", "dungeon-overhang"],
    "ash-hallow-mara-shop.json": ["dungeon-building-kit", "dungeon-decor", "dungeon-overhang"],
    "ash-hallow-inn.json": ["dungeon-building-kit", "dungeon-decor", "dungeon-overhang"],
    "ash-hallow-blacksmith.json": ["dungeon-building-kit", "dungeon-decor", "dungeon-overhang"],
    "ash-hallow-apothecary.json": ["dungeon-building-kit", "dungeon-decor", "dungeon-overhang"],
    "ash-hallow-armory.json": ["dungeon-building-kit", "dungeon-decor", "dungeon-overhang"],
    "ash-hallow-archive.json": ["dungeon-building-kit", "dungeon-decor", "dungeon-overhang"],
    "ash-hallow-mine-office.json": ["dungeon-building-kit", "dungeon-decor", "dungeon-overhang"],
    "ash-hallow-town-hall.json": ["dungeon-building-kit", "dungeon-decor", "dungeon-overhang"],
}


def build_tileset_entry(name: str, firstgid: int) -> dict:
    filename, w, h = TILESET_SPECS[name]
    cols = w // TILE
    rows = h // TILE
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
        "columns": cols,
        "tilecount": cols * rows,
        "properties": [{"name": "tilesetAssetId", "type": "string", "value": f"tileset.{name}"}],
    }


for map_filename, new_tilesets in MAP_TILESETS.items():
    path = os.path.join(MAPS_DIR, map_filename)
    if not os.path.exists(path):
        print(f"skipping {map_filename}: not found")
        continue

    with open(path, "r", encoding="utf-8") as f:
        data = json.load(f)

    existing_names = {ts["name"] for ts in data["tilesets"]}
    added = []
    for name in new_tilesets:
        if name in existing_names:
            continue
        last = data["tilesets"][-1]
        next_firstgid = last["firstgid"] + last["tilecount"]
        entry = build_tileset_entry(name, next_firstgid)
        data["tilesets"].append(entry)
        added.append(name)

    if not added:
        print(f"{map_filename}: nothing to add (already present)")
        continue

    with open(path, "w", encoding="utf-8", newline="\n") as f:
        json.dump(data, f, indent=2)
        f.write("\n")

    print(f"{map_filename}: added {added}")

print("done")
