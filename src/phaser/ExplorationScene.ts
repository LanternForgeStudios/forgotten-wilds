import Phaser from 'phaser';
import type { TileLayer, TileMap, MapObject, CollisionRect, EquipmentSlot, WeatherKind, TimePhase } from '@/types';
import type { GridPosition, Facing } from '@/hooks/useGridMovement';
import { FACING_TO_DELTA } from '@/hooks/useGridMovement';
import type { MovementState } from '@/animation/characterAnimations';
import { PLAYER_ANIMATION_LAYOUT, animationLayoutForSprite, resolveDisplayRow } from '@/animation/characterAnimations';
import { getAssetDefinition } from '@/assets/assetManager';
import { createCharacterAnimations, animationKey } from './animationDefs';
import { ensureParticleTexture } from './battleEffects';
import { WeatherLayer } from './weatherEffects';
import { LightingLayer } from './lightingEffects';
import { LIGHT_SOURCES } from '@/data/lightSources';
import { loadSceneTexture } from './textureLoader';
import type { GridEntity } from '@/components/exploration/PhaserExplorationCanvas';
import type { MovementInputState } from '@/hooks/useMovementInput';
import { playSound } from '@/audio/audioService';
import { footstepSurfaceFor, type FootstepSurface } from '@/utils/footstepSurface';

/** The glide-tween duration for non-player entities (NPCs/other players - see upsertEntity) as
 *  they move from their last reported tile to their next one. The player itself no longer tweens
 *  between discrete tiles at all (see updatePlayerPhysics/PLAYER_WALK_TILES_PER_S below) - this
 *  constant is now entity-only, kept at its old value since wandering-NPC step cadence
 *  (useWanderingNpcs.ts's STEP_INTERVAL_MS) is unchanged. */
const GLIDE_MS = 220;
/** Continuous player movement speed, in tiles/second (not px/s - see the physics-coordinate-space
 *  comment near VOID_TILE_INDEX for why: multiplying by `this.tileSize` each frame keeps speed
 *  correct in game-world terms regardless of the current viewport zoom). Chosen to match the old
 *  discrete model's own cadence (one tile every stepIntervalMs=220ms => ~4.5 tiles/s) as a feel-
 *  neutral starting point - a real "does this feel right" pass is expected once this is
 *  playtested, not a value to treat as final. */
const WALK_SPEED_TILES_PER_S = 1000 / 220;
/** Same starting-point reasoning as WALK_SPEED_TILES_PER_S, matching the old dashStepIntervalMs
 *  (100ms/tile => 10 tiles/s). */
const DASH_SPEED_TILES_PER_S = 1000 / 100;
/** The player's Arcade Physics body footprint, as a fraction of its sprite's own frame size -
 *  deliberately smaller than the full sprite (which includes head/torso that shouldn't collide)
 *  and biased toward the feet, matching a typical top-down RPG's "shadow footprint" collision
 *  convention. Tuned by eye against the actual sprite art once played, not derived from anything -
 *  flagged in the plan as an explicit follow-up tuning pass, not a value to treat as final. */
const PLAYER_BODY_WIDTH_RATIO = 0.5;
const PLAYER_BODY_HEIGHT_RATIO = 0.3;
/** Same "shadow footprint" idea as PLAYER_BODY_WIDTH/HEIGHT_RATIO, applied to any entity with
 *  `blocksMovement: true` (NPCs, chests, shrines, decor - see GridEntity's own doc comment). Not
 *  reusing the player's own ratio constants directly - these are conceptually a different tuning
 *  knob (entity art proportions won't always match the player's), and the width ratio has since
 *  diverged on purpose: widened from 0.5 to reduce how easily a fast-moving player (Dash) can
 *  tunnel past a thin static hitbox in one physics step (Arcade Physics only checks collision once
 *  per fixed 60Hz step - a wider target narrows the gap a single dash-speed step could clear). */
const ENTITY_BODY_WIDTH_RATIO = 0.75;
const ENTITY_BODY_HEIGHT_RATIO = 0.3;
/** How close (in tiles) the player must be to a field-encounter icon to trigger it - see
 *  checkFieldEncounterProximity. Roughly "standing on or immediately adjacent to it," matching the
 *  old discrete model's "landed on this exact tile" trigger closely enough to feel the same,
 *  without needing an exact-tile match now that position is continuous. */
const FIELD_ENCOUNTER_PROXIMITY_RADIUS_TILES = 0.6;
/** Directional interaction probe (queryInteraction) - a rectangle extending out from the player's
 *  body edge in the current facing direction, replacing the old discrete model's "check the exact
 *  tile one step ahead" targeting. LENGTH deliberately less than a full tile ("genuinely adjacent,"
 *  not "anywhere in the next tile"); WIDTH deliberately less than a full tile too, so a diagonally-
 *  adjacent object (one tile over AND up) doesn't fall inside the probe just because it's close -
 *  interaction should still require roughly facing the thing, not just being near it. Starting
 *  points, not final - tune by feel once played (see the plan's own open-items note on this). */
const INTERACTION_PROBE_LENGTH_TILES = 0.6;
const INTERACTION_PROBE_WIDTH_TILES = 0.7;
/** How often (ms) the physics-driven player position is reported back to React (see
 *  flushPositionUpdate) - throttled well below the 60fps physics tick since HUD/minimap/heartbeat
 *  consumers don't need a re-render every frame; ~15Hz is imperceptibly different from per-frame
 *  for anything reading it, at a fraction of the render cost. */
const POSITION_FLUSH_INTERVAL_MS = 66;
/** Always renders above every tile layer and every entity/player sprite - same as the old DOM
 *  renderer's document order (overhang divs are always painted last). */
const OVERHANG_DEPTH = 1000;
/** Entities and the player sit between decoration layers and the overhang. Deliberately higher
 *  than any plausible decoration-layer count. This is a FLOOR, not the actual depth every entity
 *  renders at - see depthForY()/update() below, which add a Y-based offset on top of this every
 *  frame so a sprite lower on screen (closer to the camera) draws over one higher up, instead of
 *  every entity sharing this exact same depth and falling back to Phaser's default same-depth
 *  ordering (child/creation order) - the cause of a real reported bug where the player sprite
 *  rendered behind a static interactable (a fireplace) it was standing in front of, because the
 *  interactable happened to be added to the display list after the player. */
const ENTITY_DEPTH = 500;
/** How much of the 500-unit gap between ENTITY_DEPTH and OVERHANG_DEPTH a Y-sorted entity's own
 *  offset is allowed to use, leaving headroom below ENTITY_LABEL_DEPTH for labels/badges to always
 *  stay above every entity body regardless of Y. ironwood-trail.json is this game's tallest map
 *  today at 48 tiles (768px @ 16px tiles); dividing by 3 keeps its offset (~256) comfortably under
 *  this cap with room to spare for future larger maps. */
const ENTITY_Y_SORT_DIVISOR = 3;
const ENTITY_Y_SORT_MAX_OFFSET = 480;
/** Depth-tie-breaker in the player's favor - see its one call site (syncAfterPhysicsStep) for the
 *  full story. In depthForY's own units (world-pixels / ENTITY_Y_SORT_DIVISOR), so this is worth
 *  ~24px of "free" y-advantage - enough to cover a small collision-box mismatch, small enough that
 *  a genuinely-in-front object (a real tile or more further south) still correctly occludes. */
const PLAYER_DEPTH_TIE_BIAS = 8;
/** Always above every entity/player body regardless of its Y-sorted depth (see ENTITY_DEPTH's own
 *  comment), but still under OVERHANG_DEPTH - a nameplate shouldn't out-rank a tree canopy above
 *  the character it's labeling. */
const ENTITY_LABEL_DEPTH = OVERHANG_DEPTH - 1;
/** Stacking order for equipment layer sprites, as small fractional offsets from the base player
 *  sprite's own ENTITY_DEPTH (see docs/Equipment-Layering-Plan.md) - boots under legs under chest
 *  under gloves under weapon/lantern. Tuned by eye once real layer art exists; weapon and lantern
 *  share a tier for now since which one should render "on top" depends on the actual generated
 *  pose (open question in the plan doc). A slot with no offset listed falls back to 0.5 (above
 *  every named slot) rather than silently rendering under the base body. */
const EQUIPMENT_LAYER_DEPTH_OFFSET: Partial<Record<EquipmentSlot, number>> = {
  boots: 0.1,
  legs: 0.15,
  chest: 0.2,
  gloves: 0.3,
  weapon: 0.4,
  lantern: 0.4,
};
/** Same one-time generated 4x4 white-square texture ensureParticleTexture already sets up for
 *  BattleScene's defeat effect - reused here rather than duplicating the Graphics->texture
 *  boilerplate, tinted differently per call site. */
const PARTICLE_TEXTURE_KEY = 'fx-dot';
/** Fallback color/intensity for a `type:"light"` map object with no lightColor/lightIntensity
 *  custom property of its own (see loadMap) - a generic warm glow, since most placements (a
 *  window, a torch already painted into tile art) don't need a bespoke tint. */
const DEFAULT_LIGHT_COLOR = 0xffdd99;
// 2x brighter (2026-08 owner ask - "same strength as the lantern"), matching lightingEffects.ts's
// lanternPeakIntensity 2x treatment rather than the 1.5x applied to src/data/lightSources.ts.
// Only the *default* - an explicit lightIntensity custom property on a placed object is a
// deliberate per-placement value and isn't multiplied on top.
const DEFAULT_LIGHT_INTENSITY = 0.7 * 2;

/** Parses a Tiled color-property string - either the 6-digit "#rrggbb" form or the 8-digit
 *  "#aarrggbb" form Tiled's own "color" property type exports (alpha first, dropped here since
 *  Phaser Lights have no separate alpha channel) - leniently: any other/missing value falls back
 *  to `fallback` rather than throwing, since this is hand-typed level-design data. */
function parseLightColor(raw: string | undefined, fallback: number): number {
  if (!raw) return fallback;
  const hex = raw.replace('#', '');
  const rgbHex = hex.length === 8 ? hex.slice(2) : hex;
  const parsed = Number.parseInt(rgbHex, 16);
  return Number.isNaN(parsed) ? fallback : parsed;
}
/** Small soft-edged ellipse, generated once (see ensureShadowTexture) and reused via
 *  setDisplaySize per instance - one shared texture rather than a separate generated image per
 *  sprite width, since the shape is identical and only the scale differs. */
const SHADOW_TEXTURE_KEY = 'entity-shadow';
const SHADOW_TEXTURE_SIZE = { width: 40, height: 20 };
/** Ground-contact shadow width as a fraction of the owning sprite's own native width - proportional
 *  so a small NPC and a tall one both get a footprint-sized shadow rather than a fixed size that
 *  looks wrong on either end. Height is a fixed fraction of width (a flattened top-down ellipse),
 *  not of the sprite's height - a shadow's footprint shouldn't grow just because the character/prop
 *  art itself is tall. Wide/flat rather than a tall blob, matching how a shadow reads at a top-down
 *  camera angle. */
const SHADOW_WIDTH_RATIO = 0.9;
const SHADOW_HEIGHT_TO_WIDTH_RATIO = 0.35;
/** Gold map-pin marker floated above a GridEntity with questTarget set (registry id
 *  'ui.quest-target-marker', a user-supplied image - see registry.ts's own notes for the source/
 *  scaling history). Loaded once via loadSceneTexture (same fire-and-forget-then-textures.exists-
 *  guard convention as DASH_DUST_FX_ASSET_ID below), not generated. Displayed at a fixed pixel
 *  size regardless of viewport scale, matching how the label/badge text attachments are also
 *  unaffected by entity scale. */
const QUEST_MARKER_ASSET_ID = 'ui.quest-target-marker';
const QUEST_MARKER_DISPLAY_SIZE = { width: 30, height: 36 };
/** Idle pulse the marker plays continuously (see upsertEntity) to draw the eye - peak scale is a
 *  multiplier on top of QUEST_MARKER_DISPLAY_SIZE's own scale, not an absolute value. */
const QUEST_MARKER_PULSE_SCALE = 1.15;
const QUEST_MARKER_PULSE_MS = 650;
/** How far above the sprite's own anchor point (sprite.y - see setPlayer/upsertEntity's "origin
 *  (0.5, 1)" comment) a shadow is centered, as a fraction of the sprite's frame height. Not 0 -
 *  every character sheet here is cropped/exported with a margin of fully transparent pixels below
 *  the actual drawn feet (confirmed against sprite.player.male's own registry note: art content
 *  fills a 60x80 box inside a 72x96 frame), so sprite.y (the frame's bottom edge) sits visibly
 *  *below* the real feet. Centering a shadow exactly at sprite.y therefore left a gap between the
 *  feet and the shadow, reading as the character floating (reported live). This is a tuned
 *  approximation, not derived per-sprite - it won't be pixel-perfect for every asset, but reads
 *  right across the character sheets in use today. */
const SHADOW_Y_OFFSET_RATIO = 0.1;
/** The viewport zoom level that every character/structure/decoration asset's own pixel dimensions
 *  are authored against - a 48x64 sprite is meant to render at exactly 48x64 screen pixels
 *  (ENTITY_VISUAL_SCALE below), not be force-fit to exactly one tile's width. Player/NPC/
 *  interactable sprites are pinned to this reference size regardless of the current tile viewport
 *  scale (see useExplorationViewport.ts's `scale`) - by request, so shrinking tiles down (e.g. for
 *  a wider view on desktop) doesn't also shrink characters/props; only the ground grid zooms.
 *  Previously entity scale tracked viewportScale proportionally (1.0 at desktop's old 3x, ~0.67 at
 *  mobile's 2x) - see ENTITY_VISUAL_SCALE for where that ratio used to be computed. */
const REFERENCE_VIEWPORT_SCALE = 3;
/** Fixed scale factor applied to every player/NPC/interactable sprite - always render at native
 *  reference size (see REFERENCE_VIEWPORT_SCALE), independent of the tile grid's own zoom level. */
const ENTITY_VISUAL_SCALE = 1;
/** --fw-text-dim - a dusty tan/grey, reads as ground dust rather than anything magical. */
const DASH_DUST_COLOR = 0xb8a888;
/** Real FX-pack sheet for the Dash dust puff, replacing the generated dot texture once loaded -
 *  see spawnDashDust's textures.exists guard for the (rare) fallback path. */
