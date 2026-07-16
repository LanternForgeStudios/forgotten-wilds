import { doc, onSnapshot } from 'firebase/firestore';
import type { PartyBattleSession } from '@/types';
import { db } from './firebaseConfig';

/** Read-only subscription - every write to partyBattles/{id} goes through a Cloud Function
 *  (submitPartyBattleAction / endlessBattle.ts), so the client never mutates it directly. */
export function subscribeToPartyBattle(battleId: string, callback: (battle: PartyBattleSession | null) => void): () => void {
  return onSnapshot(doc(db, 'partyBattles', battleId), (snap) => {
    callback(snap.exists() ? (snap.data() as PartyBattleSession) : null);
  });
}
