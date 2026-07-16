import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { getFirestore } from 'firebase-admin/firestore';
import { chestTierForLevel, rollChestRewards } from '../engine/dailyChestEngine';
import { grantItem } from '../engine/inventoryEngine';
import { CHEST_CLAIM_INTERVAL_MS } from '../data/dailyChest';
import type { PlayerSave } from '../shared-types';

export const claimDailyChest = onCall(async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'You must be signed in.');

  const db = getFirestore();
  const userRef = db.collection('users').doc(uid);

  return db.runTransaction(async (tx) => {
    const snap = await tx.get(userRef);
    if (!snap.exists) throw new HttpsError('failed-precondition', 'No character found.');
    const save = snap.data() as PlayerSave;

    // Backfill for a save written before this field existed - see knownSkillIds's matching
    // pattern in resolveCombatAction.ts. 0 already means "eligible immediately" below, so this is
    // just making the field explicit rather than changing any behavior.
    if (!save.player.lastChestClaimedAt) save.player.lastChestClaimedAt = 0;

    const now = Date.now();
    if (now - save.player.lastChestClaimedAt < CHEST_CLAIM_INTERVAL_MS) {
      throw new HttpsError('failed-precondition', 'Your next chest is not ready yet.');
    }

    const tier = chestTierForLevel(save.player.level);
    const rewards = rollChestRewards(tier);

    save.player.gold += rewards.gold;
    save.player.premiumCurrency += rewards.premiumCurrency;
    for (const itemId of rewards.itemIds) {
      grantItem(save, itemId);
    }
    save.player.lastChestClaimedAt = now;
    save.updatedAt = now;
    tx.set(userRef, save);

    return { tier, rewards, lastChestClaimedAt: now };
  });
});
