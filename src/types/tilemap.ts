/** Minimal internal model produced by tiledLoader.ts from a Tiled JSON export. */
export interface TileLayer {
  name: string;
  width: number;
  height: number;
  /** Tile IDs, row-major, 0 = empty. */
  data: number[];
  /** Tiled's per-layer visibility flag. Defaults to true when the source map omits it. */
  visible: boolean;
  /** Tiled's per-layer opacity (0-1). Defaults to 1 when the source map omits it. */
  opacity: number;
}

export type MapObjectType = 'npc' | 'transition' | 'interactable' | 'encounterZone' | 'spawnPoint';

export interface MapObject {
  type: MapObjectType;
  x: number;
  y: number;
  /** npc id, target locationId, shop/inn id, etc. depending on type */
  refId?: string;
  /** for transition objects: which spawnPoint id to place the player at in the target location */
  targetSpawnId?: string;
  /** for encounterZone: chance per step, 0-1 */
  encounterChance?: number;
  /** for npc objects: max tile distance the npc will wander from this spawn point (cosmetic client-side
   *  animation only, not server state). Omitted/undefined means the npc stands still. */
  wanderRadius?: number;
  /** for transition objects: the player must be moving in this direction to trigger the transition
   *  (e.g. a building door only opens if you walk "up" into it from the street) - stepping onto the
   *  tile from another direction just walks onto it as a normal floor tile. Omitted means any
   *  direction triggers it, which is correct for map-edge transitions only reachable from one side. */
  requiredFacing?: 'up' | 'down' | 'left' | 'right';
}

/** A discrete, non-interactive collision-only obstacle (fence, rock, ledge, barrier) authored as a
 *  rectangle (or point) object on the Tiled 'collisions' object layer. Tile-coordinate span,
 *  deliberately separate from MapObject/MapObjectType - it has no `type` discriminant, no refId,
 *  nothing beyond geometry, and never flows through the objects layer's type validation. */
export interface CollisionRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface TileMap {
  locationId: string;
  tileWidth: number;
  tileHeight: number;
  width: number;
  height: number;
  tilesetAssetId: string;
  /** Column count of the tileset's sprite sheet, used for gid -> row/col lookup when rendering. */
  columns: number;
  layers: TileLayer[];
  objects: MapObject[];
  /** Discrete static collision-only obstacles from the 'collisions' object layer. Empty if the map
   *  has no such layer. Purely geometric - never interactable, never a transition. */
  collisionObjects: CollisionRect[];
  walkableTileIds: number[];
}
