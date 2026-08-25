// One-off build script for the Raven Ridge hand-crafted-map pass (2026-08). Paints a proper
// Wang-blended ground (tileset.raven-ridge-terrain) for a winding south-to-north climbing path
// (Cliff Pass -> Abandoned Rail Line -> Eagle Overlook -> Moon Witch Circle), stamps decoration/
// shadow tile blocks copied from the already-wired tilesets, hand-places collision rects, and
// repositions the map's objects (spawn/transition to south/north edges per the "enter at the
// bottom, exit north" ask; NPC/interactables moved onto the new path; new mine-decor/
// overworld-decor2 DecorEntity objects added). Not meant to be reusable for other maps as-is -
// see scripts/genMapRicher.mjs for the generic scatter-based generator this project already has.
import fs from 'node:fs';

const MAP_PATH = 'public/assets/maps/raven-ridge.json';
const W = 64;
const H = 40;
const TS = 16;

const data = JSON.parse(fs.readFileSync(MAP_PATH, 'utf8'));

// A dedicated shadow layer at reduced opacity, same convention as ash-hallow's decorations-4 -
// spliced in right after decorations-1 so draw order still puts shadows under overhang content.
const decorations1Index = data.layers.findIndex((l) => l.name === 'decorations-1');
data.layers.splice(decorations1Index + 1, 0, {
  data: new Array(W * H).fill(0),
  height: H,
  id: Math.max(...data.layers.map((l) => l.id ?? 0)) + 1,
  name: 'decorations-2',
  opacity: 0.6,
  type: 'tilelayer',
  visible: true,
  width: W,
  x: 0,
  y: 0,
});

// ---------- 1. Ground: Wang-blended raven-ridge-terrain ----------
// "lower" = rough grey stone mountain path (the walkable corridor), "upper" = sparse windswept
// rocky ground (everything else). Same rect-union + 4-corner-vertex algorithm as
// scripts/paint_bayou_water.py, generalized to read any tileset's own corner metadata.
const terrainMeta = JSON.parse(
  fs.readFileSync('public/assets/tilesets/original/raven-ridge-terrain/metadata.json', 'utf8'),
);
function buildWidToIndex(meta) {
  const table = {};
  meta.tileset_data.tiles.forEach((t, i) => {
    const c = t.corners;
    const wid =
      (c.NW === 'upper' ? 8 : 0) + (c.NE === 'upper' ? 4 : 0) + (c.SW === 'upper' ? 2 : 0) + (c.SE === 'upper' ? 1 : 0);
    table[wid] = i;
  });
  return table;
}
const widToIndex = buildWidToIndex(terrainMeta);

// Path rects (tile coords, inclusive), south (high y) to north (low y) - see plan/commit message
// for the beat each one covers.
const PATH_RECTS = [
  [12, 33, 17, 39], // Cliff Pass - entry straight
  [15, 27, 22, 34], // Cliff Pass - bend
  [18, 22, 28, 29], // Abandoned Rail Line (ranger-caleb + tunnel)
  [24, 15, 34, 24], // climb toward the overlook
  [30, 12, 46, 20], // Eagle Overlook - open vista
  [38, 5, 48, 14], // climb into the witch circle
  [40, 2, 54, 11], // Moon Witch Circle clearing
  [45, 0, 49, 3], // exit spur to the north edge
];

const isLowerVertex = Array.from({ length: H + 1 }, () => new Array(W + 1).fill(false));
for (const [x0, y0, x1, y1] of PATH_RECTS) {
  for (let vy = y0; vy <= y1 + 1; vy++) {
    for (let vx = x0; vx <= x1 + 1; vx++) {
      if (vy >= 0 && vy <= H && vx >= 0 && vx <= W) isLowerVertex[vy][vx] = true;
    }
  }
}

