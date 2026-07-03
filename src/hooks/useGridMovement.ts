import { useCallback, useEffect, useRef, useState } from 'react';
import type { TileMap } from '@/types';

export type Facing = 'up' | 'down' | 'left' | 'right';

export interface GridPosition {
  x: number;
  y: number;
  facing: Facing;
}

const KEY_TO_DELTA: Record<string, { dx: number; dy: number; facing: Facing }> = {
  ArrowUp: { dx: 0, dy: -1, facing: 'up' },
  w: { dx: 0, dy: -1, facing: 'up' },
  W: { dx: 0, dy: -1, facing: 'up' },
  ArrowDown: { dx: 0, dy: 1, facing: 'down' },
  s: { dx: 0, dy: 1, facing: 'down' },
  S: { dx: 0, dy: 1, facing: 'down' },
  ArrowLeft: { dx: -1, dy: 0, facing: 'left' },
  a: { dx: -1, dy: 0, facing: 'left' },
  A: { dx: -1, dy: 0, facing: 'left' },
  ArrowRight: { dx: 1, dy: 0, facing: 'right' },
  d: { dx: 1, dy: 0, facing: 'right' },
  D: { dx: 1, dy: 0, facing: 'right' },
};

const BLOCKING_OBJECT_TYPES = new Set(['npc', 'interactable']);

function isWalkable(map: TileMap, x: number, y: number): boolean {
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

  useEffect(() => {
    if (!map || suspended) return;

    function handleKeyDown(e: KeyboardEvent) {
      const delta = KEY_TO_DELTA[e.key];
      if (!delta) return;
      e.preventDefault();

      const now = Date.now();
      const current = positionRef.current;

      // Always allow turning to face a new direction even if the move itself is throttled/blocked.
      if (now - lastMoveRef.current < stepIntervalMs) {
        if (current.facing !== delta.facing) setPosition({ ...current, facing: delta.facing });
        return;
      }

      const nextX = current.x + delta.dx;
      const nextY = current.y + delta.dy;

      if (!isWalkable(map!, nextX, nextY)) {
        if (current.facing !== delta.facing) setPosition({ ...current, facing: delta.facing });
        return;
      }

      lastMoveRef.current = now;
      const next: GridPosition = { x: nextX, y: nextY, facing: delta.facing };
      setPosition(next);
      onStep?.(next);
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, suspended, stepIntervalMs]);

  const facingDelta = useCallback((facing: Facing) => {
    switch (facing) {
      case 'up':
        return { dx: 0, dy: -1 };
      case 'down':
        return { dx: 0, dy: 1 };
      case 'left':
        return { dx: -1, dy: 0 };
      case 'right':
        return { dx: 1, dy: 0 };
    }
  }, []);

  return { position, facingDelta };
}
