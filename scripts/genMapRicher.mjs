#!/usr/bin/env node
// Map-authoring helper for "real" maps (bigger, multi-tileset, decorations-N/collisions/overhang/
// zone layers) - a richer sibling to genMap.mjs, not a replacement for it. genMap.mjs stays exactly
// as it was: a quick single-tileset bordered-room stub. This script exists because hand-typing a
// full tile-index array (hundreds of cells x several layers x many maps) isn't practical, and
// because the output needs to be genuinely, fully Tiled-compliant JSON - not just the minimal
// subset src/assets/tiledLoader.ts reads - so a map built with this script can be opened directly in
// the real Tiled editor and re-exported without any pre/post-processing step. The loader only reads
// the fields it needs and ignores the rest, so every extra Tiled-required field this script emits
// (type, orientation, renderorder, tiledversion, per-layer id/x/y, draworder, embedded tileset
// image/imagewidth/imageheight/margin/spacing, ...) is purely additive - confirmed by reading
// tiledLoader.ts and diffing against a real Tiled export (the hand-written
// art-staging/maps/templates/*.json files already prove this shape opens in Tiled).
//
// Usage: node scripts/genMapRicher.mjs <spec.json> <output.json>
//
// Spec shape (see any scripts/map-specs-richer/*.json for real examples):
// {
//   "width": 34, "height": 22,
//   "tilesets": [
//     { "assetId": "tileset.ground-tiles", "name": "ground-tiles", "image": "ground-tiles.png",
//       "imageWidth": 416, "imageHeight": 384, "tileSize": 16, "nonWalkableIds": [5] },
//     { "assetId": "tileset.trees-signs-rocks-bridge", "name": "trees-props", "image": "trees-signs-rocks-bridge.png",
//       "imageWidth": 512, "imageHeight": 864, "tileSize": 32 }
//   ],
//   "ground": {
//     "fill": { "tileset": 0, "id": 12 },
//     "border": { "tileset": 0, "id": 5 },
//     "regions": [ { "x": 10, "y": 5, "width": 6, "height": 4, "tileId": { "tileset": 0, "id": 40 } } ]
//   },
//   "decorations": [
//     { "name": "decorations-1",
//       "tiles": [ { "x": 3, "y": 3, "tileId": { "tileset": 1, "id": 7 } } ],
//       "scatter": [ { "region": { "x": 0, "y": 0, "width": 34, "height": 22 }, "tileIds": [{ "tileset": 1, "id": 7 }],
//                      "count": 20, "avoid": [{ "x": 5, "y": 5 }], "seed": 1 } ] }
//   ],
//   "overhang": [ /* same shape as decorations entries */ ],
//   "collisions": [ { "x": 5, "y": 5, "width": 2, "height": 1 } ],
//   "objects": [
//     { "type": "spawnPoint", "x": 6, "y": 7, "refId": "default" },
//     { "type": "transition", "x": 3, "y": 3, "refId": "some-location", "targetSpawnId": "from-x", "requiredFacing": "up" },
//     { "type": "npc", "x": 9, "y": 3, "refId": "some-npc", "wanderRadius": 2 },
//     { "type": "interactable", "x": 5, "y": 5, "refId": "some-thing" },
//     { "type": "zone", "x": 3, "y": 2, "width": 5, "height": 5, "refId": "hunters-camp" }
//   ]
// }
//
// All x/y/width/height in the spec are TILE units (the script multiplies by each tileset's own
// tileSize for pixel-space output, matching every existing map's convention - tiledLoader.ts divides
// back down on load using the map's tilewidth/tileheight, which this script always sets to 16
// regardless of any individual tileset's own native tile size - see buildTilesetBlock's comment on
// why a tileset can have a different native size than the map's grid).

import { readFileSync, writeFileSync } from 'node:fs';

const MAP_GRID_TILE_SIZE = 16;

// Small deterministic PRNG (mulberry32) so a scatter with a given seed reproduces identically across
// runs - real hand-authored maps shouldn't shuffle every time this script is re-run against the same
// spec.
function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function gid(tilesets, tileId) {
  if (tileId === undefined || tileId === null) return 0;
  const ts = tilesets[tileId.tileset];
  if (!ts) throw new Error(`Unknown tileset index ${tileId.tileset} referenced by a tile placement.`);
  // A real Tiled gid is firstgid + local tile id directly (gid 0 is reserved for "empty", so
  // firstgid 1 already IS local id 0's gid) - tiledLoader.ts's putTileAt(gid - 1, ...) is what
  // converts that back to Phaser's 0-based frame index. No extra offset here.
  return ts.firstgid + tileId.id;
}

