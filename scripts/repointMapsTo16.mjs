// One-time (but rerunnable/idempotent) migration: repoints every map's mismatched-size tileset
// entries at the new pre-scaled -16 tileset assets (see genScaledTilesets.mjs), instead of the
// runtime ExplorationScene.ts pre-scaling fallback. Only tileWidth/tileHeight/image/imagewidth/
// imageheight/tilesetAssetId change - firstgid/columns/tilecount/margin/spacing/tiles (walkable
// overrides etc.) are untouched, since the actual tile-index topology is identical at any scale.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MAPS_DIR = path.resolve(__dirname, '../public/assets/maps');
const TARGET_TILE = 16;

// basename (without extension) of the source tileset -> its native tile size
const MISMATCHED = {
  'ground-tiles': 32,
  'trees-signs-rocks-bridge': 32,
  Graveyard_Set: 48,
  water_animation_demo: 64,
  'VelmoraRealms-Environments_Free': 32,
};

const mapFiles = fs.readdirSync(MAPS_DIR).filter((f) => f.endsWith('.json'));

for (const file of mapFiles) {
  const fullPath = path.join(MAPS_DIR, file);
  const map = JSON.parse(fs.readFileSync(fullPath, 'utf8'));
  if (!Array.isArray(map.tilesets)) continue;
  let changed = false;

  for (const ts of map.tilesets) {
    const base = path.basename(ts.image ?? '', '.png');
    const nativeTile = MISMATCHED[base];
    if (!nativeTile || ts.tilewidth !== nativeTile) continue; // already migrated or not a match

    const scale = TARGET_TILE / nativeTile;
    ts.image = ts.image.replace(/\.png$/, '-16.png');
    ts.imagewidth = Math.round(ts.imagewidth * scale);
    ts.imageheight = Math.round(ts.imageheight * scale);
    ts.tilewidth = TARGET_TILE;
    ts.tileheight = TARGET_TILE;
    const idProp = (ts.properties ?? []).find((p) => p.name === 'tilesetAssetId');
    if (idProp) idProp.value = `${idProp.value}-16`;
    changed = true;
  }

  if (changed) {
    fs.writeFileSync(fullPath, JSON.stringify(map, null, 2) + '\n');
    console.log('updated', file);
  }
}

console.log('done');
