import { useEffect, useRef } from 'react';
import { updatePresence } from '@/firebase/presenceService';

const HEARTBEAT_INTERVAL_MS = 25_000;
// Position updates go out far more often than the full heartbeat, but still throttled - a write
// per single tile step would be excessive, so other players' movement renders a bit stepped
// rather than perfectly smooth. That's an acceptable tradeoff for a cozy town, not a fast-paced
// action game.
const POSITION_THROTTLE_MS = 1000;

/** Registers/refreshes this player's presence doc (including live position) every 25s while
 *  mounted, plus a throttled broadcast whenever position changes in between. Call from every
 *  exploration scene (Town/Overworld/Dungeon) - Overworld/Dungeon don't render other players'
 *  avatars, but their presence still counts toward the "N here" headcount shown everywhere. */
export function useHeartbeat(
  uid: string | undefined,
  displayName: string | undefined,
  locationId: string,
  position: { x: number; y: number } | undefined,
) {
  const joinedAtRef = useRef<number | null>(null);
  const positionRef = useRef(position);
  positionRef.current = position;
  const lastPositionSentAtRef = useRef(0);

  useEffect(() => {
    if (!uid || !displayName) return;
    if (joinedAtRef.current === null) joinedAtRef.current = Date.now();

    const avatarSymbol = displayName.slice(0, 2).toUpperCase();

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
    const avatarSymbol = displayName.slice(0, 2).toUpperCase();
    updatePresence({
      uid,
      displayName,
      avatarSymbol,
      locationId,
      lastHeartbeat: Date.now(),
      joinedAt: joinedAtRef.current,
      x: position.x,
      y: position.y,
    }).catch(() => {
      // Best-effort, same as the periodic heartbeat above.
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [position?.x, position?.y]);
}
