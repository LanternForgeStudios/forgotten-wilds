import { QUESTS, type QuestObjectiveType } from '../data/quests';
import { NPC_DIALOGUE_VARIANT_QUEST_IDS } from '../data/npcDialogueVariants';
import { grantItem } from './inventoryEngine';
import { applyLevelUp } from './levelingEngine';
import type { PlayerSave, QuestProgress } from '../shared-types';

export function effectiveStatus(
  questId: string,
  quests: Record<string, QuestProgress>,
): 'locked' | 'active' | 'completed' {
  const stored = quests[questId];
  if (stored?.status === 'completed') return 'completed';

  const def = QUESTS[questId];
  if (!def) return 'locked';
  if (def.prerequisiteQuestId && quests[def.prerequisiteQuestId]?.status !== 'completed') {
    return 'locked';
  }
  return 'active';
}

/** Which dialogue variant an NPC is currently showing, as a key (a gating quest id, or 'base' if
 *  none of that NPC's variants are unlocked yet) - mirrors the client's resolveNpcDialogue exactly
 *  (first-completed-quest-wins, most-advanced-first), just returning the key instead of the lines
 *  themselves (this file has no knowledge of dialogue text, only which quest unlocks which variant -
 *  see npcDialogueVariants.ts). Used by talkToNpc.ts to track what the player has and hasn't heard. */
export function currentNpcDialogueVariantKey(npcId: string, quests: Record<string, QuestProgress>): string {
  for (const questId of NPC_DIALOGUE_VARIANT_QUEST_IDS[npcId] ?? []) {
    if (effectiveStatus(questId, quests) === 'completed') return questId;
  }
  return 'base';
}

export interface QuestAdvanceEvent {
  type: QuestObjectiveType;
  targetId: string;
  amount?: number;
}

export interface QuestCompletion {
  questId: string;
  reward: { xp: number; gold: number; itemIds?: string[]; spiritEssence?: number };
}

/**
 * Mutates `quests` in place, advancing any active quest whose objective matches the event.
 * Returns the list of quests that became newly completed this call (for granting rewards).
 */
export function advanceQuests(quests: Record<string, QuestProgress>, event: QuestAdvanceEvent): QuestCompletion[] {
  const completions: QuestCompletion[] = [];

  for (const questId of Object.keys(QUESTS)) {
    if (effectiveStatus(questId, quests) !== 'active') continue;
    const def = QUESTS[questId];
    const objective = def.objectives.find((o) => o.type === event.type && o.targetId === event.targetId);
    if (!objective) continue;

    const progress = quests[questId] ?? { status: 'active', objectiveCounts: {} };
    const current = progress.objectiveCounts[objective.id] ?? 0;
    progress.objectiveCounts[objective.id] = Math.min(objective.requiredCount, current + (event.amount ?? 1));
    progress.status = 'active';
    quests[questId] = progress;

    const allComplete = def.objectives.every(
      (o) => (progress.objectiveCounts[o.id] ?? 0) >= o.requiredCount,
    );
    if (allComplete) {
      progress.status = 'completed';
      completions.push({ questId, reward: def.reward });
    }
  }

  return completions;
}

function grantCompletionRewards(save: PlayerSave, completions: QuestCompletion[]): void {
  for (const { reward } of completions) {
    save.player.xp += reward.xp;
    save.player.gold += reward.gold;
    save.player.spiritEssence += reward.spiritEssence ?? 0;
    for (const itemId of reward.itemIds ?? []) {
      // A unique reward item already owned some other way is skipped, not an error - the quest
      // still completes and its xp/gold still land.
      grantItem(save.inventory, itemId);
    }
  }
}

/** Auto-credits any active quest's collectItem/reachLocation objective the player already
 *  satisfies from existing state (inventory / journal.locationsVisited), even though no matching
 *  event fired this request - e.g. a fragment picked up while exploring, well before the quest
 *  requiring it ever unlocked, would otherwise sit uncredited until the player made a redundant
 *  trip back to the same spot just to "trigger" it again. Loops because completing one quest this
 *  way can unlock its successor, which might itself already be satisfied the same way (rare, but
 *  cheap to keep checking until nothing changes - bounded by the quest count so it can't spin).
 *  Other objective types (talkToNpc, defeatEnemies, defeatBoss, interactWithShrine) have no
 *  persistent "already did this" record precise enough to auto-satisfy this way, so those still
 *  require the real action once the quest is active. */
function reconcileRetroactiveObjectives(save: PlayerSave): QuestCompletion[] {
  const completions: QuestCompletion[] = [];
  const questIds = Object.keys(QUESTS);
  let changed = true;
  for (let pass = 0; changed && pass < questIds.length; pass++) {
    changed = false;
    for (const questId of questIds) {
      if (effectiveStatus(questId, save.quests) !== 'active') continue;
      const def = QUESTS[questId];
      const progress = save.quests[questId] ?? { status: 'active' as const, objectiveCounts: {} };
      let progressChanged = false;
      for (const o of def.objectives) {
        if ((progress.objectiveCounts[o.id] ?? 0) >= o.requiredCount) continue;
        const alreadySatisfied =
          (o.type === 'collectItem' && save.inventory.some((i) => i.itemId === o.targetId)) ||
          (o.type === 'reachLocation' && save.journal.locationsVisited.includes(o.targetId));
        if (alreadySatisfied) {
          progress.objectiveCounts[o.id] = o.requiredCount;
          progressChanged = true;
        }
      }
      if (!progressChanged) continue;
      progress.status = 'active';
      save.quests[questId] = progress;
      changed = true;
      const allComplete = def.objectives.every((o) => (progress.objectiveCounts[o.id] ?? 0) >= o.requiredCount);
      if (allComplete) {
        progress.status = 'completed';
        completions.push({ questId, reward: def.reward });
      }
    }
  }
  return completions;
}

/** Applies quest rewards (xp/gold/spiritEssence/items) directly onto a PlayerSave, then checks for
 *  a level-up from the accumulated xp - safe to call even alongside a separate combat-xp grant in
 *  the same request, since applyLevelUp is idempotent. Also reconciles any other active quest's
 *  already-satisfiable objectives (see reconcileRetroactiveObjectives) every time, since a quest
 *  can sit active for a while (nothing tracks "just unlocked") before the player does anything
 *  that would otherwise notice it's already done. */
export function applyQuestRewards(save: PlayerSave, completions: QuestCompletion[]): void {
  grantCompletionRewards(save, completions);
  grantCompletionRewards(save, reconcileRetroactiveObjectives(save));
  applyLevelUp(save);
}
