import { useEffect, useMemo, useRef } from 'react';
import { useGridMovement, type GridPosition } from './useGridMovement';
import { useTileMap } from './useTileMap';
import { useWanderingNpcs } from './useWanderingNpcs';
import { useSceneStore } from '@/state/useSceneStore';
import { useAuthStore } from '@/state/useAuthStore';
import { useQuestStore } from '@/state/useQuestStore';
import { callEnterLocation } from '@/firebase/functionsClient';
import { resyncSave } from '@/state/hydrate';
import { sceneForLocationKind } from '@/utils/sceneForLocationKind';
import { getBlockedMessage } from '@/utils/locationGates';
import { LOCATIONS } from '@/data';

interface UseLocationExplorationOptions {
  locationId: string;
  suspended?: boolean;
  /** Called on every completed step (dash included - a visible, deliberately-placed field
   *  encounter icon isn't the kind of thing Dash should let the player slip past unnoticed, unlike
   *  the old invisible per-tile probability roll this replaced). The caller owns the actual icon
   *  set (see useFieldEncounters) and decides what, if anything, happened at this position. */
  onFieldEncounterStep?: (pos: GridPosition) => void;
  /** Called instead of transitioning when the target location is gated behind an incomplete
   *  quest - the caller decides how to surface it (every scene already has a message Panel). */
  onBlockedTransition?: (message: string) => void;
}

/** Shared map-load + spawn-resolution + movement + transition logic for Town/Overworld/Dungeon scenes. */
export function useLocationExploration({
  locationId,
  suspended,
  onFieldEncounterStep,
  onBlockedTransition,
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
    // useTileMap caches loaded maps across visits, so `map` keeps the same object reference on a
    // repeat visit - this must also depend on the actual spawn-selecting params, or arriving back
    // at an already-cached location from a different neighboring map won't recompute and will
    // silently reuse whichever spawn point was resolved the very first time that map was loaded.
  }, [map, locationId, params.locationId, params.spawnId, params.spawnX, params.spawnY]);

  // No `isDash` param (unlike the old encounterZone-gated version) - field-encounter icons trigger
  // regardless of Dash, per the onFieldEncounterStep doc comment above.
  const handleStep = (pos: GridPosition) => {
    if (!map) return;

    const transition = map.objects.find(
      (o) =>
        o.type === 'transition' &&
        o.x === pos.x &&
        o.y === pos.y &&
        (!o.requiredFacing || o.requiredFacing === pos.facing),
    );
    if (transition?.refId) {
      const blockedMessage = getBlockedMessage(transition.refId, useQuestStore.getState().progress);
      if (blockedMessage) {
        onBlockedTransition?.(blockedMessage);
        return;
      }
      const targetLocation = LOCATIONS.find((l) => l.id === transition.refId);
      const scene = targetLocation ? sceneForLocationKind(targetLocation.kind) : undefined;
      if (scene) {
        goTo(scene, { locationId: transition.refId, spawnId: transition.targetSpawnId });
        return;
      }
    }

    onFieldEncounterStep?.(pos);
  };

  // Paused while an overlay (dialogue, menus, shop, etc.) is open, same as movement - an NPC
  // wandering off mid-conversation reads as a bug, not ambience.
  const wanderPositions = useWanderingNpcs(map, suspended);
  const dynamicBlockers = useMemo(() => Object.values(wanderPositions), [wanderPositions]);

  const { position, positionRef, facingDelta, attemptMove, movementState } = useGridMovement({
    map,
    start: spawnPoint,
    suspended,
    onStep: handleStep,
    dynamicBlockers,
  });

  return { location, map, position, positionRef, facingDelta, attemptMove, movementState, wanderPositions };
}
