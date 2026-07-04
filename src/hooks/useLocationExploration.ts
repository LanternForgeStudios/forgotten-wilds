import { useEffect, useMemo, useRef } from 'react';
import { useGridMovement, type GridPosition } from './useGridMovement';
import { useTileMap } from './useTileMap';
import { useWanderingNpcs } from './useWanderingNpcs';
import { useSceneStore } from '@/state/useSceneStore';
import { useAuthStore } from '@/state/useAuthStore';
import { callEnterLocation } from '@/firebase/functionsClient';
import { resyncSave } from '@/state/hydrate';
import { sceneForLocationKind } from '@/utils/sceneForLocationKind';
import { LOCATIONS } from '@/data';

interface UseLocationExplorationOptions {
  locationId: string;
  suspended?: boolean;
  onEncounterZoneStep?: (chance: number, pos: GridPosition) => void;
}

/** Shared map-load + spawn-resolution + movement + transition logic for Town/Overworld/Dungeon scenes. */
export function useLocationExploration({
  locationId,
  suspended,
  onEncounterZoneStep,
}: UseLocationExplorationOptions) {
  const location = LOCATIONS.find((l) => l.id === locationId)!;
  const { map } = useTileMap(locationId, location.mapAssetId);
  const params = useSceneStore((s) => s.params);
  const goTo = useSceneStore((s) => s.goTo);
  const uid = useAuthStore((s) => s.user?.uid);

  const reportedLocationRef = useRef<string | null>(null);
  useEffect(() => {
    if (!uid || reportedLocationRef.current === locationId) return;
    reportedLocationRef.current = locationId;
    callEnterLocation(locationId)
      .then(() => resyncSave(uid))
      .catch(() => {
        // Non-critical (journal/quest bookkeeping only) - exploration continues regardless.
      });
  }, [uid, locationId]);

  const spawnPoint = useMemo(() => {
    if (!map) return { x: 1, y: 1 };
    if (params.locationId === locationId && params.spawnX !== undefined && params.spawnY !== undefined) {
      return { x: params.spawnX, y: params.spawnY };
    }
    const spawnId = params.locationId === locationId ? (params.spawnId ?? 'default') : 'default';
    const spawn = map.objects.find((o) => o.type === 'spawnPoint' && o.refId === spawnId);
    return spawn ? { x: spawn.x, y: spawn.y } : { x: 1, y: 1 };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map]);

  const handleStep = (pos: GridPosition, isDash?: boolean) => {
    if (!map) return;

    const transition = map.objects.find(
      (o) =>
        o.type === 'transition' &&
        o.x === pos.x &&
        o.y === pos.y &&
        (!o.requiredFacing || o.requiredFacing === pos.facing),
    );
    if (transition?.refId) {
      const targetLocation = LOCATIONS.find((l) => l.id === transition.refId);
      const scene = targetLocation ? sceneForLocationKind(targetLocation.kind) : undefined;
      if (scene) {
        goTo(scene, { locationId: transition.refId, spawnId: transition.targetSpawnId });
        return;
      }
    }

    // Dashing through a stretch of trail is exactly what it's for - no encounter roll mid-dash.
    if (isDash) return;

    const zone = map.objects.find(
      (o) => o.type === 'encounterZone' && o.x === pos.x && o.y === pos.y,
    );
    if (zone) {
      onEncounterZoneStep?.(zone.encounterChance ?? 0.15, pos);
    }
  };

  const wanderPositions = useWanderingNpcs(map);
  const dynamicBlockers = useMemo(() => Object.values(wanderPositions), [wanderPositions]);

  const { position, positionRef, facingDelta, attemptMove } = useGridMovement({
    map,
    start: spawnPoint,
    suspended,
    onStep: handleStep,
    dynamicBlockers,
  });

  return { location, map, position, positionRef, facingDelta, attemptMove, wanderPositions };
}
