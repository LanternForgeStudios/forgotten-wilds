import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { getFirestore } from 'firebase-admin/firestore';
import { INN_REST_COST } from '../data/items';
import { restoreFullVitals } from '../engine/levelingEngine';
import type { PlayerSave } from '../shared-types';

// Only one inn exists today, so unlike openChest.ts/interactWithShrine.ts this doesn't need a
// client-supplied locationId to look up against - just a fixed id to check the player's own
// (server-authoritative) currentLocationId against.
const INN_LOCATION_ID = 'ash-hallow-inn';

export const restAtInn = onCall(async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'You must be signed in.');

  const db = getFirestore();
  const userRef = db.collection('users').doc(uid);

  return db.runTransaction(async (tx) => {
    const snap = await tx.get(userRef);
    if (!snap.exists) throw new HttpsError('failed-precondition', 'No character found.');
    const save = snap.data() as PlayerSave;

    // Every other location-bound interactable (chests, shrines, world items) checks this - rest
    // at the inn was missing it entirely, letting any client fully heal from anywhere for flat
    // gold rather than requiring the trip back to town the rest of the exploration loop assumes.
    if (save.player.currentLocationId !== INN_LOCATION_ID) {
      throw new HttpsError('failed-precondition', 'You are not at the inn.');
    }

    if (save.player.gold < INN_REST_COST) {
      throw new HttpsError('failed-precondition', 'Not enough gold to rest.');
    }

    save.player.gold -= INN_REST_COST;
    restoreFullVitals(save);

    save.updatedAt = Date.now();
    tx.set(userRef, save);

    return { gold: save.player.gold, stats: save.player.stats };
  });
});
