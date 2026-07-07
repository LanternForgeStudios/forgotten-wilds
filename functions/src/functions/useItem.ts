import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { getFirestore } from 'firebase-admin/firestore';
import { ITEMS } from '../data/items';
import type { PlayerSave } from '../shared-types';

interface UseItemRequest {
  itemId: string;
}

/** Consuming a healing/spirit item outside of combat - reuses the same effect data combat's
 *  'item' action applies, just without a combat session in the loop. */
export const useItem = onCall<UseItemRequest>(async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'You must be signed in.');

  const itemId = request.data?.itemId;
  const def = itemId ? ITEMS[itemId] : undefined;
  const effect = def?.effect;
  if (!effect) {
    throw new HttpsError('invalid-argument', 'That item cannot be used this way.');
  }

  const db = getFirestore();
  const userRef = db.collection('users').doc(uid);

  return db.runTransaction(async (tx) => {
    const snap = await tx.get(userRef);
    if (!snap.exists) throw new HttpsError('failed-precondition', 'No character found.');
    const save = snap.data() as PlayerSave;

    const entry = save.inventory.find((i) => i.itemId === itemId);
    if (!entry || entry.quantity < 1) {
      throw new HttpsError('failed-precondition', 'You do not have that item.');
    }

    const wouldHaveEffect =
      (!!effect.healHpPercent && save.player.stats.hp < save.player.stats.maxHp) ||
      (!!effect.healSpiritPercent && save.player.stats.spirit < save.player.stats.maxSpirit) ||
      (!!effect.restoreOil && save.player.stats.lanternOil < save.player.stats.maxLanternOil);
    if (!wouldHaveEffect) {
      throw new HttpsError('failed-precondition', 'That would have no effect right now.');
    }

    if (effect.healHpPercent) {
      const amount = Math.round(save.player.stats.maxHp * effect.healHpPercent);
      save.player.stats.hp = Math.min(save.player.stats.maxHp, save.player.stats.hp + amount);
    }
    if (effect.healSpiritPercent) {
      const amount = Math.round(save.player.stats.maxSpirit * effect.healSpiritPercent);
      save.player.stats.spirit = Math.min(save.player.stats.maxSpirit, save.player.stats.spirit + amount);
    }
    if (effect.restoreOil) {
      save.player.stats.lanternOil = Math.min(
        save.player.stats.maxLanternOil,
        save.player.stats.lanternOil + effect.restoreOil,
      );
    }

    entry.quantity -= 1;
    save.inventory = save.inventory.filter((i) => i.quantity > 0);

    save.updatedAt = Date.now();
    tx.set(userRef, save);

    return { stats: save.player.stats, inventory: save.inventory };
  });
});
