#!/usr/bin/env node
// One-off map-authoring helper - NOT shipped game code, not imported by the app. Emits the exact
// Tiled-schema JSON shape src/assets/tiledLoader.ts parses (bordered rectangular room, walkable
// interior via the `walkable: true` tile-property convention, objectgroup entries for
// npc/transition/interactable/zone/spawnPoint), from a small JSON spec, so new maps
// aren't hand-typed tile array by tile array.
//
// Usage: node scripts/genMap.mjs <spec.json> <output.json>
//
// Spec shape:
// {
//   "width": 20, "height": 14, "tilesetAssetId": "tileset.tiny-dungeon",
//   "objects": [
//     { "type": "spawnPoint", "x": 6, "y": 7, "refId": "default" },
//     { "type": "transition", "x": 3, "y": 3, "refId": "some-location", "targetSpawnId": "from-x", "requiredFacing": "up" },
//     { "type": "npc", "x": 9, "y": 3, "refId": "some-npc", "wanderRadius": 2 },
//     { "type": "interactable", "x": 5, "y": 5, "refId": "some-thing" }
//   ]
// }
//
// All x/y in the spec are TILE coordinates (the script multiplies by tilewidth=16 for the output
// JSON, matching every existing hand-authored map's convention - tiledLoader.ts divides back down
// on load). The generated room is a solid border of non-walkable tile (gid 1) with a fully
// walkable interior (gid 25), same tileset convention as every existing map in this repo.
//
// This script only ever produces a `ground` tile layer plus an `objects` layer - it has no concept
// of the richer decorations-N/collisions/overhang layers the Tiled editor workflow supports (see
// UseTILEDforMaps.txt). Maps that want those should be authored directly in Tiled and exported to
// public/assets/maps/<location-id>.json rather than extended through this generator.

import { readFileSync, writeFileSync } from 'node:fs';

const TILE_SIZE = 16;
const BORDER_GID = 1;
const FLOOR_GID = 25;

function propsFor(obj) {
  const props = [];
  if (obj.refId !== undefined) props.push({ name: 'refId', type: 'string', value: obj.refId });
  if (obj.targetSpawnId !== undefined) props.push({ name: 'targetSpawnId', type: 'string', value: obj.targetSpawnId });
  if (obj.requiredFacing !== undefined) props.push({ name: 'requiredFacing', type: 'string', value: obj.requiredFacing });
  if (obj.wanderRadius !== undefined) props.push({ name: 'wanderRadius', type: 'int', value: obj.wanderRadius });
  return props;
}

// Tile types the player must be able to physically stand on, even where they land on the
// border wall (e.g. a transition/spawn point on the edge of the map, matching how every existing
// hand-authored map breaks a walkable gap in its border wall at each door).
const FORCE_WALKABLE_TYPES = new Set(['spawnPoint', 'transition']);

function buildMapJson(spec) {
  const { width, height, tilesetAssetId, objects } = spec;
  const data = [];
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const isBorder = x === 0 || y === 0 || x === width - 1 || y === height - 1;
      data.push(isBorder ? BORDER_GID : FLOOR_GID);
    }
  }
  for (const o of objects) {
    if (FORCE_WALKABLE_TYPES.has(o.type)) {
      data[o.y * width + o.x] = FLOOR_GID;
    }
  }

  return {
    width,
    height,
    tilewidth: TILE_SIZE,
    tileheight: TILE_SIZE,
    properties: [{ name: 'tilesetAssetId', type: 'string', value: tilesetAssetId }],
    layers: [
      { type: 'tilelayer', name: 'ground', width, height, data },
      {
        type: 'objectgroup',
        name: 'objects',
        objects: objects.map((o) => ({
          type: o.type,
          x: o.x * TILE_SIZE,
          y: o.y * TILE_SIZE,
          properties: propsFor(o),
        })),
      },
    ],
    tilesets: [
      {
        firstgid: 1,
        tilecount: 132,
        tiles: [{ id: 24, properties: [{ name: 'walkable', type: 'bool', value: true }] }],
      },
    ],
  };
}

const [, , specPath, outPath] = process.argv;
if (!specPath || !outPath) {
  console.error('Usage: node scripts/genMap.mjs <spec.json> <output.json>');
  process.exit(1);
}
const spec = JSON.parse(readFileSync(specPath, 'utf8'));
const mapJson = buildMapJson(spec);
writeFileSync(outPath, JSON.stringify(mapJson, null, 2) + '\n');
console.log(`Wrote ${outPath} (${spec.width}x${spec.height} tiles, ${spec.objects.length} objects)`);