function buildGroundLayers(spec, tilesets) {
  const { width, height } = spec;
  const data = new Array(width * height).fill(0);
  const fillGid = gid(tilesets, spec.ground.fill);
  data.fill(fillGid);

  if (spec.ground.border) {
    const borderGid = gid(tilesets, spec.ground.border);
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        if (x === 0 || y === 0 || x === width - 1 || y === height - 1) {
          data[y * width + x] = borderGid;
        }
      }
    }
  }

  for (const region of spec.ground.regions ?? []) {
    const g = gid(tilesets, region.tileId);
    for (let y = region.y; y < region.y + region.height; y++) {
      for (let x = region.x; x < region.x + region.width; x++) {
        if (x < 0 || y < 0 || x >= width || y >= height) continue;
        data[y * width + x] = g;
      }
    }
  }

  // Every spawnPoint/transition tile must be physically standable on, even if it lands on the
  // border wall (a door/exit is deliberately placed there) - same FORCE_WALKABLE_TYPES convention
  // genMap.mjs uses, applied here to whichever fill tile is already the map's default walkable id.
  const fillGidAgain = fillGid;
  for (const o of spec.objects ?? []) {
    if (o.type === 'spawnPoint' || o.type === 'transition') {
      data[o.y * width + o.x] = fillGidAgain;
    }
  }

  return { name: 'ground', width, height, data };
}

function emptyLayer(name, width, height) {
  return { name, width, height, data: new Array(width * height).fill(0) };
}

function paintScatterLayer(layer, spec, tilesets, entry) {
  const rng = mulberry32(entry.seed ?? 1);
  const avoid = new Set((entry.avoid ?? []).map((p) => `${p.x}:${p.y}`));
  const placed = [];
  const { x: rx, y: ry, width: rw, height: rh } = entry.region;
  let attempts = 0;
  const maxAttempts = entry.count * 40;
  while (placed.length < entry.count && attempts < maxAttempts) {
    attempts++;
    const x = rx + Math.floor(rng() * rw);
    const y = ry + Math.floor(rng() * rh);
    const key = `${x}:${y}`;
    if (avoid.has(key)) continue;
    if (placed.some((p) => p.x === x && p.y === y)) continue;
    const tileId = entry.tileIds[Math.floor(rng() * entry.tileIds.length)];
    layer.data[y * layer.width + x] = gid(tilesets, tileId);
    placed.push({ x, y });
  }
}

function buildNamedTileLayers(specEntries, spec, tilesets) {
  return (specEntries ?? []).map((entry) => {
    const layer = emptyLayer(entry.name, spec.width, spec.height);
    for (const t of entry.tiles ?? []) {
      layer.data[t.y * spec.width + t.x] = gid(tilesets, t.tileId);
    }
    for (const s of entry.scatter ?? []) {
      paintScatterLayer(layer, spec, tilesets, s);
    }
    return layer;
  });
}

function propsFor(obj) {
  const props = [];
  if (obj.refId !== undefined) props.push({ name: 'refId', type: 'string', value: obj.refId });
  if (obj.targetSpawnId !== undefined) props.push({ name: 'targetSpawnId', type: 'string', value: obj.targetSpawnId });
  if (obj.requiredFacing !== undefined) props.push({ name: 'requiredFacing', type: 'string', value: obj.requiredFacing });
  if (obj.wanderRadius !== undefined) props.push({ name: 'wanderRadius', type: 'int', value: obj.wanderRadius });
  return props;
}

let nextObjectId = 1;
function tiledObject(obj) {
  const width = obj.width ? obj.width * MAP_GRID_TILE_SIZE : 0;
  const height = obj.height ? obj.height * MAP_GRID_TILE_SIZE : 0;
  return {
    id: nextObjectId++,
    name: '',
    type: obj.type,
    x: obj.x * MAP_GRID_TILE_SIZE,
    y: obj.y * MAP_GRID_TILE_SIZE,
    width,
    height,
    rotation: 0,
    visible: true,
    properties: propsFor(obj),
  };
}

function tiledCollisionObject(rect) {
  return {
    id: nextObjectId++,
    name: '',
    type: '',
    x: rect.x * MAP_GRID_TILE_SIZE,
    y: rect.y * MAP_GRID_TILE_SIZE,
    width: rect.width * MAP_GRID_TILE_SIZE,
    height: rect.height * MAP_GRID_TILE_SIZE,
    rotation: 0,
    visible: true,
  };
}

/** Each embedded tileset carries its own `tilesetAssetId` custom property (Tiled's real per-tileset
 *  Properties mechanism - see tiledLoader.ts's tilesetAssetIdFor) rather than relying on the map-level
 *  property every pre-multi-tileset map used - this is what lets a map genuinely pull tiles from more
 *  than one image. A tileset's own native `tileSize` can differ from the map's 16px grid (Tiled
 *  supports this natively - a tall prop sheet's tiles just overflow upward/left from whichever single
 *  16px cell they're anchored to); this script doesn't need to do anything special for that beyond
 *  passing each tileset's own tileSize through to its `tilewidth`/`tileheight`. */
