import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { getFirestore } from 'firebase-admin/firestore';
import { EQUIPMENT, type EquipmentSlot } from '../data/equipment';
import { adjustStatsForBonuses } from '../engine/equipmentEngine';
import type { PlayerSave } from '../shared-types';

const VALID_SLOTS = new Set<EquipmentSlot>([
  'weapon',
  'armor',
  'boots',
  'gloves',
  'charm',
  'lantern',
  'spiritTotem',
]);

interface EquipItemRequest {
  itemId: string;
}

export const equipItem = onCall<EquipItemRequest>(async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'You must be signed in.');

  const itemId = request.data?.itemId;
  const def = itemId ? EQUIPMENT[itemId] : undefined;
  if (!def) throw new HttpsError('invalid-argument', 'Unknown equipment item.');

  const db = getFirestore();
  const userRef = db.collection('users').doc(uid);

  return db.runTransaction(async (tx) => {
    const snap = await tx.get(userRef);
    if (!snap.exists) throw new HttpsError('failed-precondition', 'No character found.');
    const save = snap.data() as PlayerSave;

    const owned = save.inventory.some((i) => i.itemId === itemId && i.quantity > 0);
    if (!owned) throw new HttpsError('failed-precondition', 'You do not own that item.');

    const slot = def.slot as EquipmentSlot;
    if (!VALID_SLOTS.has(slot)) throw new HttpsError('internal', 'Invalid equipment slot.');

    const previousItemId = save.player.equipment[slot];
    if (previousItemId === itemId) {
      return { equipment: save.player.equipment, stats: save.player.stats };
    }
    if (previousItemId) {
      const previousDef = EQUIPMENT[previousItemId];
      if (previousDef) adjustStatsForBonuses(save.player.stats, previousDef.statBonuses, -1);
    }
    adjustStatsForBonuses(save.player.stats, def.statBonuses, 1);
    save.player.equipment[slot] = itemId;

    save.updatedAt = Date.now();
    tx.set(userRef, save);

    return { equipment: save.player.equipment, stats: save.player.stats };
  });
});

interface UnequipItemRequest {
  slot: EquipmentSlot;
}

export const unequipItem = onCall<UnequipItemRequest>(async (request) => {
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

    const currentItemId = save.player.equipment[slot];
    if (currentItemId) {
      const def = EQUIPMENT[currentItemId];
      if (def) adjustStatsForBonuses(save.player.stats, def.statBonuses, -1);
    }
    save.player.equipment[slot] = null;

    save.updatedAt = Date.now();
    tx.set(userRef, save);

    return { equipment: save.player.equipment, stats: save.player.stats };
  });
});