const terrainTs = data.tilesets.find((t) => t.name === 'raven-ridge-terrain');
const groundLayer = data.layers.find((l) => l.name === 'ground');
for (let row = 0; row < H; row++) {
  for (let col = 0; col < W; col++) {
    const nw = isLowerVertex[row][col] ? 0 : 8;
    const ne = isLowerVertex[row][col + 1] ? 0 : 4;
    const sw = isLowerVertex[row + 1][col] ? 0 : 2;
    const se = isLowerVertex[row + 1][col + 1] ? 0 : 1;
    const wid = nw + ne + sw + se;
    groundLayer.data[row * W + col] = terrainTs.firstgid + widToIndex[wid];
  }
}

// ---------- 2. Decoration/shadow stamps ----------
// Each stamp copies a source rectangle (tile coords, within the named tileset's own grid) onto a
// destination top-left (tile coords) in the given layer.
function tilesetByName(name) {
  const ts = data.tilesets.find((t) => t.name === name);
  if (!ts) throw new Error(`tileset not wired: ${name}`);
  return ts;
}
function stampRect(layer, ts, srcCol, srcRow, w, h, destCol, destRow) {
  for (let ry = 0; ry < h; ry++) {
    for (let rx = 0; rx < w; rx++) {
      const dx = destCol + rx;
      const dy = destRow + ry;
      if (dx < 0 || dx >= W || dy < 0 || dy >= H) continue;
      const localId = (srcRow + ry) * ts.columns + (srcCol + rx);
      layer.data[dy * W + dx] = ts.firstgid + localId;
    }
  }
}

const decorations1 = data.layers.find((l) => l.name === 'decorations-1');
const decorations2 = data.layers.find((l) => l.name === 'decorations-2');

const wallVariations = tilesetByName('general-wall-variations');
const wallTiles = tilesetByName('general-wall-tiles');
const rocks = tilesetByName('general-rocks');
const caveProps = tilesetByName('cave-props');
const shadows = tilesetByName('general-props-shadows');

// general-wall-variations, grey colorway (rows10-19 of the 16x30 sheet): rows10-14 cols0-7 is a
// tall rocky cliff mass (no grass base) - used as generic cliff-wall backdrop. rows15-19 cols0-7
// is the same mass with a dark cave-mouth void at its grass base. rows15-19 cols9-15 is the
// wooden support archway on its own grass base.
const CLIFF_WALL = { ts: wallVariations, col: 0, row: 10, w: 8, h: 5 };
const CAVE_VOID = { ts: wallVariations, col: 0, row: 15, w: 8, h: 5 };
const ARCHWAY = { ts: wallVariations, col: 9, row: 15, w: 7, h: 5 };
// row 0 of general-rocks.png is a "PALETTE" text label baked into the sheet, not tile art -
// starting at row 1 skips it while still capturing both boulder clusters.
const ROCK_BIG = { ts: rocks, col: 0, row: 1, w: 12, h: 6 };
const ROCK_MED = { ts: rocks, col: 0, row: 7, w: 10, h: 6 };
const CRYSTAL_SMALL = { ts: rocks, col: 9, row: 17, w: 4, h: 2 };
// Auto-detected via connected-component blob scan (col0-2/row12-15 was a stray leg fragment, not
// a full mushroom) - cols12-15,rows0-5 is a clean complete pair (one plain, one glowing-drip cap).
const MUSHROOM = { ts: caveProps, col: 12, row: 0, w: 4, h: 6 };
// general-wall-tiles' first (brown) tall wall cluster - used once for palette variety at the
// overlook's cliff edge rather than the uniform grey used everywhere else.
const WALL_TILES_TALL = { ts: wallTiles, col: 0, row: 0, w: 6, h: 9 };
// general-props-shadows' largest blob, for the wall/rock stamps; a smaller one for props.
const SHADOW_BIG = { ts: shadows, col: 0, row: 0, w: 14, h: 3 };
const SHADOW_SMALL = { ts: shadows, col: 0, row: 3, w: 5, h: 2 };

function stamp(spec, destCol, destRow, layer = decorations1) {
  stampRect(layer, spec.ts, spec.col, spec.row, spec.w, spec.h, destCol, destRow);
}

// Every destination rect below was checked pairwise for overlap before being finalized (an
// earlier pass had a crystal-accent stamp land squarely on the archway's roof tiles - tile
// layers overwrite, they don't composite, so any accidental overlap between two decorations1
// stamps silently destroys whichever one was written second).

