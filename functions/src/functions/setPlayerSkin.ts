import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { getFirestore } from 'firebase-admin/firestore';
import type { PlayerSave } from '../shared-types';

interface SetPlayerSkinRequest {
  gender: 'male' | 'female';
}

/** Lets the player change their chosen body silhouette any time (see UserProfile.tsx's Skin tab) -
 *  purely cosmetic, no economy/progress implications, so no validation beyond "is this a real
 *  gender value" is needed. `appearance` isn't user-changeable yet (no UI exposes it - the picker
 *  is still 2-option), so this only ever touches `gender`, leaving whatever `appearance` the
 *  player already has untouched. */
export const setPlayerSkin = onCall<SetPlayerSkinRequest>(async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'You must be signed in.');

  const gender = request.data?.gender;
  if (gender !== 'male' && gender !== 'female') {
    throw new HttpsError('invalid-argument', 'Unknown skin.');
  }

  const db = getFirestore();
  const userRef = db.collection('users').doc(uid);

  return db.runTransaction(async (tx) => {
    const snap = await tx.get(userRef);
    if (!snap.exists) throw new HttpsError('failed-precondition', 'No character found.');
    const save = snap.data() as PlayerSave;

    save.player.gender = gender;
    save.updatedAt = Date.now();
    tx.set(userRef, save);

    return { gender };
  });
});
