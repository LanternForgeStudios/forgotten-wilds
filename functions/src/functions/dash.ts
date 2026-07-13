import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { getFirestore } from 'firebase-admin/firestore';
import type { PlayerSave } from '../shared-types';

interface DashRequest {
  /** True for the first tile of a fresh hold (gates the cooldown check below); false for every
   *  continuation tile of an already-in-progress hold, called roughly every DASH_STEP_MS
   *  (src/hooks/useDash.ts) for as long as the player keeps Dash held - those must skip the
   *  cooldown gate entirely, or the hold would get cut off after its very first tile the moment
   *  staminaUpdatedAt (below) gets touched. Defaults to true so an old/mismatched client still
   *  gets the (more conservative) cooldown-gated behavior instead of silently bypassing it. */
  isDashStart?: boolean;
}

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
/** Hard floor between the *end* of one dash hold and the *start* of the next, enforced server-side
 *  against staminaUpdatedAt (which every tile-debit call - including the last one of a hold -
 *  updates, so it's a close-enough proxy for "when the hold ended," within one DASH_STEP_MS).
 *  Without this, a client with enough banked Stamina could fire fresh dash holds back to back with
 *  no gap at all and cross an entire map's encounter zones for free. Only checked when
 *  isDashStart is true - never applies mid-hold, or every hold would cut itself off after one tile. */
const DASH_COOLDOWN_MS = 3000;

export const dash = onCall<DashRequest>(async (request) => {
  const uid = request.auth?.uid;
  if (!uid) {
    throw new HttpsError('unauthenticated', 'You must be signed in.');
  }
  const isDashStart = request.data?.isDashStart !== false;

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
    if (isDashStart && now - save.player.staminaUpdatedAt < DASH_COOLDOWN_MS) {
      throw new HttpsError('failed-precondition', 'Dash is still recovering.');
    }

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
    save.updatedAt = now;
    tx.set(userRef, save);

    return {
      stamina: save.player.stats.stamina,
      maxStamina: save.player.stats.maxStamina,
      staminaUpdatedAt: save.player.staminaUpdatedAt,
    };
  });
});