const DASH_DUST_FX_ASSET_ID = 'fx.smoke-puff';

/** Movement/collision migration to Arcade Physics (see docs/plan) - Physics geometry lives in the
 *  SAME render/viewport-scaled coordinate space every sprite and tile layer already uses (`x *
 *  this.tileSize`), not Tiled's native pixel space. Arcade colliders check overlapping *world*
 *  AABBs, and Phaser's own tilemap-collision system reads a layer's live world bounds through its
 *  own scale/position - so a physics body has to share that same scaled frame to align with it at
 *  all, rather than introducing a second, parallel coordinate system alongside the one already in
 *  use everywhere else in this file. `CollisionRect`/`MapObject.pixelX/Y/W/H` (native Tiled pixels)
 *  are converted to this scaled space with `* this.viewportScale` wherever a body/debug rect is
 *  built. This is scale-invariant for the one thing that actually needs to be resize-safe (the
 *  tile-float `GridPosition` reported back to React - see setPlayer/Phase 2): px / tileSize is the
 *  same ratio whether px and tileSize are both native or both scaled. */

/** Reserved tile index for the synthetic "void" tile placed at every empty (gid<=0) ground cell -
 *  see loadMap's void-tile-fill step. Deliberately far above any real map's tile-id range (every
 *  map's total tile count today is a few hundred at most) so it can never collide with a real
 *  tileset's own firstgid..firstgid+tilecount-1 span, without needing to compute the actual max
 *  gid in use (this game's internal TileMap model doesn't carry each tileset's tilecount, only its
 *  own tiles' individual walkable properties). Phaser resolves a tile index to its owning tileset
 *  by range lookup, not by allocating an array sized to the index itself, so a large constant here
 *  doesn't cost memory proportional to its value. */
const VOID_TILE_INDEX = 100_000;

/** Set equality by value, order-independent - used to decide whether the player's currently-
 *  overlapped zone refIds actually changed this frame (see onActiveZonesChange), rather than
 *  firing the callback on every frame the player merely stands still inside a zone. */
function setsHaveSameMembers(a: Set<string>, b: Set<string>): boolean {
  if (a.size !== b.size) return false;
  for (const value of a) if (!b.has(value)) return false;
  return true;
}

function voidTileTextureKey(tileWidth: number, tileHeight: number): string {
  return `void-tile-texture-${tileWidth}x${tileHeight}`;
}

/** Texture-cache key for a tileset's map-grid-scaled copy - see loadMap's tileset pre-scaling
 *  step. Namespaced by target size (not just the source asset id) so the same tileset loaded for
 *  two different maps with different grid sizes wouldn't collide on one cached texture. */
function scaledTilesetKey(assetId: string, tileWidth: number, tileHeight: number): string {
  return `${assetId}__scaled-${tileWidth}x${tileHeight}`;
}

/** Module-level (not per-Scene) cache of already-scaled tileset canvases, keyed by
 *  scaledTilesetKey - PhaserExplorationCanvas.tsx creates a brand-new Phaser.Game (and therefore a
 *  brand-new, empty Scene.textures manager) on every Town/Overworld/Dungeon transition, so a
 *  per-Scene cache alone made the actual pixel-scaling work (a synchronous canvas drawImage call)
 *  redo itself on every single map load instead of once - the map-loading slowdown this was meant
 *  to fix. This survives across Game instances for the life of the page, so the expensive resize
 *  only ever happens once per (tileset, target size) pair; only the cheap re-registration into a
 *  new Game's texture manager repeats. */
const scaledTilesetCanvasCache = new Map<string, HTMLCanvasElement>();

interface EntityVisual {
  sprite: Phaser.GameObjects.Sprite;
  /** The spriteAssetId this sprite was last textured with - lets upsertEntity detect a change
   *  (e.g. another player switching skins via Profile mid-session, presence entity id stays the
   *  same) and retexture in place instead of leaving the sprite stuck on its original asset. */
  spriteAssetId: string;
  label?: Phaser.GameObjects.Text;
  badge?: Phaser.GameObjects.Text;
  questMarker?: Phaser.GameObjects.Image;
  /** Per-slot equipment layer sprites stacked on this entity's own base sprite - same shape/
   *  reconciliation approach as the local player's Scene-wide equipmentLayerSprites map (setPlayer),
   *  just nested per-entity here since many remote players' presence entities can be on screen at
   *  once. Undefined for any entity with no GridEntity.equipmentLayers (everything except another
   *  player's presence entity, today). */
  layerSprites?: Map<EquipmentSlot, { sprite: Phaser.GameObjects.Sprite; spriteAssetId: string }>;
  /** Mirrors GridEntity.interactionKind - set once at creation (see upsertEntity), read by
   *  queryInteraction to find nearby NPCs/other players. Undefined for every other entity kind
   *  (building/exit markers, field-encounter icons, decor/shrine - the latter are looked up via
   *  currentMapObjects directly instead, since they're static MapObjects with their own refId). */
  interactionKind?: 'npc' | 'presence';
  /** Ground-contact shadow, only present for 'npc'/'presence' entities (see upsertEntity) - gives
   *  characters visual depth against the flat ground the same way the player's own shadow does.
   *  Absent for buildings/exit markers/decor/shrines, which already sit flush on the ground art. */
  shadow?: Phaser.GameObjects.Image;
}

/** The one generic exploration-rendering Phaser Scene - loaded once per Game instance, reused
 *  across every location (mirrors useLocationExploration.ts's "one hook, many locations" shape,
 *  not "one Scene per location"). Most methods here are still called imperatively by
 *  PhaserExplorationCanvas.tsx in response to React prop changes (spawn placement, entity/UI-
 *  driven state, camera/viewport) - but movement itself is a deliberate exception: player velocity,
 *  Arcade Physics collision (ground/collision-rects/NPCs/interactables), zone/transition overlap
 *  detection, and the directional interaction probe (queryInteraction) all live HERE, in Phaser's
 *  own per-frame update loop, not in a React hook - Arcade Physics has to run inside that loop to
 *  work at all (see update()/syncAfterPhysicsStep()'s own comments for the exact timing). React
 *  still owns everything the physics *triggers* the meaning of: server calls, dialogue/quest/
 *  inventory state, UI - see useLocationExploration.ts's handleTransitionEnter for where that
 *  boundary sits concretely. */
export class ExplorationScene extends Phaser.Scene {
  private tileSize = 48;
  /** tileSize ÷ the map's own native tile pixel size (map.tileWidth) - the actual current viewport
   *  zoom level (3 on desktop, 2 on mobile - see useExplorationViewport.ts), used to scale
   *  character/entity sprites relative to REFERENCE_VIEWPORT_SCALE. Set once per loadMap call. */
  private viewportScale = REFERENCE_VIEWPORT_SCALE;
  private mapLayers: Phaser.Tilemaps.TilemapLayer[] = [];
  /** One entry per distinct *source* tile (identified by its own global gid) that the current map's
   *  Tiled data marks as animated AND that's actually placed somewhere on the map - built once in
   *  loadMap by grouping every placement sharing that source gid, then cycled every frame by
   *  advanceAnimatedTiles (called from update()). `cycleMs` walks forward through `totalDurationMs`
   *  (wrapping via modulo, not accumulated frame-by-frame) so a very large delta - e.g. the tab was
   *  backgrounded for a while - resolves straight to the correct frame instead of looping through
   *  every intermediate one. Rebuilt alongside mapLayers on every real location swap. */
  private animatedTileGroups: {
    frames: { gid: number; durationMs: number }[];
    totalDurationMs: number;
    cycleMs: number;
    frameIndex: number;
    placements: { layer: Phaser.Tilemaps.TilemapLayer; tx: number; ty: number; rotation: number; flipX: boolean }[];
  }[] = [];
  private currentMapKey: string | null = null;
  /** Set whenever loadMap actually swaps to a different location - consumed by the next
   *  setPlayer call so a location transition snaps the player to the new spawn point instantly
   *  instead of gliding from the previous map's pixel coordinates. */
  private mapJustChanged = false;

  /** The `ground` tile layer specifically (a subset of mapLayers) - captured separately so
   *  setCollision/the Arcade tilemap collider can target it without re-searching mapLayers by
   *  name every time. Rebuilt alongside mapLayers on every real location swap; null for a map
   *  with no ground layer at all (shouldn't happen for a real map, but loadMap already tolerates
   *  it via orderedLayers' `.filter((l): l is TileLayer => !!l)`). */
  private groundLayer: Phaser.Tilemaps.TilemapLayer | null = null;
  /** One static Arcade body per `collisions`-layer rectangle from the current map, in render-
   *  scaled space (see the module-level comment on physics coordinate space above). Rebuilt
   *  alongside mapLayers on every real location swap. No collider is registered against the
   *  player yet (Phase 1 is geometry-only, inspectable via the debug overlay) - see Phase 2. */
  private collisionStaticGroup: Phaser.Physics.Arcade.StaticGroup | null = null;
  /** Raw collision rectangles/map objects for the current map, kept only for the debug overlay's
   *  per-frame redraw (drawn from data directly, not from live body state, since object-footprint
   *  bodies aren't built until Phase 3). */
  private currentCollisionRects: CollisionRect[] = [];
  private currentMapObjects: MapObject[] = [];
  private debugGraphics: Phaser.GameObjects.Graphics | null = null;
  private debugEnabled = false;
  /** Re-registered (destroy old, create new) every time groundLayer/collisionStaticGroup are
   *  rebuilt (a real location swap) - see registerPlayerColliders. Null until the player sprite
   *  and at least one of those two exist. */
  private playerGroundCollider: Phaser.Physics.Arcade.Collider | null = null;
  private playerRectCollider: Phaser.Physics.Arcade.Collider | null = null;
  private playerEntityCollider: Phaser.Physics.Arcade.Collider | null = null;
  /** Every entity sprite with `blocksMovement: true` (NPCs, chests, shrines, decor - see
   *  GridEntity's own doc comment) gets a dynamic Arcade body added to this ONE shared group in
   *  upsertEntity - created once in create() (not per-map, unlike collisionStaticGroup) since
   *  Phaser Groups auto-remove a member the instant its GameObject is destroyed (standard Group
   *  behavior - listens for each member's own DESTROY event), so setEntities' existing per-location
   *  destroy-stale-entities loop already keeps this group's membership correct with no extra
   *  bookkeeping needed here. A body's position is NOT driven by physics velocity - NPCs move via
   *  the tween in upsertEntity's own reposition code, and Arcade re-derives a dynamic body's
   *  position from its GameObject's transform every step regardless of what moved it, so the
   *  collider still sees each entity's real, current (possibly tweening) position. */
  private entityCollisionGroup: Phaser.Physics.Arcade.Group | null = null;

  /** Shared input-state ref (see useMovementInput.ts) that updatePlayerPhysics reads every frame -
   *  bound once by PhaserExplorationCanvas via bindInput, not passed per-call, since it's a stable
   *  ref object for the life of the exploration session. */
  private inputRef: { current: MovementInputState } | null = null;
  /** True while an overlay (dialogue, menus, shop, ...) is open - movement/dash input is ignored
   *  but depth-sort/debug drawing continue normally. Set via setSuspended. */
  private suspended = false;
  /** The player's current facing, derived from velocity every frame (see updatePlayerPhysics) -
   *  persists at its last value while stationary, same as the old discrete model's `facing`. */
  private facing: Facing = 'down';
  private onPositionChange?: (pos: GridPosition, movementState: MovementState) => void;
  private positionFlushAccumulatorMs = 0;
  private lastDashDustAtMs = 0;
  /** Which footstep sfx family (dirt/stone/water/wood) the current map's location resolves to -
   *  see footstepSurfaceFor. Recomputed once per loadMap call, not per frame. */
  private currentFootstepSurface: FootstepSurface = 'dirt';
  private lastFootstepAtMs = 0;
  /** Set every update() (pre-physics-step), read by syncAfterPhysicsStep (post-physics-step) -
   *  see that method's own comment for why movementState itself is computed in update() (it
   *  doesn't depend on the sprite's resolved position) while everything that USES it to touch
   *  sprite.x/y-derived state has to happen later. */
  private currentMovementState: MovementState = 'idle';

  /** Leading-edge overlap tracking for zone/transition objects - keyed by object REFERENCE, not
   *  refId (two distinct transition tiles can legitimately share the same target-location refId,
   *  e.g. two separate doors into the same building; keying by refId could then have one tile's
   *  "not overlapping" state clobber another's "overlapping" state within the same frame's loop -
   *  object identity has no such collision). Cleared on every real location swap (loadMap) since
   *  `currentMapObjects` itself gets replaced with a new array then. */
  private zoneOverlapState = new Map<MapObject, boolean>();
  private transitionOverlapState = new Map<MapObject, boolean>();
  /** Which `currentMapKey` the overlap-state maps above were last primed for (see
   *  checkZoneAndTransitionOverlaps/primeOverlapState) - null means "not primed for the current
   *  map yet," which is also what loadMap resets it to on every real swap. */
  private overlapStatePrimedForMapKey: string | null = null;
  private onZoneEnter?: (refId: string) => void;
  private onTransitionEnter?: (obj: MapObject) => void;
  /** Every zone refId the player's body is CURRENTLY overlapping (not leading-edge like
   *  onZoneEnter - this is a level, not an edge), recomputed every checkZoneAndTransitionOverlaps
   *  call. Drives subarea music (see onActiveZonesChange) - unlike a one-shot pickup/shrine
   *  interaction, background music needs to know when the player LEAVES a zone too, not just when
   *  they enter it. */
  private activeZoneRefIds = new Set<string>();
  private onActiveZonesChange?: (refIds: string[]) => void;
  /** Tile-int positions (matching GridEntity's own convention) - set via setFieldEncounterIcons,
   *  checked for player proximity every frame in checkFieldEncounterProximity. Keyed by id (already
   *  unique/time-stamped by the caller - see useFieldEncounters.ts) rather than object reference
   *  since the caller passes a fresh array every render. */
  private fieldEncounterIcons: { id: string; x: number; y: number }[] = [];
  private fieldEncounterOverlapState = new Map<string, boolean>();
  private onFieldEncounterNear?: (icon: { id: string; x: number; y: number }) => void;

