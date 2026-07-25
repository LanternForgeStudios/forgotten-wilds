import { useEffect, useRef, useState } from 'react';
import type { MapObject, TileMap } from '@/types';
import { isWalkable, type Facing } from './useGridMovement';

interface NpcObject extends MapObject {
  refId: string;
}

const STEP_INTERVAL_MS = 2200;
const MOVE_CHANCE = 0.5;
// How long a step's `isMoving` flag stays true before reverting to idle - must be at least
// ExplorationScene.ts's own GLIDE_MS (220ms, the Phaser tween duration that visually glides the
// sprite to its new tile) so the walking animation doesn't cut back to idle mid-glide. A little
// slack (not imported/shared with GLIDE_MS directly - this hook doesn't otherwise reach into
// src/phaser/*, matching the "Phaser owns canvas, React owns state" layering everywhere else)
// rather than an exact match, so a slightly slow frame doesn't clip the tail end of the glide.
const WALK_ANIM_CLEAR_MS = 260;

export interface WanderPosition {
  x: number;
  y: number;
  /** Which direction the most recent step moved - only meaningful while `isMoving` is true.
   *  Persists at its last value once `isMoving` clears, so a caller that reads it while idle just
   *  sees "the direction it was last walking," which is harmless since nothing renders a facing
   *  for a non-moving entity. */
  facing?: Facing;
  /** True for WALK_ANIM_CLEAR_MS after a step, then reverts to false/undefined - the transient
   *  signal a caller uses to play a walking animation only during the tile-to-tile glide, matching
   *  a stationary NPC's idle the rest of the time. */
  isMoving?: boolean;
}

/** Current tile of every npc on the map - not just the ones that wander. This doubles as the
 *  single source of truth for npc collision (see `dynamicBlockers` in useGridMovement): a static
 *  npc's entry never moves from its home tile, and a `wanderRadius` npc's entry is nudged by a
 *  cosmetic client-side random walk (not server state, not synced between players - npc position
 *  doesn't affect gameplay fairness the way player/combat state does). */
export function useWanderingNpcs(map: TileMap | null, paused?: boolean): Record<string, WanderPosition> {
  const [positions, setPositions] = useState<Record<string, WanderPosition>>({});
  const pausedRef = useRef(paused);
  pausedRef.current = paused;

  const homesKey = map
    ? map.objects
        .filter((o) => o.type === 'npc' && o.refId)
        .map((o) => `${o.refId}:${o.x}:${o.y}:${o.wanderRadius ?? 0}`)
        .join('|')
    : '';

  const mapRef = useRef(map);
  mapRef.current = map;
  // Every setTimeout scheduled to clear a step's isMoving flag - tracked so the effect's own
  // cleanup can cancel any still-pending ones (a location change or unmount mid-glide shouldn't
  // leave a stray setPositions call firing against a superseded/unmounted hook instance).
  const pendingClearsRef = useRef<number[]>([]);

  useEffect(() => {
    if (!map) return;
    const npcs = map.objects.filter((o): o is NpcObject => o.type === 'npc' && !!o.refId);
    if (npcs.length === 0) {
      setPositions({});
      return;
    }
    setPositions(Object.fromEntries(npcs.map((n) => [n.refId, { x: n.x, y: n.y }])));

    const wanderers = npcs.filter((n) => !!n.wanderRadius);
    if (wanderers.length === 0) return;

    const intervalId = window.setInterval(() => {
      const currentMap = mapRef.current;
      if (!currentMap) return;
      if (pausedRef.current) return;
      setPositions((prev) => {
        // Returning `prev` itself (not just an equivalent copy) when no wanderer actually moved
        // this tick lets React bail out of re-rendering everything that reads these positions -
        // most ticks roll no movement at all (MOVE_CHANCE, radius, or collision), so without this
        // every consumer would re-render every STEP_INTERVAL_MS for a no-op update.
        let changed = false;
        const next = { ...prev };
        for (const home of wanderers) {
          if (Math.random() > MOVE_CHANCE) continue;
          const current = prev[home.refId] ?? { x: home.x, y: home.y };
          const dx = Math.round(Math.random() * 2 - 1);
          const dy = dx === 0 ? Math.round(Math.random() * 2 - 1) : 0;
          if (dx === 0 && dy === 0) continue;
          const candidateX = current.x + dx;
          const candidateY = current.y + dy;
          const radius = home.wanderRadius!;
          const withinHomeRadius = Math.abs(candidateX - home.x) <= radius && Math.abs(candidateY - home.y) <= radius;
          if (!withinHomeRadius || !isWalkable(currentMap, candidateX, candidateY)) continue;
          const facing: Facing = dx === 1 ? 'right' : dx === -1 ? 'left' : dy === 1 ? 'down' : 'up';
          next[home.refId] = { x: candidateX, y: candidateY, facing, isMoving: true };
          changed = true;

          const refId = home.refId;
          const timeoutId = window.setTimeout(() => {
            setPositions((p) => {
              const cur = p[refId];
              if (!cur || !cur.isMoving) return p;
              return { ...p, [refId]: { ...cur, isMoving: false } };
            });
          }, WALK_ANIM_CLEAR_MS);
          pendingClearsRef.current.push(timeoutId);
        }
        return changed ? next : prev;
      });
    }, STEP_INTERVAL_MS);

    return () => {
      window.clearInterval(intervalId);
      for (const id of pendingClearsRef.current) window.clearTimeout(id);
      pendingClearsRef.current = [];
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [homesKey]);

  return positions;
}
