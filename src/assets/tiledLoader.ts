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
  tiles?: TiledTilesetTile[];
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

const KNOWN_TILELAYER_NAMES = /^(ground|decorations-\d+|overhang)$/;

function objectType(raw: string): MapObjectType {
  if (
    raw === 'npc' ||
    raw === 'transition' ||
    raw === 'interactable' ||
    raw === 'encounterZone' ||
    raw === 'spawnPoint'
  ) {
    return raw;
  }
  throw new Error(`Unknown Tiled object type "${raw}" — expected npc/transition/interactable/encounterZone/spawnPoint.`);
}

export async function loadTiledMap(locationId: string, mapAssetId: string): Promise<TileMap> {
  const url = getAssetUrl(mapAssetId);
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to load Tiled map "${mapAssetId}" from ${url}: ${response.status}`);
  }
  const raw: TiledMapJson = await response.json();

  const tilesetAssetId = propValue<string>(raw.properties, 'tilesetAssetId');
  if (!tilesetAssetId) {
    throw new Error(`Tiled map "${mapAssetId}" is missing a "tilesetAssetId" custom property.`);
  }

  if (import.meta.env.DEV) {
    for (const l of raw.layers) {
      if (l.type === 'tilelayer' && !KNOWN_TILELAYER_NAMES.test(l.name)) {
        console.warn(
          `Tiled map "${mapAssetId}": tile layer "${l.name}" doesn't match ground/decorations-N/overhang and will not render.`,
        );
      }
      if (l.type === 'objectgroup' && l.name !== 'objects' && l.name !== 'collisions') {
        console.warn(`Tiled map "${mapAssetId}": object layer "${l.name}" is not "objects" or "collisions" and will be ignored.`);
      }
    }
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
    .map((o) => ({
      type: objectType(o.type),
      x: Math.floor(o.x / raw.tilewidth),
      y: Math.floor(o.y / raw.tileheight),
      refId: propValue<string>(o.properties, 'refId'),
      targetSpawnId: propValue<string>(o.properties, 'targetSpawnId'),
      encounterChance: propValue<number>(o.properties, 'encounterChance'),
      wanderRadius: propValue<number>(o.properties, 'wanderRadius'),
      requiredFacing: propValue<'up' | 'down' | 'left' | 'right'>(o.properties, 'requiredFacing'),
    }));

  // 'collisions' is an object layer of discrete, non-interactive obstacles (fences, rocks, ledges,
  // barriers). Parsed entirely separately from `objects` above - it never flows through
  // objectType()'s allow-list, and the object's own Class/Type field is ignored (geometry only).
  const collisionObjects: CollisionRect[] = raw.layers
    .filter((l): l is TiledObjectGroup => l.type === 'objectgroup' && l.name === 'collisions')
    .flatMap((l) => l.objects)
    .map((o) => ({
      x: Math.floor(o.x / raw.tilewidth),
      y: Math.floor(o.y / raw.tileheight),
      width: Math.max(1, Math.round((o.width || raw.tilewidth) / raw.tilewidth)),
      height: Math.max(1, Math.round((o.height || raw.tileheight) / raw.tileheight)),
    }));

  const walkableTileIds: number[] = [];
  for (const tileset of raw.tilesets) {
    for (const tile of tileset.tiles ?? []) {
      if (propValue<boolean>(tile.properties, 'walkable')) {
        walkableTileIds.push(tileset.firstgid + tile.id);
      }
    }
  }

  const columns = raw.tilesets[0]?.columns ?? 12;

  return {
    locationId,
    tileWidth: raw.tilewidth,
    tileHeight: raw.tileheight,
    width: raw.width,
    height: raw.height,
    tilesetAssetId,
    columns,
    layers,
    objects,
    collisionObjects,
    walkableTileIds,
  };
}
