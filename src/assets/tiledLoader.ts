import type { MapObject, MapObjectType, TileLayer, TileMap } from '@/types';
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
}

interface TiledObject {
  id: number;
  type: string;
  x: number;
  y: number;
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

  const layers: TileLayer[] = raw.layers
    .filter((l): l is TiledTileLayer => l.type === 'tilelayer')
    .map((l) => ({ name: l.name, width: l.width, height: l.height, data: l.data }));

  const objects: MapObject[] = raw.layers
    .filter((l): l is TiledObjectGroup => l.type === 'objectgroup')
    .flatMap((l) => l.objects)
    .map((o) => ({
      type: objectType(o.type),
      x: Math.floor(o.x / raw.tilewidth),
      y: Math.floor(o.y / raw.tileheight),
      refId: propValue<string>(o.properties, 'refId'),
      targetSpawnId: propValue<string>(o.properties, 'targetSpawnId'),
      encounterChance: propValue<number>(o.properties, 'encounterChance'),
    }));

  const walkableTileIds: number[] = [];
  for (const tileset of raw.tilesets) {
    for (const tile of tileset.tiles ?? []) {
      if (propValue<boolean>(tile.properties, 'walkable')) {
        walkableTileIds.push(tileset.firstgid + tile.id);
      }
    }
  }

  return {
    locationId,
    tileWidth: raw.tilewidth,
    tileHeight: raw.tileheight,
    width: raw.width,
    height: raw.height,
    tilesetAssetId,
    layers,
    objects,
    walkableTileIds,
  };
}
