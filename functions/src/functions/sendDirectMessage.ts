import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { getFirestore } from 'firebase-admin/firestore';
import { findMessageViolation } from '../engine/messageFilter';
import type { BlockListDoc, DirectMessage, FriendshipDoc } from '../shared-types';

interface SendDirectMessageRequest {
  toUid: string;
  text: string;
}

const MAX_MESSAGE_LENGTH = 500;

/** A lightweight message-a-friend capability, distinct from the full real-time town Chat feature
 *  planned later - only exchanged between accepted friends, and blocked either direction. */
export const sendDirectMessage = onCall<SendDirectMessageRequest>(async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'You must be signed in.');
  const toUid = request.data?.toUid;
  const rawText = request.data?.text;
  if (!toUid || toUid === uid) throw new HttpsError('invalid-argument', 'Invalid recipient.');
  const text = typeof rawText === 'string' ? rawText.trim() : '';
  if (!text) throw new HttpsError('invalid-argument', 'Message cannot be empty.');
  if (text.length > MAX_MESSAGE_LENGTH) {
    throw new HttpsError('invalid-argument', `Message must be ${MAX_MESSAGE_LENGTH} characters or fewer.`);
  }
  const violation = findMessageViolation(text);
  if (violation) throw new HttpsError('invalid-argument', violation);

  const db = getFirestore();
  const [friendsSnap, myBlocksSnap, theirBlocksSnap] = await Promise.all([
    db.collection('friendships').doc(uid).get(),
    db.collection('blocks').doc(uid).get(),
    db.collection('blocks').doc(toUid).get(),
  ]);

  const isFriend = ((friendsSnap.data() as FriendshipDoc | undefined)?.friendUids ?? []).includes(toUid);
  if (!isFriend) throw new HttpsError('failed-precondition', 'You can only message friends.');

  const myBlockedUids: string[] = (myBlocksSnap.data() as BlockListDoc | undefined)?.blockedUids ?? [];
  const theirBlockedUids: string[] = (theirBlocksSnap.data() as BlockListDoc | undefined)?.blockedUids ?? [];
  if (myBlockedUids.includes(toUid) || theirBlockedUids.includes(uid)) {
    throw new HttpsError('failed-precondition', 'You cannot message this user.');
  }

  const participants: [string, string] = uid < toUid ? [uid, toUid] : [toUid, uid];
  const docRef = db.collection('directMessages').doc();
  const message: DirectMessage = {
    id: docRef.id,
    participants,
    fromUid: uid,
    text,
    sentAt: Date.now(),
  };
  await docRef.set(message);

  return { sent: true };
});
