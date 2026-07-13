import { collection, doc, onSnapshot, setDoc } from 'firebase/firestore';
import type { OnlinePresence } from '@/types';
import { db } from './firebaseConfig';

/**
 * Direct client writes — presence is the one collection clients write to themselves (see
 * firestore.rules). Worst-case tampering here is a fake nameplate, not an economy exploit,
 * and real-time responsiveness matters more than server validation for town presence.
 */
export async function updatePresence(presence: OnlinePresence): Promise<void> {
  await setDoc(doc(db, 'presence', presence.uid), {
    displayName: presence.displayName,
    avatarSymbol: presence.avatarSymbol,
    locationId: presence.locationId,
    lastHeartbeat: presence.lastHeartbeat,
    joinedAt: presence.joinedAt,
    x: presence.x,
    y: presence.y,
    skin: presence.skin ?? 'male',
  });
}

export function subscribeToPresence(callback: (all: OnlinePresence[]) => void): () => void {
  return onSnapshot(collection(db, 'presence'), (snap) => {
    const all = snap.docs.map((d) => ({ uid: d.id, ...(d.data() as Omit<OnlinePresence, 'uid'>) }));
    callback(all);
  });
}
