import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { getFirestore } from 'firebase-admin/firestore';
import { grantItem } from '../engine/inventoryEngine';
import type { PlayerSave } from '../shared-types';

interface OpenChestRequest {
  locationId: string;
  chestId: string;
}

/** Server-side source of truth for what a given map's chest interactable grants. Uncommon/Rare
 *  equipment only - common gear is shop stock, and unique relics are quest/boss rewards, not
 *  something that belongs behind a repeatable-looking world object. Per the canonical equipment
 *  design: `spiritwood-walking-staff`, `veteran-keeper-coat`, and `mountain-knot` have no earn
 *  path yet - they become quest rewards once that content exists. */
const CHESTS: Record<string, Record<string, string>> = {
  'ironwood-trail': {
    'chest-ironwood-1': 'ironwood-walking-staff',
    'chest-ironwood-2': 'ranger-boots',
    'chest-ironwood-3': 'ghost-miners-coin',
  },
  'hollow-rail-mine': {
    'chest-mine-1': 'reinforced-keeper-coat',
    'chest-mine-2': 'leather-gauntlets',
    'chest-mine-3': 'stone-wolf-totem',
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

    // A unique item already owned some other way (quest reward, etc.) - still mark the chest
    // opened so it doesn't linger as an obviously-reachable freebie, just grant nothing further.
    grantItem(save.inventory, itemId);

    save.openedChests = [...openedChests, chestId];
    save.updatedAt = Date.now();
    tx.set(userRef, save);

    return { alreadyOpened: false, itemId };
  });
});
