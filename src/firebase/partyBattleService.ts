import { collection, doc, onSnapshot, query, where } from 'firebase/firestore';
import type { PartyBattleSession, PvpChallengeDoc } from '@/types';
import { db } from './firebaseConfig';

const TERMINAL_STATUSES = new Set<PartyBattleSession['status']>(['victory', 'defeated', 'withdrawn']);

/** Read-only subscription - every write to partyBattles/{id} goes through a Cloud Function
 *  (submitPartyBattleAction / endlessBattle.ts), so the client never mutates it directly. */
export function subscribeToPartyBattle(battleId: string, callback: (battle: PartyBattleSession | null) => void): () => void {
  return onSnapshot(doc(db, 'partyBattles', battleId), (snap) => {
    callback(snap.exists() ? (snap.data() as PartyBattleSession) : null);
  });
}

/** Finds the one non-terminal battle `uid` is currently a participant in, if any - lets every
 *  participant's client discover and show a battle automatically (see PlayerHUD.tsx), not just
 *  whoever happened to click "Start". `participants array-contains uid` can only ever match a
 *  small number of docs at once in practice (a player is never in more than one active battle -
 *  see endlessBattle.ts's lock mechanism), so filtering terminal statuses out client-side is fine
 *  here, same "everything, caller filters" shape as subscribeToMyTrades. */
export function subscribeToMyActivePartyBattle(uid: string, callback: (battleId: string | null) => void): () => void {
  const q = query(collection(db, 'partyBattles'), where('participants', 'array-contains', uid));
  return onSnapshot(q, (snap) => {
    const active = snap.docs.map((d) => d.data() as PartyBattleSession).find((b) => !TERMINAL_STATUSES.has(b.status));
    callback(active?.id ?? null);
  });
}

/** Pending PvP challenges addressed to `uid` - see pvpBattle.ts's challengeToPvp. */
export function subscribeToIncomingPvpChallenges(
  uid: string,
  callback: (challenges: PvpChallengeDoc[]) => void,
): () => void {
  const q = query(collection(db, 'pvpChallenges'), where('toUid', '==', uid), where('status', '==', 'pending'));
  return onSnapshot(q, (snap) => callback(snap.docs.map((d) => d.data() as PvpChallengeDoc)));
}
