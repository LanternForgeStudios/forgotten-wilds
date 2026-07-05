import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { getFirestore } from 'firebase-admin/firestore';
import { SHOP_PRICES, SHOP_CATALOGS } from '../data/items';
import { grantItem } from '../engine/inventoryEngine';
import type { PlayerSave } from '../shared-types';

interface PurchaseItemRequest {
  itemId: string;
  shopId: string;
}

export const purchaseItem = onCall<PurchaseItemRequest>(async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'You must be signed in.');

  const itemId = request.data?.itemId;
  const shopId = request.data?.shopId;
  const price = itemId ? SHOP_PRICES[itemId] : undefined;
  if (price === undefined) throw new HttpsError('invalid-argument', 'That item is not for sale here.');
  // Confirms the item is actually stocked by the shop the client claims to have opened - without
  // this, any item in the flat SHOP_PRICES table could be bought regardless of which NPC/shopId
  // the request came from.
  if (typeof shopId !== 'string' || !SHOP_CATALOGS[shopId]?.includes(itemId)) {
    throw new HttpsError('invalid-argument', 'That item is not for sale here.');
  }

  const db = getFirestore();
  const userRef = db.collection('users').doc(uid);

  return db.runTransaction(async (tx) => {
    const snap = await tx.get(userRef);
    if (!snap.exists) throw new HttpsError('failed-precondition', 'No character found.');
    const save = snap.data() as PlayerSave;

    if (save.player.gold < price) {
      throw new HttpsError('failed-precondition', 'Not enough gold.');
    }
    if (!grantItem(save.inventory, itemId)) {
      throw new HttpsError('failed-precondition', 'You already own the only one of those.');
    }
    save.player.gold -= price;

    save.updatedAt = Date.now();
    tx.set(userRef, save);

    return { gold: save.player.gold, inventory: save.inventory };
  });
});
