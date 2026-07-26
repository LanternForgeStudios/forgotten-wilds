import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { getFirestore } from 'firebase-admin/firestore';
import type { PlayerSave } from '../shared-types';

const VALID_APPEARANCES = ['white-dark', 'black-dark', 'white-blonde', 'asian-dark'] as const;
type Appearance = (typeof VALID_APPEARANCES)[number];

interface SetPlayerSkinRequest {
  gender: 'male' | 'female';
  appearance: Appearance;
}

/** Lets the player change their chosen body silhouette/appearance any time (see UserProfile.tsx's
 *  Skin tab) - purely cosmetic, no economy/progress implications, so no validation beyond "is
 *  this a real gender/appearance value" is needed. */
export const setPlayerSkin = onCall<SetPlayerSkinRequest>(async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'You must be signed in.');

  const gender = request.data?.gender;
  if (gender !== 'male' && gender !== 'female') {
    throw new HttpsError('invalid-argument', 'Unknown skin.');
  }
  const appearance = request.data?.appearance;
  if (!VALID_APPEARANCES.includes(appearance)) {
    throw new HttpsError('invalid-argument', 'Unknown appearance.');
  }

  const db = getFirestore();
  const userRef = db.collection('users').doc(uid);

  return db.runTransaction(async (tx) => {
    const snap = await tx.get(userRef);
    if (!snap.exists) throw new HttpsError('failed-precondition', 'No character found.');
    const save = snap.data() as PlayerSave;

    save.player.gender = gender;
    save.player.appearance = appearance;
    save.updatedAt = Date.now();
    tx.set(userRef, save);

    return { gender, appearance };
  });
});
