"""Places real instances of the two new animated decor objects (structure.decor-fireplace,
structure.decor-glowing-mushroom - see build_ambient_decor.py) into the maps' `objects` layer as
plain `interactable` points, per the "integrate into the games and maps" ask (not just registered
and unused). Coordinates were checked by hand against each map's ground/decorations-1/objects data
before picking them (interior fireplace spots sit on plain walkable floor away from the
NPC/spawn/door column; outdoor mushroom spots sit inside the newly-painted region added by
resize_and_paint_maps.py, confirmed empty of both existing objects and decor-tileset gids).

Run once from repo root: `python scripts/place_ambient_decor.py`
"""

import json
import os

MAPS_DIR = os.path.join("public", "assets", "maps")
TILE = 16

# Interior fireplace: one hearth per interior, tucked in the corner (col 2, row 2), away from the
# NPC (col 6, row 3)/spawn/door column - verified against ash-hallow-inn's ground layer (floor
# tiles fill rows 1-8, cols 1-11; all 3 target interiors share the same generated room layout).
FIREPLACE_MAPS = ["ash-hallow-inn.json", "ash-hallow-elias-house.json", "ash-hallow-blacksmith.json"]
FIREPLACE_COL, FIREPLACE_ROW = 2, 2

# Outdoor/dungeon glowing-mushroom spots: (col, row) pairs inside each map's newly-painted region
# (see resize_and_paint_maps.py), confirmed empty of existing objects/decor gids.
MUSHROOM_SPOTS = {
    "ironwood-trail.json": [(50, 10), (55, 35)],
    "raven-ridge.json": [(45, 10), (50, 30)],
    "whisper-falls.json": [(45, 12), (50, 32)],
    "black-briar-forest.json": [(45, 12), (50, 32)],
    "hollow-rail-mine.json": [(45, 10), (50, 32)],
}


def make_point_object(obj_id, refid, col, row):
    return {
        "id": obj_id,
        "name": "",
        "type": "interactable",
        "x": col * TILE,
        "y": row * TILE,
        "width": 0,
        "height": 0,
        "rotation": 0,
        "visible": True,
        "properties": [{"name": "refId", "type": "string", "value": refid}],
    }


def next_id(data):
    obj_id = data.get("nextobjectid", 1)
    data["nextobjectid"] = obj_id + 1
    return obj_id


def load(path):
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def save(path, data):
    with open(path, "w", encoding="utf-8", newline="\n") as f:
        json.dump(data, f, indent=2)
        f.write("\n")


for map_filename in FIREPLACE_MAPS:
    path = os.path.join(MAPS_DIR, map_filename)
    data = load(path)
    objects_layer = next(l for l in data["layers"] if l.get("name") == "objects")
    if any(
        any(p["name"] == "refId" and p["value"] == "fireplace" for p in o.get("properties", []))
        for o in objects_layer["objects"]
    ):
        print(f"{map_filename}: fireplace already present, skipping")
        continue
    objects_layer["objects"].append(make_point_object(next_id(data), "fireplace", FIREPLACE_COL, FIREPLACE_ROW))
    save(path, data)
    print(f"{map_filename}: added fireplace at col {FIREPLACE_COL}, row {FIREPLACE_ROW}")

for map_filename, spots in MUSHROOM_SPOTS.items():
    path = os.path.join(MAPS_DIR, map_filename)
    data = load(path)
    objects_layer = next(l for l in data["layers"] if l.get("name") == "objects")
    existing = {
        p["value"]
        for o in objects_layer["objects"]
        for p in o.get("properties", [])
        if p["name"] == "refId" and p["value"].startswith("glowing-mushroom")
    }
    added = 0
    for i, (col, row) in enumerate(spots, start=1):
        refid = f"glowing-mushroom-{i}"
        if refid in existing:
            continue
        objects_layer["objects"].append(make_point_object(next_id(data), refid, col, row))
        added += 1
    if added:
        save(path, data)
    print(f"{map_filename}: added {added} glowing-mushroom instance(s)")

print("done")
