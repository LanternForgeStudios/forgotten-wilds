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
  // Any populated ground tile is walkable by default - only an explicit walkable:false exception
  // (walls, water, ...) or an empty tile (gid 0, nothing painted there) blocks movement.
  if (gid <= 0 || map.nonWalkableTileIds.includes(gid)) return false;
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
  /** The throttle floor for a step taken with `isDash: true` - separate from (and faster than)
   *  stepIntervalMs, matching Dash's own faster glide (ExplorationScene.ts's DASH_GLIDE_MS) and
   *  loop cadence (useDash.ts's DASH_STEP_MS). Previously Dash silently fell back to the plain
   *  walking throttle here (this option didn't actually exist despite useDash.ts's own comment
   *  assuming it did) - real dash steps landed slower than the glide animation tuned for them,
   *  leaving a visible gap between each glide instead of one continuous run. */
  dashStepIntervalMs?: number;
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
  dashStepIntervalMs = 100,
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
      const throttleMs = options?.isDash ? dashStepIntervalMs : stepIntervalMs;

      // Always allow turning to face a new direction even if the move itself is throttled/blocked.
      if (now - lastMoveRef.current < throttleMs) {
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
      movementIdleTimeoutRef.current = setTimeout(() => setMovementState('idle'), throttleMs + 40);
      onStepRef.current?.(next, options?.isDash);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [map, suspended, stepIntervalMs, dashStepIntervalMs],
  );

  useEffect(() => () => clearTimeout(movementIdleTimeoutRef.current), []);

  // Held-direction movement drives its own interval instead of relying on the browser's keyboard
  // auto-repeat: OS key-repeat has a long initial delay (~500ms, tuned for text editing) before it
  // starts firing repeat keydowns, which is longer than stepIntervalMs - holding a direction would
  // take one instant step, then visibly stutter/pause until the OS repeat caught up. Polling
  // attemptMove ourselves on a short interval (well under stepIntervalMs - attemptMove's own
  // throttle still gates the actual move rate, so over-calling it is harmless) removes that dead
  // pause entirely, same fix already applied to Dash via useDashKeybind's held-Shift tracking.
  const heldFacingRef = useRef<Facing | null>(null);
  // Tracks whichever direction key is *physically* held down right now, independent of who
  // currently owns movement (this loop vs. useDash.ts's own loop while Shift is also held) - lets
  // Shift's keyup handler below re-arm normal held-movement for a direction that was never
  // released, instead of leaving it frozen. See handleKeyUp's 'Shift' case.
  const physicallyHeldFacingRef = useRef<Facing | null>(null);
  const attemptMoveRef = useRef(attemptMove);
  attemptMoveRef.current = attemptMove;

  useEffect(() => {
    if (!map || suspended) return;
    let intervalId: ReturnType<typeof setInterval> | undefined;

    function startHolding(facing: Facing) {
      heldFacingRef.current = facing;
      attemptMoveRef.current(facing);
      if (intervalId === undefined) {
        intervalId = setInterval(() => {
          if (heldFacingRef.current) attemptMoveRef.current(heldFacingRef.current);
        }, 50);
      }
    }

    function stopHolding() {
      heldFacingRef.current = null;
      clearInterval(intervalId);
      intervalId = undefined;
    }

    function handleKeyDown(e: KeyboardEvent) {
      if (isTypingTarget(e)) return;
      // Pressing Shift while already holding a direction (a very natural way to start dashing)
      // must stop this hold, not just decline to start a new one - useDashKeybind's own Shift
      // keydown handler starts a *second*, independent hold-loop via useDash.ts, and without this
      // the two would keep calling attemptMove concurrently for the rest of the hold. Whichever
      // loop's interval happens to win a given throttle window decides that step's movementState
      // ('walking' vs 'running'), so an in-progress Dash would randomly get a slower glide
      // duration and no dust FX on the steps the normal loop won - the stutter this fixes.
      if (e.key === 'Shift') {
        if (heldFacingRef.current) stopHolding();
        return;
      }
      const facing = KEY_TO_FACING[e.key];
      // Tracked before the Shift check below so a direction pressed (or already held) while Shift
      // is down is still remembered - otherwise releasing Shift later has no record of it to
      // resume.
      if (facing) physicallyHeldFacingRef.current = facing;
      // Shift+direction is Dash, handled by a separate hook (useDashKeybind) - don't also take a
      // normal single-tile step on the same keypress.
      if (e.shiftKey) return;
      if (!facing) return;
      e.preventDefault();
      // The OS's own auto-repeat re-fires keydown for the still-held key - ignore those (the
      // interval above already has it covered) rather than restarting the loop every repeat.
      if (heldFacingRef.current === facing) return;
      startHolding(facing);
    }

    function handleKeyUp(e: KeyboardEvent) {
      // Releasing Shift while a direction is still physically held must hand movement back to
      // this loop - useDash.ts's own loop (which owned movement while Shift was down) stops on
      // this same keyup, and without this nothing else re-arms the normal loop, leaving the
      // player frozen despite still holding a direction key.
      if (e.key === 'Shift') {
        if (physicallyHeldFacingRef.current) startHolding(physicallyHeldFacingRef.current);
        return;
      }
      const facing = KEY_TO_FACING[e.key];
      if (!facing) return;
      if (physicallyHeldFacingRef.current === facing) physicallyHeldFacingRef.current = null;
      if (heldFacingRef.current !== facing) return;
      stopHolding();
    }

    // Losing focus (alt-tab, clicking outside the game) never fires a keyup for whatever was held
    // - without this the interval would keep calling attemptMove indefinitely.
    function handleBlur() {
      stopHolding();
      physicallyHeldFacingRef.current = null;
    }

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('blur', handleBlur);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('blur', handleBlur);
      stopHolding();
    };
  }, [map, suspended]);

  const facingDelta = useCallback((facing: Facing) => FACING_TO_DELTA[facing], []);

  return { position, positionRef, facingDelta, attemptMove, movementState };
}
