import type { CollisionRect, MapObject, MapObjectType, TileLayer, TileMap } from '@/types';
import { getAssetUrl } from './assetManager';

// Minimal shape of the subset of the Tiled JSON map format (https://doc.mapeditor.org/en/stable/reference/json-map-format/)
// that this game actually uses. Maps are authored directly to this schema (or exported from the Tiled editor)
// and reference tile IDs only — no map file hardcodes an image filename; the tileset image is resolved through
// the asset registry via `tilesetAssetId` in the map's custom properties.

interface TiledProperty {
  name: string;
  value: string | number | boolean;
}

interface TiledTileLayer {
  type: 'tilelayer';
  name: string;
  width: number;
  height: number;
  data: number[];
  visible?: boolean;
  opacity?: number;
}

interface TiledObject {
  id: number;
  type: string;
  x: number;
  y: number;
  /** Pixel width/height, present on rectangle objects (used only by the 'collisions' layer). */
  width?: number;
  height?: number;
  properties?: TiledProperty[];
}

interface TiledObjectGroup {
  type: 'objectgroup';
  name: string;
  objects: TiledObject[];
}

interface TiledTilesetTile {
  id: number;
  properties?: TiledProperty[];
}

interface TiledEmbeddedTileset {
  firstgid: number;
  tilecount: number;
  columns?: number;
  /** This tileset's own native tile size - can legitimately differ from the map's own tilewidth/
   *  tileheight (e.g. a 32px prop sheet embedded in a 16px-grid map). Tiled itself always reads and
   *  renders using each tileset's own declared size, so the loader must carry it through instead of
   *  assuming every tileset matches the map grid. */
  tilewidth?: number;
  tileheight?: number;
  tiles?: TiledTilesetTile[];
  /** Tiled's own per-tileset custom properties (Tileset Editor -> Properties) - this is where a
   *  multi-tileset map tells the loader which registry asset each embedded tileset resolves to,
   *  since Tiled itself has no concept of this game's asset ids. See `tilesetAssetIdFor` below for
   *  the single-tileset fallback (the map-level `tilesetAssetId` property every existing map uses). */
  properties?: TiledProperty[];
}

interface TiledMapJson {
  width: number;
  height: number;
  tilewidth: number;
  tileheight: number;
  layers: (TiledTileLayer | TiledObjectGroup)[];
  tilesets: TiledEmbeddedTileset[];
  properties?: TiledProperty[];
}

function propValue<T extends string | number | boolean>(
  properties: TiledProperty[] | undefined,
  name: string,
): T | undefined {
  return properties?.find((p) => p.name === name)?.value as T | undefined;
}

/** Converts a pixel-space rectangle (Tiled's own object coordinates - free-form, not necessarily
 *  grid-aligned) into the tile span it touches: any tile the rectangle overlaps even partially is
 *  included (floor of the start edge, ceil of the end edge), never fewer. This is deliberately
 *  "any overlap counts" rather than nearest-tile rounding - the player moves tile-by-tile with no
 *  sub-tile position, so a rectangle can only ever block whole tiles anyway; "any overlap blocks"
 *  is the one interpretation that's fully consistent (a rounding-based conversion could go either
 *  way depending on exactly where the fractional edge landed, which read as arbitrary/surprising -
 *  a rectangle drawn without Tiled's Snap to Grid enabled could end up blocking a tile it barely
 *  grazed, or failing to block one it mostly covered). Authors should still snap to the grid for a
 *  precise 1:1 match between what's drawn in Tiled and what blocks in-game - this just makes the
 *  unsnapped case predictable instead of ambiguous. */
function pixelRectToTileSpan(
  px: number,
  py: number,
  pixelWidth: number,
  pixelHeight: number,
  tileWidth: number,
  tileHeight: number,
): { x: number; y: number; width: number; height: number } {
  const startX = Math.floor(px / tileWidth);
  const startY = Math.floor(py / tileHeight);
  const endX = Math.ceil((px + pixelWidth) / tileWidth);
  const endY = Math.ceil((py + pixelHeight) / tileHeight);
  return { x: startX, y: startY, width: Math.max(1, endX - startX), height: Math.max(1, endY - startY) };
}

const KNOWN_TILELAYER_NAMES = /^(ground|decorations-\d+|overhang(-\d+)?)$/;

function objectType(raw: string): MapObjectType {
  if (
    raw === 'npc' ||
    raw === 'transition' ||
    raw === 'interactable' ||
    raw === 'zone' ||
    raw === 'spawnPoint'
  ) {
    return raw;
  }
  throw new Error(`Unknown Tiled object type "${raw}" — expected npc/transition/interactable/zone/spawnPoint.`);
}

/** Resolves which registry asset id an embedded tileset (by its position in `raw.tilesets`)
 *  supplies tiles from. A multi-tileset map sets its own `tilesetAssetId` custom property on each
 *  individual tileset (Tiled's Tileset Editor -> Properties - a real, standard Tiled mechanism, not
 *  a hack). Every existing single-tileset map predates that convention and only ever set the
 *  property on the *map itself*, so tileset #0 falls back to that map-level property if it doesn't
 *  carry its own. */
function tilesetAssetIdFor(tileset: TiledEmbeddedTileset, index: number, mapLevelAssetId: string | undefined): string {
  const ownId = propValue<string>(tileset.properties, 'tilesetAssetId');
  if (ownId) return ownId;
  if (index === 0 && mapLevelAssetId) return mapLevelAssetId;
  throw new Error(`Tiled map: embedded tileset #${index} is missing a "tilesetAssetId" custom property.`);
}

