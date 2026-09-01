import { useCallback, useEffect, useMemo, useRef } from 'react';
import { useGridMovement, type GridPosition } from './useGridMovement';
import { useMovementInput } from './useMovementInput';
import { useTileMap } from './useTileMap';
import { useWanderingNpcs } from './useWanderingNpcs';
import { useSceneStore } from '@/state/useSceneStore';
import { useAuthStore } from '@/state/useAuthStore';
import { useQuestStore } from '@/state/useQuestStore';
import { callEnterLocation } from '@/firebase/functionsClient';
import { resyncSave } from '@/state/hydrate';
import { sceneForLocationKind } from '@/utils/sceneForLocationKind';
import { getBlockedMessage } from '@/utils/locationGates';
import { playSound } from '@/audio/audioService';
import { LOCATIONS } from '@/data';
import type { MapObject } from '@/types';

interface UseLocationExplorationOptions {
  locationId: string;
  suspended?: boolean;
  /** Called instead of transitioning when the target location is gated behind an incomplete
   *  quest - the caller decides how to surface it (every scene already has a message Panel). */
  onBlockedTransition?: (message: string) => void;
}

/** Shared map-load + spawn-resolution + movement + transition logic for Town/Overworld/Dungeon scenes. */
export function useLocationExploration({ locationId, suspended, onBlockedTransition }: UseLocationExplorationOptions) {
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
    if (!map) return { x: 1, y: 1, facing: 'down' as const };
    if (params.locationId === locationId && params.spawnX !== undefined && params.spawnY !== undefined) {
      return { x: params.spawnX, y: params.spawnY, facing: 'down' as const };
    }
    const spawnPoints = map.objects.filter((o) => o.type === 'spawnPoint');
    const spawnId = params.locationId === locationId ? (params.spawnId ?? 'default') : 'default';
    // Exact refId match first; otherwise fall back to the map's first-authored spawn point rather
    // than a hardcoded {1,1} corner. No interior building map actually defines a 'default' spawn -
    // every one of them names its (only, or primary) spawn point after where it's entered from
    // (e.g. 'from-ash-hallow') - so a cold reload/direct nav with no matching params used to always
    // resolve to {1,1} (reported live: "spawns in the top-left instead of the normal entry spawn
    // point"). Falling back to spawnPoints[0] lands on that same front-door spawn instead, since
    // every interior map authors it as its first (often only) spawn point object.
    const spawn = spawnPoints.find((o) => o.refId === spawnId) ?? spawnPoints[0];
    return spawn ? { x: spawn.x, y: spawn.y, facing: spawn.spawnFacing ?? 'down' } : { x: 1, y: 1, facing: 'down' as const };
    // useTileMap caches loaded maps across visits, so `map` keeps the same object reference on a
    // repeat visit - this must also depend on the actual spawn-selecting params, or arriving back
    // at an already-cached location from a different neighboring map won't recompute and will
    // silently reuse whichever spawn point was resolved the very first time that map was loaded.
  }, [map, locationId, params.locationId, params.spawnId, params.spawnX, params.spawnY]);

  // Paused while an overlay (dialogue, menus, shop, etc.) is open, same as movement - an NPC
  // wandering off mid-conversation reads as a bug, not ambience.
  const wanderPositions = useWanderingNpcs(map, suspended);

  const { position, positionRef, movementState, reportPosition, spawnPosition } = useGridMovement({ start: spawnPoint });
  const movementInput = useMovementInput(!suspended && !!map);

  // Rounded to the nearest tile - still used for facing-tile interaction targeting in
  // TownScene/OverworldScene/DungeonScene's attemptInteract (Phase 4 replaces this with a real
  // pixel-space probe; not yet done). Zone/transition entry itself no longer goes through this -
  // see handleZoneEnter/handleTransitionEnter below, driven by ExplorationScene's own per-frame
  // Arcade overlap checks instead of a rounded-tile comparison.
  const tileX = Math.round(position.x);
  const tileY = Math.round(position.y);
  const tilePosition = useMemo<GridPosition>(() => ({ x: tileX, y: tileY, facing: position.facing }), [tileX, tileY, position.facing]);

  // Passed to PhaserExplorationCanvas as `onTransitionEnter`. Quest-gate check + goTo() - identical
  // logic to what the old rounded-tile effect ran inline, just invoked from a real physics overlap
  // event now instead of a tile-equality comparison.
  const handleTransitionEnter = useCallback(
    (transition: MapObject) => {
      if (!transition.refId) return;
      const blockedMessage = getBlockedMessage(transition.refId, useQuestStore.getState().progress, locationId);
      if (blockedMessage) {
        onBlockedTransition?.(blockedMessage);
        return;
      }
      const targetLocation = LOCATIONS.find((l) => l.id === transition.refId);
      const scene = targetLocation ? sceneForLocationKind(targetLocation.kind) : undefined;
      if (scene) {
        void playSound('sfx.transition');
        goTo(scene, { locationId: transition.refId, spawnId: transition.targetSpawnId });
      }
    },
    [goTo, onBlockedTransition, locationId],
  );

  return {
    location,
    map,
    position,
    positionRef,
    tilePosition,
    spawnPosition,
    movementState,
    reportPosition,
    movementInput,
    wanderPositions,
    handleTransitionEnter,
  };
}
