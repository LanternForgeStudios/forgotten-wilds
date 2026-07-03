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

    const alreadyHave = save.inventory.some((i) => i.itemId === itemId);
    if (alreadyHave) {
      return { alreadyCollected: true, questsCompleted: [] as string[] };
    }

    save.inventory.push({ itemId, quantity: 1 });
    const completions = advanceQuests(save.quests, { type: 'collectItem', targetId: itemId });
    applyQuestRewards(save, completions);
    save.updatedAt = Date.now();
    tx.set(userRef, save);

    return { alreadyCollected: false, questsCompleted: completions.map((c) => c.questId) };
  });
});
