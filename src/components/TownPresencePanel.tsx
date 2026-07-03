import { useEffect, useState } from 'react';
import type { OnlinePresence } from '@/types';
import { subscribeToPresence } from '@/firebase/presenceService';
import { useAuthStore } from '@/state/useAuthStore';
import { Panel } from './common/Panel';
import styles from './TownPresencePanel.module.css';

const STALE_AFTER_MS = 60_000;

interface TownPresencePanelProps {
  locationId: string;
}

/** Shows other players currently in this location, via a live Firestore subscription with client-side staleness filtering. */
export function TownPresencePanel({ locationId }: TownPresencePanelProps) {
  const uid = useAuthStore((s) => s.user?.uid);
  const [presences, setPresences] = useState<OnlinePresence[]>([]);

  useEffect(() => {
    const unsubscribe = subscribeToPresence(setPresences);
    return unsubscribe;
  }, []);

  const now = Date.now();
  const visible = presences
    .filter((p) => p.locationId === locationId && now - p.lastHeartbeat < STALE_AFTER_MS)
    .sort((a, b) => a.joinedAt - b.joinedAt);

  return (
    <Panel className={styles.panel}>
      <p className={styles.title}>In Ash Hallow ({visible.length})</p>
      {visible.length === 0 && <p className={styles.empty}>No one else here right now.</p>}
      {visible.map((p) => (
        <div key={p.uid} className={styles.row}>
          <span className={styles.avatar}>{p.avatarSymbol}</span>
          <span className={styles.name}>
            {p.displayName}
            {p.uid === uid ? ' (you)' : ''}
          </span>
        </div>
      ))}
    </Panel>
  );
}