// Cliff Pass: a cliff-wall backdrop west of the entry, a boulder cluster east of the bend - both
// clear of the path rects, framing the corridor rather than sitting in it.
stamp(SHADOW_BIG, 2, 36, decorations2);
stamp(CLIFF_WALL, 2, 33, decorations1); // x2-9,y33-37
stamp(SHADOW_BIG, 23, 33, decorations2);
stamp(ROCK_MED, 23, 30, decorations1); // x23-32,y30-35

// Abandoned Rail Line: the tunnel mouth (cave void + wooden archway framing it), stacked just
// west of the main corridor. ember-codex-tunnel/ranger-caleb are repositioned (below) to stand
// right at this threshold; the mine-decor props cluster around it too.
stamp(SHADOW_BIG, 8, 25, decorations2);
stamp(CAVE_VOID, 8, 22, decorations1); // x8-15,y22-26
stamp(SHADOW_SMALL, 8, 30, decorations2);
stamp(ARCHWAY, 8, 27, decorations1); // x8-14,y27-31

// Eagle Overlook: the path widens - clutter kept to the margins so the middle stays open. One
// palette-variety wall cluster (general-wall-tiles) NW of the widening, one boulder mass E of it.
stamp(SHADOW_BIG, 24, 13, decorations2);
stamp(WALL_TILES_TALL, 24, 6, decorations1); // x24-29,y6-14
stamp(SHADOW_BIG, 49, 20, decorations2);
stamp(ROCK_BIG, 49, 14, decorations1); // x49-60,y14-20
stamp(SHADOW_SMALL, 33, 10, decorations2);
stamp(CRYSTAL_SMALL, 33, 9, decorations1); // x33-36,y9-10

// Moon Witch Circle: mushrooms + crystal shards scattered inside the open clearing itself (it's
// wide enough that small ambient props don't block traversal), plus a cliff backdrop filling the
// otherwise-empty NW corner above the climb.
stamp(SHADOW_SMALL, 43, 8, decorations2);
stamp(MUSHROOM, 43, 3, decorations1); // x43-46,y3-8
stamp(SHADOW_SMALL, 50, 8, decorations2);
stamp(MUSHROOM, 50, 3, decorations1); // x50-53,y3-8
stamp(SHADOW_SMALL, 44, 10, decorations2);
stamp(CRYSTAL_SMALL, 44, 9, decorations1); // x44-47,y9-10
stamp(SHADOW_SMALL, 48, 10, decorations2);
stamp(CRYSTAL_SMALL, 48, 9, decorations1); // x48-51,y9-10
stamp(SHADOW_BIG, 28, 3, decorations2);
stamp(CLIFF_WALL, 28, 0, decorations1); // x28-35,y0-4

// Small cave-floor exception right at the archway threshold - a handful of the map's original
// cave-tiles ground gids, so stepping through the archway briefly reads as cave floor before the
// path continues as outdoor mountain terrain either side of it.
const caveFloorGids = [649, 630, 665, 666, 647, 664, 632, 631, 648];
let gidCursor = 0;
for (let y = 28; y <= 30; y++) {
  for (let x = 9; x <= 13; x++) {
    groundLayer.data[y * W + x] = caveFloorGids[gidCursor % caveFloorGids.length];
    gidCursor++;
  }
}

