import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { getFirestore } from 'firebase-admin/firestore';
import type { PlayerSave } from '../shared-types';

/** How much Stamina one Dash costs, and how long a full empty-to-max refill takes - both fixed
 *  server constants rather than data-file content since there's only one kind of dash right now.
 *  Regen is expressed as "seconds to fill the whole bar" rather than a flat per-second amount so
 *  it scales the same way at any level, even though maxStamina grows with level (see
 *  STAT_GROWTH_PER_LEVEL.maxStamina) - kept in sync by hand with the client's display-only copy in
 *  src/utils/staminaRegen.ts, the same way any other client/server display number is. Regen is
 *  deliberately slower than DASH_COST/DASH_COOLDOWN_MS's pace (15 Stamina every 3s would need
 *  regenPerSecond >= 5, i.e. FULL_REGEN_SECONDS <= 8, to sustain indefinitely) so a player can
 *  chain a handful of Dashes back to back but can't sustain it forever - Stamina runs out after a
 *  few, forcing a real walk (and its encounter risk) before the next chain. */
const DASH_COST = 15;
const FULL_REGEN_SECONDS = 20;
/** Hard floor between Dash attempts, enforced server-side against the same staminaUpdatedAt used
 *  for regen - without this, a client with enough banked Stamina could fire Dash calls back to
 *  back with no gap at all and cross an entire map's encounter zones for free. */
const DASH_COOLDOWN_MS = 3000;

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

    const now = Date.now();
    if (now - save.player.staminaUpdatedAt < DASH_COOLDOWN_MS) {
      throw new HttpsError('failed-precondition', 'Dash is still recovering.');
    }

    // Lazy regen: there's no scheduled job ticking every player's Stamina, so each Dash call
    // first reconciles however much time has passed since the last update.
    const elapsedSeconds = Math.max(0, (now - save.player.staminaUpdatedAt) / 1000);
    const regenPerSecond = save.player.stats.maxStamina / FULL_REGEN_SECONDS;
    const regenerated = Math.min(
      save.player.stats.maxStamina - save.player.stats.stamina,
      elapsedSeconds * regenPerSecond,
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

    return {
      stamina: save.player.stats.stamina,
      maxStamina: save.player.stats.maxStamina,
      staminaUpdatedAt: save.player.staminaUpdatedAt,
    };
  });
});