  private playerSprite: Phaser.GameObjects.Sprite | null = null;
  private playerShadow: Phaser.GameObjects.Image | null = null;
  private playerTextureKey: string | null = null;
  /** Same race-guard pattern as entityGeneration - only matters once the player sprite's own
   *  texture can change at runtime (e.g. a future equipment-appearance swap), but guarded now for
   *  consistency rather than waiting for that bug to actually happen. */
  private playerGeneration = 0;
  /** One child sprite per equipped slot with layer art (see docs/Equipment-Layering-Plan.md) -
   *  kept in lockstep with playerSprite's own position/scale/animation every setPlayer call.
   *  Empty in practice until real layer art ships (Phase 3/4) - no equipped item sets a
   *  layerSpriteAssetId yet, so equipmentLayers is always [] today. */
  private equipmentLayerSprites = new Map<EquipmentSlot, { sprite: Phaser.GameObjects.Sprite; spriteAssetId: string }>();

  private entityVisuals = new Map<string, EntityVisual>();
  /** Incremented on every setEntities call - lets an in-flight upsertEntity (awaiting a texture
   *  load) detect it's been superseded by a newer call (e.g. the player left this location before
   *  the load finished) and bail out, instead of creating an orphaned sprite for an entity that's
   *  no longer part of the current location. See setEntities/upsertEntity. */
  private entityGeneration = 0;
  /** Same idea as entityGeneration, for loadMap's own await (texture load before building tile
   *  layers) - guards against a rapid double location-transition racing itself. */
  private mapGeneration = 0;
  private onReady?: () => void;
  // Constructed here, not in create() - PhaserExplorationCanvas.tsx sets its sceneRef to this
  // instance synchronously, right after `new ExplorationScene(...)` (before Phaser's async boot
  // even starts), so any field only assigned inside create() is still undefined if something
  // calls a method on it before boot completes. WeatherLayer's own constructor is Phaser-API-free
  // (just stores the scene reference), so building it this early is safe; the real Phaser API
  // calls (scene.add.graphics/particles) only happen once setWeather is actually invoked with a
  // real kind, which PhaserExplorationCanvas's effect gates on sceneReady anyway.
  private weatherLayer: WeatherLayer;
  // Same early-construction reasoning as weatherLayer above - LightingLayer's constructor is
  // Phaser-API-free too.
  private lightingLayer: LightingLayer;
  private currentTimePhase: TimePhase = 'day';

  constructor(onReady?: () => void) {
    super({ key: 'ExplorationScene' });
    this.onReady = onReady;
    this.weatherLayer = new WeatherLayer(this);
    this.lightingLayer = new LightingLayer(this);
  }

  create() {
    // Nothing to eagerly load - map/sprite textures load lazily per call below, since maps and
    // sprites change at runtime (location transitions) outside the normal preload()/create()
    // lifecycle. Signals readiness so the React bridge knows it's safe to start calling the
    // imperative API. This is a constructor-injected callback invoked from *inside* create()
    // (not an event the caller subscribes to from outside) because Phaser boots a scene
    // asynchronously - `this.events`/`this.load`/every other scene system is undefined until
    // boot completes, so the caller can't safely listen on `scene.events` immediately after
    // `new Phaser.Game(...)` returns (confirmed the hard way: that's exactly what threw
    // "Cannot read properties of undefined (reading 'once')").
    ensureParticleTexture(this, PARTICLE_TEXTURE_KEY);
    this.ensureShadowTexture();
    this.lightingLayer.enable();
    // Fire-and-forget: spawnDashDust checks textures.exists before using this, falling back to the
    // dot texture on the rare chance a dash is triggered before this finishes loading.
    loadSceneTexture(this, DASH_DUST_FX_ASSET_ID).catch(() => {});
    // Same fire-and-forget convention - upsertEntity checks textures.exists before showing a
    // quest-target marker, so a marker just doesn't appear for the brief window (if any) before
    // this resolves, rather than failing anything.
    loadSceneTexture(this, QUEST_MARKER_ASSET_ID).catch(() => {});
    this.physics.world.gravity.set(0, 0);
    // Created once (not per-map) - see its own field doc comment for why membership doesn't need
    // manual per-location bookkeeping.
    this.entityCollisionGroup = this.physics.add.group();
    // Always above everything, including overhang layers - collision/interaction geometry needs
    // to stay visible over a tree canopy, not get hidden under it.
    this.debugGraphics = this.add.graphics().setDepth(OVERHANG_DEPTH + 100);
    // Registered here (not in the constructor - `this.events` doesn't exist until boot completes,
    // same reasoning as the onReady comment above) - see syncAfterPhysicsStep's own comment for
    // why this has to run on POST_UPDATE specifically, not update(). Safe to register unconditionally
    // every create() call: ExplorationScene is a fresh instance per Phaser.Game (one Game per
    // Town/Overworld/Dungeon mount - see PhaserExplorationCanvas.tsx), so there's never a prior
    // listener on this same scene instance to duplicate.
    this.events.on(Phaser.Scenes.Events.POST_UPDATE, this.syncAfterPhysicsStep, this);
    this.onReady?.();
  }

  /** Toggles the collision/interaction-bounds debug overlay (player/entity bodies, collision-rect
   *  static bodies, object footprints) - see update()'s drawDebugOverlay call. Zero per-frame cost
   *  when disabled (drawDebugOverlay early-returns before touching debugGraphics). */
  setDebugEnabled(enabled: boolean): void {
    this.debugEnabled = enabled;
    if (!enabled) this.debugGraphics?.clear();
  }

  /** Binds the shared input-state ref (see useMovementInput.ts) that updatePlayerPhysics reads
   *  every frame - called once by PhaserExplorationCanvas, not per-render, since the ref object
   *  itself is stable for the life of the exploration session. */
  bindInput(inputRef: { current: MovementInputState }): void {
    this.inputRef = inputRef;
  }

  /** While true, movement/dash input is ignored (an overlay is open) - depth-sort and the debug
   *  overlay keep running normally. */
  setSuspended(suspended: boolean): void {
    this.suspended = suspended;
  }

  /** Registered once by PhaserExplorationCanvas - see flushPositionUpdate for the throttling. */
  setPositionCallback(cb: (pos: GridPosition, movementState: MovementState) => void): void {
    this.onPositionChange = cb;
  }

  /** Registered once by PhaserExplorationCanvas - fires once per real entry into a `zone` object's
   *  rectangle (leading edge only, see zoneOverlapState/checkZoneAndTransitionOverlaps). */
  setZoneEnterCallback(cb: (refId: string) => void): void {
    this.onZoneEnter = cb;
  }

  /** Registered once by PhaserExplorationCanvas - fires whenever the SET of zone refIds the player
   *  is currently standing inside changes (entry OR exit), unlike setZoneEnterCallback's leading-
   *  edge-only firing. Used for subarea background music (see OverworldScene's handleActiveZones
   *  Change), which needs to revert to the region's base track on exit, not just switch on entry. */
  setActiveZonesChangeCallback(cb: (refIds: string[]) => void): void {
    this.onActiveZonesChange = cb;
  }

  /** Registered once by PhaserExplorationCanvas - fires once per real entry onto a `transition`
   *  object's rectangle (leading edge only, same mechanism as setZoneEnterCallback). */
  setTransitionEnterCallback(cb: (obj: MapObject) => void): void {
    this.onTransitionEnter = cb;
  }

  /** Called by PhaserExplorationCanvas whenever the live field-encounter icon list changes (see
   *  useFieldEncounters.ts) - tile-int positions, same convention as GridEntity. */
  setFieldEncounterIcons(icons: { id: string; x: number; y: number }[]): void {
    this.fieldEncounterIcons = icons;
  }

  /** Registered once by PhaserExplorationCanvas - fires once per real approach within
   *  FIELD_ENCOUNTER_PROXIMITY_RADIUS_TILES of an icon (leading edge, see
   *  fieldEncounterOverlapState/checkFieldEncounterProximity). */
  setFieldEncounterNearCallback(cb: (icon: { id: string; x: number; y: number }) => void): void {
    this.onFieldEncounterNear = cb;
  }

  /** Y-sort depth for a sprite at pixel-space `y` - see ENTITY_DEPTH's own comment for why this
   *  exists. Clamped so an unexpectedly tall future map can't push an entity's depth into
   *  ENTITY_LABEL_DEPTH/OVERHANG_DEPTH territory. */
  private depthForY(y: number): number {
    return ENTITY_DEPTH + Math.min(y / ENTITY_Y_SORT_DIVISOR, ENTITY_Y_SORT_MAX_OFFSET);
  }

  /** Generates the shared soft-edged ellipse texture every player/NPC shadow reuses (see
   *  SHADOW_TEXTURE_KEY) - a few concentric ellipses of increasing alpha drawn small-to-large-first
   *  so later (smaller, more opaque) draws blend over earlier (larger, fainter) ones, producing a
   *  soft falloff toward the edge rather than one flat-alpha shape with a hard boundary. Generated
   *  once per Game instance (mirrors ensureParticleTexture's own guard), not per sprite - every
   *  shadow is the same shared texture, scaled per-instance via setDisplaySize. */
  private ensureShadowTexture(): void {
    if (this.textures.exists(SHADOW_TEXTURE_KEY)) return;
    const { width, height } = SHADOW_TEXTURE_SIZE;
    const g = this.add.graphics();
    const layers = [
      { scale: 1, alpha: 0.12 },
      { scale: 0.7, alpha: 0.14 },
      { scale: 0.45, alpha: 0.16 },
    ];
    for (const layer of layers) {
      g.fillStyle(0x000000, layer.alpha);
      g.fillEllipse(width / 2, height / 2, (width / 2) * layer.scale, (height / 2) * layer.scale);
    }
    g.generateTexture(SHADOW_TEXTURE_KEY, width, height);
    g.destroy();
  }

  /** Creates one shadow image sized proportionally to `ownerSprite`'s own native width (see
   *  SHADOW_WIDTH_RATIO) - shared by both the player (setPlayer) and NPC/presence entities
   *  (upsertEntity), positioned/depth-sorted every frame in syncAfterPhysicsStep alongside their
   *  owner. Depth starts at ENTITY_DEPTH - 1 (same "just behind the entity layer" convention
   *  spawnDashDust's emitter already uses) - corrected to track the owner's own Y-sorted depth once
   *  movement starts, so it never renders in front of anything actually further "north". */
  private createShadowFor(ownerSprite: Phaser.GameObjects.Sprite): Phaser.GameObjects.Image {
    const width = ownerSprite.width * SHADOW_WIDTH_RATIO;
    const height = width * SHADOW_HEIGHT_TO_WIDTH_RATIO;
    return this.add
      .image(ownerSprite.x, this.shadowY(ownerSprite), SHADOW_TEXTURE_KEY)
      .setDisplaySize(width, height)
      .setDepth(ENTITY_DEPTH - 1);
  }

  /** Where a shadow's own Y should sit for a given owner sprite this frame - see
   *  SHADOW_Y_OFFSET_RATIO's own comment for why this isn't just `ownerSprite.y`. `ownerSprite.height`
   *  is the frame's native (unscaled) height, same basis PLAYER/ENTITY_BODY_HEIGHT_RATIO already use
   *  for collision body sizing - stable regardless of sprite.scaleY, so no need to cache it. */
  private shadowY(ownerSprite: Phaser.GameObjects.Sprite): number {
    return ownerSprite.y - ownerSprite.height * SHADOW_Y_OFFSET_RATIO;
  }

  /** Reads the shared input ref and drives the player's Arcade body velocity every frame - the
   *  actual "continuous, Arcade-Physics-driven movement" this migration exists for. Deliberately
   *  does NOT touch `playerSprite.x/y` or anything derived from it (depth-sort, equipment-layer
   *  mirroring, the throttled React position report) - see syncAfterPhysicsStep's own comment for
   *  why that has to happen in a separate, later hook instead of here. */
  update(_time: number, delta: number): void {
    this.advanceAnimatedTiles(delta);

    const sprite = this.playerSprite;
    if (!sprite || !sprite.body) return;
    const body = sprite.body as Phaser.Physics.Arcade.Body;

    const input = !this.suspended && this.inputRef ? this.inputRef.current : null;
    let dx = 0;
    let dy = 0;
    if (input) {
      if (input.left) dx -= 1;
      if (input.right) dx += 1;
      if (input.up) dy -= 1;
      if (input.down) dy += 1;
    }
    const dashHeld = input?.dashHeld ?? false;

    // Dash with no directional input held runs in the last-faced direction - mirrors the old
    // discrete model's mobile UX (MobileHud's Dash button has no directional companion of its
    // own on a touchscreen with no keyboard - see that file's doc comment).
    if (dashHeld && dx === 0 && dy === 0) {
      const delta2 = FACING_TO_DELTA[this.facing];
      dx = delta2.dx;
      dy = delta2.dy;
    }

    if (dx !== 0 && dy !== 0) {
      dx *= Math.SQRT1_2;
      dy *= Math.SQRT1_2;
    }

    const speedTilesPerSec = dashHeld ? DASH_SPEED_TILES_PER_S : WALK_SPEED_TILES_PER_S;
    const speedPxPerSec = speedTilesPerSec * this.tileSize;
    body.setVelocity(dx * speedPxPerSec, dy * speedPxPerSec);

    if (dx !== 0 || dy !== 0) {
      this.facing = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : dy > 0 ? 'down' : 'up';
    }
    this.currentMovementState = dx === 0 && dy === 0 ? 'idle' : dashHeld ? 'running' : 'walking';

    this.applyPlayerAnimation(this.currentMovementState);
  }

