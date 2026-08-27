import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import Phaser from 'phaser';
import type { EquipmentSlot, MapObject, TileMap, WeatherKind, TimePhase } from '@/types';
import type { Facing, GridPosition } from '@/hooks/useGridMovement';
import type { MovementInputState } from '@/hooks/useMovementInput';
import type { MovementState } from '@/animation/characterAnimations';
import { ExplorationScene } from '@/phaser/ExplorationScene';

export interface GridEntity {
  id: string;
  x: number;
  y: number;
  spriteAssetId: string;
  label?: string;
  /** Which row of the sprite sheet to show (a direction/state row) - only meaningful when the
   *  asset's registry entry has a `frameSize` and no dedicated idle/walking animation row exists
   *  for the current movementState (the static-frame fallback branch in upsertEntity). */
  frameRow?: number;
  /** Static column to show when not animating (e.g. a resting pose) - defaults to 0. */
  frameColumn?: number;
  movementState?: MovementState;
  /** Which direction to face while playing a walking/running animation - only meaningful together
   *  with movementState 'walking'/'running' on a sheet that actually has directional walk rows
   *  (see NPC_WALK_ASSET_IDS in characterAnimations.ts). Defaults to 'down' when omitted, matching
   *  every entity's behavior before this field existed. */
  facing?: Facing;
  /** Small overlay shown above the entity's label (e.g. "!" for an NPC with unheard dialogue). */
  badge?: string;
  /** Shows a floating gold teardrop marker above this entity - set when it's the current, unmet
   *  target of an active quest objective (see questTargetLookup.ts's resolveActiveQuestTargetRefIds,
   *  the same resolution rules MiniMap.tsx's own "quest gold ring" uses). Mirrors that minimap
   *  indicator so a player can also spot their next objective while actually walking the overworld,
   *  not just glancing at the map overlay. */
  questTarget?: boolean;
  /** Per-slot equipment layer sprites stacked on top of this entity's own base sprite - same shape
   *  and rendering approach (ExplorationScene.ts's upsertEntity) as the local player's own
   *  top-level equipmentLayers prop (see resolveEquipmentLayers). Used for other online players'
   *  presence entities so they render with their real equipped gear instead of a bare base body -
   *  omitted (undefined/empty) for everything else (NPCs, interactables, decor). */
  equipmentLayers?: { slot: EquipmentSlot; spriteAssetId: string }[];
  /** Overrides ExplorationScene's default GLIDE_MS glide duration when this entity's x/y changes -
   *  a remote player's presence entity sets this to POSITION_THROTTLE_MS (useHeartbeat.ts) so it
   *  glides continuously for the full gap between position broadcasts instead of a short default
   *  glide followed by a freeze until the next update (see TownScene.tsx's otherPlayerEntities).
   *  Omitted for everything else, keeping the default. */
  glideMs?: number;
  /** Multiplier on top of ExplorationScene's normal viewport-relative scale (see
   *  REFERENCE_VIEWPORT_SCALE) - for a caller that wants to render this specific entity's existing
   *  art smaller/larger than its native pixel size would otherwise imply, without needing new art
   *  at a different resolution. Used for field-encounter/boss map icons, whose battle sprites
   *  (128x128/256x256) are sized for the combat screen, not for a small "something's nearby" map
   *  marker. Defaults to 1 (no change) when omitted. */
  displayScale?: number;
  /** Whether the player's Arcade Physics body should collide with this entity - true for NPCs and
   *  solid interactables (chests, shrines, decor), false for anything that must stay walk-through
   *  (building/exit transition markers, other players' presence avatars, field-encounter icons).
   *  Mirrors the old discrete model's BLOCKING_OBJECT_TYPES/dynamicBlockers split, now unified into
   *  one per-entity flag since both kinds of blocker get a real Arcade body here (see
   *  ExplorationScene.ts's upsertEntity). Defaults to false when omitted. */
  blocksMovement?: boolean;
  /** Marks this entity as a valid target for the directional interaction probe (see
   *  ExplorationScene.ts's queryInteraction) - 'npc' for talkable NPCs, 'presence' for other
   *  players' live avatars. Omitted for anything not meant to be interacted with directly this way
   *  (building/exit markers, field-encounter icons) - static interactables (chests, shrines, decor)
   *  don't need this either, since queryInteraction finds those directly from the map's own
   *  `interactable`-type objects instead of from the rendered entity list. */
  interactionKind?: 'npc' | 'presence';
  /** Ground-contact shadow (see ExplorationScene.ts's createShadowFor) - true for field-encounter
   *  enemy icons and dungeon boss triggers, which read as characters standing on the ground the
   *  same way NPCs/other players already do, but aren't a queryInteraction target so they don't
   *  set interactionKind (that field alone already implies a shadow for 'npc'/'presence' - this is
   *  purely additive for entities that need one without being an interaction-probe target).
   *  Omitted/false for everything else (buildings/exit markers/decor/shrines/chests, which already
   *  sit flush on the map art). */
  hasShadow?: boolean;
}

