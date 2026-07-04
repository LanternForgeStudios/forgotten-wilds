import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { getFirestore } from 'firebase-admin/firestore';
import { ITEMS, SHOP_PRICES } from '../data/items';
import type { PlayerSave } from '../shared-types';

interface PurchaseItemRequest {
  itemId: string;
}

export const purchaseItem = onCall<PurchaseItemRequest>(async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'You must be signed in.');

  const itemId = request.data?.itemId;
  const price = itemId ? SHOP_PRICES[itemId] : undefined;
  if (price === undefined) throw new HttpsError('invalid-argument', 'That item is not for sale here.');

  const db = getFirestore();
  const userRef = db.collection('users').doc(uid);

  return db.runTransaction(async (tx) => {
    const snap = await tx.get(userRef);
    if (!snap.exists) throw new HttpsError('failed-precondition', 'No character found.');
    const save = snap.data() as PlayerSave;

    if (save.player.gold < price) {
      throw new HttpsError('failed-precondition', 'Not enough gold.');
    }
    if (ITEMS[itemId]?.unique && save.inventory.some((i) => i.itemId === itemId)) {
      throw new HttpsError('failed-precondition', 'You already own the only one of those.');
    }

    save.player.gold -= price;
    const entry = save.inventory.find((i) => i.itemId === itemId);
    if (entry) entry.quantity += 1;
    else save.inventory.push({ itemId, quantity: 1 });

    save.updatedAt = Date.now();
    tx.set(userRef, save);

    return { gold: save.player.gold, inventory: save.inventory };
  });
});
