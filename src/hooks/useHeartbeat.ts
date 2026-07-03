import { useEffect, useRef } from 'react';
import { updatePresence } from '@/firebase/presenceService';

const HEARTBEAT_INTERVAL_MS = 25_000;

/** Registers/refreshes this player's presence doc every 25s while mounted (see plan: 25s heartbeat / 60s staleness). */
export function useHeartbeat(uid: string | undefined, displayName: string | undefined, locationId: string) {
  const joinedAtRef = useRef<number | null>(null);

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
      }).catch(() => {
        // Best-effort — a missed heartbeat just makes this player look offline a bit sooner.
      });
    }

    beat();
    const id = setInterval(beat, HEARTBEAT_INTERVAL_MS);
    return () => clearInterval(id);
  }, [uid, displayName, locationId]);
}
