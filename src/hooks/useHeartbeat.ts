import { useEffect, useRef } from 'react';
import { updatePresence } from '@/firebase/presenceService';
import type { PlayerEquipment } from '@/types';

const HEARTBEAT_INTERVAL_MS = 25_000;
// Position updates go out far more often than the full heartbeat, but still throttled - a write
// per single tile step would be excessive, so other players' movement renders a bit stepped
// rather than perfectly smooth. That's an acceptable tradeoff for a cozy town, not a fast-paced
// action game.
// Exported so TownScene.tsx's otherPlayerEntities can set GridEntity.glideMs to match - a remote
// player's position only ever changes this often, so its glide animation should take exactly this
// long too, rather than the short per-tile NPC-wander glide (a quick slide then a freeze until the
// next update, otherwise - see ExplorationScene.ts's own GLIDE_MS comment).
export const POSITION_THROTTLE_MS = 1000;

/** Registers/refreshes this player's presence doc (including live position) every 25s while
 *  mounted, plus a throttled broadcast whenever position changes in between. Call from every
 *  exploration scene (Town/Overworld/Dungeon) - Overworld/Dungeon don't render other players'
 *  avatars, but their presence still counts toward the "N here" headcount shown everywhere. */
export function useHeartbeat(
  uid: string | undefined,
  displayName: string | undefined,
  locationId: string,
  position: { x: number; y: number; facing?: 'up' | 'down' | 'left' | 'right' } | undefined,
  gender?: 'male' | 'female',
  appearance?: 'white-dark' | 'black-dark' | 'white-blonde' | 'asian-dark',
  equipment?: PlayerEquipment,
) {
  const joinedAtRef = useRef<number | null>(null);
  const positionRef = useRef(position);
  positionRef.current = position;
  const genderRef = useRef(gender);
  genderRef.current = gender;
  const appearanceRef = useRef(appearance);
  appearanceRef.current = appearance;
  const equipmentRef = useRef(equipment);
  equipmentRef.current = equipment;
  const lastPositionSentAtRef = useRef(0);
  // Computed once and shared by both effects below (previously duplicated in each) - harmless
  // empty-string fallback when displayName isn't ready yet, since both effects bail out before
  // ever reading it in that case.
  const avatarSymbol = displayName ? displayName.slice(0, 2).toUpperCase() : '';

  useEffect(() => {
    if (!uid || !displayName) return;
    if (joinedAtRef.current === null) joinedAtRef.current = Date.now();

    function beat() {
      updatePresence({
        uid: uid!,
        displayName: displayName!,
        avatarSymbol,
        locationId,
        lastHeartbeat: Date.now(),
        joinedAt: joinedAtRef.current!,
        x: positionRef.current?.x ?? 0,
        y: positionRef.current?.y ?? 0,
        gender: genderRef.current,
        appearance: appearanceRef.current,
        equipment: equipmentRef.current,
        facing: positionRef.current?.facing,
      }).catch(() => {
        // Best-effort — a missed heartbeat just makes this player look offline a bit sooner.
      });
    }

    beat();
    const id = setInterval(beat, HEARTBEAT_INTERVAL_MS);
    return () => clearInterval(id);
  }, [uid, displayName, locationId]);

  useEffect(() => {
    if (!uid || !displayName || !position || joinedAtRef.current === null) return;
    const now = Date.now();
    if (now - lastPositionSentAtRef.current < POSITION_THROTTLE_MS) return;
    lastPositionSentAtRef.current = now;
    updatePresence({
      uid,
      displayName,
      avatarSymbol,
      locationId,
      lastHeartbeat: Date.now(),
      joinedAt: joinedAtRef.current,
      x: position.x,
      y: position.y,
      gender: genderRef.current,
      appearance: appearanceRef.current,
      equipment: equipmentRef.current,
      facing: position.facing,
    }).catch(() => {
      // Best-effort, same as the periodic heartbeat above.
    });
    // Facing is included so turning in place (no x/y change) still broadcasts promptly, instead
    // of only updating on the next actual move or the next ~25s periodic heartbeat.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [position?.x, position?.y, position?.facing]);
}
