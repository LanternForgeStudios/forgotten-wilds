import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { getFirestore } from 'firebase-admin/firestore';
import { EQUIPMENT, type EquipmentSlot } from '../data/equipment';
import { QUESTS } from '../data/quests';
import {
  adjustStatsForBonuses,
  backfillPlayerEquipment,
  CHARM_SLOTS,
  equipIntoSlot,
  freshPlayerEquipment,
  setLanternOilCapacity,
  TOTEM_SLOTS,
} from '../engine/equipmentEngine';
import type { PlayerSave } from '../shared-types';
import { ENFORCE_APP_CHECK } from '../appCheckConfig';

// Derived from freshPlayerEquipment() (the canonical slot list) rather than its own hardcoded
// literal, so a future slot add/rename can't drift this validation set out of sync the way it
// would have to be remembered by hand otherwise.
const VALID_SLOTS = new Set<EquipmentSlot>(Object.keys(freshPlayerEquipment()) as EquipmentSlot[]);

/** Which quest's completion unlocks a given equipment slot - derived once from QUESTS itself
 *  (reward.grantsEquipmentSlot) rather than a second hand-maintained table, so this can never
 *  silently drift from the quest data that's actually authoritative. A slot with no entry here
 *  (every slot except charm2-4/spiritTotem2-4) is always unlocked. */
const SLOT_UNLOCK_QUEST_ID: Partial<Record<EquipmentSlot, string>> = (() => {
  const map: Partial<Record<EquipmentSlot, string>> = {};
  for (const quest of Object.values(QUESTS)) {
    if (quest.reward.grantsEquipmentSlot) map[quest.reward.grantsEquipmentSlot] = quest.id;
  }
  return map;
})();

interface EquipItemRequest {
  itemId: string;
  /** Only meaningful for a Charm or Spirit Totem item, which can go into any of its family's 4
   *  slots (see CHARM_SLOTS/TOTEM_SLOTS) - every other item has exactly one possible slot
   *  (def.slot itself), so this is ignored for anything else. Defaults to the family's base slot
   *  ('charm'/'spiritTotem') when omitted or when it names a slot outside the right family. */
  targetSlot?: EquipmentSlot;
}

/** Resolves which slot an equip request actually targets - itemId's own def.slot for everything
 *  except Charm/Spirit Totem items, which resolve to the requested targetSlot if it's a real
 *  member of the right family, else fall back to that family's base slot. */
function resolveTargetSlot(defSlot: EquipmentSlot, requestedSlot: EquipmentSlot | undefined): EquipmentSlot {
  const family = defSlot === 'charm' ? CHARM_SLOTS : defSlot === 'spiritTotem' ? TOTEM_SLOTS : undefined;
  if (!family) return defSlot;
  return requestedSlot && family.includes(requestedSlot) ? requestedSlot : defSlot;
}

export const equipItem = onCall<EquipItemRequest>({ enforceAppCheck: ENFORCE_APP_CHECK }, async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'You must be signed in.');

  const itemId = request.data?.itemId;
  const def = itemId ? EQUIPMENT[itemId] : undefined;
  if (!def) throw new HttpsError('invalid-argument', 'Unknown equipment item.');

  const slot = resolveTargetSlot(def.slot as EquipmentSlot, request.data?.targetSlot);
  if (!VALID_SLOTS.has(slot)) throw new HttpsError('internal', 'Invalid equipment slot.');

  const db = getFirestore();
  const userRef = db.collection('users').doc(uid);

  return db.runTransaction(async (tx) => {
    const snap = await tx.get(userRef);
    if (!snap.exists) throw new HttpsError('failed-precondition', 'No character found.');
    const save = snap.data() as PlayerSave;
    backfillPlayerEquipment(save);

    const unlockQuestId = SLOT_UNLOCK_QUEST_ID[slot];
    if (unlockQuestId && save.quests[unlockQuestId]?.status !== 'completed') {
      throw new HttpsError('failed-precondition', 'That equipment slot is not unlocked yet.');
    }

    const previousItemId = save.player.equipment[slot];
    if (previousItemId === itemId) {
      return { equipment: save.player.equipment, stats: save.player.stats };
    }

    // Ownership check accounts for the same itemId already equipped in ANOTHER slot (only
    // possible for Charm/Spirit Totem items now that each family has 4 slots) - owning exactly 1
    // copy, already worn in `charm`, isn't enough to also wear it in `charm2`; that would be the
    // same physical item in two places at once. Every other slot family still has just one
    // possible target, so this is a no-op reduction to the old single-slot check for them.
    const equippedElsewhereCount = (Object.entries(save.player.equipment) as [EquipmentSlot, string | null][]).filter(
      ([s, id]) => id === itemId && s !== slot,
    ).length;
    const ownedQuantity = save.inventory.find((i) => i.itemId === itemId)?.quantity ?? 0;
    if (ownedQuantity <= equippedElsewhereCount) {
      throw new HttpsError('failed-precondition', 'You do not have another one of those to equip.');
    }

    if (previousItemId) {
      const previousDef = EQUIPMENT[previousItemId];
      if (previousDef) adjustStatsForBonuses(save.player.stats, previousDef.statBonuses, -1);
    }
    equipIntoSlot(save, itemId, def, slot);

    save.updatedAt = Date.now();
    tx.set(userRef, save);

    return { equipment: save.player.equipment, stats: save.player.stats };
  });
});

interface UnequipItemRequest {
  slot: EquipmentSlot;
}

export const unequipItem = onCall<UnequipItemRequest>({ enforceAppCheck: ENFORCE_APP_CHECK }, async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'You must be signed in.');

  const slot = request.data?.slot;
  if (!slot || !VALID_SLOTS.has(slot)) throw new HttpsError('invalid-argument', 'Invalid equipment slot.');

  const db = getFirestore();
  const userRef = db.collection('users').doc(uid);

  return db.runTransaction(async (tx) => {
    const snap = await tx.get(userRef);
    if (!snap.exists) throw new HttpsError('failed-precondition', 'No character found.');
    const save = snap.data() as PlayerSave;
    backfillPlayerEquipment(save);

    const currentItemId = save.player.equipment[slot];
    if (currentItemId) {
      const def = EQUIPMENT[currentItemId];
      if (def) adjustStatsForBonuses(save.player.stats, def.statBonuses, -1);
    }
    if (slot === 'lantern') setLanternOilCapacity(save.player.stats, 0);
    save.player.equipment[slot] = null;

    save.updatedAt = Date.now();
    tx.set(userRef, save);

    return { equipment: save.player.equipment, stats: save.player.stats };
  });
});
