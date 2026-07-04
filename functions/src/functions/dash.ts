import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { getFirestore } from 'firebase-admin/firestore';
import type { PlayerSave } from '../shared-types';

/** How much Stamina one Dash costs, and how fast it regenerates on its own - both fixed server
 *  constants rather than data-file content since there's only one kind of dash right now. */
const DASH_COST = 15;
const REGEN_PER_SECOND = 1;

export const dash = onCall(async (request) => {
  const uid = request.auth?.uid;
  if (!uid) {
    throw new HttpsError('unauthenticated', 'You must be signed in.');
  }

  const db = getFirestore();
  const userRef = db.collection('users').doc(uid);

  return db.runTransaction(async (tx) => {
    const snap = await tx.get(userRef);
    if (!snap.exists) throw new HttpsError('failed-precondition', 'No character found.');
    const save = snap.data() as PlayerSave;

    if (save.player.stats.maxStamina <= 0) {
      throw new HttpsError('failed-precondition', 'You have not learned to Dash yet.');
    }

    // Lazy regen: there's no scheduled job ticking every player's Stamina, so each Dash call
    // first reconciles however much time has passed since the last update.
    const now = Date.now();
    const elapsedSeconds = Math.max(0, (now - save.player.staminaUpdatedAt) / 1000);
    const regenerated = Math.min(
      save.player.stats.maxStamina - save.player.stats.stamina,
      elapsedSeconds * REGEN_PER_SECOND,
    );
    save.player.stats.stamina = Math.min(save.player.stats.maxStamina, save.player.stats.stamina + regenerated);

    if (save.player.stats.stamina < DASH_COST) {
      // Throwing here rolls back the whole transaction (Firestore transactions are all-or-
      // nothing) - the regenerated amount computed above simply isn't persisted this attempt,
      // and gets recomputed fresh (correctly, from the same real elapsed time) next Dash attempt.
      throw new HttpsError('failed-precondition', 'Not enough Stamina to Dash.');
    }

    save.player.stats.stamina -= DASH_COST;
    save.player.staminaUpdatedAt = now;
    save.updatedAt = now;
    tx.set(userRef, save);

    return { stamina: save.player.stats.stamina, maxStamina: save.player.stats.maxStamina };
  });
});
