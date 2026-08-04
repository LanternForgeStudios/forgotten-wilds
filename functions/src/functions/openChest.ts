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
  // Crimson Bayou field maps - now stocked with the region's own Rare-tier equipment (Cypress
  // Cane/Bayou Vestments/Bayou Leg-Wraps/Marsh Boots/Mire Gloves/Cypress Spirits families - see
  // equipment.ts), rather than Iron Mountains leftovers with no earn path of their own. Those
  // Iron Mountains items got a real earn path instead via SHOP_UNLOCK_TIERS
  // (ash-hallow-blacksmith-forge/ash-hallow-armory, unlocked by the-mountain-remembers). One
  // materials chest per map rounds out the crafting-material drop rate rather than making every
  // chest an equipment freebie.
  'cypress-marsh': {
    'chest-cypress-marsh-1': 'rougarou-fang-blade',
    'chest-cypress-marsh-2': 'warden-bayou-vestments',
    'chest-cypress-marsh-3': 'croc-hide',
  },
  'murkwater-trails': {
    'chest-murkwater-trails-1': 'mosswalker-boots',
    'chest-murkwater-trails-2': 'warden-mire-gloves',
    'chest-murkwater-trails-3': 'bog-ash',
  },
  'hidden-river-landing': {
    'chest-hidden-river-landing-1': 'warden-bayou-leg-wraps',
    'chest-hidden-river-landing-2': 'swamp-wisp-totem',
    'chest-hidden-river-landing-3': 'ancient-serpent-scale',
  },
  // Endless Prairie (MSQ Volume III, Chapter 5) - 5 field maps instead of Bayou's 3, so the 6 Rare
  // equipment pieces spread 1-2 per map instead of a flat "2 equipment + 1 material" split;
  // materials fill every other chest slot.
  'golden-prairie': {
    'chest-golden-prairie-1': 'windriders-spear',
    'chest-golden-prairie-2': 'wisp-feather',
    'chest-golden-prairie-3': 'prairie-wolf-pelt',
  },
  'spirit-herd-plains': {
    'chest-spirit-herd-plains-1': 'chieftains-buffalo-hide',
    'chest-spirit-herd-plains-2': 'windborn-riders-chaps',
    'chest-spirit-herd-plains-3': 'wisp-feather',
  },
  'sacred-hills': {
    'chest-sacred-hills-1': 'windrunner-boots',
    'chest-sacred-hills-2': 'warden-rider-gloves',
    'chest-sacred-hills-3': 'prairie-wolf-pelt',
  },
  'stone-circle-valley': {
    'chest-stone-circle-valley-1': 'skywalkers-charm',
    'chest-stone-circle-valley-2': 'wisp-feather',
    'chest-stone-circle-valley-3': 'prairie-wolf-pelt',
  },
  'thunderbird-mesa-approach': {
    'chest-thunderbird-mesa-approach-1': 'wisp-feather',
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

    if (save.player.currentLocationId !== locationId) {
      throw new HttpsError('failed-precondition', 'You are not at that location.');
    }

    const openedChests = save.openedChests ?? [];

    if (openedChests.includes(chestId)) {
      return { alreadyOpened: true, itemId };
    }

    // A unique item already owned some other way (quest reward, etc.) - still mark the chest
    // opened so it doesn't linger as an obviously-reachable freebie, just grant nothing further.
    grantItem(save, itemId);

    save.openedChests = [...openedChests, chestId];
    save.updatedAt = Date.now();
    tx.set(userRef, save);

    return { alreadyOpened: false, itemId };
  });
});
