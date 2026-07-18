import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { getFirestore } from 'firebase-admin/firestore';
import type { PlayerSave } from '../shared-types';

/** How much Stamina one dashed tile costs, and how long a full empty-to-max refill takes - both
 *  fixed server constants rather than data-file content since there's only one kind of dash right
 *  now. Regen is expressed as "seconds to fill the whole bar" rather than a flat per-second amount
 *  so it scales the same way at any level, even though maxStamina grows with level (see
 *  STAT_GROWTH_PER_LEVEL.maxStamina) - kept in sync by hand with the client's display-only copy in
 *  src/utils/staminaRegen.ts, the same way any other client/server display number is.
 *  DASH_COST_PER_TILE (3) matches the old flat-cost model's effective rate (15 Stamina / 5 tiles),
 *  so an uninterrupted full-Stamina hold still covers roughly the same ~5 tiles it always did. */
const DASH_COST_PER_TILE = 3;
const FULL_REGEN_SECONDS = 20;

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

    // Lazy regen: there's no scheduled job ticking every player's Stamina, so each Dash call
    // first reconciles however much time has passed since the last update (a few tenths of a
    // Stamina point per tile-debit call during a hold - a small amount of passive regen even while
    // dashing, which is fine; the per-tile cost below is what actually drains the bar).
    const elapsedSeconds = Math.max(0, (now - save.player.staminaUpdatedAt) / 1000);
    const regenPerSecond = save.player.stats.maxStamina / FULL_REGEN_SECONDS;
    const regenerated = Math.min(
      save.player.stats.maxStamina - save.player.stats.stamina,
      elapsedSeconds * regenPerSecond,
    );
    save.player.stats.stamina = Math.min(save.player.stats.maxStamina, save.player.stats.stamina + regenerated);

    if (save.player.stats.stamina < DASH_COST_PER_TILE) {
      // Throwing here rolls back the whole transaction (Firestore transactions are all-or-
      // nothing) - the regenerated amount computed above simply isn't persisted this attempt,
      // and gets recomputed fresh (correctly, from the same real elapsed time) next Dash attempt.
      // The client's hold-loop stops the instant this is thrown (see useDash.ts).
      throw new HttpsError('failed-precondition', 'Not enough Stamina to Dash.');
    }

    save.player.stats.stamina -= DASH_COST_PER_TILE;
    save.player.staminaUpdatedAt = now;
    // A targeted field update, not tx.set(userRef, save) - this is the single hottest-called
    // mutation in the codebase (fired roughly every DASH_STEP_MS for the whole duration of a held
    // Dash), and only these 3 fields ever change here; every other Cloud Function's tx.set(save)
    // round-trips the player's entire inventory/quests/journal/equipment payload for no reason on
    // top of the 3 fields it actually touched.
    tx.update(userRef, {
      'player.stats.stamina': save.player.stats.stamina,
      'player.staminaUpdatedAt': save.player.staminaUpdatedAt,
      updatedAt: now,
    });

    return {
      stamina: save.player.stats.stamina,
      maxStamina: save.player.stats.maxStamina,
      staminaUpdatedAt: save.player.staminaUpdatedAt,
    };
  });
});