  /** Cycles every Tiled-animated tile group (water, sewer, etc. - see animatedTileGroups' own doc
   *  comment) forward by this frame's delta. `cycleMs` resolves fresh from 0 every call rather than
   *  tracking "time since last frame change" so a huge delta (a backgrounded tab) lands directly on
   *  the correct frame instead of stepping through every intermediate one. Cheap no-op for the
   *  overwhelming majority of maps, which declare no animated tiles at all. */
  private advanceAnimatedTiles(deltaMs: number): void {
    for (const group of this.animatedTileGroups) {
      if (group.frames.length <= 1) continue;
      group.cycleMs = (group.cycleMs + deltaMs) % group.totalDurationMs;
      let acc = 0;
      let frameIndex = group.frames.length - 1;
      for (let i = 0; i < group.frames.length; i++) {
        acc += group.frames[i].durationMs;
        if (group.cycleMs < acc) {
          frameIndex = i;
          break;
        }
      }
      if (frameIndex === group.frameIndex) continue;
      group.frameIndex = frameIndex;
      const frame = group.frames[frameIndex];
      for (const placement of group.placements) {
        const tile = placement.layer.putTileAt(frame.gid - 1, placement.tx, placement.ty);
        if (placement.rotation) tile.rotation = placement.rotation;
        if (placement.flipX) tile.flipX = placement.flipX;
      }
    }
  }

  /** Runs after Arcade Physics has fully resolved this frame's movement/collisions AND already
   *  written the result back into playerSprite.x/y - everything here that reads playerSprite.x/y
   *  has to run at this point, not from update() above. Phaser's own per-frame Scene event order
   *  is PRE_UPDATE -> UPDATE (world.update: computes body.position, does NOT touch the GameObject
   *  yet) -> the scene's own update() (where velocity gets set, above) -> POST_UPDATE
   *  (world.postUpdate -> Body.postUpdate: THIS is what actually copies body.position into
   *  playerSprite.x/y - see node_modules/phaser/src/physics/arcade/Body.js's own postUpdate doc
   *  comment: "Feeds the Body results back into the parent Game Object"). Reading
   *  playerSprite.x/y from inside update() therefore returns the PREVIOUS frame's resolved
   *  position, one full frame stale - which is exactly what made every equipment layer (mirrored
   *  from that stale read) visibly trail behind the base sprite while moving, and disappear the
   *  instant movement stopped (once velocity is 0, position stops changing frame to frame, so
   *  "stale" and "current" happen to read the same value) - reported live and confirmed by
   *  reading Phaser's own source, not just guessed at. Registered once, in create(), via
   *  `this.events.on(Phaser.Scenes.Events.POST_UPDATE, this.syncAfterPhysicsStep, this)` - the
   *  Arcade Physics plugin registers its own POST_UPDATE listener (world.postUpdate) during scene
   *  boot, before create() ever runs (see ArcadePhysics.start()), so ours is guaranteed to fire
   *  second on every frame, after the GameObject sync has already happened. */
  private syncAfterPhysicsStep(_time: number, delta: number): void {
    const sprite = this.playerSprite;
    if (sprite) {
      for (const [, visual] of this.equipmentLayerSprites) {
        visual.sprite.setPosition(sprite.x, sprite.y);
      }
      const lanternVisual = this.equipmentLayerSprites.get('lantern');
      if (lanternVisual) {
        this.lightingLayer.updateLanternPosition(lanternVisual.sprite.x, this.lanternLightY(lanternVisual.sprite));
      }
      // + PLAYER_DEPTH_TIE_BIAS - reported live: walking up to a blocksMovement decor prop (e.g.
      // general-bonfire-01) from the south still rendered the prop over the player's head, despite
      // the player's/entity's collision-box math (both bottom-anchored at ENTITY/PLAYER_BODY_
      // HEIGHT_RATIO=0.3) working out to player.y > object.y once stopped at the collision edge -
      // so depthForY *should* already favor the player there. Whatever the exact remaining gap is,
      // this bias guarantees the player wins any close/near-tie against static scenery without
      // touching depthForY itself (entities are unaffected, so a genuinely-in-front tall object
      // still correctly occludes the player from a real distance).
      const playerDepth = this.depthForY(sprite.y) + PLAYER_DEPTH_TIE_BIAS;
      sprite.setDepth(playerDepth);
      for (const [slot, visual] of this.equipmentLayerSprites) {
        visual.sprite.setDepth(playerDepth + (EQUIPMENT_LAYER_DEPTH_OFFSET[slot] ?? 0.5));
      }
      this.playerShadow?.setPosition(sprite.x, this.shadowY(sprite)).setDepth(playerDepth - 0.5);
      if (this.currentMovementState === 'running' && this.time.now - this.lastDashDustAtMs > 150) {
        this.lastDashDustAtMs = this.time.now;
        this.spawnDashDust(sprite.x, sprite.y);
      }
      if (this.currentMovementState === 'walking' || this.currentMovementState === 'running') {
        const footstepIntervalMs = this.currentMovementState === 'running' ? 220 : 350;
        if (this.time.now - this.lastFootstepAtMs > footstepIntervalMs) {
          this.lastFootstepAtMs = this.time.now;
          const variant = this.currentMovementState === 'running' ? 'run' : 'walk';
          playSound(`sfx.footstep.${this.currentFootstepSurface}.${variant}`);
        }
      }
      this.flushPositionUpdate(delta, this.currentMovementState);
      this.checkZoneAndTransitionOverlaps();
      this.checkFieldEncounterProximity();
    }
    for (const visual of this.entityVisuals.values()) {
      const entityDepth = this.depthForY(visual.sprite.y);
      visual.sprite.setDepth(entityDepth);
      visual.shadow?.setPosition(visual.sprite.x, this.shadowY(visual.sprite)).setDepth(entityDepth - 0.5);
      // Another player's equipped-gear layers (see upsertEntity) glued to their own base sprite
      // every frame, same "position always mirrors the base" contract as the local player's own
      // equipmentLayerSprites sync just above in this same method.
      if (visual.layerSprites) {
        for (const [slot, layerVisual] of visual.layerSprites) {
          layerVisual.sprite
            .setPosition(visual.sprite.x, visual.sprite.y)
            .setDepth(entityDepth + (EQUIPMENT_LAYER_DEPTH_OFFSET[slot] ?? 0.5));
        }
      }
    }
    this.drawDebugOverlay();
  }

  /** Native-pixel object rect, scaled to render space, tested against the player's current Arcade
   *  body bounds - shared by checkZoneAndTransitionOverlaps and primeOverlapState so the "is this
   *  object currently overlapped" math can't drift between the two call sites. */
  private isOverlappingPlayer(obj: MapObject, body: Phaser.Physics.Arcade.Body): boolean {
    const rx = obj.pixelX * this.viewportScale;
    const ry = obj.pixelY * this.viewportScale;
    const rw = obj.pixelWidth * this.viewportScale;
    const rh = obj.pixelHeight * this.viewportScale;
    return body.x < rx + rw && body.x + body.width > rx && body.y < ry + rh && body.y + body.height > ry;
  }

  /** Leading-edge zone/transition entry, replacing the old discrete model's "compare this step's
   *  landed tile against the previous one" check (see useLocationExploration.ts's git history) -
   *  same idea, just driven by a real per-frame rectangle overlap against the player's Arcade body
   *  instead of a once-per-discrete-step tile comparison. Only fires on the frame overlap starts,
   *  not on every frame spent inside (zoneOverlapState/transitionOverlapState track "was this
   *  object being overlapped last frame" - see their own doc comment for why they're keyed by
   *  object reference, not refId). */
  private checkZoneAndTransitionOverlaps(): void {
    const sprite = this.playerSprite;
    if (!sprite || !sprite.body) return;
    const body = sprite.body as Phaser.Physics.Arcade.Body;
    // loadMap and setPlayer are two independent async chains (separate React effects racing their
    // own texture loads) - by the time THIS first runs after a real map swap, either one could have
    // finished first. Priming lazily here, keyed by currentMapKey (only reset when a swap actually
    // completes on the loadMap side - see loadMap's own currentMapObjects assignment), fires
    // exactly once per real swap regardless of which side won the race, rather than trying to prime
    // from a single call site and risking currentMapObjects still referencing the PREVIOUS
    // location's objects if setPlayer happened to resolve first. See primeOverlapState's own
    // comment for what "priming" prevents (spawning directly on a transition/zone tile re-firing it
    // immediately - confirmed live, the same bug class the old rounded-tile bridge had).
    if (this.overlapStatePrimedForMapKey !== this.currentMapKey) {
      this.primeOverlapState();
      this.overlapStatePrimedForMapKey = this.currentMapKey;
    }
    const newActiveZoneRefIds = new Set<string>();
    for (const obj of this.currentMapObjects) {
      if ((obj.type !== 'zone' && obj.type !== 'transition') || !obj.refId) continue;
      const overlapping = this.isOverlappingPlayer(obj, body);
      const state = obj.type === 'zone' ? this.zoneOverlapState : this.transitionOverlapState;
      const wasOverlapping = state.get(obj) ?? false;
      state.set(obj, overlapping);
      if (overlapping && !wasOverlapping) {
        if (obj.type === 'zone') this.onZoneEnter?.(obj.refId);
        else this.onTransitionEnter?.(obj);
      }
      if (obj.type === 'zone' && overlapping) newActiveZoneRefIds.add(obj.refId);
    }
    if (!setsHaveSameMembers(newActiveZoneRefIds, this.activeZoneRefIds)) {
      this.activeZoneRefIds = newActiveZoneRefIds;
      this.onActiveZonesChange?.(Array.from(newActiveZoneRefIds));
    }
  }

  /** Seeds zone/transition overlap state to reflect wherever the player is RIGHT NOW, without
   *  firing any callback - called lazily by checkZoneAndTransitionOverlaps (see its own comment
   *  for why lazily, not from a single fixed call site) the first time it runs against a given
   *  map. Without this, an interior's exit door spawns the player back on top of the very
   *  transition tile that leads back into it, and loadMap's own state.clear() would otherwise
   *  leave that read as "wasn't overlapping a moment ago" on the very first real check -
   *  immediately re-entering the transition and bouncing between the two locations before
   *  anything settles. This is the exact same failure mode the OLD rounded-tile bridge had (fixed
   *  there by suppressing the first post-spawn tile evaluation) - the equivalent fix for a real
   *  per-frame overlap check is priming "already known to be overlapping" instead of skipping a
   *  check outright, since skipping isn't an option here (this runs continuously, not once). */
  private primeOverlapState(): void {
    const sprite = this.playerSprite;
    if (!sprite || !sprite.body) return;
    const body = sprite.body as Phaser.Physics.Arcade.Body;
    for (const obj of this.currentMapObjects) {
      if ((obj.type !== 'zone' && obj.type !== 'transition') || !obj.refId) continue;
      const state = obj.type === 'zone' ? this.zoneOverlapState : this.transitionOverlapState;
      state.set(obj, this.isOverlappingPlayer(obj, body));
    }
  }

  /** Leading-edge proximity trigger for field-encounter icons - replaces the old discrete model's
   *  "landed exactly on this tile" match (see useFieldEncounters.ts's consumeAt, still keyed by the
   *  icon's own exact tile coordinates - only how it gets CALLED changed, not its own contract).
   *  Distance-based rather than a rectangle overlap since an icon has no real "footprint" of its
   *  own the way a zone/transition does - it's a marker at a point. */
  private checkFieldEncounterProximity(): void {
    const sprite = this.playerSprite;
    if (!sprite || !this.onFieldEncounterNear) return;
    const radiusPx = FIELD_ENCOUNTER_PROXIMITY_RADIUS_TILES * this.tileSize;
    const seenIds = new Set<string>();
    for (const icon of this.fieldEncounterIcons) {
      seenIds.add(icon.id);
      const iconX = icon.x * this.tileSize + this.tileSize / 2;
      const iconY = icon.y * this.tileSize + this.tileSize;
      const dx = sprite.x - iconX;
      const dy = sprite.y - iconY;
      const near = dx * dx + dy * dy <= radiusPx * radiusPx;
      const wasNear = this.fieldEncounterOverlapState.get(icon.id) ?? false;
      this.fieldEncounterOverlapState.set(icon.id, near);
      if (near && !wasNear) this.onFieldEncounterNear(icon);
    }
    // Drop tracking for any icon no longer in the live list (consumed/respawned elsewhere) so a
    // reused id can't inherit a stale "was near" flag - ids are already time-stamped/unique in
    // practice (see useFieldEncounters.ts), but this costs nothing and removes the assumption.
    for (const id of this.fieldEncounterOverlapState.keys()) {
      if (!seenIds.has(id)) this.fieldEncounterOverlapState.delete(id);
    }
  }

  private static rectsOverlap(
    a: { x: number; y: number; width: number; height: number },
    b: { x: number; y: number; width: number; height: number },
  ): boolean {
    return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
  }

  /** A MapObject's native-pixel footprint, scaled to render space - same conversion used
   *  throughout this file (drawDebugOverlay, checkZoneAndTransitionOverlaps). */
  private objectRect(obj: MapObject): { x: number; y: number; width: number; height: number } {
    return {
      x: obj.pixelX * this.viewportScale,
      y: obj.pixelY * this.viewportScale,
      width: obj.pixelWidth * this.viewportScale,
      height: obj.pixelHeight * this.viewportScale,
    };
  }

  /** An entity sprite's approximate footprint for interaction purposes - entities (NPCs, other
   *  players) don't carry a real pixel footprint the way MapObjects do, so this reuses the same
   *  "shadow footprint" ratio the entity's own collision body would use if it had one (see
   *  ENTITY_BODY_WIDTH/HEIGHT_RATIO), computed directly from the sprite's current displayed size/
   *  position rather than requiring an actual Arcade body - a presence (other player) entity never
   *  gets one (see GridEntity.blocksMovement's own doc comment), so this has to work without it. */
  private entityInteractionRect(sprite: Phaser.GameObjects.Sprite): { x: number; y: number; width: number; height: number } {
    const w = sprite.width * sprite.scaleX * ENTITY_BODY_WIDTH_RATIO;
    const h = sprite.height * sprite.scaleY * ENTITY_BODY_HEIGHT_RATIO;
    // Feet-anchor origin (0.5, 1) - same convention as every sprite in this file.
    return { x: sprite.x - w / 2, y: sprite.y - h, width: w, height: h };
  }

