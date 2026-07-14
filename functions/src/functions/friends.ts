import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { getFirestore, type Firestore, type Transaction } from 'firebase-admin/firestore';
import type { FriendRequest, FriendshipDoc, PlayerSave } from '../shared-types';

/** Reads through the given transaction (not a plain `.get()`) so this participates in the same
 *  optimistic-concurrency check as the rest of sendFriendRequest's transaction - a concurrent
 *  blockUser call writes blocks/{uid}, so reading it inside the transaction means Firestore
 *  automatically retries this transaction (and re-observes the fresh block) if the two race,
 *  instead of a pre-transaction plain read letting a request slip through half a moment before the
 *  block actually lands. */
async function isBlockedEitherWay(db: Firestore, tx: Transaction, uidA: string, uidB: string): Promise<boolean> {
  const [aBlocks, bBlocks] = await Promise.all([
    tx.get(db.collection('blocks').doc(uidA)),
    tx.get(db.collection('blocks').doc(uidB)),
  ]);
  const aBlockedUids: string[] = aBlocks.data()?.blockedUids ?? [];
  const bBlockedUids: string[] = bBlocks.data()?.blockedUids ?? [];
  return aBlockedUids.includes(uidB) || bBlockedUids.includes(uidA);
}

/** Adds each other to friendships/{uid} inside the given transaction - all reads happen before
 *  any write, as Firestore transactions require. */
async function acceptFriendshipInTransaction(
  db: Firestore,
  tx: Transaction,
  uidA: string,
  uidB: string,
): Promise<void> {
  const aRef = db.collection('friendships').doc(uidA);
  const bRef = db.collection('friendships').doc(uidB);
  const [aSnap, bSnap] = await Promise.all([tx.get(aRef), tx.get(bRef)]);
  const aFriends = new Set<string>((aSnap.data() as FriendshipDoc | undefined)?.friendUids ?? []);
  const bFriends = new Set<string>((bSnap.data() as FriendshipDoc | undefined)?.friendUids ?? []);
  aFriends.add(uidB);
  bFriends.add(uidA);
  tx.set(aRef, { friendUids: Array.from(aFriends) });
  tx.set(bRef, { friendUids: Array.from(bFriends) });
}

interface SendFriendRequestRequest {
  toUid: string;
}

/** If the other person already sent *us* a pending request, sending our own is really just
 *  accepting theirs - mutual interest becomes friends immediately rather than leaving two
 *  redundant pending requests sitting in each other's inbox. */
