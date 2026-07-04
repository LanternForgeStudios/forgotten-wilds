import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { getFirestore } from 'firebase-admin/firestore';
import type { PlayerSave } from '../shared-types';

interface OpenChestRequest {
  locationId: string;
  chestId: string;
}

/** Server-side source of truth for what a given map's chest interactable grants. Uncommon-tier
 *  equipment only - common gear is shop stock, and unique relics are quest/boss rewards, not
 *  something that belongs behind a repeatable-looking world object. */
const CHESTS: Record<string, Record<string, string>> = {
  'ironwood-trail': {
    'chest-ironwood-1': 'keepers-lantern-staff',
    'chest-ironwood-2': 'ridge-runner-boots',
    'chest-ironwood-3': 'emberwood-totem',
  },
  'hollow-rail-mine': {
    'chest-mine-1': 'ironwood-vest',
    'chest-mine-2': 'miners-leather-gloves',
    'chest-mine-3': 'warding-charm',
  },
};

export const openChest = onCall<OpenChestRequest>(async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'You must be signed in.');

  const { locationId, chestId } = request.data ?? {};
  const itemId = locationId && chestId ? CHESTS[locationId]?.[chestId] : undefined;
  if (!itemId) throw new HttpsError('invalid-argument', 'There is no chest here.');

  const db = getFirestore();
  const userRef = db.collection('users').doc(uid);

  return db.runTransaction(async (tx) => {
    const snap = await tx.get(userRef);
    if (!snap.exists) throw new HttpsError('failed-precondition', 'No character found.');
    const save = snap.data() as PlayerSave;
    const openedChests = save.openedChests ?? [];

    if (openedChests.includes(chestId)) {
      return { alreadyOpened: true, itemId };
    }

    const entry = save.inventory.find((i) => i.itemId === itemId);
    if (entry) entry.quantity += 1;
    else save.inventory.push({ itemId, quantity: 1 });

    save.openedChests = [...openedChests, chestId];
    save.updatedAt = Date.now();
    tx.set(userRef, save);

    return { alreadyOpened: false, itemId };
  });
});