  /** The directional interaction probe rectangle, extending out from the player's body edge in the
   *  current facing direction - see INTERACTION_PROBE_LENGTH/WIDTH_TILES' own comment. */
  private interactionProbeRect(body: Phaser.Physics.Arcade.Body): { x: number; y: number; width: number; height: number } {
    const lengthPx = INTERACTION_PROBE_LENGTH_TILES * this.tileSize;
    const widthPx = INTERACTION_PROBE_WIDTH_TILES * this.tileSize;
    const centerX = body.x + body.width / 2;
    const centerY = body.y + body.height / 2;
    switch (this.facing) {
      case 'up':
        return { x: centerX - widthPx / 2, y: body.y - lengthPx, width: widthPx, height: lengthPx };
      case 'down':
        return { x: centerX - widthPx / 2, y: body.y + body.height, width: widthPx, height: lengthPx };
      case 'left':
        return { x: body.x - lengthPx, y: centerY - widthPx / 2, width: lengthPx, height: widthPx };
      case 'right':
        return { x: body.x + body.width, y: centerY - widthPx / 2, width: lengthPx, height: widthPx };
    }
  }

  /** Finds whatever the player is currently facing and genuinely adjacent to - replaces the old
   *  discrete model's "check the exact tile one step ahead of the player" targeting (see
   *  TownScene.tsx/OverworldScene.tsx/DungeonScene.tsx's attemptInteract, all three identical) with
   *  a real pixel-space probe rectangle. Checked in the same priority order the old per-scene code
   *  used (NPC, then another player, then a static interactable) so an NPC standing next to a chest
   *  still resolves to talking, not looting. Returns the SAME kind of identifier each caller already
   *  knows how to look its own data up by: an npc/interactable's `refId`, or a presence entity's own
   *  GridEntity `id` (e.g. `player-<uid>`, so the caller can match it back to a live presence doc
   *  exactly the way it already does for rendering). */
  queryInteraction(): { kind: 'npc' | 'presence' | 'interactable'; id: string } | null {
    const sprite = this.playerSprite;
    if (!sprite || !sprite.body) return null;
    const body = sprite.body as Phaser.Physics.Arcade.Body;
    const probe = this.interactionProbeRect(body);

    for (const [id, visual] of this.entityVisuals) {
      if (visual.interactionKind !== 'npc') continue;
      if (ExplorationScene.rectsOverlap(probe, this.entityInteractionRect(visual.sprite))) {
        return { kind: 'npc', id };
      }
    }
    for (const [id, visual] of this.entityVisuals) {
      if (visual.interactionKind !== 'presence') continue;
      if (ExplorationScene.rectsOverlap(probe, this.entityInteractionRect(visual.sprite))) {
        return { kind: 'presence', id };
      }
    }
    for (const obj of this.currentMapObjects) {
      if (obj.type !== 'interactable' || !obj.refId) continue;
      if (ExplorationScene.rectsOverlap(probe, this.objectRect(obj))) {
        return { kind: 'interactable', id: obj.refId };
      }
    }
    return null;
  }

  /** Plays/stops the base sprite's (and every equipment layer's) walk/run animation, or pins the
   *  idle frame - driven every frame by the Scene's own live facing/movementState now, not passed
   *  in from React (see setPlayer's own comment: React's copy of these is a throttled ~15Hz
   *  mirror, too stale to drive per-frame animation switching cleanly). */
  private applyPlayerAnimation(movementState: MovementState): void {
    const sprite = this.playerSprite;
    if (!sprite || !this.playerTextureKey) return;
    const idleFrame = resolveDisplayRow(PLAYER_ANIMATION_LAYOUT, movementState, this.facing) * PLAYER_ANIMATION_LAYOUT.frameCount;

    if (getAssetDefinition(this.playerTextureKey).frameSize) {
      if (movementState === 'walking' || movementState === 'running') {
        const key = animationKey(this.playerTextureKey, movementState, this.facing);
        if (!sprite.anims.isPlaying || sprite.anims.currentAnim?.key !== key) sprite.play(key);
      } else {
        sprite.anims.stop();
        sprite.setFrame(idleFrame);
      }
    }

    // Every equipment layer must show the SAME limb frame as the base at all times. This does NOT
    // give each layer its own independent Animation instance to play (an earlier version of this
    // code did - see git history) - two separately-timed Animation objects (Phaser ties an
    // animation's frame progress to the GameObject playing it, not to the animation key) staying
    // in lockstep purely by each independently advancing at "the same" rate is fragile: a restart
    // resynced them at that instant, but any later edge case (a layer created/equipped mid-cycle,
    // a second restart landing a tick apart, etc.) could knock them back out of phase with no way
    // to self-correct - reported live as a persistent frame-off look, most visible on legs/limb-
    // heavy layers, even after the base-vs-layer *position* bug was separately fixed. Instead,
    // every layer directly mirrors the base's own CURRENT texture frame every tick - every layer
    // sheet shares the base's exact row/frameCount/frame-numbering layout (see docs/Equipment-
    // Layering-Plan.md), so the base's own frame name/index applies unchanged to any layer's own
    // spritesheet. This is a pixel-perfect copy each frame, not two clocks hoping to agree - there
    // is nothing left to drift out of sync.
    for (const visual of this.equipmentLayerSprites.values()) {
      if (!getAssetDefinition(visual.spriteAssetId).frameSize) continue;
      if (visual.sprite.anims.isPlaying) visual.sprite.anims.stop();
      visual.sprite.setFrame(movementState === 'walking' || movementState === 'running' ? sprite.frame.name : idleFrame);
    }
  }

  /** Reports the physics-driven player position back to React, throttled to
   *  POSITION_FLUSH_INTERVAL_MS (see its own comment) - converts the sprite's render-scaled pixel
   *  position back to a fractional tile GridPosition using the exact inverse of setPlayer's own
   *  spawn-placement formula (`pos.x * tileSize + tileSize/2` / `pos.y * tileSize + tileSize`), so
   *  a stationary player's reported position round-trips to the same integer it was placed at. */
  private flushPositionUpdate(delta: number, movementState: MovementState): void {
    const sprite = this.playerSprite;
    if (!sprite || !this.onPositionChange) return;
    this.positionFlushAccumulatorMs += delta;
    if (this.positionFlushAccumulatorMs < POSITION_FLUSH_INTERVAL_MS) return;
    this.positionFlushAccumulatorMs = 0;
    this.onPositionChange(
      { x: sprite.x / this.tileSize - 0.5, y: sprite.y / this.tileSize - 1, facing: this.facing },
      movementState,
    );
  }

  /** (Re)registers the player-vs-level colliders - called once groundLayer/collisionStaticGroup
   *  exist (end of loadMap's real-swap branch) and once the player sprite itself first exists (end
   *  of setPlayer's first-creation branch), covering either possible ordering of those two async
   *  calls. Destroys any prior collider first since loadMap rebuilds groundLayer/
   *  collisionStaticGroup from scratch on every real location swap - a stale collider would still
   *  reference the just-destroyed previous map's layer/group. */
  private registerPlayerColliders(): void {
    if (!this.playerSprite) return;
    this.playerGroundCollider?.destroy();
    this.playerGroundCollider = this.groundLayer ? this.physics.add.collider(this.playerSprite, this.groundLayer) : null;
    this.playerRectCollider?.destroy();
    this.playerRectCollider = this.collisionStaticGroup
      ? this.physics.add.collider(this.playerSprite, this.collisionStaticGroup)
      : null;
    this.playerEntityCollider?.destroy();
    this.playerEntityCollider = this.entityCollisionGroup
      ? this.physics.add.collider(this.playerSprite, this.entityCollisionGroup)
      : null;
  }

  /** Collision/interaction-bounds overlay, toggled via F9 (see PhaserExplorationCanvas.tsx) - draws
   *  every piece of geometry this file's movement/collision/interaction code actually uses, in the
   *  same render-scaled space everything else here uses (see the physics-coordinate-space comment
   *  near VOID_TILE_INDEX), so it can be eyeballed directly against the real map art:
   *  - orange: ground tiles Arcade considers solid (walls, water, void-filled empty cells)
   *  - red: `collisions`-layer static bodies (fences, rocks, ledges)
   *  - cyan: every MapObject's native-pixel footprint (zones, transitions, npc/interactable points)
   *  - yellow: live entity collision bodies (NPCs, interactable entities - entityCollisionGroup)
   *  - green: the player's own Arcade body
   *  - magenta: the current directional interaction probe rectangle (queryInteraction) */
  private drawDebugOverlay(): void {
    const g = this.debugGraphics;
    if (!g || !this.debugEnabled) return;
    g.clear();
    if (this.groundLayer) {
      g.lineStyle(1, 0xff8800, 0.6);
      this.groundLayer.forEachTile((tile) => {
        if (!tile.collides) return;
        g.strokeRect(tile.pixelX * this.viewportScale, tile.pixelY * this.viewportScale, tile.width * this.viewportScale, tile.height * this.viewportScale);
      });
    }
    g.lineStyle(1, 0xff4444, 1);
    for (const rect of this.currentCollisionRects) {
      g.strokeRect(
        rect.x * this.viewportScale,
        rect.y * this.viewportScale,
        rect.width * this.viewportScale,
        rect.height * this.viewportScale,
      );
    }
    g.lineStyle(1, 0x44ccff, 1);
    for (const obj of this.currentMapObjects) {
      g.strokeRect(
        obj.pixelX * this.viewportScale,
        obj.pixelY * this.viewportScale,
        obj.pixelWidth * this.viewportScale,
        obj.pixelHeight * this.viewportScale,
      );
    }
    g.lineStyle(1, 0xffff44, 1);
    for (const visual of this.entityVisuals.values()) {
      if (!visual.sprite.body) continue;
      const body = visual.sprite.body as Phaser.Physics.Arcade.Body;
      g.strokeRect(body.x, body.y, body.width, body.height);
    }
    if (this.playerSprite?.body) {
      const body = this.playerSprite.body as Phaser.Physics.Arcade.Body;
      g.lineStyle(1, 0x66ff66, 1);
      g.strokeRect(body.x, body.y, body.width, body.height);
      g.lineStyle(1, 0xff44ff, 1);
      const probe = this.interactionProbeRect(body);
      g.strokeRect(probe.x, probe.y, probe.width, probe.height);
    }
  }

