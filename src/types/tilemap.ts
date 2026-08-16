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
  /** Native-pixel footprint (Tiled's own coordinate space, unrelated to any render-time viewport
   *  scale), always populated for every object type - used by Arcade Physics bodies/interaction
   *  probes for exact-position collision instead of the tile-quantized x/y/width/height above. When
   *  an object was point-placed in Tiled (no explicit width/height - true for everything except
   *  hand-drawn zone rectangles today), pixelWidth/pixelHeight fall back to a full tile so existing
   *  maps keep their current "blocks/occupies its whole tile" behavior until re-authored with a real
   *  rectangle. */
  pixelX: number;
  pixelY: number;
  pixelWidth: number;
  pixelHeight: number;
  /** for npc objects: max tile distance the npc will wander from this spawn point (cosmetic client-side
   *  animation only, not server state). Omitted/undefined means the npc stands still. */
  wanderRadius?: number;
  /** for spawnPoint objects only: which way the player should face on arrival. Every interior
   *  building's own front-door spawn point sets this to 'up' (walking in, you face further into
   *  the room, not back out the door you just came through) - see useLocationExploration.ts's
   *  spawnPoint resolution. Omitted/undefined defaults to 'down' (outdoor/dungeon maps, which
   *  don't set this property at all). */
  spawnFacing?: 'up' | 'down' | 'left' | 'right';
  /** Legacy field, parsed from older map data but no longer enforced - every transition now
   *  triggers from any approach direction (see useGridMovement.ts's isWalkable and
   *  useLocationExploration.ts's handleStep). Kept on the type so existing map JSON with this
   *  property still parses without error; safe to omit on any new map. */
  requiredFacing?: 'up' | 'down' | 'left' | 'right';
}

/** A discrete, non-interactive collision-only obstacle (fence, rock, ledge, barrier) authored as a
 *  rectangle (or point) object on the Tiled 'collisions' object layer. Native-pixel rectangle
 *  (Tiled's own coordinate space, exactly as drawn - no tile-snapping/expansion), deliberately
 *  separate from MapObject/MapObjectType - it has no `type` discriminant, no refId, nothing beyond
 *  geometry, and never flows through the objects layer's type validation. Used directly as an
 *  Arcade Physics static body's bounds. */
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
   *  sub-region of any tileset whose native size differed from it. */
  /** `columns` is this tileset's own sheet width in tiles - needed to convert a gid into a source
   *  (col, row) crop of the tileset image (see MiniMap.tsx's tile-art rendering, the only consumer
   *  that needs it; ExplorationScene.ts gets this for free from Phaser's own addTilesetImage). */
  tilesets: { assetId: string; firstgid: number; tileWidth: number; tileHeight: number; columns: number }[];
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
