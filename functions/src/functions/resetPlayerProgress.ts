import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { getFirestore } from 'firebase-admin/firestore';
import { buildFreshPlayer, buildFreshSaveContent } from '../engine/newCharacter';
import type { PlayerSave } from '../shared-types';

interface ResetPlayerProgressRequest {
  confirmEmail: string;
}

/** Wipes level/xp/gold/stats/equipment/inventory/quests/journal/openedChests back to exactly
 *  what a brand-new character starts with - "start over" for game progress only. Deliberately
 *  does NOT touch: premiumCurrency (explicitly preserved on the fresh player object below),
 *  friends/blocks/directMessages (separate Firestore collections this function never reads or
 *  writes), or the account itself (displayName/createdAt/email/uid). Requires the caller to type
 *  their own account email back, exactly, as a confirmation gate - there is no undo. */
export const resetPlayerProgress = onCall<ResetPlayerProgressRequest>(async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'You must be signed in.');

  const authEmail = request.auth?.token?.email;
  if (!authEmail) {
    throw new HttpsError('failed-precondition', 'This account has no confirmable email on file.');
  }
  const confirmEmail = request.data?.confirmEmail;
  if (!confirmEmail || confirmEmail.trim().toLowerCase() !== authEmail.toLowerCase()) {
    throw new HttpsError('invalid-argument', 'The email you typed does not match your account.');
  }

  const db = getFirestore();
  const userRef = db.collection('users').doc(uid);

  return db.runTransaction(async (tx) => {
    const snap = await tx.get(userRef);
    if (!snap.exists) throw new HttpsError('failed-precondition', 'No character found.');
    const save = snap.data() as PlayerSave;

    const now = Date.now();
    const freshPlayer = buildFreshPlayer(uid, save.player.name, now);
    freshPlayer.premiumCurrency = save.player.premiumCurrency;

    const fresh: PlayerSave = {
      displayName: save.displayName,
      createdAt: save.createdAt,
      lastLoginAt: save.lastLoginAt,
      player: freshPlayer,
      ...buildFreshSaveContent(),
      updatedAt: now,
    };
    tx.set(userRef, fresh);
    return { reset: true };
  });
});