  /** Builds the tilemap for a location from the already-parsed TileMap (see the plan's "Tiled
   *  loading" section for why this doesn't re-feed raw Tiled JSON through Phaser's own loader) -
   *  a no-op if this exact location is already loaded, since this gets called on every relevant
   *  prop change from React, not just on a real location transition. */
  async loadMap(map: TileMap, tileSize: number): Promise<void> {
    this.tileSize = tileSize;
    // Kept current even on the early-return no-op path below (a resize/mobile-toggle while
    // staying in the same location still changes tileSize, and setPlayer/setEntities read this
    // independently of whether the tile layers themselves get rebuilt).
    this.viewportScale = tileSize / map.tileWidth;
    if (this.currentMapKey === map.locationId) return;
    this.mapJustChanged = true;
    this.mapGeneration++;
    const generation = this.mapGeneration;

    try {
      await Promise.all(map.tilesets.map((t) => loadSceneTexture(this, t.assetId)));
    } catch (err) {
      // A texture genuinely failed to load even after loadSceneTexture's own internal retry (a
      // real, if rare, transient network/CDN failure - confirmed live against Graveyard_Set.png
      // returning a bare 503) - deliberately does NOT set currentMapKey, so the *next* loadMap
      // call for this same location doesn't hit the "already loaded" early-return above and skip
      // retrying for real (e.g. leaving and re-entering the location). Also deliberately leaves
      // whatever tile layers are already on screen alone rather than tearing them down first -
      // showing the previous location's floor a moment longer beats a blank/broken scene for one
      // that can't actually be built right now.
      console.error(`ExplorationScene.loadMap: failed to load tileset textures for "${map.locationId}"`, err);
      throw err;
    }
    // A newer loadMap call (a second, rapid location transition) has since superseded this one -
    // abort rather than build tile layers for a location we've already left.
    if (generation !== this.mapGeneration) return;

    this.currentMapKey = map.locationId;
    this.currentFootstepSurface = footstepSurfaceFor(map.locationId);
    for (const layer of this.mapLayers) layer.destroy();
    this.mapLayers = [];
    this.animatedTileGroups = [];
    this.groundLayer = null;
    this.collisionStaticGroup?.clear(true, true);
    this.collisionStaticGroup = null;
    this.currentCollisionRects = map.collisionObjects;
    this.currentMapObjects = map.objects;
    this.lightingLayer.clearAllMapLights();
    this.zoneOverlapState.clear();
    this.transitionOverlapState.clear();
    this.activeZoneRefIds.clear();
    this.fieldEncounterOverlapState.clear();
    this.overlapStatePrimedForMapKey = null;

    // A tileset's own tile size can differ from the map's grid (e.g. a 32px prop sheet on a 16px-
    // grid map) - this project's tilesets are all configured in Tiled with "Tile Render Size: Map
    // Grid Size" + "Fill Mode: Preserve Aspect Ratio" (confirmed by hand against a real map,
    // whisper-falls.json), meaning Tiled draws every tile scaled DOWN to fit its own single grid
    // cell, never overflowing into neighbors. An earlier version of this code assumed the opposite
    // (tiles drawn at native size, overflowing bottom-left-anchored per Tiled's usual convention
    // for *unscaled* oversized tiles) - that was the wrong mental model for this project's actual
    // tileset config and only partially matched real Tiled output. Phaser's Tileset/Tile classes
    // have no "slice at native size, draw at a different size" mode of their own (the renderer
    // draws each tile at exactly `tileset.tileWidth/tileHeight`, the same value used to slice
    // frames from the source image), so the fix happens one level up: pre-scale the whole source
    // texture down to the map's grid size *before* handing it to addTilesetImage, so slicing and
    // drawing both naturally happen at the already-correct size - no per-tile position/scale hacks
    // needed. Every current tileset and map grid here is square, so a uniform whole-image resize is
    // exactly equivalent to Tiled's "preserve aspect ratio" fill mode (no letterboxing needed since
    // the aspect ratio never actually differs) - this doesn't handle a hypothetical non-square
    // mismatch, since nothing in this project has one yet.
    for (const t of map.tilesets) {
      if (t.tileWidth === map.tileWidth && t.tileHeight === map.tileHeight) continue;
      const scaledKey = scaledTilesetKey(t.assetId, map.tileWidth, map.tileHeight);
      if (this.textures.exists(scaledKey)) continue;
      const cached = scaledTilesetCanvasCache.get(scaledKey);
      if (cached) {
        this.textures.addCanvas(scaledKey, cached);
        continue;
      }
      const source = this.textures.get(t.assetId).getSourceImage() as HTMLImageElement | HTMLCanvasElement;
      const scale = Math.min(map.tileWidth / t.tileWidth, map.tileHeight / t.tileHeight);
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(source.width * scale);
      canvas.height = Math.round(source.height * scale);
      const ctx = canvas.getContext('2d')!;
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
      scaledTilesetCanvasCache.set(scaledKey, canvas);
      this.textures.addCanvas(scaledKey, canvas);
    }

    const ground = map.layers.find((l) => l.name === 'ground');
    const decorationLayers = map.layers
      .filter((l) => /^decorations-\d+$/.test(l.name))
      .sort((a, b) => Number(a.name.split('-')[1]) - Number(b.name.split('-')[1]));
    // 'overhang' (no suffix) and 'overhang-N' are both valid - mirrors decorations-N so a map only
    // needs a numbered suffix once it actually has more than one overhang layer to stack.
    const overhangLayers = map.layers
      .filter((l) => /^overhang(-\d+)?$/.test(l.name))
      .sort((a, b) => Number(a.name.split('-')[1] ?? 0) - Number(b.name.split('-')[1] ?? 0));
    const orderedLayers = [ground, ...decorationLayers, ...overhangLayers].filter((l): l is TileLayer => !!l);

    const tilemap = this.make.tilemap({
      tileWidth: map.tileWidth,
      tileHeight: map.tileHeight,
      width: map.width,
      height: map.height,
    });
    // One Phaser tileset object per embedded tileset the map declares, each anchored at its own
    // firstgid so a single layer can freely mix tiles from more than one source image (e.g. a grass
    // ground pack + a separate tree/prop pack) - standard Phaser/Tiled multi-tileset usage.
    // putTileAt below passes `gid - 1` (a 0-based index, since Tiled gid 0 means "empty"), so
    // addTilesetImage's own `gid` (its internal *0-based* index-space anchor - confirmed by reading
    // Phaser's source: BuildTilesetIndex populates `tiles[firstgid..firstgid+total-1]`, and the old
    // single-tileset call never passed a `gid` at all, defaulting to 0) must be `t.firstgid - 1`,
    // not the raw 1-based Tiled firstgid - passing the raw value left `tiles[0]` (and every other
    // index in tileset 0's range) unpopulated, throwing inside Phaser's PutTileAt on the very first
    // tile and aborting the whole layer build silently (the map rendered as a blank room).
    // A mismatched tileset now draws from its pre-scaled texture (built above) at the map's own
    // tile size - already scaled correctly, so no per-tile position/size adjustment is needed below.
    const tilesets = map.tilesets.map((t) => {
      const mismatched = t.tileWidth !== map.tileWidth || t.tileHeight !== map.tileHeight;
      const key = mismatched ? scaledTilesetKey(t.assetId, map.tileWidth, map.tileHeight) : t.assetId;
      const tileWidth = mismatched ? map.tileWidth : t.tileWidth;
      const tileHeight = mismatched ? map.tileHeight : t.tileHeight;
      return tilemap.addTilesetImage(t.assetId, key, tileWidth, tileHeight, 0, 0, t.firstgid - 1)!;
    });

    // A synthetic, fully-transparent 1-tile "void" tileset covering every currently-empty (gid<=0)
    // ground cell - see VOID_TILE_INDEX's own comment. Registered here (not create()) since it's
    // sized to this map's own tile dimensions, which can differ per map.
    const voidKey = voidTileTextureKey(map.tileWidth, map.tileHeight);
    if (!this.textures.exists(voidKey)) {
      const canvas = document.createElement('canvas');
      canvas.width = map.tileWidth;
      canvas.height = map.tileHeight;
      this.textures.addCanvas(voidKey, canvas);
    }
    const voidTileset = tilemap.addTilesetImage('void-tile', voidKey, map.tileWidth, map.tileHeight, 0, 0, VOID_TILE_INDEX)!;
    const tilesetsWithVoid = [...tilesets, voidTileset];

    // Groups placements that share the same *source* animated tile (by its global gid) so every
    // occurrence of, say, a water tile cycles through Tiled's declared frame sequence in lockstep -
    // built up across all layers here, then handed to this.animatedTileGroups once as arrays (see
    // that field's own doc comment for why cycleMs is wall-clock rather than frame-accumulated).
    const animatedGroupsByGid = new Map<number, (typeof this.animatedTileGroups)[number]>();

    let groundPhaserLayer: Phaser.Tilemaps.TilemapLayer | null = null;
    orderedLayers.forEach((layer, index) => {
      const isGround = layer.name === 'ground';
      const phaserLayer = tilemap.createBlankLayer(layer.name, tilesetsWithVoid, 0, 0, map.width, map.height)!;
      layer.data.forEach((gid, i) => {
        const tx = i % map.width;
        const ty = Math.floor(i / map.width);
        if (gid <= 0) {
          // Only the ground layer needs a real (collidable) tile at an empty cell - an irregularly
          // shaped map's missing edge tiles must still block movement, same as an explicit wall.
          // Decoration/overhang layers have no collision concept, so they keep the old skip.
          if (isGround) phaserLayer.putTileAt(VOID_TILE_INDEX, tx, ty);
          return;
        }
        // Tiled encodes a tile's horizontal-flip/vertical-flip/anti-diagonal-flip (rotation) state
        // as 3 flag bits in the gid's own high bits (e.g. rotating or mirroring a tile in Tiled's
        // "Flip Horizontally/Vertically"/rotate-90° editor commands) - a raw flagged gid is a huge
        // number nowhere near any real tileset's firstgid..firstgid+tilecount range, so passing it
        // straight to putTileAt (as `gid - 1`) threw and aborted the whole layer build, which is
        // what "the map won't load anymore" after rotating a tile in Tiled actually was. ParseGID
        // is Phaser's own Tiled-flag decoder (used internally by its native Tiled JSON loader,
        // reused here rather than hand-rolled) - strips the flag bits back to the real gid and
        // derives the rotation/mirror Phaser's own Tile class understands natively.
        const gidInfo = Phaser.Tilemaps.Parsers.Tiled.ParseGID(gid);
        const tile = phaserLayer.putTileAt(gidInfo.gid - 1, tx, ty);
        if (gidInfo.rotation || gidInfo.flipped) {
          tile.rotation = gidInfo.rotation;
          tile.flipX = gidInfo.flipped;
        }
        const frames = map.animatedTiles[gidInfo.gid];
        if (frames) {
          let group = animatedGroupsByGid.get(gidInfo.gid);
          if (!group) {
            group = {
              frames,
              totalDurationMs: frames.reduce((sum, f) => sum + f.durationMs, 0),
              cycleMs: 0,
              frameIndex: 0,
              placements: [],
            };
            animatedGroupsByGid.set(gidInfo.gid, group);
          }
          group.placements.push({ layer: phaserLayer, tx, ty, rotation: gidInfo.rotation, flipX: gidInfo.flipped });
        }
      });
      phaserLayer.setAlpha(layer.opacity).setVisible(layer.visible).setScale(this.viewportScale).setLighting(true);
      const overhangMatch = /^overhang(?:-(\d+))?$/.exec(layer.name);
      // Multiple overhang-N layers stack in numeric order among themselves, all still above every
      // decoration/entity layer (OVERHANG_DEPTH is already higher than any plausible decoration count).
      phaserLayer.setDepth(overhangMatch ? OVERHANG_DEPTH + Number(overhangMatch[1] ?? 0) : index);
      this.mapLayers.push(phaserLayer);
      if (isGround) groundPhaserLayer = phaserLayer;
    });
    this.groundLayer = groundPhaserLayer;
    this.animatedTileGroups = [...animatedGroupsByGid.values()];

    if (groundPhaserLayer) {
      const nonWalkableIndices = map.nonWalkableTileIds.map((gid) => gid - 1);
      (groundPhaserLayer as Phaser.Tilemaps.TilemapLayer).setCollision([VOID_TILE_INDEX, ...nonWalkableIndices]);
    }

    // One static Arcade body per Tiled 'collisions' rectangle, in render-scaled space (see the
    // physics-coordinate-space comment near VOID_TILE_INDEX) - built now for the debug overlay to
    // draw against real geometry; no collider is registered against the player until Phase 2.
    this.collisionStaticGroup = this.physics.add.staticGroup();
    for (const rect of map.collisionObjects) {
      const zone = this.add.zone(
        (rect.x + rect.width / 2) * this.viewportScale,
        (rect.y + rect.height / 2) * this.viewportScale,
        rect.width * this.viewportScale,
        rect.height * this.viewportScale,
      );
      this.physics.add.existing(zone, true);
      this.collisionStaticGroup.add(zone);
    }
    // Hand-placed `type:"light"` map objects - pure metadata markers (no sprite of their own),
    // for tile-painted glow (a window, a torch baked into a wall tileset) that isn't a separate
    // decor entity - see src/types/tilemap.ts's own doc comment on lightColor/lightIntensity.
    // Same top-left-rect pixel convention as the collision rects just above (isCenteredRect is
    // false for 'light' in tiledLoader.ts, matching 'zone').
    map.objects
      .filter((o) => o.type === 'light')
      .forEach((o, index) => {
        const x = (o.pixelX + o.pixelWidth / 2) * this.viewportScale;
        const y = (o.pixelY + o.pixelHeight / 2) * this.viewportScale;
        // Half-diagonal (center to corner), not the average of width/height - averaging badly
        // under-covers any non-square rectangle (a 52x48 object only got radius 25, nowhere near
        // its own corners at ~35), which is exactly the shape a wide/short window rect would be.
        // The 1.3x pad means the corners land at meaningful brightness, not just barely-nonzero at
        // the light's very edge (radius 0 = the point of zero attenuation - see the quadratic
        // falloff in DefineLights.glsl).
        const halfWidth = o.pixelWidth / 2;
        const halfHeight = o.pixelHeight / 2;
        const radius = Math.sqrt(halfWidth * halfWidth + halfHeight * halfHeight) * 1.3 * this.viewportScale;
        this.lightingLayer.setLight(`mapobj:${index}`, x, y, {
          color: parseLightColor(o.lightColor, DEFAULT_LIGHT_COLOR),
          radius,
          intensity: o.lightIntensity ?? DEFAULT_LIGHT_INTENSITY,
        });
      });
    this.registerPlayerColliders();
  }

  /** Loads the texture (if not already loaded) and registers PLAYER_ANIMATION_LAYOUT's walk/run
   *  animations against it (if it's a real spritesheet - a frameSize-less static image has no rows
   *  to animate). Side-effect-free w.r.t. playerTextureKey so it's safe to call for an equipment
   *  layer's own spriteAssetId too, not just the base player sprite - every layer sheet shares the
   *  base's exact row/frame layout (see docs/Equipment-Layering-Plan.md), so the same layout
   *  applies uniformly. */
  private async ensureAnimationsFor(spriteAssetId: string): Promise<void> {
    await loadSceneTexture(this, spriteAssetId);
    // Only a real spritesheet (frameSize set - today just the sprite.player fallback) has rows to
    // build a walk/run animation from. The male/female skins (Player.gender) are still a single
    // static frame with no frameSize - creating frame-numbered animations against those found zero
    // real frames every time (Phaser logs one warning per missing frame, then the broken Animation
    // object throws when setPlayer's walking/running branch below tries to play it), on every
    // single scene-level map transition since PhaserExplorationCanvas mounts a fresh
    // ExplorationScene per Town/Overworld/Dungeon switch. Matches setEntities' own `if
    // (def.frameSize)` guard for NPCs - this is that same guard, just missing here until now.
    if (getAssetDefinition(spriteAssetId).frameSize) {
      createCharacterAnimations(this.anims, spriteAssetId, PLAYER_ANIMATION_LAYOUT);
    }
  }

  private async ensurePlayerAnimations(spriteAssetId: string): Promise<void> {
    if (this.playerTextureKey === spriteAssetId) return;
    await this.ensureAnimationsFor(spriteAssetId);
    this.playerTextureKey = spriteAssetId;
  }