function buildTilesetBlock(ts, firstgid) {
  const tileSize = ts.tileSize ?? MAP_GRID_TILE_SIZE;
  const columns = Math.floor(ts.imageWidth / tileSize);
  const rows = Math.floor(ts.imageHeight / tileSize);
  // Opt-out, not opt-in: any populated ground tile is walkable by default (see
  // src/assets/tiledLoader.ts), so only the exceptions (walls, water, ...) need marking.
  const tiles = (ts.nonWalkableIds ?? []).map((id) => ({
    id,
    properties: [{ name: 'walkable', type: 'bool', value: false }],
  }));
  return {
    firstgid,
    name: ts.name ?? ts.assetId,
    image: `../../../public/assets/tilesets/${ts.image}`,
    imagewidth: ts.imageWidth,
    imageheight: ts.imageHeight,
    tilewidth: tileSize,
    tileheight: tileSize,
    margin: 0,
    spacing: 0,
    columns,
    tilecount: columns * rows,
    properties: [{ name: 'tilesetAssetId', type: 'string', value: ts.assetId }],
    ...(tiles.length > 0 ? { tiles } : {}),
  };
}

function buildMapJson(spec) {
  nextObjectId = 1;
  let cumulativeGid = 1;
  const tilesets = spec.tilesets.map((ts) => {
    const columns = Math.floor(ts.imageWidth / (ts.tileSize ?? MAP_GRID_TILE_SIZE));
    const rows = Math.floor(ts.imageHeight / (ts.tileSize ?? MAP_GRID_TILE_SIZE));
    const entry = { firstgid: cumulativeGid, tilecount: columns * rows };
    cumulativeGid += entry.tilecount;
    return entry;
  });

  const groundLayer = buildGroundLayers(spec, tilesets);
  const decorationLayers = buildNamedTileLayers(spec.decorations, spec, tilesets);
  const overhangLayers = buildNamedTileLayers(spec.overhang, spec, tilesets);

  let nextLayerId = 1;
  const tileLayers = [groundLayer, ...decorationLayers, ...overhangLayers].map((l) => ({
    id: nextLayerId++,
    type: 'tilelayer',
    name: l.name,
    width: l.width,
    height: l.height,
    data: l.data,
    visible: true,
    opacity: 1,
    x: 0,
    y: 0,
  }));

  const layers = [...tileLayers];
  if (spec.collisions?.length) {
    layers.push({
      id: nextLayerId++,
      type: 'objectgroup',
      name: 'collisions',
      draworder: 'topdown',
      objects: spec.collisions.map(tiledCollisionObject),
      opacity: 1,
      visible: true,
      x: 0,
      y: 0,
    });
  }
  layers.push({
    id: nextLayerId++,
    type: 'objectgroup',
    name: 'objects',
    draworder: 'topdown',
    objects: (spec.objects ?? []).map(tiledObject),
    opacity: 1,
    visible: true,
    x: 0,
    y: 0,
  });

  return {
    type: 'map',
    orientation: 'orthogonal',
    renderorder: 'right-down',
    compressionlevel: -1,
    infinite: false,
    tiledversion: '1.12.2',
    version: '1.10',
    width: spec.width,
    height: spec.height,
    tilewidth: MAP_GRID_TILE_SIZE,
    tileheight: MAP_GRID_TILE_SIZE,
    nextlayerid: nextLayerId,
    nextobjectid: nextObjectId,
    layers,
    tilesets: spec.tilesets.map((ts, i) => buildTilesetBlock(ts, tilesets[i].firstgid)),
    // The first tileset's own `properties` block above already carries `tilesetAssetId` - this
    // map-level copy is kept too purely for backward compatibility with the single-tileset
    // convention every map before this script used (tiledLoader.ts's tilesetAssetIdFor falls back to
    // it for tileset #0 only; a real multi-tileset map doesn't strictly need this, but it's harmless
    // and matches every existing map's shape).
    properties: [{ name: 'tilesetAssetId', type: 'string', value: spec.tilesets[0].assetId }],
  };
}

const [, , specPath, outPath] = process.argv;
if (!specPath || !outPath) {
  console.error('Usage: node scripts/genMapRicher.mjs <spec.json> <output.json>');
  process.exit(1);
}
const spec = JSON.parse(readFileSync(specPath, 'utf8'));
const mapJson = buildMapJson(spec);
writeFileSync(outPath, JSON.stringify(mapJson, null, 2) + '\n');
console.log(
  `Wrote ${outPath} (${spec.width}x${spec.height} tiles, ${spec.tilesets.length} tileset(s), ${(spec.objects ?? []).length} objects)`,
);
