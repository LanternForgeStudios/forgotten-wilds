import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { getFirestore } from 'firebase-admin/firestore';
import type { PlayerSave } from '../shared-types';
import { ENFORCE_APP_CHECK } from '../appCheckConfig';

interface SetCombatPreferencesRequest {
  fastRounds: boolean;
  targetAll: boolean;
}

/** Lets the player change their account-wide "Fast Rounds"/"Target All" combat defaults any time
 *  (see UserProfile.tsx's Settings tab) - purely which state each fight's local toggles start in,
 *  no economy/progress implications, so no validation beyond "are these actually booleans" is
 *  needed. See CombatPreferences' own doc comment for why this lives on the account instead of
 *  localStorage. */
export const setCombatPreferences = onCall<SetCombatPreferencesRequest>(
  { enforceAppCheck: ENFORCE_APP_CHECK },
  async (request) => {
    const uid = request.auth?.uid;
    if (!uid) throw new HttpsError('unauthenticated', 'You must be signed in.');

    const { fastRounds, targetAll } = request.data ?? {};
    if (typeof fastRounds !== 'boolean' || typeof targetAll !== 'boolean') {
      throw new HttpsError('invalid-argument', 'fastRounds and targetAll must both be booleans.');
    }

    const db = getFirestore();
    const userRef = db.collection('users').doc(uid);

    return db.runTransaction(async (tx) => {
      const snap = await tx.get(userRef);
      if (!snap.exists) throw new HttpsError('failed-precondition', 'No character found.');
      const save = snap.data() as PlayerSave;

      save.player.combatPreferences = { fastRounds, targetAll };
      save.updatedAt = Date.now();
      tx.set(userRef, save);

      return { fastRounds, targetAll };
    });
  },
);
