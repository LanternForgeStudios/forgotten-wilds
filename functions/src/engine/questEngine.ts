import { QUESTS, type QuestObjectiveType } from '../data/quests';
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

export interface QuestAdvanceEvent {
  type: QuestObjectiveType;
  targetId: string;
  amount?: number;
}

export interface QuestCompletion {
  questId: string;
  reward: { xp: number; gold: number; itemIds?: string[] };
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

/** Applies quest rewards (xp/gold/items) directly onto a PlayerSave. Does not handle leveling; call sites that
 *  also grant combat XP should apply level-up logic afterward using the combined xp total. */
export function applyQuestRewards(save: PlayerSave, completions: QuestCompletion[]): void {
  for (const { reward } of completions) {
    save.player.xp += reward.xp;
    save.player.gold += reward.gold;
    for (const itemId of reward.itemIds ?? []) {
      const entry = save.inventory.find((i) => i.itemId === itemId);
      if (entry) entry.quantity += 1;
      else save.inventory.push({ itemId, quantity: 1 });
    }
  }
}