export async function loadTiledMap(locationId: string, mapAssetId: string): Promise<TileMap> {
  const url = getAssetUrl(mapAssetId);
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to load Tiled map "${mapAssetId}" from ${url}: ${response.status}`);
  }
  const raw: TiledMapJson = await response.json();

  const mapLevelAssetId = propValue<string>(raw.properties, 'tilesetAssetId');
  const tilesets = raw.tilesets.map((t, i) => ({
    assetId: tilesetAssetIdFor(t, i, mapLevelAssetId),
    firstgid: t.firstgid,
    tileWidth: t.tilewidth ?? raw.tilewidth,
    tileHeight: t.tileheight ?? raw.tileheight,
  }));

  if (import.meta.env.DEV) {
    for (const l of raw.layers) {
      if (l.type === 'tilelayer' && !KNOWN_TILELAYER_NAMES.test(l.name)) {
        console.warn(
          `Tiled map "${mapAssetId}": tile layer "${l.name}" doesn't match ground/decorations-N/overhang(-N) and will not render.`,
        );
      }
      if (l.type === 'objectgroup' && l.name !== 'objects' && l.name !== 'collisions') {
        console.warn(`Tiled map "${mapAssetId}": object layer "${l.name}" is not "objects" or "collisions" and will be ignored.`);
      }
    }
    // A tileset saved as an *external* reference (a "source": "foo.tsx" entry, instead of the
    // embedded columns/tilecount/tiles this loader reads) silently loses its `walkable: false`
    // exceptions and column count - since walkability now defaults to true for any populated tile,
    // losing this data makes walls/water/etc. silently *walkable* with no other symptom. Tiled
    // defaults new tilesets to embedded, but "Save Tileset As" or an unchecked "Embed in map" box
    // can flip this on save - surface it loudly instead of degrading silently.
    raw.tilesets.forEach((t, i) => {
      if (!t.tiles && !t.columns) {
        console.warn(
          `Tiled map "${mapAssetId}": tileset #${i} looks like an *external* reference (no embedded ` +
            `tiles/columns) - its walkable:false exceptions (walls/water/etc.) will be lost, making ` +
            `them walkable. Re-embed it in Tiled (make sure "Embed in map" was used on export).`,
        );
      }
    });
  }

  const layers: TileLayer[] = raw.layers
    .filter((l): l is TiledTileLayer => l.type === 'tilelayer')
    .map((l) => ({
      name: l.name,
      width: l.width,
      height: l.height,
      data: l.data,
      visible: l.visible ?? true,
      opacity: l.opacity ?? 1,
    }));

  const objects: MapObject[] = raw.layers
    .filter((l): l is TiledObjectGroup => l.type === 'objectgroup' && l.name !== 'collisions')
    .flatMap((l) => l.objects)
    .map((o) => {
      // Only 'zone' objects are ever authored as real Tiled rectangles (every other object type is
      // a point) - width/height (and the tile-span x/y below) fall out as the point's own single
      // tile for those, same as before.
      const span = o.width || o.height ? pixelRectToTileSpan(o.x, o.y, o.width ?? 0, o.height ?? 0, raw.tilewidth, raw.tileheight) : null;
      return {
        type: objectType(o.type),
        x: span?.x ?? Math.floor(o.x / raw.tilewidth),
        y: span?.y ?? Math.floor(o.y / raw.tileheight),
        refId: propValue<string>(o.properties, 'refId'),
        targetSpawnId: propValue<string>(o.properties, 'targetSpawnId'),
        width: span?.width,
        height: span?.height,
        wanderRadius: propValue<number>(o.properties, 'wanderRadius'),
        requiredFacing: propValue<'up' | 'down' | 'left' | 'right'>(o.properties, 'requiredFacing'),
      };
    });

  // 'collisions' is an object layer of discrete, non-interactive obstacles (fences, rocks, ledges,
  // barriers). Parsed entirely separately from `objects` above - it never flows through
  // objectType()'s allow-list, and the object's own Class/Type field is ignored (geometry only).
  const collisionObjects: CollisionRect[] = raw.layers
    .filter((l): l is TiledObjectGroup => l.type === 'objectgroup' && l.name === 'collisions')
    .flatMap((l) => l.objects)
    .map((o) => pixelRectToTileSpan(o.x, o.y, o.width || raw.tilewidth, o.height || raw.tileheight, raw.tilewidth, raw.tileheight));

  // Opt-out, not opt-in: any populated ground tile is walkable unless its own tileset explicitly
  // marks it `walkable: false` (walls, water, chasms, ...). Checks strictly against `=== false` -
  // a tile with no `walkable` property at all (propValue returns undefined) defaults to walkable.
  const nonWalkableTileIds: number[] = [];
  for (const tileset of raw.tilesets) {
    for (const tile of tileset.tiles ?? []) {
      if (propValue<boolean>(tile.properties, 'walkable') === false) {
        nonWalkableTileIds.push(tileset.firstgid + tile.id);
      }
    }
  }

  return {
    locationId,
    tileWidth: raw.tilewidth,
    tileHeight: raw.tileheight,
    width: raw.width,
    height: raw.height,
    tilesets,
    layers,
    objects,
    collisionObjects,
    nonWalkableTileIds,
  };
}
