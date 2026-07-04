import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { getFirestore } from 'firebase-admin/firestore';
import { sellPriceFor } from '../engine/pricingEngine';
import type { PlayerSave } from '../shared-types';

interface SellItemRequest {
  itemId: string;
  quantity?: number;
}

export const sellItem = onCall<SellItemRequest>(async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'You must be signed in.');

  const itemId = request.data?.itemId;
  if (!itemId) throw new HttpsError('invalid-argument', 'No item specified.');
  const requestedQuantity = Math.max(1, Math.floor(request.data?.quantity ?? 1));

  const price = sellPriceFor(itemId);
  if (price === undefined) {
    throw new HttpsError('invalid-argument', 'That item cannot be sold.');
  }

  const db = getFirestore();
  const userRef = db.collection('users').doc(uid);

  return db.runTransaction(async (tx) => {
    const snap = await tx.get(userRef);
    if (!snap.exists) throw new HttpsError('failed-precondition', 'No character found.');
    const save = snap.data() as PlayerSave;

    const entry = save.inventory.find((i) => i.itemId === itemId);
    if (!entry || entry.quantity < 1) {
      throw new HttpsError('failed-precondition', 'You do not own that item.');
    }
    const isEquipped = Object.values(save.player.equipment).includes(itemId);
    if (isEquipped) {
      throw new HttpsError('failed-precondition', 'Unequip that item before selling it.');
    }

    const sellQuantity = Math.min(requestedQuantity, entry.quantity);
    entry.quantity -= sellQuantity;
    save.inventory = save.inventory.filter((i) => i.quantity > 0);

    const goldEarned = price * sellQuantity;
    save.player.gold += goldEarned;
    save.updatedAt = Date.now();
    tx.set(userRef, save);

    return { gold: save.player.gold, soldQuantity: sellQuantity, goldEarned };
  });
});
