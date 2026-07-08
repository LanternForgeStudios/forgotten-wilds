import { collection, onSnapshot, query, where } from 'firebase/firestore';
import type { TradeDoc } from '@/types';
import { db } from './firebaseConfig';

/** Read-only subscription - every write to trades/{id} goes through a Cloud Function in
 *  functions/src/functions/trade.ts (see firestore.rules), so the client never mutates it
 *  directly. Every trade `uid` is a participant in, regardless of role - callers filter to
 *  non-terminal trades (or whatever else they need) themselves, same as
 *  subscribeToAllDirectMessages's "everything, caller filters" shape. */
export function subscribeToMyTrades(uid: string, callback: (trades: TradeDoc[]) => void): () => void {
  const q = query(collection(db, 'trades'), where('participants', 'array-contains', uid));
  return onSnapshot(q, (snap) => callback(snap.docs.map((d) => d.data() as TradeDoc)));
}
