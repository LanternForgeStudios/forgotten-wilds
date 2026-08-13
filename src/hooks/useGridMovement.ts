import { useCallback, useMemo, useRef, useState } from 'react';
import type { TileMap } from '@/types';

export type Facing = 'up' | 'down' | 'left' | 'right';

export interface GridPosition {
  x: number;
  y: number;
  facing: Facing;
}

export type MovementState = 'idle' | 'walking' | 'running';

export const KEY_TO_FACING: Record<string, Facing> = {
  ArrowUp: 'up',
  w: 'up',
  W: 'up',
  ArrowDown: 'down',
  s: 'down',
  S: 'down',
  ArrowLeft: 'left',
  a: 'left',
  A: 'left',
  ArrowRight: 'right',
  d: 'right',
  D: 'right',
};

export const FACING_TO_DELTA: Record<Facing, { dx: number; dy: number }> = {
  up: { dx: 0, dy: -1 },
  down: { dx: 0, dy: 1 },
  left: { dx: -1, dy: 0 },
  right: { dx: 1, dy: 0 },
};

// 'npc' is deliberately not in here - an NPC's own static map-data position is its SPAWN point,
// not necessarily where it currently stands (see useWanderingNpcs), so blocking on it would leave
// an invisible permanent obstacle behind once a wandering NPC moves away. Player-vs-NPC collision
// is handled entirely by Arcade Physics now (each blocking entity gets a real body in
// ExplorationScene.ts's entityCollisionGroup - see upsertEntity/registerPlayerColliders), not by
// this tile-candidate check at all.
const BLOCKING_OBJECT_TYPES = new Set(['interactable']);

/** Whether tile (x,y) is walkable - still used for tile-*candidate* checks (a wandering NPC's next
 *  step, a field-encounter icon's placement tile - see useWanderingNpcs.ts/useFieldEncounters.ts),
 *  even though it no longer gates the player's own movement (that's Arcade Physics collision now -
 *  see ExplorationScene.ts's updatePlayerPhysics/registerPlayerColliders and its
 *  entityCollisionGroup for NPC/interactable collision specifically). Every caller here only ever
 *  needs a static "would something occupy this tile by default" answer, not live NPC positions. */
export function isWalkable(map: TileMap, x: number, y: number): boolean {
  if (x < 0 || y < 0 || x >= map.width || y >= map.height) return false;
  const ground = map.layers.find((l) => l.name === 'ground');
  if (!ground) return false;
  const gid = ground.data[y * map.width + x];
  // Any populated ground tile is walkable by default - only an explicit walkable:false exception
  // (walls, water, ...) or an empty tile (gid 0, nothing painted there) blocks movement.
  if (gid <= 0 || map.nonWalkableTileIds.includes(gid)) return false;
  // Discrete collision-only obstacles authored on the Tiled 'collisions' layer (fences, rocks,
  // ledges, barriers). Purely geometric - blocks movement but never triggers interaction logic,
  // unlike an 'interactable' MapObject. `collisionObjects` is native-pixel (exactly as drawn in
  // Tiled, used directly by ExplorationScene.ts's Arcade Physics bodies) - here, for this tile-
  // candidate check, any rectangle that overlaps the queried tile's pixel bounds at all blocks the
  // whole tile (same "any overlap blocks" semantics tiledLoader.ts previously precomputed via
  // pixelRectToTileSpan, just evaluated per-query instead of once at load).
  const tileMinX = x * map.tileWidth;
  const tileMinY = y * map.tileHeight;
  const collisionBlocked = map.collisionObjects.some(
    (r) =>
      r.x < tileMinX + map.tileWidth &&
      r.x + r.width > tileMinX &&
      r.y < tileMinY + map.tileHeight &&
      r.y + r.height > tileMinY,
  );
  if (collisionBlocked) return false;
  const blocked = map.objects.some((o) => BLOCKING_OBJECT_TYPES.has(o.type) && o.x === x && o.y === y);
  if (blocked) return false;
  // Transitions (building entrances, map edges, etc.) are always open floor from every direction -
  // a player should be able to walk onto and trigger one from any side, not just a map-authored
  // requiredFacing. That field still exists on older map data but is no longer enforced here.
  return true;
}

interface UseGridMovementOptions {
  start: { x: number; y: number };
}

/** Owns the React-visible mirror of the player's position/movementState - Arcade Physics
 *  (ExplorationScene.ts's updatePlayerPhysics) is the actual mover now; this hook just surfaces
 *  its throttled position reports to React for HUD/minimap/heartbeat/interaction consumers (see
 *  reportPosition, called from PhaserExplorationCanvas's onPositionChange callback). Also owns the
 *  "snap to a new spawn point on a real location transition" reset, same as before. */
export function useGridMovement({ start }: UseGridMovementOptions) {
  const [resolvedStart, setResolvedStart] = useState(start);
  const [position, setPosition] = useState<GridPosition>({ x: start.x, y: start.y, facing: 'down' });
  const [movementState, setMovementState] = useState<MovementState>('idle');
  const positionRef = useRef(position);
  positionRef.current = position;

  // "Adjust state during render" (see useTileMap.ts's own use of this pattern, and for the same
  // reason) rather than a useEffect - useLocationExploration's hook instance persists across
  // location transitions (no remount), so a post-commit effect leaves a one-render window where a
  // just-loaded map's canvas can mount and paint *before* position has been corrected to that
  // map's real spawn point.
  if (start.x !== resolvedStart.x || start.y !== resolvedStart.y) {
    setResolvedStart(start);
    setPosition({ x: start.x, y: start.y, facing: 'down' });
  }

  const reportPosition = useCallback((pos: GridPosition, state: MovementState) => {
    setPosition(pos);
    setMovementState(state);
  }, []);

  // Stable across every ~15Hz position report - only changes when the spawn tile itself changes
  // (a real location transition) - see PhaserExplorationCanvas's own `player` prop doc comment for
  // why this, not the continuously-updating `position`, is what gets passed there: it's what tells
  // ExplorationScene.setPlayer where to (re)place the physics body on first mount/a transition,
  // and passing the live position instead would re-run that effect on every position report for no
  // benefit (setPlayer already no-ops position writes outside that case, but still does async
  // texture-check work each call).
  const spawnPosition = useMemo<GridPosition>(
    () => ({ x: resolvedStart.x, y: resolvedStart.y, facing: 'down' }),
    [resolvedStart.x, resolvedStart.y],
  );

  return { position, positionRef, movementState, reportPosition, spawnPosition };
}
