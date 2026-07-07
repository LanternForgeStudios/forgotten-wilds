import { collection, doc, documentId, getDocs, onSnapshot, query, where } from 'firebase/firestore';
import type { BlockListDoc, DirectMessage, FriendRequest, FriendshipDoc, UserDirectoryEntry } from '@/types';
import { db } from './firebaseConfig';

/** Friend/block lists only store uids - this resolves them to display names for the UI. Capped
 *  at 30 (Firestore's `in` query limit), which is far more than a personal project needs. */
export async function resolveDisplayNames(uids: string[]): Promise<Record<string, string>> {
  if (uids.length === 0) return {};
  const q = query(collection(db, 'userDirectory'), where(documentId(), 'in', uids.slice(0, 30)));
  const snap = await getDocs(q);
  const names: Record<string, string> = {};
  for (const d of snap.docs) {
    names[d.id] = (d.data() as UserDirectoryEntry).displayName;
  }
  return names;
}

/** Read-only subscriptions - every write to these collections goes through a Cloud Function
 *  (see firestore.rules), so the client never mutates them directly. */

export function subscribeToFriendship(uid: string, callback: (friendUids: string[]) => void): () => void {
  return onSnapshot(doc(db, 'friendships', uid), (snap) => {
    callback((snap.data() as FriendshipDoc | undefined)?.friendUids ?? []);
  });
}

export function subscribeToBlockList(uid: string, callback: (blockedUids: string[]) => void): () => void {
  return onSnapshot(doc(db, 'blocks', uid), (snap) => {
    callback((snap.data() as BlockListDoc | undefined)?.blockedUids ?? []);
  });
}

/** Incoming (toUid == uid) and outgoing (fromUid == uid) pending requests are separate queries -
 *  Firestore can't OR across two different fields in one query. */
export function subscribeToIncomingFriendRequests(
  uid: string,
  callback: (requests: FriendRequest[]) => void,
): () => void {
  const q = query(collection(db, 'friendRequests'), where('toUid', '==', uid), where('status', '==', 'pending'));
  return onSnapshot(q, (snap) => callback(snap.docs.map((d) => d.data() as FriendRequest)));
}

export function subscribeToOutgoingFriendRequests(
  uid: string,
  callback: (requests: FriendRequest[]) => void,
): () => void {
  const q = query(collection(db, 'friendRequests'), where('fromUid', '==', uid), where('status', '==', 'pending'));
  return onSnapshot(q, (snap) => callback(snap.docs.map((d) => d.data() as FriendRequest)));
}

/** All messages involving `uid`, newest last - filtered client-side down to the one thread with
 *  `otherUid` (fine at this scale; a real Chat feature would want a per-thread subcollection). */
export function subscribeToDirectMessagesWith(
  uid: string,
  otherUid: string,
  callback: (messages: DirectMessage[]) => void,
): () => void {
  const q = query(collection(db, 'directMessages'), where('participants', 'array-contains', uid));
  return onSnapshot(q, (snap) => {
    const messages = snap.docs
      .map((d) => d.data() as DirectMessage)
      .filter((m) => m.participants.includes(otherUid))
      .sort((a, b) => a.sentAt - b.sentAt);
    callback(messages);
  });
}

/** Every message across every conversation involving `uid` - same query as
 *  subscribeToDirectMessagesWith minus the single-thread filter, for a global "do I have any
 *  unread DM" check (see PlayerHUD's "new social activity" indicator). */
export function subscribeToAllDirectMessages(uid: string, callback: (messages: DirectMessage[]) => void): () => void {
  const q = query(collection(db, 'directMessages'), where('participants', 'array-contains', uid));
  return onSnapshot(q, (snap) => callback(snap.docs.map((d) => d.data() as DirectMessage)));
}