// ---------- 3. Collisions ----------
// Perimeter (thin strips wrapping the whole map, matching ash-hallow's boundary-rect convention),
// plus rects over each wall/rock/void stamp placed above (not every decorative tile - only the
// large solid obstacles), in pixel coordinates.
const collisionsLayer = data.layers.find((l) => l.name === 'collisions');
let nextObjId = Math.max(...data.layers.flatMap((l) => (l.objects ?? []).map((o) => o.id ?? 0))) + 1;
function px(v) {
  return v * TS;
}
function addCollision(xTile, yTile, wTiles, hTiles) {
  collisionsLayer.objects.push({
    id: nextObjId++,
    name: '',
    type: '',
    x: px(xTile),
    y: px(yTile),
    width: px(wTiles),
    height: px(hTiles),
    rotation: 0,
    visible: true,
    opacity: 1,
  });
}
collisionsLayer.objects = [];
// Perimeter strips.
addCollision(0, 0, W, 1);
addCollision(0, H - 1, W, 1);
addCollision(0, 0, 1, H);
addCollision(W - 1, 0, 1, H);
// Wall/void/rock obstacles (matching the stamps above; a row or two smaller than the full stamp
// footprint so the grass/floor base at each stamp's bottom edge stays walkable). Small ambient
// props (crystal shards, mushrooms) get no collision at all, matching ash-hallow's own "small
// vegetation ~0-5% collision" density.
addCollision(2, 33, 8, 4);
addCollision(23, 30, 10, 5);
addCollision(8, 22, 8, 4);
addCollision(24, 6, 6, 8);
addCollision(49, 14, 12, 6);
addCollision(28, 0, 8, 4);
// The archway's legs are collidable but its doorway gap (its middle third) must stay open - two
// thin rects flanking the opening rather than one solid block.
addCollision(9, 27, 2, 4);
addCollision(12, 27, 2, 4);

// ---------- 4. Objects: reposition to the new south-to-north layout ----------
const objectsLayer = data.layers.find((l) => l.name === 'objects');
function findObj(refId, type) {
  const o = objectsLayer.objects.find(
    (o) => o.type === type && (o.properties ?? []).some((p) => p.name === 'refId' && p.value === refId),
  );
  if (!o) throw new Error(`object not found: ${type} ${refId}`);
  return o;
}
function setPos(o, xTile, yTile) {
  o.x = px(xTile);
  o.y = px(yTile);
}

// Entry now sits on the south edge (row 39) instead of the west edge, per the "enter at the
// bottom" ask; exit moves to the north edge (row 0) - a climbing path fits "rocky mountain paths
// above Ironwood Trail" better than the old flat west-to-east crossing.
setPos(findObj('default', 'spawnPoint'), 14, 38);
setPos(findObj('from-ironwood-trail', 'spawnPoint'), 14, 38);
setPos(findObj('ironwood-trail', 'transition'), 14, 39);
setPos(findObj('from-whisper-falls', 'spawnPoint'), 47, 1);
setPos(findObj('whisper-falls', 'transition'), 47, 0);

setPos(findObj('ranger-caleb', 'npc'), 16, 29);
setPos(findObj('ember-codex-tunnel', 'interactable'), 11, 29);
setPos(findObj('glowing-mushroom-1', 'interactable'), 44, 5);
setPos(findObj('glowing-mushroom-2', 'interactable'), 51, 4);

// New DecorEntity objects (src/data/decorEntities.ts), placed along the path.
function addDecor(refId, xTile, yTile) {
  objectsLayer.objects.push({
    id: nextObjId++,
    name: '',
    type: 'interactable',
    x: px(xTile),
    y: px(yTile),
    width: 0,
    height: 0,
    rotation: 0,
    visible: true,
    opacity: 1,
    properties: [{ name: 'refId', type: 'string', value: refId }],
  });
}
addDecor('mine-rail-track', 11, 31);
addDecor('mine-cart', 17, 30);
addDecor('mine-support-beam', 18, 25);
addDecor('mine-rubble', 21, 25);
addDecor('mine-crate', 25, 27);
addDecor('overworld-boulder', 14, 35);
addDecor('overworld-fallen-log', 37, 17);
addDecor('overworld-tree-stump', 30, 20);
addDecor('overworld-wildflower', 47, 6);

// This is a full-file rewrite (ground/decorations/collisions/objects all change substantially),
// so an exact byte-for-byte match of Tiled's own idiosyncratic export whitespace isn't worth
// chasing - plain indented JSON is still valid, still opens fine in Tiled, and the client loader
// only ever JSON.parses it. Keep CRLF since every other map file in this repo uses it.
fs.writeFileSync(MAP_PATH, JSON.stringify(data, null, 1).replace(/\n/g, '\r\n') + '\r\n');
console.log('raven-ridge.json rebuilt.');
