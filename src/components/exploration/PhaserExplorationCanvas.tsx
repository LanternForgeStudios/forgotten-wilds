import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import Phaser from 'phaser';
import type { EquipmentSlot, MapObject, TileMap } from '@/types';
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
  const equipmentLayers = props.equipmentLayers ?? [];
  const fieldEncounterIcons = props.fieldEncounterIcons ?? [];
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
    void sceneRef.current?.loadMap(map, tileSize).then(
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
  // setDebugEnabled/drawDebugOverlay) - F9 rather than a UI button since this is a development aid,
  // not a player-facing feature. Scoped to this one component (not per-scene) so it works
  // identically in Town/Overworld/Dungeon without three copies of the same keybind.
  useEffect(() => {
    if (!sceneReady) return;
    let enabled = false;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key !== 'F9') return;
      enabled = !enabled;
      sceneRef.current?.setDebugEnabled(enabled);
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [sceneReady]);

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
