import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { getFirestore } from 'firebase-admin/firestore';
import { advanceQuests, applyQuestRewards, effectiveStatus, isEmptyQuestRewardSummary } from '../engine/questEngine';
import { backfillPlayerEquipment } from '../engine/equipmentEngine';
import { grantItem } from '../engine/inventoryEngine';
import { WORLD_ITEMS } from '../data/locations';
import type { PlayerSave } from '../shared-types';
import { ENFORCE_APP_CHECK } from '../appCheckConfig';

interface CollectWorldItemRequest {
  locationId: string;
  refId: string;
}

/** A world-item pickup that stays inert (this function refuses to grant it) until a specific
 *  quest is at least active - the "key artifact discovery gated behind the SQ being active"
 *  mechanic the 4-slot Charm/Totem side quests need (see data/quests.ts's grantsEquipmentSlot).
 *  Built generic (keyed by refId, not hardcoded to these 6) so any future world item can reuse the
 *  same gate rather than this becoming a special case bolted onto one feature. A refId with no
 *  entry here is ungated, matching every WORLD_ITEMS pickup that existed before this table did. */
const WORLD_ITEM_QUEST_GATES: Record<string, string> = {
  'prairie-charm-relic': 'the-skys-second-gift',
  'prairie-totem-relic': 'the-herds-enduring-bond',
  'cedar-charm-relic': 'the-cedars-second-ring',
  'cedar-totem-relic': 'roots-that-remember',
  'desert-charm-relic': 'the-stars-second-light',
  'desert-totem-relic': 'sands-that-endure',
};

export const collectWorldItem = onCall<CollectWorldItemRequest>({ enforceAppCheck: ENFORCE_APP_CHECK }, async (request) => {
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
    backfillPlayerEquipment(save);

    if (save.player.currentLocationId !== locationId) {
      throw new HttpsError('failed-precondition', 'You are not at that location.');
    }

    const gateQuestId = WORLD_ITEM_QUEST_GATES[refId];
    if (gateQuestId && effectiveStatus(gateQuestId, save.quests) === 'locked') {
      throw new HttpsError('failed-precondition', 'There is nothing to find here yet.');
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
    const questRewards = applyQuestRewards(save, completions);
    save.updatedAt = Date.now();
    tx.set(userRef, save);

    return {
      alreadyCollected: alreadyHave,
      questsCompleted: completions.map((c) => c.questId),
      itemId,
      questRewards: isEmptyQuestRewardSummary(questRewards) ? null : questRewards,
    };
  });
});
