import { useEffect, useRef, useState } from 'react';
import type { MapObject, TileMap } from '@/types';
import { isWalkable } from './useGridMovement';

interface NpcObject extends MapObject {
  refId: string;
}

const STEP_INTERVAL_MS = 2200;
const MOVE_CHANCE = 0.5;

export interface WanderPosition {
  x: number;
  y: number;
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
          next[home.refId] = { x: candidateX, y: candidateY };
          changed = true;
        }
        return changed ? next : prev;
      });
    }, STEP_INTERVAL_MS);

    return () => window.clearInterval(intervalId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [homesKey]);

  return positions;
}
