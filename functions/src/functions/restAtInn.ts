import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { getFirestore } from 'firebase-admin/firestore';
import { INN_REST_COST } from '../data/items';
import type { PlayerSave } from '../shared-types';

export const restAtInn = onCall(async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'You must be signed in.');

  const db = getFirestore();
  const userRef = db.collection('users').doc(uid);

  return db.runTransaction(async (tx) => {
    const snap = await tx.get(userRef);
    if (!snap.exists) throw new HttpsError('failed-precondition', 'No character found.');
    const save = snap.data() as PlayerSave;

    if (save.player.gold < INN_REST_COST) {
      throw new HttpsError('failed-precondition', 'Not enough gold to rest.');
    }

    save.player.gold -= INN_REST_COST;
    save.player.stats.hp = save.player.stats.maxHp;
    save.player.stats.spirit = save.player.stats.maxSpirit;

    save.updatedAt = Date.now();
    tx.set(userRef, save);

    return { gold: save.player.gold, stats: save.player.stats };
  });
});
