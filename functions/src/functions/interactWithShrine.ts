import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { getFirestore } from 'firebase-admin/firestore';
import { advanceQuests, applyQuestRewards } from '../engine/questEngine';
import { BASE_STAMINA_ON_UNLOCK, STAT_GROWTH_PER_LEVEL } from '../data/leveling';
import type { PlayerSave } from '../shared-types';

interface InteractWithShrineRequest {
  locationId: string;
  refId: string;
}

/** Server-side source of truth for which shrine interactables actually exist. The Guardian of
 *  Ironwood shrine (an ad hoc Stamina/Dash unlock chain built before the canonical MSQ existed)
 *  has been retired in favor of the Spirit Grove restoration shrine from the real MSQ content
 *  (see the 'rekindling-spirit-grove' quest, gated behind the three Guardian Sigil fragments). */
const KNOWN_SHRINES: Record<string, Set<string>> = {
  'ironwood-trail': new Set(['spirit-grove']),
  'ash-hallow': new Set(['ash-hallow-shrine']),
  'hollow-rail-mine': new Set(['mine-shrine']),
};

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

    // Fires both event types so one interaction can satisfy a "discover this place" quest
    // (reachLocation) and a separate, later "do something here" quest (interactWithShrine) without
    // needing the client to know which one currently applies.
    const shrineCompletions = advanceQuests(save.quests, { type: 'interactWithShrine', targetId: refId });
    const discoveryCompletions = advanceQuests(save.quests, { type: 'reachLocation', targetId: refId });
    const completions = [...shrineCompletions, ...discoveryCompletions];
    applyQuestRewards(save, completions);

    const completedIds = completions.map((c) => c.questId);
    // Restoring Spirit Grove is also what unlocks Stamina/Dash - the base pool is scaled for
    // the player's current level so it isn't undersized for someone who leveled up along the way.
    const unlockedStamina = completedIds.includes('rekindling-spirit-grove');
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