  /** Creates (once) or updates the player's texture/equipment-layer sprites - the player isn't
   *  part of `entities`, matching the old TileGrid's own player-is-rendered-separately convention.
   *  Position is no longer driven from here on every call: since Arcade Physics owns the player's
   *  frame-by-frame position now (see updatePlayerPhysics), `pos` is only consulted to (re)place
   *  the physics body on first creation or on a real location transition (`snapInstantly` - the
   *  same condition that used to gate "snap vs. tween" back when React drove position every step).
   *  Likewise, walk/run/idle animation switching moved to applyPlayerAnimation (called every frame
   *  from updatePlayerPhysics using the Scene's own live facing/movementState) rather than being
   *  driven by React-passed frameRow/movementState params here - React's copy of those is a
   *  throttled ~15Hz mirror of what Phaser already knows moment-to-moment, too stale to drive
   *  per-frame animation switching cleanly. `equipmentLayers` stacks one extra sprite per equipped
   *  slot with layer art (see docs/Equipment-Layering-Plan.md) - empty in practice until real
   *  layer art exists. */
  async setPlayer(
    pos: GridPosition,
    spriteAssetId: string,
    equipmentLayers: { slot: EquipmentSlot; spriteAssetId: string }[] = [],
  ): Promise<void> {
    this.playerGeneration++;
    const generation = this.playerGeneration;
    // Captured before ensurePlayerAnimations (which updates playerTextureKey itself) - true only
    // when an already-created sprite's skin actually changed mid-session (see UserProfile's Skin
    // tab); always false on the very first setPlayer call, since there's no sprite yet to retexture.
    const textureChanged = !!this.playerSprite && this.playerTextureKey !== spriteAssetId;
    await Promise.all([
      this.ensurePlayerAnimations(spriteAssetId),
      ...equipmentLayers.map((layer) => this.ensureAnimationsFor(layer.spriteAssetId)),
    ]);
    // A newer setPlayer call has since superseded this one - its own (more current) state has
    // already been applied, so don't let this stale continuation clobber it.
    if (generation !== this.playerGeneration) return;

    const snapInstantly = !this.playerSprite || this.mapJustChanged;
    this.mapJustChanged = false;
    const firstCreation = !this.playerSprite;
    if (firstCreation) {
      // Origin (0.5, 1) anchors the sprite's feet to its tile position rather than its center, so
      // taller-than-one-tile art (see the 3/4-view scale spec and REFERENCE_VIEWPORT_SCALE above)
      // lines up with the ground instead of floating with its vertical midpoint on the tile - the
      // 48x64 player placeholder is already taller than one 48px tile at desktop's reference scale.
      const sprite = this.add.sprite(0, 0, spriteAssetId).setOrigin(0.5, 1).setDepth(ENTITY_DEPTH).setLighting(true);
      this.physics.add.existing(sprite);
      const body = sprite.body as Phaser.Physics.Arcade.Body;
      // Deliberately smaller than the full sprite frame, biased toward the feet - see
      // PLAYER_BODY_WIDTH_RATIO/HEIGHT_RATIO's own comment.
      const bodyWidth = sprite.width * PLAYER_BODY_WIDTH_RATIO;
      const bodyHeight = sprite.height * PLAYER_BODY_HEIGHT_RATIO;
      body.setSize(bodyWidth, bodyHeight);
      body.setOffset((sprite.width - bodyWidth) / 2, sprite.height - bodyHeight);
      this.playerSprite = sprite;
      this.playerShadow = this.createShadowFor(sprite);
      // setCamera has its own `if (this.playerSprite) camera.startFollow(...)` check, but
      // setCamera and setPlayer are two independent React effects that can run in either order -
      // and setPlayer's own texture load (ensurePlayerAnimations, just awaited above) means the
      // sprite frequently doesn't exist yet the first time setCamera runs, especially on a slower
      // connection. Establishing follow here too, the instant the sprite actually exists, means
      // camera tracking works on the very first load regardless of which effect wins the race,
      // instead of only recovering once some later, unrelated resize re-triggers setCamera
      // (confirmed by hand: this is exactly why rotating the phone "fixed" a dead camera - the
      // resize was incidentally the first thing to re-run setCamera after the sprite existed).
      // roundPixels=true (2nd arg) - the player now sits at a fractional pixel position almost
      // constantly while walking (continuous Arcade Physics, not tile-snapped), so an un-rounded
      // camera scroll is fractional nearly all the time instead of just briefly mid-tween like the
      // old discrete model. A fractional camera scroll lets every sprite's texture sampling bleed a
      // texel into its neighboring frame in the packed spritesheet (frames have no padding) -
      // reported live as a visible ghosting/bleed "in all directions" around every character
      // sprite (base and equipment layers alike) once movement went continuous.
      this.cameras.main.startFollow(sprite, true);
      // groundLayer/collisionStaticGroup may already exist if loadMap's own real-swap branch
      // finished before this first setPlayer call did (the two are independent React effects,
      // either can win the race) - safe to call unconditionally either way, see its own comment.
      this.registerPlayerColliders();
    }
    const sprite = this.playerSprite!;
    if (textureChanged) {
      // The player changed skin mid-session (Profile's Skin tab) - swap the existing sprite's
      // texture instead of leaving it stuck on whichever skin it was first created with.
      sprite.setTexture(spriteAssetId);
    }
    this.playerTextureKey = spriteAssetId;
    sprite.setScale(ENTITY_VISUAL_SCALE);

    if (snapInstantly) {
      const targetX = pos.x * this.tileSize + this.tileSize / 2;
      const targetY = pos.y * this.tileSize + this.tileSize;
      sprite.setPosition(targetX, targetY);
      const body = sprite.body as Phaser.Physics.Arcade.Body;
      body.reset(targetX, targetY);
      this.facing = pos.facing;
      this.applyPlayerAnimation('idle');
    }

    // Equipment layers: one child sprite per equipped slot with layer art. Position/animation are
    // driven every frame by updatePlayerPhysics/applyPlayerAnimation now (see this method's own
    // comment) - this just creates/retextures/tears down the sprites and snaps them alongside the
    // base sprite on a real transition.
    const seenSlots = new Set<EquipmentSlot>();
    for (const layer of equipmentLayers) {
      seenSlots.add(layer.slot);
      let visual = this.equipmentLayerSprites.get(layer.slot);
      if (!visual) {
        const layerSprite = this.add
          .sprite(sprite.x, sprite.y, layer.spriteAssetId)
          .setOrigin(0.5, 1)
          .setDepth(ENTITY_DEPTH + (EQUIPMENT_LAYER_DEPTH_OFFSET[layer.slot] ?? 0.5))
          .setLighting(true);
        visual = { sprite: layerSprite, spriteAssetId: layer.spriteAssetId };
        this.equipmentLayerSprites.set(layer.slot, visual);
      } else if (visual.spriteAssetId !== layer.spriteAssetId) {
        // Same retexture-must-stop-the-old-animation-first fix as upsertEntity's own retexture
        // branch (see that method's comment) - a still-playing animation from the old asset would
        // otherwise keep overwriting the sprite's frame back onto the just-replaced texture.
        visual.sprite.anims.stop();
        visual.sprite.setTexture(layer.spriteAssetId);
        visual.spriteAssetId = layer.spriteAssetId;
      }
      visual.sprite.setScale(sprite.scaleX, sprite.scaleY);
      if (snapInstantly) visual.sprite.setPosition(sprite.x, sprite.y);
    }
    // A slot that had a layer sprite before but isn't in this call's list anymore (unequipped, or
    // switched to an item with no layer art) gets its sprite torn down.
    for (const [slot, visual] of this.equipmentLayerSprites) {
      if (!seenSlots.has(slot)) {
        visual.sprite.destroy();
        this.equipmentLayerSprites.delete(slot);
      }
    }
    this.syncLanternLight();
  }

  /** Whether the player's lantern light should be on right now: a lantern is equipped (has a real
   *  layer sprite - see equipmentLayerSprites) *and* the current phase is sunset or night (not
   *  sunrise, not day - see lightingEffects.ts's setLanternActive doc comment for why sunrise is
   *  deliberately excluded). Called whenever either input could have changed - after setPlayer's
   *  equipment-layer sync above, and from setTimePhase. */
  private syncLanternLight(): void {
    const lanternVisual = this.equipmentLayerSprites.get('lantern');
    const shouldBeActive = !!lanternVisual && (this.currentTimePhase === 'sunset' || this.currentTimePhase === 'night');
    const x = lanternVisual?.sprite.x ?? 0;
    const y = lanternVisual ? this.lanternLightY(lanternVisual.sprite) : 0;
    this.lightingLayer.setLanternActive(shouldBeActive, x, y);
  }

  /** The lantern equipment layer sprite is anchored at origin (0.5, 1) - bottom-center, same as
   *  every other sprite - so its own `.y` sits at the player's feet, not where the lantern art
   *  itself actually is (held around hip/hand height). 0.6 of the way up from feet to the top of
   *  the sprite reads as "emitting from the lantern," not "emitting from the ground" (reported
   *  live as looking like it came from the feet at the naive `.y` position) - lower than a full
   *  half-height offset (that would center on the torso, too high for a hand-held light). */
  private lanternLightY(sprite: Phaser.GameObjects.Sprite): number {
    return sprite.y - sprite.displayHeight * 0.6;
  }

  /** One small puff of dust, at ground level (behind the player sprite) rather than on top of
   *  it - a short-lived one-shot emitter, same explode()-then-destroy pattern as BattleScene's
   *  defeat effect. Uses the real FX-pack smoke-puff sheet once loaded; falls back to the
   *  generated dot texture (tinted dust-brown) for the rare dash that fires before create()'s
   *  fire-and-forget load finishes. Not routed through battleEffects' playFxBurst - this needs its
   *  own emitter reference to set depth (dust renders behind the player sprite), which that shared
   *  helper doesn't expose. */
  private spawnDashDust(x: number, y: number): void {
    const useFx = this.textures.exists(DASH_DUST_FX_ASSET_ID);
    const emitter = this.add.particles(x, y, useFx ? DASH_DUST_FX_ASSET_ID : PARTICLE_TEXTURE_KEY, {
      ...(useFx ? { frame: [0, 1, 2, 3] } : { tint: DASH_DUST_COLOR }),
      speed: { min: 15, max: 40 },
      lifespan: 280,
      scale: { start: 0.8, end: 0 },
      quantity: 4,
      emitting: false,
    });
    emitter.setDepth(ENTITY_DEPTH - 1);
    emitter.explode(4);
    this.time.delayedCall(320, () => emitter.destroy());
  }

  /** Loads every one of `entities`' own sprite textures up front (batched, same Promise.all
   *  pattern loadMap already uses for tileset textures), without creating any sprites - called by
   *  PhaserExplorationCanvas alongside loadMap on a real location transition, so the "loading..."
   *  overlay stays up until NPCs/interactables are actually ready to render and collide, not just
   *  the ground tiles. Without this, setEntities (below) still worked correctly, just too late:
   *  each entity's texture loads lazily, one Promise per entity, only once upsertEntity itself
   *  gets called - so for however long that takes (fine on a fast connection/cached texture, a
   *  real multi-second wait on a slow one - reported live as most visible on mobile, where a
   *  weaker CPU/GPU and often-slower network both stretch that window and make the resulting
   *  frame-rate stutter far more noticeable than the same contention is on desktop), the player
   *  could already move and walk straight through a spot an NPC/interactable was about to occupy,
   *  since neither its sprite nor its Arcade body exists yet. Safe to call with an empty/duplicate
   *  list - loadSceneTexture no-ops for anything already cached. */
  async preloadEntityTextures(entities: GridEntity[]): Promise<void> {
    await Promise.all([
      ...entities.map((e) => loadSceneTexture(this, e.spriteAssetId)),
      ...entities.flatMap((e) => (e.equipmentLayers ?? []).map((layer) => loadSceneTexture(this, layer.spriteAssetId))),
    ]);
  }

  /** Reconciles entity sprites/labels/badges against the incoming array - the manual equivalent
   *  of React's `.map()`+`key` reconciliation, which doesn't exist in Phaser. */
  setEntities(entities: GridEntity[]): void {
    this.entityGeneration++;
    const generation = this.entityGeneration;
    const seen = new Set<string>();
    for (const entity of entities) {
      seen.add(entity.id);
      this.upsertEntity(entity, generation);
    }
    for (const [id, visual] of this.entityVisuals) {
      if (seen.has(id)) continue;
      this.lightingLayer.setLight(`entity:${id}`, 0, 0, null);
      visual.sprite.destroy();
      visual.label?.destroy();
      visual.badge?.destroy();
      if (visual.questMarker) this.tweens.killTweensOf(visual.questMarker);
      visual.questMarker?.destroy();
      visual.shadow?.destroy();
      if (visual.layerSprites) for (const layerVisual of visual.layerSprites.values()) layerVisual.sprite.destroy();
      this.entityVisuals.delete(id);
    }
  }