interface PhaserExplorationCanvasProps {
  map: TileMap;
  /** Only consulted to (re)place the player on first mount or a real location transition - see
   *  ExplorationScene.ts's setPlayer doc comment. Continuous movement is driven entirely by Arcade
   *  Physics inside the Scene now, not by this prop on every render. */
  player: GridPosition;
  playerSpriteAssetId: string;
  /** Shared input-state ref (see useMovementInput.ts) the Scene reads every frame to drive the
   *  player's Arcade body velocity - bound once, not re-read per render. */
  movementInputRef: { current: MovementInputState };
  /** True while an overlay (dialogue, menus, shop, etc.) is open - movement/dash input is ignored. */
  suspended?: boolean;
  /** Ambient screen-space weather effect, resolved by the caller (OverworldScene/TownScene) via
   *  src/utils/weather.ts's resolveWeather - see ExplorationScene.setWeather. Omitted/null means
   *  no effect; DungeonScene never passes this at all, so dungeons/interiors never show weather. */
  weather?: WeatherKind | null;
  /** Day/night ambient phase, resolved by the caller via useTimeOfDayStore/useDebugStore's
   *  override - see ExplorationScene.setTimePhase. Omitted defaults to 'day' (no darkening);
   *  DungeonScene never passes this, so dungeons/interiors never show day/night. */
  timePhase?: TimePhase;
  /** Collision/interaction-bounds debug overlay - see ExplorationScene.setDebugEnabled. Driven by
   *  the UserProfile Debug tab's useDebugStore, reachable from Town/Overworld/Dungeon alike. */
  showCollisions?: boolean;
  /** Called with the physics-driven player position/movementState, throttled to ~15Hz (see
   *  ExplorationScene.ts's POSITION_FLUSH_INTERVAL_MS) - the caller (useLocationExploration's
   *  reportPosition) mirrors this into React state for HUD/minimap/heartbeat/interaction. */
  onPositionChange?: (pos: GridPosition, movementState: MovementState) => void;
  /** Fires once (leading edge only) when the player's Arcade body enters a `zone` map object's
   *  real rectangle - see ExplorationScene.ts's checkZoneAndTransitionOverlaps. */
  onZoneEnter?: (refId: string) => void;
  /** Fires whenever the SET of `zone` refIds the player is currently standing inside changes -
   *  entry AND exit, unlike onZoneEnter's leading-edge-only firing. Used for subarea background
   *  music, which needs to know when the player leaves a zone too, not just enters it. */
  onActiveZonesChange?: (refIds: string[]) => void;
  /** Fires once (leading edge only) when the player's Arcade body enters a `transition` map
   *  object's rectangle - the caller decides what a transition actually does (quest-gate check +
   *  goTo, see useLocationExploration.ts's handleTransitionEnter). */
  onTransitionEnter?: (transition: MapObject) => void;
  /** Tile-int icon positions (see useFieldEncounters.ts) - checked for player proximity every
   *  frame (see ExplorationScene.ts's checkFieldEncounterProximity). */
  fieldEncounterIcons?: { id: string; x: number; y: number }[];
  /** Fires once (leading edge only) per real approach to a field-encounter icon. */
  onFieldEncounterNear?: (icon: { id: string; x: number; y: number }) => void;
  entities?: GridEntity[];
  scale?: number;
  /** Visible window size in exact pixels (typically the real available window area) - maps larger
   *  than this scroll to keep the player centered. Omit for a map that should always render at
   *  full size (no camera). */
  viewportSize?: { width: number; height: number };
  /** Equipped-item sprite layers stacked on top of the player (see
   *  docs/Equipment-Layering-Plan.md) - resolved by the caller from player.equipment + each
   *  equipped item's layerSpriteAssetId[gender]. Empty in practice until real layer art ships. */
  equipmentLayers?: { slot: EquipmentSlot; spriteAssetId: string }[];
}