export const sendFriendRequest = onCall<SendFriendRequestRequest>(async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'You must be signed in.');
  const toUid = request.data?.toUid;
  if (!toUid || toUid === uid) throw new HttpsError('invalid-argument', 'Invalid target user.');

  const db = getFirestore();

  const forwardId = `${uid}_${toUid}`;
  const reverseId = `${toUid}_${uid}`;
  const forwardRef = db.collection('friendRequests').doc(forwardId);
  const reverseRef = db.collection('friendRequests').doc(reverseId);
  const myFriendsRef = db.collection('friendships').doc(uid);

  return db.runTransaction(async (tx) => {
    // Both read through this same transaction (not a plain pre-transaction .get()) so a concurrent
    // blockUser/friendship-mutating call can't race past this check - see isBlockedEitherWay's own
    // comment.
    const [blocked, myFriendsSnap, forwardSnap, reverseSnap] = await Promise.all([
      isBlockedEitherWay(db, tx, uid, toUid),
      tx.get(myFriendsRef),
      tx.get(forwardRef),
      tx.get(reverseRef),
    ]);
    if (blocked) {
      throw new HttpsError('failed-precondition', 'You cannot send a friend request to this user.');
    }
    if (((myFriendsSnap.data() as FriendshipDoc | undefined)?.friendUids ?? []).includes(toUid)) {
      throw new HttpsError('failed-precondition', 'You are already friends.');
    }

    const reverseData = reverseSnap.data() as FriendRequest | undefined;
    if (reverseSnap.exists && reverseData?.status === 'pending') {
      await acceptFriendshipInTransaction(db, tx, uid, toUid);
      tx.update(reverseRef, { status: 'accepted' });
      return { status: 'accepted' as const };
    }

    const forwardData = forwardSnap.data() as FriendRequest | undefined;
    if (forwardSnap.exists && forwardData?.status === 'pending') {
      return { status: 'already-pending' as const };
    }

    const [myDir, toDir, mySave, toSave] = await Promise.all([
      db.collection('userDirectory').doc(uid).get(),
      db.collection('userDirectory').doc(toUid).get(),
      db.collection('users').doc(uid).get(),
      db.collection('users').doc(toUid).get(),
    ]);
    if (!toDir.exists) throw new HttpsError('not-found', 'No such user.');

    // Sourced from the authoritative users/{uid} save first - userDirectory is a denormalized
    // search-index copy written as a separate (non-transactional) call in createCharacter.ts, so
    // it can drift missing/stale for an account even though the real save always has the name.
    // Kept as a fallback rather than removed outright, with 'A Keeper' as an absolute last resort.
    const newRequest: FriendRequest = {
      id: forwardId,
      fromUid: uid,
      fromDisplayName:
        (mySave.data() as PlayerSave | undefined)?.displayName ??
        (myDir.data()?.displayName as string | undefined) ??
        'A Keeper',
      toUid,
      toDisplayName:
        (toSave.data() as PlayerSave | undefined)?.displayName ?? (toDir.data()?.displayName as string),
      status: 'pending',
      createdAt: Date.now(),
    };
    tx.set(forwardRef, newRequest);
    return { status: 'sent' as const };
  });
});

interface RespondToFriendRequestRequest {
  requestId: string;
  accept: boolean;
}

export const respondToFriendRequest = onCall<RespondToFriendRequestRequest>(async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'You must be signed in.');
  const { requestId, accept } = request.data ?? {};
  if (!requestId) throw new HttpsError('invalid-argument', 'No request specified.');

  const db = getFirestore();
  const reqRef = db.collection('friendRequests').doc(requestId);

  return db.runTransaction(async (tx) => {
    const snap = await tx.get(reqRef);
    if (!snap.exists) throw new HttpsError('not-found', 'That request no longer exists.');
    const data = snap.data() as FriendRequest;
    if (data.toUid !== uid) {
      throw new HttpsError('permission-denied', 'This request is not addressed to you.');
    }
    if (data.status !== 'pending') {
      return { status: data.status };
    }
    if (!accept) {
      tx.update(reqRef, { status: 'declined' });
      return { status: 'declined' as const };
    }
    await acceptFriendshipInTransaction(db, tx, data.fromUid, data.toUid);
    tx.update(reqRef, { status: 'accepted' });
    return { status: 'accepted' as const };
  });
});

interface RemoveFriendRequest {
  friendUid: string;
}

export const removeFriend = onCall<RemoveFriendRequest>(async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'You must be signed in.');
  const friendUid = request.data?.friendUid;
  if (!friendUid) throw new HttpsError('invalid-argument', 'No friend specified.');

  const db = getFirestore();
  const meRef = db.collection('friendships').doc(uid);
  const themRef = db.collection('friendships').doc(friendUid);

  await db.runTransaction(async (tx) => {
    const [meSnap, themSnap] = await Promise.all([tx.get(meRef), tx.get(themRef)]);
    const myFriends = ((meSnap.data() as FriendshipDoc | undefined)?.friendUids ?? []).filter(
      (f) => f !== friendUid,
    );
    const theirFriends = ((themSnap.data() as FriendshipDoc | undefined)?.friendUids ?? []).filter(
      (f) => f !== uid,
    );
    tx.set(meRef, { friendUids: myFriends });
    tx.set(themRef, { friendUids: theirFriends });
  });

  return { removed: true };
});
