import { useCallback, useEffect, useRef, useState } from 'react';
import type { TileMap } from '@/types';
import { isTypingTarget } from '@/utils/keyboard';

export type Facing = 'up' | 'down' | 'left' | 'right';

export interface GridPosition {
  x: number;
  y: number;
  facing: Facing;
}

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

const FACING_TO_DELTA: Record<Facing, { dx: number; dy: number }> = {
  up: { dx: 0, dy: -1 },
  down: { dx: 0, dy: 1 },
  left: { dx: -1, dy: 0 },
  right: { dx: 1, dy: 0 },
};

// 'npc' is deliberately not in here - npc collision is handled entirely via `dynamicBlockers`
// (see useWanderingNpcs), which tracks every npc's *current* tile. Blocking on the npc's static
// map-data position too would leave an invisible permanent obstacle at its original spawn point
// once it wanders away from there.
const BLOCKING_OBJECT_TYPES = new Set(['interactable']);

export function isWalkable(map: TileMap, x: number, y: number, facing?: Facing): boolean {
  if (x < 0 || y < 0 || x >= map.width || y >= map.height) return false;
  const ground = map.layers.find((l) => l.name === 'ground');
  if (!ground) return false;
  const gid = ground.data[y * map.width + x];
  if (!map.walkableTileIds.includes(gid)) return false;
  // Discrete collision-only obstacles authored on the Tiled 'collisions' layer (fences, rocks,
  // ledges, barriers). Purely geometric - blocks movement but never triggers interaction logic,
  // unlike an 'interactable' MapObject.
  const collisionBlocked = map.collisionObjects.some(
    (r) => x >= r.x && x < r.x + r.width && y >= r.y && y < r.y + r.height,
  );
  if (collisionBlocked) return false;
  const blocked = map.objects.some((o) => BLOCKING_OBJECT_TYPES.has(o.type) && o.x === x && o.y === y);
  if (blocked) return false;
  // A gated transition (e.g. a building door) only behaves like open floor when approached from
  // its required direction - from any other side it's a wall, so you can't slip past a building
  // by walking across its door tile sideways.
  const gatedTransition = map.objects.find(
    (o) => o.type === 'transition' && o.x === x && o.y === y && o.requiredFacing,
  );
  if (gatedTransition && gatedTransition.requiredFacing !== facing) return false;
  return true;
}

interface UseGridMovementOptions {
  map: TileMap | null;
  start: { x: number; y: number };
  /** Movement is suspended while true (e.g. dialogue open, combat active). */
  suspended?: boolean;
  /** `isDash` is true for a step taken as part of a Dash sequence - callers use it to skip things
   *  that shouldn't trigger mid-dash (encounter checks; see useLocationExploration). */
  onStep?: (pos: GridPosition, isDash?: boolean) => void;
  stepIntervalMs?: number;
  /** Tiles currently occupied by something that moves independently of the static map data (e.g.
   *  a wandering npc) - blocks the player from walking onto them, same as a static npc/interactable
   *  object would. Read via a ref so passing a new array each render doesn't re-create attemptMove. */
  dynamicBlockers?: { x: number; y: number }[];
}