/** Imperative handle exposed via ref - `queryInteraction` is the only method a caller needs
 *  (see TownScene.tsx/OverworldScene.tsx/DungeonScene.tsx's attemptInteract), reading directly
 *  from the live Scene rather than needing its own React-state mirror of interaction-probe
 *  results the way position/movementState do (a one-shot query on keypress doesn't need to be
 *  reactive between renders the way continuous position does). */
export interface PhaserExplorationCanvasHandle {
  queryInteraction: () => { kind: 'npc' | 'presence' | 'interactable'; id: string } | null;
}

/** Phaser-backed replacement for the old DOM/CSS TileGrid - same prop shape, so every scene's JSX
 *  is unaffected by this swap. Owns a single persistent Phaser.Game (created once, destroyed on
 *  unmount) and pushes prop changes into ExplorationScene via imperative method calls rather than
 *  re-rendering JSX - Phaser owns its own render loop. All game logic (collision, movement
 *  throttling, transitions, encounters) stays exactly where it already lived, in
 *  useGridMovement.ts/useLocationExploration.ts - this component and its Scene are pure rendering. */
export const PhaserExplorationCanvas = forwardRef<PhaserExplorationCanvasHandle, PhaserExplorationCanvasProps>(
  function PhaserExplorationCanvas(props, ref) {
  const { map, player, playerSpriteAssetId, movementInputRef, scale = 3 } = props;
  const entities = props.entities ?? [];
  const viewportSize = props.viewportSize;
  const suspended = props.suspended ?? false;
  const weather = props.weather ?? null;
  const timePhase = props.timePhase ?? 'day';
  const showCollisions = props.showCollisions ?? false;
  const equipmentLayers = props.equipmentLayers ?? [];
  const fieldEncounterIcons = props.fieldEncounterIcons ?? [];
  // Mirrored into a ref (not read directly) so the map-load effect below can preload whatever
  // entities happen to be current at the moment a real transition starts, without listing
  // `entities` in that effect's own dependency array - the loading overlay should only reappear on
  // a genuine location change, not every time the entities array itself updates during normal play
  // (quest state, chest opens, etc.).
  const entitiesRef = useRef(entities);
  entitiesRef.current = entities;
  const onPositionChangeRef = useRef(props.onPositionChange);
  onPositionChangeRef.current = props.onPositionChange;
  const onZoneEnterRef = useRef(props.onZoneEnter);
  onZoneEnterRef.current = props.onZoneEnter;
  const onActiveZonesChangeRef = useRef(props.onActiveZonesChange);
  onActiveZonesChangeRef.current = props.onActiveZonesChange;
  const onTransitionEnterRef = useRef(props.onTransitionEnter);
  onTransitionEnterRef.current = props.onTransitionEnter;
  const onFieldEncounterNearRef = useRef(props.onFieldEncounterNear);
  onFieldEncounterNearRef.current = props.onFieldEncounterNear;

  const containerRef = useRef<HTMLDivElement>(null);
  const gameRef = useRef<Phaser.Game | null>(null);
  const sceneRef = useRef<ExplorationScene | null>(null);
  const [sceneReady, setSceneReady] = useState(false);
  // True from mount until the *currently requested* map has actually finished building its tile
  // layers (texture loads included) - covers the gap ExplorationScene's own async loadMap leaves
  // invisible to React. Without this, a slow load (cold cache, a flaky connection) showed a bare
  // dark canvas with only the player sprite floating on it until the floor tiles popped in, which
  // read as broken rather than "still loading." mapLoadGenerationRef guards against a stale
  // resolution clearing this after a newer loadMap call has already superseded it (same pattern as
  // ExplorationScene's own internal mapGeneration).
  const [mapLoading, setMapLoading] = useState(true);
  // Set when loadMap's own promise rejects (a texture that genuinely failed to load, even after
  // its internal retry - see textureLoader.ts/ExplorationScene.ts's own comments) rather than
  // hanging on the loading overlay forever, which would otherwise look identical to "still
  // loading" with no way to tell the player anything actually went wrong.
  const [mapLoadError, setMapLoadError] = useState(false);
  const mapLoadGenerationRef = useRef(0);

  // Created once and persists across every prop change - React StrictMode's dev-only
  // mount->cleanup->mount double-invoke is harmless as long as cleanup actually destroys the game
  // (never two live instances at once).
  useEffect(() => {
    let cancelled = false;
    const scene = new ExplorationScene(() => {
      if (!cancelled) setSceneReady(true);
    });
    // Bound once (not per-render) - the input ref object itself is stable for the life of the
    // exploration session (see useMovementInput.ts), and the position-report callback goes through
    // a ref (onPositionChangeRef) so it always calls the CURRENT prop closure without needing to
    // be re-bound every time the parent re-renders with a new inline function.
    scene.bindInput(movementInputRef);
    scene.setPositionCallback((pos, state) => onPositionChangeRef.current?.(pos, state));
    scene.setZoneEnterCallback((refId) => onZoneEnterRef.current?.(refId));
    scene.setActiveZonesChangeCallback((refIds) => onActiveZonesChangeRef.current?.(refIds));
    scene.setTransitionEnterCallback((transition) => onTransitionEnterRef.current?.(transition));
    scene.setFieldEncounterNearCallback((icon) => onFieldEncounterNearRef.current?.(icon));
    const game = new Phaser.Game({
      type: Phaser.AUTO,
      parent: containerRef.current ?? undefined,
      width: viewportSize?.width ?? window.innerWidth,
      height: viewportSize?.height ?? window.innerHeight,
      pixelArt: true,
      backgroundColor: '#120e0b',
      scene,
      banner: false,
      // Movement/collision is migrating to Arcade Physics (see ExplorationScene.ts) - zero gravity
      // since this is a top-down game, no falling. `debug` stays off here; ExplorationScene draws
      // its own toggleable overlay instead (see setDebugEnabled) rather than Phaser's built-in one,
      // since the built-in flag isn't runtime-toggleable without recreating this Game instance.
      // fps: 120 (double Phaser's own 60 default) - Arcade Physics only resolves collisions once per
      // fixed step, so a body's per-step displacement is velocity/fps; at Dash speed this was large
      // enough, relative to a thin NPC/interactable hitbox, to skip clean past it in a single step
      // (reported live: Dash lets the player pass through NPCs/shrines/chests that normal walking
      // correctly blocks). Doubling the step rate halves that per-step distance with no change to
      // actual movement speed or feel - the standard mitigation for this class of tunneling.
      physics: { default: 'arcade', arcade: { gravity: { x: 0, y: 0 }, debug: false, fps: 120 } },
    });
    gameRef.current = game;
    sceneRef.current = scene;
    setSceneReady(false);
    return () => {
      cancelled = true;
      game.destroy(true);
      gameRef.current = null;
      sceneRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useImperativeHandle(
    ref,
    () => ({
      queryInteraction: () => sceneRef.current?.queryInteraction() ?? null,
    }),
    [],
  );

  const tileSize = map.tileWidth * scale;
  const worldWidthPx = map.width * tileSize;
  const worldHeightPx = map.height * tileSize;
  const viewportWidthPx = viewportSize?.width ?? worldWidthPx;
  const viewportHeightPx = viewportSize?.height ?? worldHeightPx;

  useEffect(() => {
    if (!sceneReady) return;
    const generation = ++mapLoadGenerationRef.current;
    setMapLoading(true);
    setMapLoadError(false);
    // Both run in parallel and the loading overlay waits on whichever finishes last - ground tiles
    // and this location's NPC/interactable sprites are both "the map isn't ready yet" from the
    // player's perspective. A texture load failure here is deliberately non-fatal to the whole
    // transition (unlike loadMap's own failure, which aborts the tile-layer swap): an entity whose
    // texture never arrives just never gets a sprite (upsertEntity's own per-entity await handles
    // that later), it shouldn't block the player from walking around the location at all.
    void Promise.all([
      sceneRef.current?.loadMap(map, tileSize),
      sceneRef.current?.preloadEntityTextures(entitiesRef.current).catch(() => {}),
    ]).then(
      () => {
        if (mapLoadGenerationRef.current === generation) setMapLoading(false);
      },
      () => {
        if (mapLoadGenerationRef.current === generation) {
          setMapLoading(false);
          setMapLoadError(true);
        }
      },
    );
  }, [sceneReady, map, tileSize]);

  useEffect(() => {
    if (!sceneReady) return;
    void sceneRef.current?.setPlayer(player, playerSpriteAssetId, equipmentLayers);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sceneReady, player, playerSpriteAssetId, equipmentLayers, tileSize]);

  useEffect(() => {
    sceneRef.current?.setSuspended(suspended);
  }, [suspended]);

  useEffect(() => {
    // Gated on sceneReady (unlike setSuspended above) - a real weather kind eventually calls into
    // scene.add.graphics/particles, which don't exist until Phaser's async boot completes (see
    // the map-load effect's own comment on this). setSuspended gets away without the guard only
    // because it just flips a plain boolean field with a class-level default, no Phaser API calls.
    if (!sceneReady) return;
    sceneRef.current?.setWeather(weather);
  }, [sceneReady, weather]);

  // Same sceneReady gate as weather above - setTimePhase eventually tweens scene.lights (real
  // Phaser API calls), not safe before boot completes.
  useEffect(() => {
    if (!sceneReady) return;
    sceneRef.current?.setTimePhase(timePhase);
  }, [sceneReady, timePhase]);

  useEffect(() => {
    if (!sceneReady) return;
    sceneRef.current?.setEntities(entities);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sceneReady, entities, tileSize]);

  useEffect(() => {
    if (!sceneReady) return;
    sceneRef.current?.setFieldEncounterIcons(fieldEncounterIcons);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sceneReady, fieldEncounterIcons]);

  // Dev-only collision/interaction-bounds overlay toggle (see ExplorationScene.ts's
  // setDebugEnabled/drawDebugOverlay) - driven by the UserProfile Debug tab's useDebugStore now
  // (was an F9 hotkey; retired in favor of a tap-friendly UI reachable on mobile too). Scoped to
  // this one component (not per-scene) so it works identically in Town/Overworld/Dungeon without
  // three copies of the same toggle.
  useEffect(() => {
    if (!sceneReady) return;
    sceneRef.current?.setDebugEnabled(showCollisions);
  }, [sceneReady, showCollisions]);

  useEffect(() => {
    if (!sceneReady) return;
    sceneRef.current?.setCamera(worldWidthPx, worldHeightPx, viewportWidthPx, viewportHeightPx);
  }, [sceneReady, worldWidthPx, worldHeightPx, viewportWidthPx, viewportHeightPx]);

  useEffect(() => {
    if (!sceneReady) return;
    sceneRef.current?.setViewport({ width: viewportWidthPx, height: viewportHeightPx });
  }, [sceneReady, viewportWidthPx, viewportHeightPx]);

  const loading = !sceneReady || mapLoading;
  // Stays visible (no fade) on a real failure, rather than fading away into whatever was left on
  // screen (the previous location's tiles, or a blank canvas on a first-ever load) with no
  // indication anything went wrong - see ExplorationScene.loadMap's own comment on why the old
  // tiles are deliberately left in place rather than torn down for a map that couldn't be built.
  const showOverlay = loading || mapLoadError;

  return (
    <div style={{ position: 'relative', width: viewportWidthPx, height: viewportHeightPx, overflow: 'hidden' }}>
      <div ref={containerRef} style={{ width: viewportWidthPx, height: viewportHeightPx }} />
      {/* Covers the canvas until the requested map's tiles have actually finished building -
       *  otherwise a slow load shows a bare dark canvas with only the player sprite floating on
       *  it, which reads as broken rather than "still loading". Same background color as the
       *  Phaser canvas itself so there's no color pop when it fades out. pointerEvents 'none' once
       *  faded so it doesn't eat clicks/taps meant for the (now-ready) canvas underneath. */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#120e0b',
          color: mapLoadError ? '#e0a94a' : '#ece1cf',
          fontSize: 14,
          letterSpacing: 1,
          textAlign: 'center',
          padding: 16,
          opacity: showOverlay ? 1 : 0,
          transition: 'opacity 250ms ease-out',
          pointerEvents: showOverlay ? 'auto' : 'none',
        }}
      >
        {mapLoadError ? (
          <>
            <div>Couldn&apos;t load this area - probably a brief connection hiccup.</div>
            <div>Try leaving and re-entering, or refreshing the page.</div>
          </>
        ) : (
          'Loading...'
        )}
      </div>
    </div>
  );
  },
);
