import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { getFirestore } from 'firebase-admin/firestore';
import { SHOP_PRICES, SHOP_CATALOGS, ITEMS } from '../data/items';
import { grantItem } from '../engine/inventoryEngine';
import type { PlayerSave } from '../shared-types';

interface PurchaseItemRequest {
  itemId: string;
  shopId: string;
}

// Which location the player must actually be standing in to buy from a given shopId - shopId
// itself is an NPC/shop-identity id, not the same string as the building's locationId, so this
// can't be derived automatically. Without this, shopId/itemId pairing alone let a purchase go
// through regardless of which building (if any) the player was actually in, unlike every other
// location-bound interaction (restAtInn.ts/openChest.ts/interactWithShrine.ts/talkToNpc.ts all
// validate currentLocationId).
const SHOP_LOCATIONS: Record<string, string> = {
  'mara-ash-general-store': 'ash-hallow-mara-shop',
  'ash-hallow-blacksmith-forge': 'ash-hallow-blacksmith',
  'ash-hallow-armory': 'ash-hallow-armory',
  apothecary: 'ash-hallow-apothecary',
};

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

    if (save.player.currentLocationId !== SHOP_LOCATIONS[shopId]) {
      throw new HttpsError('failed-precondition', 'You are not at that location.');
    }

    if (save.player.gold < price) {
      throw new HttpsError('failed-precondition', 'Not enough gold.');
    }

    // Non-consumables (equipment, key items, lantern upgrades) can only ever be bought one at a
    // time from a shop - a second copy serves no purpose since it can't be equipped twice. This is
    // purchase-specific: it doesn't stop the same item being found or earned again later through
    // quests/chests/loot, which route through grantItem directly rather than this function.
    const isConsumable = ITEMS[itemId]?.category === 'consumable';
    if (!isConsumable && save.inventory.some((i) => i.itemId === itemId && i.quantity >= 1)) {
      throw new HttpsError('failed-precondition', 'You already own one of those.');
    }

    if (!grantItem(save, itemId)) {
      throw new HttpsError('failed-precondition', 'You already own the only one of those.');
    }
    save.player.gold -= price;

    save.updatedAt = Date.now();
    tx.set(userRef, save);

    return { gold: save.player.gold, inventory: save.inventory };
  });
});
