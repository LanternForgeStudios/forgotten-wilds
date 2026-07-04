import { useEffect, useRef, useState } from 'react';
import type { MapObject, TileMap } from '@/types';
import { isWalkable } from './useGridMovement';

interface Wanderer extends MapObject {
  refId: string;
  wanderRadius: number;
}

const STEP_INTERVAL_MS = 2200;
const MOVE_CHANCE = 0.5;

export interface WanderPosition {
  x: number;
  y: number;
}

/** Cosmetic client-side random walk for npc map objects that declare a `wanderRadius`. Purely
 *  local animation - not server state, not synced between players - since NPC position doesn't
 *  affect gameplay fairness the way player/combat state does. See [[useGridMovement]] for the
 *  shared walkability rule this reuses. */
export function useWanderingNpcs(map: TileMap | null): Record<string, WanderPosition> {
  const [positions, setPositions] = useState<Record<string, WanderPosition>>({});

  const homesKey = map
    ? map.objects
        .filter((o) => o.type === 'npc' && o.refId && o.wanderRadius)
        .map((o) => `${o.refId}:${o.x}:${o.y}:${o.wanderRadius}`)
        .join('|')
    : '';

  const mapRef = useRef(map);
  mapRef.current = map;

  useEffect(() => {
    if (!map) return;
    const wanderers = map.objects.filter(
      (o): o is Wanderer => o.type === 'npc' && !!o.refId && !!o.wanderRadius,
    );
    if (wanderers.length === 0) {
      setPositions({});
      return;
    }
    setPositions(Object.fromEntries(wanderers.map((w) => [w.refId, { x: w.x, y: w.y }])));

    const intervalId = window.setInterval(() => {
      const currentMap = mapRef.current;
      if (!currentMap) return;
      setPositions((prev) => {
        const next = { ...prev };
        for (const home of wanderers) {
          if (Math.random() > MOVE_CHANCE) continue;
          const current = prev[home.refId] ?? { x: home.x, y: home.y };
          const dx = Math.round(Math.random() * 2 - 1);
          const dy = dx === 0 ? Math.round(Math.random() * 2 - 1) : 0;
          if (dx === 0 && dy === 0) continue;
          const candidateX = current.x + dx;
          const candidateY = current.y + dy;
          const withinHomeRadius =
            Math.abs(candidateX - home.x) <= home.wanderRadius && Math.abs(candidateY - home.y) <= home.wanderRadius;
          if (!withinHomeRadius || !isWalkable(currentMap, candidateX, candidateY)) continue;
          next[home.refId] = { x: candidateX, y: candidateY };
        }
        return next;
      });
    }, STEP_INTERVAL_MS);

    return () => window.clearInterval(intervalId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [homesKey]);

  return positions;
}
