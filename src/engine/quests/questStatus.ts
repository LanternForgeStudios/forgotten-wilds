import type { Quest, QuestProgress } from '@/types';

export type EffectiveQuestStatus = 'locked' | 'active' | 'completed';

/** Display-only mirror of functions/src/engine/questEngine.ts effectiveStatus — not authoritative. */
export function effectiveQuestStatus(
  quest: Quest,
  quests: Record<string, QuestProgress>,
): EffectiveQuestStatus {
  const stored = quests[quest.id];
  if (stored?.status === 'completed') return 'completed';
  if (quest.prerequisiteQuestId && quests[quest.prerequisiteQuestId]?.status !== 'completed') {
    return 'locked';
  }
  return 'active';
}
