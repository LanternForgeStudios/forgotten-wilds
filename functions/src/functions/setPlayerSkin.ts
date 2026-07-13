import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { getFirestore } from 'firebase-admin/firestore';
import type { PlayerSave } from '../shared-types';

interface SetPlayerSkinRequest {
  skin: 'male' | 'female';
}

/** Lets the player change their chosen sprite skin any time (see UserProfile.tsx's Skin tab) -
 *  purely cosmetic, no economy/progress implications, so no validation beyond "is this a real
 *  skin value" is needed. */
export const setPlayerSkin = onCall<SetPlayerSkinRequest>(async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'You must be signed in.');

  const skin = request.data?.skin;
  if (skin !== 'male' && skin !== 'female') {
    throw new HttpsError('invalid-argument', 'Unknown skin.');
  }

  const db = getFirestore();
  const userRef = db.collection('users').doc(uid);

  return db.runTransaction(async (tx) => {
    const snap = await tx.get(userRef);
    if (!snap.exists) throw new HttpsError('failed-precondition', 'No character found.');
    const save = snap.data() as PlayerSave;

    save.player.skin = skin;
    save.updatedAt = Date.now();
    tx.set(userRef, save);

    return { skin };
  });
});
