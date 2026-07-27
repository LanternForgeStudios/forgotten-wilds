"""Adds the create_map_object-based decor tilesets (mine-decor, graveyard-decor, shrine-states,
overworld-decor2) as additional embedded Tileset entries on the relevant maps - same append-only,
firstgid-continuing convention as wire_new_tilesets.py. Safe to re-run (skips already-present).
"""

import json
import os

MAPS_DIR = os.path.join("public", "assets", "maps")

TILESET_SPECS = {
    "mine-decor": ("mine-decor.png", 64, 48),
    "graveyard-decor": ("graveyard-decor.png", 64, 48),
    "shrine-states": ("shrine-states.png", 64, 32),
    "overworld-decor2": ("overworld-decor2.png", 64, 48),
}

TILE = 16

MAP_TILESETS = {
    "hollow-rail-mine.json": ["mine-decor"],
    "ash-hallow-elias-house.json": ["mine-decor"],
    "ash-hallow-mara-shop.json": ["mine-decor"],
    "ash-hallow-inn.json": ["mine-decor"],
    "ash-hallow-blacksmith.json": ["mine-decor"],
    "ash-hallow-apothecary.json": ["mine-decor"],
    "ash-hallow-armory.json": ["mine-decor"],
    "ash-hallow-archive.json": ["mine-decor"],
    "ash-hallow-mine-office.json": ["mine-decor"],
    "ash-hallow-town-hall.json": ["mine-decor"],
    "black-briar-forest.json": ["graveyard-decor", "overworld-decor2"],
    "ash-hallow.json": ["shrine-states"],
    "ironwood-trail.json": ["overworld-decor2"],
    "raven-ridge.json": ["overworld-decor2"],
    "whisper-falls.json": ["overworld-decor2"],
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
