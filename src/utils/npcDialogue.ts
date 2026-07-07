import { QUESTS } from '@/data';
import { effectiveQuestStatus } from '@/engine/quests/questStatus';
import type { DialogueLine, Npc, QuestProgress } from '@/types';

/** Picks the right dialogue for an NPC given the player's current quest progress - the first
 *  variant whose linked quest is completed wins (variants should be authored most-advanced-quest
 *  first), falling back to the NPC's base `dialogue` if none of its quests are completed yet. */
export function resolveNpcDialogue(npc: Npc, questProgress: Record<string, QuestProgress>): DialogueLine[] {
  for (const variant of npc.dialogueVariants ?? []) {
    const quest = QUESTS.find((q) => q.id === variant.questId);
    if (quest && effectiveQuestStatus(quest, questProgress) === 'completed') {
      return variant.lines;
    }
  }
  return npc.dialogue;
}
