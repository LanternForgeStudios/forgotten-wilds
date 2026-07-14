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

export type MapObjectType = 'npc' | 'transition' | 'interactable' | 'zone' | 'spawnPoint';

export interface MapObject {
  type: MapObjectType;
  x: number;
  y: number;
  /** npc id, target locationId, shop/inn id, landmark id (for `zone`), etc. depending on type */
  refId?: string;
  /** for transition objects: which spawnPoint id to place the player at in the target location */
  targetSpawnId?: string;
  /** for zone objects only: tile-unit rectangle size (a zone is a walk-in area, not a single tile) -
   *  same rectangle convention as CollisionRect below. Undefined/1x1 for every other object type. */
  width?: number;
  height?: number;
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
  /** Every embedded tileset this map draws tiles from, in gid order - a map can span more than one
   *  source image (e.g. a grass ground pack + a separate tree/prop pack), same as a real multi-
   *  tileset Tiled map. `tileWidth`/`tileHeight` here are that *tileset's own* native tile size
   *  (Tiled itself always reads and renders using each tileset's own declared size - a tileset can
   *  legitimately differ from the map's grid size, e.g. a 32px prop sheet on a 16px-grid map), which
   *  ExplorationScene.ts must pass to Phaser's addTilesetImage instead of the map's own tileWidth/
   *  tileHeight below - using the map's size for every tileset previously cropped the wrong
   *  sub-region of any tileset whose native size differed from it. `tilesetAssetId`/`columns` below
   *  are convenience aliases for `tilesets[0]`, kept only because a couple of now-dead
   *  prop-passthrough call sites still read them. */
  tilesets: { assetId: string; firstgid: number; tileWidth: number; tileHeight: number }[];
  tilesetAssetId: string;
  /** Column count of the *first* tileset's sprite sheet - retained for the same dead-prop-parity
   *  reason as tilesetAssetId above; rendering itself never needs this (Phaser derives columns from
   *  each tileset image's own pixel width once loaded). */
  columns: number;
  layers: TileLayer[];
  objects: MapObject[];
  /** Discrete static collision-only obstacles from the 'collisions' object layer. Empty if the map
   *  has no such layer. Purely geometric - never interactable, never a transition. */
  collisionObjects: CollisionRect[];
  /** Any populated `ground` tile (gid > 0) is walkable *by default* - this is the opt-out list:
   *  gids explicitly marked `walkable: false` on their tileset (Tiled's Tileset Editor -> a tile's
   *  Custom Properties), for walls/water/chasms/etc. Inverted on purpose from an opt-in allow-list
   *  (which this used to be) - most of a hand-authored map's ground *is* walkable, so painting a
   *  new floor variant "just working" without also remembering to flag it walkable elsewhere is far
   *  less error-prone than the reverse (forgetting to flag an obstacle non-walkable is much rarer
   *  and more visually obvious - you can see the wall/water sitting there). */
  nonWalkableTileIds: number[];
}
