import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { getFirestore } from 'firebase-admin/firestore';
import { findMessageViolation } from '../engine/messageFilter';
import { checkAndRecordMessage } from '../engine/chatModerationEngine';
import type { BlockListDoc, DirectMessage, FriendshipDoc, MessageModerationDoc } from '../shared-types';
import { ENFORCE_APP_CHECK } from '../appCheckConfig';

interface SendDirectMessageRequest {
  toUid: string;
  text: string;
}

const MAX_MESSAGE_LENGTH = 500;

const EMPTY_MODERATION: MessageModerationDoc = { lastMessageAt: 0, recentMessageTimestamps: [], mutedUntil: 0 };

/** A lightweight message-a-friend capability, distinct from the full real-time town Chat feature
 *  planned later - only exchanged between accepted friends, and blocked either direction.
 *  Rate-limited per-sender the same way sendWorldChatMessage.ts is (see chatModerationEngine.ts) -
 *  friendship alone doesn't stop a "friend" from flooding someone's DMs, so this needs the same
 *  cooldown/flood-mute guard, just tracked in its own directMessageModeration/{uid} doc so a DM
 *  flood doesn't also mute the sender's world chat, or vice versa. */
export const sendDirectMessage = onCall<SendDirectMessageRequest>({ enforceAppCheck: ENFORCE_APP_CHECK }, async (request) => {
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

  const moderationRef = db.collection('directMessageModeration').doc(uid);
  const participants: [string, string] = uid < toUid ? [uid, toUid] : [toUid, uid];
  const docRef = db.collection('directMessages').doc();

  // Moderation check-and-record + the message write happen in one transaction (mirrors
  // sendWorldChatMessage.ts) so two concurrent sends from the same account can't both read the
  // moderation doc's old state and both slip past the flood check.
  const result = await db.runTransaction(async (tx) => {
    const moderationSnap = await tx.get(moderationRef);
    const moderation = (moderationSnap.data() as MessageModerationDoc | undefined) ?? EMPTY_MODERATION;
    const now = Date.now();
    const check = checkAndRecordMessage(moderation, now);
    tx.set(moderationRef, check.moderation);

    if (!check.allowed) return { allowed: false as const, reason: check.reason };

    const message: DirectMessage = { id: docRef.id, participants, fromUid: uid, text, sentAt: now };
    tx.set(docRef, message);
    return { allowed: true as const };
  });

  if (!result.allowed) throw new HttpsError('resource-exhausted', result.reason);

  return { sent: true };
});
