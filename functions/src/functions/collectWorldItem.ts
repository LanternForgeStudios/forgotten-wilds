import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { getFirestore } from 'firebase-admin/firestore';
import { advanceQuests, applyQuestRewards } from '../engine/questEngine';
import { grantItem } from '../engine/inventoryEngine';
import { WORLD_ITEMS } from '../data/locations';
import type { PlayerSave } from '../shared-types';

interface CollectWorldItemRequest {
  locationId: string;
  refId: string;
}

export const collectWorldItem = onCall<CollectWorldItemRequest>(async (request) => {
  const uid = request.auth?.uid;
  if (!uid) {
    throw new HttpsError('unauthenticated', 'You must be signed in.');
  }
  const { locationId, refId } = request.data ?? {};
  const itemId = locationId && refId ? WORLD_ITEMS[locationId]?.[refId] : undefined;
  if (!itemId) {
    throw new HttpsError('invalid-argument', 'Nothing to collect there.');
  }

  const db = getFirestore();
  const userRef = db.collection('users').doc(uid);

  return db.runTransaction(async (tx) => {
    const snap = await tx.get(userRef);
    if (!snap.exists) throw new HttpsError('failed-precondition', 'No character found.');
    const save = snap.data() as PlayerSave;

    if (save.player.currentLocationId !== locationId) {
      throw new HttpsError('failed-precondition', 'You are not at that location.');
    }

    // `alreadyHave` is this function's own "don't grant a second copy" gate (every current
    // WORLD_ITEMS entry is a always-one-per-world-node pickup) - grantItem's own unique-cap check
    // is redundant with it but harmless, and calling grantItem directly (instead of hand-copying
    // its inventory-push + itemsDiscovered bookkeeping inline) means this can never silently drift
    // from grantItem's actual behavior the way the old inline copy already had.
    const alreadyHave = save.inventory.some((i) => i.itemId === itemId);
    if (!alreadyHave) {
      grantItem(save, itemId);
    }

    // Always advance quests on this event, even if the item was already collected - a quest
    // whose collectItem objective wasn't active yet the first time this node was visited (e.g.
    // reachable well before its own prerequisite quest) would otherwise never see the event again,
    // permanently soft-locking it once the fast path above starts short-circuiting.
    const completions = advanceQuests(save.quests, { type: 'collectItem', targetId: itemId });
    applyQuestRewards(save, completions);
    save.updatedAt = Date.now();
    tx.set(userRef, save);

    return { alreadyCollected: alreadyHave, questsCompleted: completions.map((c) => c.questId), itemId };
  });
});
