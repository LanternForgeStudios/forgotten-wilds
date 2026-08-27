import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { getFirestore } from 'firebase-admin/firestore';
import type { Difficulty, PlayerSave } from '../shared-types';
import { ENFORCE_APP_CHECK } from '../appCheckConfig';

const VALID_DIFFICULTIES: Difficulty[] = ['easy', 'medium', 'hard'];

interface SetDifficultyRequest {
  difficulty: Difficulty;
}

/** Lets the player change their solo-combat difficulty preference any time (see UserProfile.tsx's
 *  Settings tab) - purely a balance preference, no economy/progress implications, so no
 *  validation beyond "is this a real difficulty value" is needed. Only affects solo combat (see
 *  the Difficulty type's own doc comment) - resolveCombatAction.ts is the only reader. */
export const setDifficulty = onCall<SetDifficultyRequest>({ enforceAppCheck: ENFORCE_APP_CHECK }, async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'You must be signed in.');

  const difficulty = request.data?.difficulty;
  if (!VALID_DIFFICULTIES.includes(difficulty)) {
    throw new HttpsError('invalid-argument', 'Unknown difficulty.');
  }

  const db = getFirestore();
  const userRef = db.collection('users').doc(uid);

  return db.runTransaction(async (tx) => {
    const snap = await tx.get(userRef);
    if (!snap.exists) throw new HttpsError('failed-precondition', 'No character found.');
    const save = snap.data() as PlayerSave;

    save.player.difficulty = difficulty;
    save.updatedAt = Date.now();
    tx.set(userRef, save);

    return { difficulty };
  });
});
