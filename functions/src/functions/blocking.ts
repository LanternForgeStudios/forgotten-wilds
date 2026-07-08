import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { getFirestore, type DocumentSnapshot } from 'firebase-admin/firestore';
import { releaseOffer } from '../engine/tradeEngine';
import { sortedPairKey } from './trade';
import type { ActiveTradeLockDoc, BlockListDoc, FriendshipDoc, PlayerSave, TradeDoc } from '../shared-types';

interface BlockUserRequest {
  targetUid: string;
}

/** Blocking implies unfriending - also clears any pending friend request between the pair so it
 *  can't sit in either inbox afterward, and terminates any active trade between the pair
 *  (restoring both sides' escrow), consistent with blocking already meaning "close out anything
 *  pending with this person." The blocked user is never notified either happened; only the
 *  blocker's own blocks/{uid} doc is ever readable by them. */
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
  const lockRef = db.collection('activeTradeLocks').doc(sortedPairKey(uid, targetUid));

  await db.runTransaction(async (tx) => {
    const [blockSnap, meFriendsSnap, themFriendsSnap, forwardSnap, reverseSnap, lockSnap] = await Promise.all([
      tx.get(blockRef),
      tx.get(meFriendsRef),
      tx.get(themFriendsRef),
      tx.get(forwardReqRef),
      tx.get(reverseReqRef),
      tx.get(lockRef),
    ]);

    // All reads - including this conditional trade lookup - must happen before any write below,
    // as Firestore transactions require.
    let tradeRef: FirebaseFirestore.DocumentReference | null = null;
    let tradeSnap: DocumentSnapshot | null = null;
    let initiatorSnap: DocumentSnapshot | null = null;
    let recipientSnap: DocumentSnapshot | null = null;
    if (lockSnap.exists) {
      const { tradeId } = lockSnap.data() as ActiveTradeLockDoc;
      tradeRef = db.collection('trades').doc(tradeId);
      tradeSnap = await tx.get(tradeRef);
      if (tradeSnap.exists) {
        const trade = tradeSnap.data() as TradeDoc;
        [initiatorSnap, recipientSnap] = await Promise.all([
          tx.get(db.collection('users').doc(trade.initiatorUid)),
          tx.get(db.collection('users').doc(trade.recipientUid)),
        ]);
      }
    }

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

    if (tradeRef && tradeSnap?.exists) {
      const trade = tradeSnap.data() as TradeDoc;
      if (trade.status === 'awaiting_recipient' || trade.status === 'awaiting_initiator') {
        if (initiatorSnap?.exists) {
          const initiatorSave = initiatorSnap.data() as PlayerSave;
          releaseOffer(initiatorSave, trade.initiatorOffer);
          initiatorSave.updatedAt = Date.now();
          tx.set(initiatorSnap.ref, initiatorSave);
        }
        if (recipientSnap?.exists && trade.recipientOffer) {
          const recipientSave = recipientSnap.data() as PlayerSave;
          releaseOffer(recipientSave, trade.recipientOffer);
          recipientSave.updatedAt = Date.now();
          tx.set(recipientSnap.ref, recipientSave);
        }
        tx.set(tradeRef, { ...trade, status: 'cancelled', updatedAt: Date.now() });
        tx.delete(lockRef);
      }
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
