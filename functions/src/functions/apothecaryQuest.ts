import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { getFirestore } from 'firebase-admin/firestore';
import { APOTHECARY_SHOPS } from '../data/apothecaryShops';
import { generateApothecaryQuest, rollApothecaryReward } from '../engine/apothecaryQuestEngine';
import { grantItem, removeItem } from '../engine/inventoryEngine';
import { applyLevelUp } from '../engine/levelingEngine';
import type { ApothecaryQuest, PlayerSave } from '../shared-types';

interface ApothecaryShopRequest {
  shopId: string;
}

/** Requests (or, if one is already active, just returns) this shop's current "restock" request -
 *  idempotent rather than erroring on a repeat call, since the client calls this whenever the
 *  player opens the Restock Supplies panel and doesn't need to track locally whether it already
 *  asked. See PlayerSave.apothecaryQuests' own doc comment for why this isn't modeled as a real
 *  QuestDef. */
export const requestApothecaryQuest = onCall<ApothecaryShopRequest>(async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'You must be signed in.');

  const shopId = request.data?.shopId;
  const shop = shopId ? APOTHECARY_SHOPS[shopId] : undefined;
  if (!shop) throw new HttpsError('invalid-argument', 'Unknown shop.');

  const db = getFirestore();
  const userRef = db.collection('users').doc(uid);

  return db.runTransaction(async (tx) => {
    const snap = await tx.get(userRef);
    if (!snap.exists) throw new HttpsError('failed-precondition', 'No character found.');
    const save = snap.data() as PlayerSave;
    if (!save.apothecaryQuests) save.apothecaryQuests = {};

    if (save.player.currentLocationId !== shop.locationId) {
      throw new HttpsError('failed-precondition', 'You are not at that location.');
    }

    // Gated at level 2 (i.e. "won at least one fight") - mirrors TownScene.tsx's own earlier,
    // friendlier client-side check (which just hides the button); this is the real enforcement,
    // since a brand-new level-1 character could otherwise request a restock job the instant they
    // first walked into any Apothecary.
    if (save.player.level < 2) {
      throw new HttpsError('failed-precondition', 'Come back once you have some experience under your belt.');
    }

    const existing = save.apothecaryQuests[shopId];
    if (existing) return { quest: existing };

    const quest: ApothecaryQuest = generateApothecaryQuest(shop.materialIds);
    save.apothecaryQuests[shopId] = quest;
    save.updatedAt = Date.now();
    tx.set(userRef, save);

    return { quest };
  });
});

/** Turns in the shop's active restock request - requires owning at least `requiredCount` of the
 *  target material (removed from inventory, not just checked), grants a randomized gold+maybe-item
 *  reward, and clears the request so a new one can be requested next visit. */
export const turnInApothecaryQuest = onCall<ApothecaryShopRequest>(async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'You must be signed in.');

  const shopId = request.data?.shopId;
  const shop = shopId ? APOTHECARY_SHOPS[shopId] : undefined;
  if (!shop) throw new HttpsError('invalid-argument', 'Unknown shop.');

  const db = getFirestore();
  const userRef = db.collection('users').doc(uid);

  return db.runTransaction(async (tx) => {
    const snap = await tx.get(userRef);
    if (!snap.exists) throw new HttpsError('failed-precondition', 'No character found.');
    const save = snap.data() as PlayerSave;
    if (!save.apothecaryQuests) save.apothecaryQuests = {};

    if (save.player.currentLocationId !== shop.locationId) {
      throw new HttpsError('failed-precondition', 'You are not at that location.');
    }

    const quest = save.apothecaryQuests[shopId];
    if (!quest) throw new HttpsError('failed-precondition', 'There is no restock request here right now.');

    const owned = save.inventory.find((i) => i.itemId === quest.materialId)?.quantity ?? 0;
    if (owned < quest.requiredCount) {
      throw new HttpsError('failed-precondition', 'You do not have enough materials yet.');
    }

    removeItem(save, quest.materialId, quest.requiredCount);
    delete save.apothecaryQuests[shopId];

    const reward = rollApothecaryReward(quest.materialId, quest.requiredCount);
    save.player.gold += reward.gold;
    save.player.xp += reward.xp;
    const grantedItemIds: string[] = [];
    for (const itemId of reward.itemIds) {
      if (grantItem(save, itemId)) grantedItemIds.push(itemId);
    }
    applyLevelUp(save);

    save.updatedAt = Date.now();
    tx.set(userRef, save);

    return { gold: reward.gold, xp: reward.xp, itemIds: grantedItemIds, playerGold: save.player.gold };
  });
});
