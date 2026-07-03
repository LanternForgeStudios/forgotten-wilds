import { doc, getDoc } from 'firebase/firestore';
import type { PlayerSave } from '@/types';
import { db } from './firebaseConfig';

/** Read-only — the client never writes to users/{uid} directly; every mutation is a Cloud Function. */
export async function fetchPlayerSave(uid: string): Promise<PlayerSave | null> {
  const snap = await getDoc(doc(db, 'users', uid));
  return snap.exists() ? (snap.data() as PlayerSave) : null;
}
