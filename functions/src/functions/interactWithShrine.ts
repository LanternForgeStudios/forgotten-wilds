import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { getFirestore } from 'firebase-admin/firestore';
import { advanceQuests, applyQuestRewards } from '../engine/questEngine';
import { BASE_STAMINA_ON_UNLOCK, STAT_GROWTH_PER_LEVEL } from '../data/leveling';
import { KNOWN_SHRINES } from '../data/locations';
import type { PlayerSave } from '../shared-types';

interface InteractWithShrineRequest {
  locationId: string;
  refId: string;
}

export const interactWithShrine = onCall<InteractWithShrineRequest>(async (request) => {
  const uid = request.auth?.uid;
  if (!uid) {
    throw new HttpsError('unauthenticated', 'You must be signed in.');
  }
  const { locationId, refId } = request.data ?? {};
  if (!locationId || !refId || !KNOWN_SHRINES[locationId]?.has(refId)) {
    throw new HttpsError('invalid-argument', 'Unknown shrine.');
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

    // Fires both event types so one interaction can satisfy a "discover this place" quest
    // (reachLocation) and a separate, later "do something here" quest (interactWithShrine) without
    // needing the client to know which one currently applies.
    const shrineCompletions = advanceQuests(save.quests, { type: 'interactWithShrine', targetId: refId });
    const discoveryCompletions = advanceQuests(save.quests, { type: 'reachLocation', targetId: refId });
    const completions = [...shrineCompletions, ...discoveryCompletions];
    applyQuestRewards(save, completions);

    const completedIds = completions.map((c) => c.questId);
    // Data-driven via QuestDef.reward.grantsStaminaUnlock rather than a hardcoded quest id, so any
    // future quest could unlock Stamina/Dash the same way (see 'rekindling-spirit-grove' in
    // data/quests.ts). The base pool is scaled for the player's current level so it isn't
    // undersized for someone who leveled up along the way.
    const unlockedStamina = completions.some((c) => c.reward.grantsStaminaUnlock);
    if (unlockedStamina) {
      const level = save.player.level;
      save.player.stats.maxStamina = BASE_STAMINA_ON_UNLOCK + STAT_GROWTH_PER_LEVEL.maxStamina * (level - 1);
      save.player.stats.stamina = save.player.stats.maxStamina;
      save.player.staminaUpdatedAt = Date.now();
    }

    save.updatedAt = Date.now();
    tx.set(userRef, save);

    return { questsCompleted: completedIds, unlockedStamina };
  });
});
