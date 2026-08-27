import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { getFirestore } from 'firebase-admin/firestore';
import { EQUIPMENT } from '../data/equipment';
import { LANTERN_OIL_UPGRADE_GATES, LANTERN_OIL_UPGRADE_MAX_TIER, LANTERN_OIL_UPGRADE_PRICES } from '../data/lanternOilUpgrades';
import { backfillPlayerEquipment, effectiveOilCapacity, setLanternOilCapacity } from '../engine/equipmentEngine';
import type { PlayerSave } from '../shared-types';
import { ENFORCE_APP_CHECK } from '../appCheckConfig';

// Same table purchaseItem.ts uses for every General Store, keyed by the same shopId - a player
// standing anywhere else can't spend gold on an upgrade whose price/discovery the client only
// ever surfaces at that specific shop's dialogue.
const SHOP_LOCATIONS: Record<string, string> = {
  'mara-ash-general-store': 'ash-hallow-mara-shop',
  'remy-general-store': 'mirehaven-general-store',
  'wyatt-general-store': 'highwind-crossing-general-store',
  'byron-general-store': 'cedarwatch-general-store',
  'mateo-general-store': 'red-mesa-general-store',
  'bjorn-general-store': 'frosthaven-general-store',
};

interface UpgradeLanternOilRequest {
  lanternId: string;
}

/** Spends gold to permanently raise one specific Legendary Lantern's max Oil capacity by one tier
 *  (see data/lanternOilUpgrades.ts) - gated behind having already defeated that lantern's own
 *  region's story boss, and only purchasable at that region's General Store. The upgrade is
 *  tracked per lanternId (player.lanternOilUpgrades), independent of whether that lantern happens
 *  to be equipped right now - if it IS currently equipped, this also immediately recomputes
 *  stats.maxLanternOil so the new capacity takes effect without needing to re-equip. */
export const upgradeLanternOil = onCall<UpgradeLanternOilRequest>({ enforceAppCheck: ENFORCE_APP_CHECK }, async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'You must be signed in.');

  const lanternId = request.data?.lanternId;
  const gate = lanternId ? LANTERN_OIL_UPGRADE_GATES[lanternId] : undefined;
  const def = lanternId ? EQUIPMENT[lanternId] : undefined;
  if (!gate || !def || def.slot !== 'lantern') {
    throw new HttpsError('invalid-argument', 'That lantern cannot be upgraded.');
  }

  const db = getFirestore();
  const userRef = db.collection('users').doc(uid);

  return db.runTransaction(async (tx) => {
    const snap = await tx.get(userRef);
    if (!snap.exists) throw new HttpsError('failed-precondition', 'No character found.');
    const save = snap.data() as PlayerSave;
    backfillPlayerEquipment(save);

    if (save.player.currentLocationId !== SHOP_LOCATIONS[gate.shopId]) {
      throw new HttpsError('failed-precondition', 'You are not at that location.');
    }
    if (!save.journal.bossesDefeated.includes(gate.bossId)) {
      throw new HttpsError('failed-precondition', 'This upgrade is not available to you yet.');
    }
    // Owning the lantern (in inventory, or currently equipped) is required - upgrading a lantern
    // the player has never actually found would be a purchase with no real effect.
    const owned = save.inventory.some((i) => i.itemId === lanternId) || save.player.equipment.lantern === lanternId;
    if (!owned) {
      throw new HttpsError('failed-precondition', 'You do not own that lantern.');
    }

    const currentTier = save.player.lanternOilUpgrades[lanternId] ?? 0;
    if (currentTier >= LANTERN_OIL_UPGRADE_MAX_TIER) {
      throw new HttpsError('failed-precondition', 'That lantern is already fully upgraded.');
    }
    const price = LANTERN_OIL_UPGRADE_PRICES[currentTier];
    if (save.player.gold < price) {
      throw new HttpsError('failed-precondition', 'Not enough gold.');
    }

    save.player.gold -= price;
    const newTier = currentTier + 1;
    save.player.lanternOilUpgrades[lanternId] = newTier;
    if (save.player.equipment.lantern === lanternId) {
      setLanternOilCapacity(save.player.stats, effectiveOilCapacity(def.oilCapacity ?? 0, lanternId, save.player.lanternOilUpgrades));
    }

    save.updatedAt = Date.now();
    tx.set(userRef, save);

    return {
      gold: save.player.gold,
      newTier,
      maxLanternOil: save.player.stats.maxLanternOil,
      nextPrice: newTier < LANTERN_OIL_UPGRADE_MAX_TIER ? LANTERN_OIL_UPGRADE_PRICES[newTier] : null,
    };
  });
});
