import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { getFirestore } from 'firebase-admin/firestore';
import type { BlockListDoc, FriendshipDoc } from '../shared-types';

interface BlockUserRequest {
  targetUid: string;
}

/** Blocking implies unfriending - also clears any pending friend request between the pair so it
 *  can't sit in either inbox afterward. The blocked user is never notified either happened; only
 *  the blocker's own blocks/{uid} doc is ever readable by them. */
export const blockUser = onCall<BlockUserRequest>(async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'You must be signed in.');
  const targetUid = request.data?.targetUid;
  if (!targetUid || targetUid === uid) throw new HttpsError('invalid-argument', 'Invalid target user.');

  const db = getFirestore();
  const blockRef = db.collection('blocks').doc(uid);
  const meFriendsRef = db.collection('friendships').doc(uid);
  const themFriendsRef = db.collection('friendships').doc(targetUid);
  const forwardReqRef = db.collection('friendRequests').doc(`${uid}_${targetUid}`);
  const reverseReqRef = db.collection('friendRequests').doc(`${targetUid}_${uid}`);

  await db.runTransaction(async (tx) => {
    const [blockSnap, meFriendsSnap, themFriendsSnap, forwardSnap, reverseSnap] = await Promise.all([
      tx.get(blockRef),
      tx.get(meFriendsRef),
      tx.get(themFriendsRef),
      tx.get(forwardReqRef),
      tx.get(reverseReqRef),
    ]);

    const blocked = new Set<string>((blockSnap.data() as BlockListDoc | undefined)?.blockedUids ?? []);
    blocked.add(targetUid);
    tx.set(blockRef, { blockedUids: Array.from(blocked) });

    const myFriends = ((meFriendsSnap.data() as FriendshipDoc | undefined)?.friendUids ?? []).filter(
      (f) => f !== targetUid,
    );
    const theirFriends = ((themFriendsSnap.data() as FriendshipDoc | undefined)?.friendUids ?? []).filter(
      (f) => f !== uid,
    );
    tx.set(meFriendsRef, { friendUids: myFriends });
    tx.set(themFriendsRef, { friendUids: theirFriends });

    if (forwardSnap.exists && forwardSnap.data()?.status === 'pending') {
      tx.update(forwardReqRef, { status: 'declined' });
    }
    if (reverseSnap.exists && reverseSnap.data()?.status === 'pending') {
      tx.update(reverseReqRef, { status: 'declined' });
    }
  });

  return { blocked: true };
});

interface UnblockUserRequest {
  targetUid: string;
}

export const unblockUser = onCall<UnblockUserRequest>(async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'You must be signed in.');
  const targetUid = request.data?.targetUid;
  if (!targetUid) throw new HttpsError('invalid-argument', 'Invalid target user.');

  const db = getFirestore();
  const blockRef = db.collection('blocks').doc(uid);

  await db.runTransaction(async (tx) => {
    const snap = await tx.get(blockRef);
    const blocked = ((snap.data() as BlockListDoc | undefined)?.blockedUids ?? []).filter((b) => b !== targetUid);
    tx.set(blockRef, { blockedUids: blocked });
  });

  return { unblocked: true };
});
