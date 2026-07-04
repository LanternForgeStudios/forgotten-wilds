import { useCallback, useEffect, useRef, useState } from 'react';
import type { TileMap } from '@/types';

export type Facing = 'up' | 'down' | 'left' | 'right';

export interface GridPosition {
  x: number;
  y: number;
  facing: Facing;
}

const KEY_TO_FACING: Record<string, Facing> = {
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

const BLOCKING_OBJECT_TYPES = new Set(['npc', 'interactable']);

export function isWalkable(map: TileMap, x: number, y: number): boolean {
  if (x < 0 || y < 0 || x >= map.width || y >= map.height) return false;
  const ground = map.layers.find((l) => l.name === 'ground');
  if (!ground) return false;
  const gid = ground.data[y * map.width + x];
  if (!map.walkableTileIds.includes(gid)) return false;
  const blocked = map.objects.some((o) => BLOCKING_OBJECT_TYPES.has(o.type) && o.x === x && o.y === y);
  return !blocked;
}

interface UseGridMovementOptions {
  map: TileMap | null;
  start: { x: number; y: number };
  /** Movement is suspended while true (e.g. dialogue open, combat active). */
  suspended?: boolean;
  onStep?: (pos: GridPosition) => void;
  stepIntervalMs?: number;
}

export function useGridMovement({ map, start, suspended, onStep, stepIntervalMs = 150 }: UseGridMovementOptions) {
  const [position, setPosition] = useState<GridPosition>({ x: start.x, y: start.y, facing: 'down' });
  const lastMoveRef = useRef(0);
  const positionRef = useRef(position);
  positionRef.current = position;

  useEffect(() => {
    setPosition({ x: start.x, y: start.y, facing: 'down' });
  }, [start.x, start.y]);

  // Single source of truth for "try to move one tile in this direction" - the keyboard handler,
  // the mobile joystick, and any on-screen D-pad all funnel through this so they share the same
  // throttling/collision/turning behavior instead of three slightly different reimplementations.
  const attemptMove = useCallback(
    (facing: Facing) => {
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

      if (!isWalkable(map, nextX, nextY)) {
        if (current.facing !== facing) setPosition({ ...current, facing });
        return;
      }

      lastMoveRef.current = now;
      const next: GridPosition = { x: nextX, y: nextY, facing };
      setPosition(next);
      onStep?.(next);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [map, suspended, stepIntervalMs],
  );

  useEffect(() => {
    if (!map || suspended) return;

    function handleKeyDown(e: KeyboardEvent) {
      const facing = KEY_TO_FACING[e.key];
      if (!facing) return;
      e.preventDefault();
      attemptMove(facing);
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [map, suspended, attemptMove]);

  const facingDelta = useCallback((facing: Facing) => FACING_TO_DELTA[facing], []);

  return { position, facingDelta, attemptMove };
}
