import { collection, doc, onSnapshot, query, where } from 'firebase/firestore';
import type { ClanDoc, ClanInvite, ClanMembershipDoc } from '@/types';
import { db } from './firebaseConfig';

/** Read-only subscriptions - every write to these collections goes through a Cloud Function in
 *  functions/src/functions/clan.ts (see firestore.rules), so the client never mutates them
 *  directly. */

export function subscribeToClanMembership(uid: string, callback: (clanId: string | null) => void): () => void {
  return onSnapshot(doc(db, 'clanMemberships', uid), (snap) => {
    callback((snap.data() as ClanMembershipDoc | undefined)?.clanId ?? null);
  });
}

export function subscribeToClan(clanId: string, callback: (clan: ClanDoc | null) => void): () => void {
  return onSnapshot(doc(db, 'clans', clanId), (snap) => {
    callback(snap.exists() ? (snap.data() as ClanDoc) : null);
  });
}

export function subscribeToIncomingClanInvites(uid: string, callback: (invites: ClanInvite[]) => void): () => void {
  const q = query(collection(db, 'clanInvites'), where('toUid', '==', uid), where('status', '==', 'pending'));
  return onSnapshot(q, (snap) => callback(snap.docs.map((d) => d.data() as ClanInvite)));
}
