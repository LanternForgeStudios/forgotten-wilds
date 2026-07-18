import { useEffect, useRef, useState } from 'react';
import Phaser from 'phaser';
import type { TileMap } from '@/types';
import type { GridPosition } from '@/hooks/useGridMovement';
import type { MovementState } from '@/animation/characterAnimations';
import { ExplorationScene } from '@/phaser/ExplorationScene';

export interface GridEntity {
  id: string;
  x: number;
  y: number;
  spriteAssetId: string;
  label?: string;
  /** Which row of the sprite sheet to show (a direction/state row) - only meaningful when the
   *  asset's registry entry has a `frameSize` (e.g. the player sheet). No NPC/enemy asset has one
   *  yet, so this is inert for them today. */
  frameRow?: number;
  /** Static column to show when not animating (e.g. a resting pose) - defaults to 0. */
  frameColumn?: number;
  movementState?: MovementState;
  /** Small overlay shown above the entity's label (e.g. "!" for an NPC with unheard dialogue). */
  badge?: string;
  /** Multiplier on top of ExplorationScene's normal viewport-relative scale (see
   *  REFERENCE_VIEWPORT_SCALE) - for a caller that wants to render this specific entity's existing
   *  art smaller/larger than its native pixel size would otherwise imply, without needing new art
   *  at a different resolution. Used for field-encounter/boss map icons, whose battle sprites
   *  (128x128/256x256) are sized for the combat screen, not for a small "something's nearby" map
   *  marker. Defaults to 1 (no change) when omitted. */
  displayScale?: number;
}

interface PhaserExplorationCanvasProps {
  map: TileMap;
  player: GridPosition;
  playerSpriteAssetId: string;
  entities?: GridEntity[];
  scale?: number;
  /** Visible window size in exact pixels (typically the real available window area) - maps larger
   *  than this scroll to keep the player centered. Omit for a map that should always render at
   *  full size (no camera). */
  viewportSize?: { width: number; height: number };
  /** Row of the player's sprite sheet to show (from resolveDisplayRow) - the player isn't part of
   *  `entities`, so it gets its own pair of animation props here. */
  playerFrameRow?: number;
  playerMovementState?: MovementState;
}

/** Phaser-backed replacement for the old DOM/CSS TileGrid - same prop shape, so every scene's JSX
 *  is unaffected by this swap. Owns a single persistent Phaser.Game (created once, destroyed on
 *  unmount) and pushes prop changes into ExplorationScene via imperative method calls rather than
 *  re-rendering JSX - Phaser owns its own render loop. All game logic (collision, movement
 *  throttling, transitions, encounters) stays exactly where it already lived, in
 *  useGridMovement.ts/useLocationExploration.ts - this component and its Scene are pure rendering. */
export function PhaserExplorationCanvas(props: PhaserExplorationCanvasProps) {
  const { map, player, playerSpriteAssetId, scale = 3 } = props;
  const entities = props.entities ?? [];
  const viewportSize = props.viewportSize;
  const playerFrameRow = props.playerFrameRow ?? 0;
  const playerMovementState = props.playerMovementState ?? 'idle';

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
  const mapLoadGenerationRef = useRef(0);

  // Created once and persists across every prop change - React StrictMode's dev-only
  // mount->cleanup->mount double-invoke is harmless as long as cleanup actually destroys the game
  // (never two live instances at once).
  useEffect(() => {
    let cancelled = false;
    const scene = new ExplorationScene(() => {
      if (!cancelled) setSceneReady(true);
    });
    const game = new Phaser.Game({
      type: Phaser.AUTO,
      parent: containerRef.current ?? undefined,
      width: viewportSize?.width ?? window.innerWidth,
      height: viewportSize?.height ?? window.innerHeight,
      pixelArt: true,
      backgroundColor: '#120e0b',
      scene,
      banner: false,
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

  const tileSize = map.tileWidth * scale;
  const worldWidthPx = map.width * tileSize;
  const worldHeightPx = map.height * tileSize;
  const viewportWidthPx = viewportSize?.width ?? worldWidthPx;
  const viewportHeightPx = viewportSize?.height ?? worldHeightPx;

  useEffect(() => {
    if (!sceneReady) return;
    const generation = ++mapLoadGenerationRef.current;
    setMapLoading(true);
    void sceneRef.current?.loadMap(map, tileSize).then(() => {
      if (mapLoadGenerationRef.current === generation) setMapLoading(false);
    });
  }, [sceneReady, map, tileSize]);

  useEffect(() => {
    if (!sceneReady) return;
    void sceneRef.current?.setPlayer(player, playerSpriteAssetId, playerFrameRow, playerMovementState);
  }, [sceneReady, player, playerSpriteAssetId, playerFrameRow, playerMovementState, tileSize]);

  useEffect(() => {
    if (!sceneReady) return;
    sceneRef.current?.setEntities(entities);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sceneReady, entities, tileSize]);

  useEffect(() => {
    if (!sceneReady) return;
    sceneRef.current?.setCamera(worldWidthPx, worldHeightPx, viewportWidthPx, viewportHeightPx);
  }, [sceneReady, worldWidthPx, worldHeightPx, viewportWidthPx, viewportHeightPx]);

  useEffect(() => {
    if (!sceneReady) return;
    sceneRef.current?.setViewport({ width: viewportWidthPx, height: viewportHeightPx });
  }, [sceneReady, viewportWidthPx, viewportHeightPx]);

  const loading = !sceneReady || mapLoading;

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
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#120e0b',
          color: '#ece1cf',
          fontSize: 14,
          letterSpacing: 1,
          opacity: loading ? 1 : 0,
          transition: 'opacity 250ms ease-out',
          pointerEvents: loading ? 'auto' : 'none',
        }}
      >
        Loading...
      </div>
    </div>
  );
}