  private async upsertEntity(entity: GridEntity, generation: number): Promise<void> {
    let visual = this.entityVisuals.get(entity.id);
    let justCreated = false;
    if (!visual) {
      justCreated = true;
      await loadSceneTexture(this, entity.spriteAssetId);
      // A newer setEntities call has since superseded this one (the player left this location
      // before the texture finished loading) - abort rather than create an orphaned sprite for
      // an entity that's no longer part of the current location's entity list.
      if (generation !== this.entityGeneration) return;
      // Same feet-anchor origin as the player sprite (setPlayer above) - see its comment.
      const sprite = this.add.sprite(0, 0, entity.spriteAssetId).setOrigin(0.5, 1).setDepth(ENTITY_DEPTH).setLighting(true);
      if (entity.blocksMovement) {
        // A dynamic (not static) body on purpose - a wandering NPC's sprite moves via the tween
        // below, not via velocity, and Arcade re-derives a dynamic body's position from its
        // GameObject's transform every step regardless of what moved it, so the collider always
        // sees the entity's real current position. Membership in entityCollisionGroup is what
        // actually makes it collide with the player - see that field's own doc comment for why no
        // manual cleanup is needed when this entity is later destroyed (setEntities' reconciliation).
        this.physics.add.existing(sprite);
        const body = sprite.body as Phaser.Physics.Arcade.Body;
        body.moves = false;
        const bodyWidth = sprite.width * ENTITY_BODY_WIDTH_RATIO;
        const bodyHeight = sprite.height * ENTITY_BODY_HEIGHT_RATIO;
        body.setSize(bodyWidth, bodyHeight);
        body.setOffset((sprite.width - bodyWidth) / 2, sprite.height - bodyHeight);
        this.entityCollisionGroup?.add(sprite);
      }
      // A shadow reads as ground contact - only meaningful for actual characters (NPCs, other
      // players, field-encounter enemy icons/bosses via hasShadow), not buildings/exit
      // markers/decor/shrines/chests, which already sit flush on the map art.
      const shadow =
        entity.interactionKind === 'npc' || entity.interactionKind === 'presence' || entity.hasShadow
          ? this.createShadowFor(sprite)
          : undefined;
      visual = { sprite, spriteAssetId: entity.spriteAssetId, interactionKind: entity.interactionKind, shadow };
      this.entityVisuals.set(entity.id, visual);
      // Mirrors ensurePlayerAnimations - a static single-frame sprite (no frameSize) has no rows to
      // register at all. Safe to call unconditionally for every frameSize'd entity sharing this
      // sheet (createCharacterAnimations already skips already-registered keys).
      if (getAssetDefinition(entity.spriteAssetId).frameSize) {
        createCharacterAnimations(this.anims, entity.spriteAssetId, animationLayoutForSprite(entity.spriteAssetId));
      }
    } else if (visual.spriteAssetId !== entity.spriteAssetId) {
      // Same entity id (e.g. another player's presence doc, or a chest whose refId now resolves to
      // structure.chest-open once opened), different sprite - most notably another player switching
      // skins via Profile mid-session. Load (if not already cached) and retexture in place rather
      // than leaving the sprite stuck on its original asset.
      await loadSceneTexture(this, entity.spriteAssetId);
      if (generation !== this.entityGeneration) return;
      // Must stop any animation still playing from the OLD asset before retexturing, not just when
      // the new asset happens to have no frameSize - an active Phaser animation references frames
      // tied to the texture key it was created against, so it keeps overwriting the sprite's frame
      // back to the old texture every tick even after setTexture() below, regardless of whether the
      // new asset ends up needing its own animation immediately after. Reported live as a chest
      // staying visually "glowing/closed" after being opened until the location was reloaded - the
      // glow-loop animation (registered against structure.chest) kept fighting the retexture to
      // structure.chest-open (no frameSize, so the frameSize-gated stop() below never ran for it).
      visual.sprite.anims.stop();
      visual.sprite.setTexture(entity.spriteAssetId);
      visual.spriteAssetId = entity.spriteAssetId;
      if (getAssetDefinition(entity.spriteAssetId).frameSize) {
        createCharacterAnimations(this.anims, entity.spriteAssetId, animationLayoutForSprite(entity.spriteAssetId));
      }
    }

    const def = getAssetDefinition(entity.spriteAssetId);
    const x = entity.x * this.tileSize + this.tileSize / 2;
    const y = entity.y * this.tileSize + this.tileSize;
    visual.sprite.setScale(ENTITY_VISUAL_SCALE * (entity.displayScale ?? 1));
    // Keyed by the *resolved* sprite asset id, not entity.id/refId - see src/data/lightSources.ts.
    // Covers both a freshly-created entity and one that just retextured (a chest going
    // structure.chest -> structure.chest-open loses its light right here, same call). Read after
    // setScale (not before) so displayHeight reflects the real current scale - the sprite's
    // origin is (0.5, 1), bottom-center, so its feet sit at `y` and its visual center sits
    // `displayHeight / 2` above that; without this offset the light sat at ground level under the
    // object instead of glowing from its middle (reported live for a chest/shrine).
    this.lightingLayer.setLight(`entity:${entity.id}`, x, y - visual.sprite.displayHeight / 2, LIGHT_SOURCES[entity.spriteAssetId] ?? null);
    if (def.frameSize) {
      const row = entity.frameRow ?? 0;
      const column = entity.frameColumn ?? 0;
      const layout = animationLayoutForSprite(entity.spriteAssetId);
      if (entity.movementState === 'walking' || entity.movementState === 'running') {
        // Mirrors setPlayer's own walking/running branch, including its facing param (a wandering
        // NPC is the first non-player entity to actually exercise this - see NPC_WALK_ASSET_IDS in
        // characterAnimations.ts). Same isPlaying check as setPlayer's own fix - see that call
        // site's comment for why currentAnim alone isn't enough.
        const key = animationKey(entity.spriteAssetId, entity.movementState, entity.facing ?? 'down');
        if (this.anims.exists(key) && (!visual.sprite.anims.isPlaying || visual.sprite.anims.currentAnim?.key !== key)) {
          visual.sprite.play(key);
        }
      } else {
        // Not every NPC/enemy has an idle animation of its own (most don't) - only play one if
        // createCharacterAnimations actually registered it for this sheet; otherwise fall back to
        // the plain static frame exactly as before.
        // entity.facing was previously ignored here entirely (hardcoded 'down') - any character
        // entity that tracks a real facing (wandering NPCs, another player's presence entity)
        // stood still always facing down between walk steps regardless of which way they'd
        // actually turned, most noticeable on presence entities since they're idle far more than
        // they're mid-glide. Only applied when facing is actually set - decor/chest/shrine
        // entities never set it, and keep using their own manually-pinned frameRow/frameColumn.
        const idleFacing = entity.facing ?? 'down';
        const idleKey = animationKey(entity.spriteAssetId, 'idle', idleFacing);
        if (this.anims.exists(idleKey)) {
          if (!visual.sprite.anims.isPlaying || visual.sprite.anims.currentAnim?.key !== idleKey) {
            visual.sprite.play(idleKey);
          }
        } else {
          visual.sprite.anims.stop();
          const idleRow = entity.facing !== undefined ? resolveDisplayRow(layout, 'idle', entity.facing) : row;
          visual.sprite.setFrame(idleRow * layout.frameCount + column);
        }
      }
    }

    // Another player's equipped gear (GridEntity.equipmentLayers, resolved by TownScene.tsx's
    // otherPlayerEntities the same way resolveEquipmentLayers feeds the local player's own
    // setPlayer) - one child sprite per equipped slot, stacked on this entity's base sprite. Same
    // per-slot create/retexture/teardown approach as setPlayer's own equipmentLayerSprites, just
    // keyed under this entity's own visual instead of one Scene-wide singleton, since there can be
    // several other players' presence entities on screen at once.
    if (entity.equipmentLayers && entity.equipmentLayers.length > 0) {
      await Promise.all(entity.equipmentLayers.map((layer) => this.ensureAnimationsFor(layer.spriteAssetId)));
      if (generation !== this.entityGeneration) return;
    }
    if (!visual.layerSprites) visual.layerSprites = new Map();
    const seenLayerSlots = new Set<EquipmentSlot>();
    for (const layer of entity.equipmentLayers ?? []) {
      seenLayerSlots.add(layer.slot);
      let layerVisual = visual.layerSprites.get(layer.slot);
      if (!layerVisual) {
        // Positioned at the already-computed target x/y, not visual.sprite's own current
        // position - on a freshly-created entity, the base sprite is still sitting at its (0,0)
        // creation point this far into the method (it isn't moved to x/y until the
        // justCreated/tween branch further below), so reading it here would snap this layer to
        // the wrong spot for one entity's very first frame.
        const layerSprite = this.add
          .sprite(x, y, layer.spriteAssetId)
          .setOrigin(0.5, 1)
          .setDepth(ENTITY_DEPTH + (EQUIPMENT_LAYER_DEPTH_OFFSET[layer.slot] ?? 0.5))
          .setLighting(true);
        layerVisual = { sprite: layerSprite, spriteAssetId: layer.spriteAssetId };
        visual.layerSprites.set(layer.slot, layerVisual);
      } else if (layerVisual.spriteAssetId !== layer.spriteAssetId) {
        // Same retexture-must-stop-the-old-animation-first fix as this entity's own base-sprite
        // retexture branch above.
        layerVisual.sprite.anims.stop();
        layerVisual.sprite.setTexture(layer.spriteAssetId);
        layerVisual.spriteAssetId = layer.spriteAssetId;
      }
      layerVisual.sprite.setScale(visual.sprite.scaleX, visual.sprite.scaleY);
      if (justCreated || this.mapJustChanged) layerVisual.sprite.setPosition(x, y);
    }
    // A slot that had a layer sprite before but isn't in this call's list anymore (the other
    // player unequipped it, or switched to an item with no layer art) gets its sprite torn down.
    for (const [slot, layerVisual] of visual.layerSprites) {
      if (!seenLayerSlots.has(slot)) {
        layerVisual.sprite.destroy();
        visual.layerSprites.delete(slot);
      }
    }
    // Every equipment layer mirrors the base sprite's own CURRENT frame, same reasoning as
    // applyPlayerAnimation's identical loop for the local player (never given an independent
    // Animation instance of its own - see that method's own comment for why that drifts).
    for (const layerVisual of visual.layerSprites.values()) {
      if (!getAssetDefinition(layerVisual.spriteAssetId).frameSize) continue;
      if (layerVisual.sprite.anims.isPlaying) layerVisual.sprite.anims.stop();
      layerVisual.sprite.setFrame(visual.sprite.frame.name);
    }

    const v = visual;
    // Computed from the sprite's own displayHeight (rather than a fixed tileSize/2) so the label
    // floats above the actual sprite top - matters once taller-than-one-tile art lands, since the
    // sprite's origin is now feet-anchored (bottom), not center.
    // NPCs get the marker floating close above their head - same offset as the "!" unheard-
    // dialogue badge (spriteY - displayHeight - 2), not the nameplate's more distant one - an
    // overlay on a character's own face would look wrong. Every other quest-target-able entity
    // (interactables, building/exit markers) gets it centered over its own top third instead,
    // since those don't have a "head" to float above and read better as a badge on the icon
    // itself.
    const questMarkerYFor = (spriteY: number, displayHeight: number) =>
      entity.interactionKind === 'npc' ? spriteY - displayHeight - 2 : spriteY - displayHeight * (2 / 3);
    const repositionAttachments = () => {
      v.label?.setPosition(v.sprite.x, v.sprite.y - v.sprite.displayHeight - 8);
      v.badge?.setPosition(v.sprite.x + this.tileSize / 2 - 4, v.sprite.y - v.sprite.displayHeight - 2);
      v.questMarker?.setPosition(v.sprite.x, questMarkerYFor(v.sprite.y, v.sprite.displayHeight));
    };
    if (justCreated || this.mapJustChanged) {
      this.tweens.killTweensOf(visual.sprite);
      visual.sprite.setPosition(x, y);
    } else {
      this.tweens.add({ targets: visual.sprite, x, y, duration: entity.glideMs ?? GLIDE_MS, ease: 'Linear', onUpdate: repositionAttachments });
    }

    const labelY = y - visual.sprite.displayHeight - 8;
    if (entity.label) {
      if (!visual.label) {
        visual.label = this.add
          .text(x, labelY, entity.label, {
            fontSize: '10px',
            color: '#b8a888',
            backgroundColor: 'rgba(0,0,0,0.6)',
            padding: { x: 4, y: 1 },
          })
          .setOrigin(0.5, 1)
          .setDepth(ENTITY_LABEL_DEPTH);
      } else {
        visual.label.setText(entity.label).setPosition(x, labelY);
      }
    } else if (visual.label) {
      visual.label.destroy();
      visual.label = undefined;
    }

    const badgeX = x + this.tileSize / 2 - 4;
    const badgeY = y - visual.sprite.displayHeight - 2;
    if (entity.badge) {
      if (!visual.badge) {
        visual.badge = this.add
          .text(badgeX, badgeY, entity.badge, {
            fontSize: '10px',
            fontStyle: 'bold',
            color: '#ffd166',
            backgroundColor: '#c0392b',
            padding: { x: 2, y: 0 },
          })
          .setOrigin(0.5, 1)
          .setDepth(ENTITY_LABEL_DEPTH);
      } else {
        visual.badge.setPosition(badgeX, badgeY);
      }
    } else if (visual.badge) {
      visual.badge.destroy();
      visual.badge = undefined;
    }

    // NPCs float the marker above their head (see questMarkerYFor above); every other quest-
    // target-able entity gets it centered over its own top third as a badge on the icon itself.
    const questMarkerX = x;
    const questMarkerY = questMarkerYFor(y, visual.sprite.displayHeight);
    // Guards on textures.exists the same way spawnDashDust does for DASH_DUST_FX_ASSET_ID above -
    // the load kicked off fire-and-forget in create() usually wins the race easily, but a marker
    // just silently not appearing yet (rather than throwing on a missing texture key) is the
    // correct fallback for the rare case it hasn't.
    if (entity.questTarget && this.textures.exists(QUEST_MARKER_ASSET_ID)) {
      if (!visual.questMarker) {
        const marker = this.add
          .image(questMarkerX, questMarkerY, QUEST_MARKER_ASSET_ID)
          .setOrigin(0.5, entity.interactionKind === 'npc' ? 1 : 0.5)
          .setDisplaySize(QUEST_MARKER_DISPLAY_SIZE.width, QUEST_MARKER_DISPLAY_SIZE.height)
          .setDepth(ENTITY_LABEL_DEPTH);
        visual.questMarker = marker;
        // Gentle breathing pulse (size + brightness) to draw the eye without being obnoxious -
        // tweened relative to the scale setDisplaySize just computed, not a hardcoded 1, so the
        // marker's actual intended size is the low point of the pulse, not a reset value.
        this.tweens.add({
          targets: marker,
          scaleX: marker.scaleX * QUEST_MARKER_PULSE_SCALE,
          scaleY: marker.scaleY * QUEST_MARKER_PULSE_SCALE,
          alpha: { from: 1, to: 0.7 },
          duration: QUEST_MARKER_PULSE_MS,
          yoyo: true,
          repeat: -1,
          ease: 'Sine.easeInOut',
        });
      } else {
        visual.questMarker.setPosition(questMarkerX, questMarkerY);
      }
    } else if (visual.questMarker) {
      this.tweens.killTweensOf(visual.questMarker);
      visual.questMarker.destroy();
      visual.questMarker = undefined;
    }
  }

  /** Replaces clampCamera() entirely. `centerOn=true` on setBounds is required (not a Phaser
   *  default) - without it, bounds smaller than the viewport just lock the camera in place rather
   *  than centering the smaller world, silently dropping the "center the world when it's smaller
   *  than the viewport" behavior the old DOM camera math had. Re-call whenever the active map
   *  changes, since world size differs per location. */
  setCamera(worldWidthPx: number, worldHeightPx: number, viewportWidthPx: number, viewportHeightPx: number): void {
    const camera = this.cameras.main;
    camera.setViewport(0, 0, viewportWidthPx, viewportHeightPx);
    camera.setBounds(0, 0, worldWidthPx, worldHeightPx, true);
    // roundPixels=true - see the other startFollow call's comment (setPlayer's first-creation
    // branch) for why this matters now that movement is continuous, not tile-snapped.
    if (this.playerSprite) camera.startFollow(this.playerSprite, true);
    this.weatherLayer.handleResize();
  }

  setViewport(viewportSize: { width: number; height: number }): void {
    this.scale.resize(viewportSize.width, viewportSize.height);
    this.weatherLayer.handleResize();
  }

  /** Ambient screen-space weather (see src/phaser/weatherEffects.ts) - the caller (Overworld/
   *  TownScene, via PhaserExplorationCanvas's `weather` prop) resolves *which* kind from
   *  src/utils/weather.ts; this Scene only owns rendering it. DungeonScene never calls this, so
   *  dungeons/interiors never show weather. */
  setWeather(kind: WeatherKind | null): void {
    this.weatherLayer.setWeather(kind);
  }

  /** Day/night ambient (see src/phaser/lightingEffects.ts) - the caller (Overworld/TownScene, via
   *  PhaserExplorationCanvas's `timePhase` prop) resolves *which* phase from useTimeOfDayStore/
   *  useDebugStore's override; this Scene only owns rendering it, same split as setWeather.
   *  DungeonScene never calls this, so dungeons/interiors never show day/night. Also re-syncs the
   *  lantern light, since whether it should be on depends on this phase too. */
  setTimePhase(phase: TimePhase): void {
    this.currentTimePhase = phase;
    this.lightingLayer.setPhase(phase);
    this.weatherLayer.setPhaseHint(phase);
    this.syncLanternLight();
  }
}