export function useGridMovement({
  map,
  start,
  suspended,
  onStep,
  stepIntervalMs = 220,
  dynamicBlockers,
}: UseGridMovementOptions) {
  const [resolvedStart, setResolvedStart] = useState(start);
  const [position, setPosition] = useState<GridPosition>({ x: start.x, y: start.y, facing: 'down' });
  // 'idle' whenever no step has landed recently - set to 'walking'/'running' right after a
  // successful step, then self-clears via a timeout reset on every subsequent step. Deliberately
  // not a continuous ticker (no setInterval) - one timer per step, so this doesn't add a second
  // recurring re-render source alongside the existing per-step setPosition re-render.
  const [movementState, setMovementState] = useState<'idle' | 'walking' | 'running'>('idle');
  const movementIdleTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const lastMoveRef = useRef(0);
  const positionRef = useRef(position);
  positionRef.current = position;
  const dynamicBlockersRef = useRef(dynamicBlockers);
  dynamicBlockersRef.current = dynamicBlockers;
  // attemptMove's own useCallback deliberately excludes onStep from its deps (see below) so
  // keyboard/drag/D-pad listeners bound to attemptMove don't churn on every render - but that
  // means attemptMove only picks up a *new* onStep closure when map/suspended/stepIntervalMs also
  // change. onStep (useLocationExploration's handleStep) is redefined fresh on every render and
  // closes over that render's own map/locationId/goTo, so calling a stale one can drive a
  // transition or encounter roll off out-of-date location data. Routing through a ref (same
  // pattern useDragMovement.ts already uses for attemptMoveRef) guarantees the *current* onStep
  // is always called regardless of whether attemptMove itself rebuilt this render.
  const onStepRef = useRef(onStep);
  onStepRef.current = onStep;

  // "Adjust state during render" (same pattern useTileMap.ts uses for `map`, and for the same
  // reason) rather than a useEffect. useLocationExploration's hook instance persists across
  // location transitions (no remount), so a post-commit effect leaves a one-render window where
  // a just-loaded map's TileGrid can mount and paint *before* position has been corrected to that
  // map's real spawn point - confirmed responsible for an intermittent "spawns in the top-left
  // corner" bug on a location's first (uncached) load, since useLocationExploration's spawnPoint
  // falls back to {1,1} for the render(s) before the map finishes loading, and that fallback was
  // otherwise only ever corrected on the *next* effect flush, after the map-loaded render had
  // already painted it.
  if (start.x !== resolvedStart.x || start.y !== resolvedStart.y) {
    setResolvedStart(start);
    setPosition({ x: start.x, y: start.y, facing: 'down' });
  }

  // Single source of truth for "try to move one tile in this direction" - the keyboard handler,
  // the mobile joystick, and any on-screen D-pad all funnel through this so they share the same
  // throttling/collision/turning behavior instead of three slightly different reimplementations.
  const attemptMove = useCallback(
    (facing: Facing, options?: { isDash?: boolean }) => {
      if (!map || suspended) return;

      const now = Date.now();
      const current = positionRef.current;
      const delta = FACING_TO_DELTA[facing];

      // Always allow turning to face a new direction even if the move itself is throttled/blocked.
      if (now - lastMoveRef.current < stepIntervalMs) {
        if (current.facing !== facing) setPosition({ ...current, facing });
        return;
      }

      const nextX = current.x + delta.dx;
      const nextY = current.y + delta.dy;
      const dynamicallyBlocked = dynamicBlockersRef.current?.some((b) => b.x === nextX && b.y === nextY);

      if (!isWalkable(map, nextX, nextY, facing) || dynamicallyBlocked) {
        if (current.facing !== facing) setPosition({ ...current, facing });
        return;
      }

      lastMoveRef.current = now;
      const next: GridPosition = { x: nextX, y: nextY, facing };
      setPosition(next);
      setMovementState(options?.isDash ? 'running' : 'walking');
      clearTimeout(movementIdleTimeoutRef.current);
      movementIdleTimeoutRef.current = setTimeout(() => setMovementState('idle'), stepIntervalMs + 40);
      onStepRef.current?.(next, options?.isDash);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [map, suspended, stepIntervalMs],
  );

  useEffect(() => () => clearTimeout(movementIdleTimeoutRef.current), []);

  useEffect(() => {
    if (!map || suspended) return;

    function handleKeyDown(e: KeyboardEvent) {
      if (isTypingTarget(e)) return;
      // Shift+direction is Dash, handled by a separate hook (useDashKeybind) - don't also take a
      // normal single-tile step on the same keypress.
      if (e.shiftKey) return;
      const facing = KEY_TO_FACING[e.key];
      if (!facing) return;
      e.preventDefault();
      attemptMove(facing);
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [map, suspended, attemptMove]);

  const facingDelta = useCallback((facing: Facing) => FACING_TO_DELTA[facing], []);

  return { position, positionRef, facingDelta, attemptMove, movementState };
}
