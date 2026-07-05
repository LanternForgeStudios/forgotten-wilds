import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { getFirestore } from 'firebase-admin/firestore';
import { advanceQuests, applyQuestRewards } from '../engine/questEngine';
import type { PlayerSave } from '../shared-types';

interface CollectWorldItemRequest {
  locationId: string;
  refId: string;
}

/** Server-side source of truth for what a given map's world-item interactable actually grants. */
const WORLD_ITEMS: Record<string, Record<string, string>> = {
  'hollow-rail-mine': {
    'miners-lost-lantern': 'miners-lost-lantern',
  },
  // Mossy Creek and Fallen Watchtower are landmarks within the Ironwood Trail map, not their own
  // locations, so their refId is looked up under 'ironwood-trail' here.
  'ironwood-trail': {
    'mossy-creek': 'stone-fragment',
    'fallen-watchtower': 'wind-fragment',
  },
  'whisper-falls': {
    'water-fragment': 'water-fragment',
  },
};

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

    const alreadyHave = save.inventory.some((i) => i.itemId === itemId);
    if (!alreadyHave) {
      save.inventory.push({ itemId, quantity: 1 });
    }

    // Always advance quests on this event, even if the item was already collected - a quest
    // whose collectItem objective wasn't active yet the first time this node was visited (e.g.
    // reachable well before its own prerequisite quest) would otherwise never see the event again,
    // permanently soft-locking it once the fast path above starts short-circuiting.
    const completions = advanceQuests(save.quests, { type: 'collectItem', targetId: itemId });
    applyQuestRewards(save, completions);
    save.updatedAt = Date.now();
    tx.set(userRef, save);

    return { alreadyCollected: alreadyHave, questsCompleted: completions.map((c) => c.questId) };
  });
});
