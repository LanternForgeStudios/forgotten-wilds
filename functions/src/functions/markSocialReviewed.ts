import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { getFirestore } from 'firebase-admin/firestore';
import type { PlayerSave } from '../shared-types';

/** Records that the player has just looked at their Friends tab - clears the "new social
 *  activity" indicator in PlayerHUD, which compares incoming friend requests'/direct messages'
 *  timestamps against this value. Not folded into friends.ts since it isn't a friend-relationship
 *  mutation, just a viewed-timestamp write. */
export const markSocialReviewed = onCall(async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'You must be signed in.');

  const db = getFirestore();
  const userRef = db.collection('users').doc(uid);

  return db.runTransaction(async (tx) => {
    const snap = await tx.get(userRef);
    if (!snap.exists) throw new HttpsError('failed-precondition', 'No character found.');
    const save = snap.data() as PlayerSave;

    save.lastReviewedSocialAt = Date.now();
    save.updatedAt = Date.now();
    tx.set(userRef, save);

    return { lastReviewedSocialAt: save.lastReviewedSocialAt };
  });
});
