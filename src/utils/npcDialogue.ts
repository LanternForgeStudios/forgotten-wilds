import { QUESTS } from '@/data';
import { effectiveQuestStatus } from '@/engine/quests/questStatus';
import type { DialogueLine, Npc, QuestProgress } from '@/types';

/** Which dialogue variant an NPC is currently showing, as a key (a gating quest id, or 'base' if
 *  none of its variants are unlocked yet) - mirrors the server's currentNpcDialogueVariantKey
 *  (functions/src/engine/questEngine.ts) exactly, first-completed-quest-wins, most-advanced-first. */
export function resolveNpcDialogueVariantKey(npc: Npc, questProgress: Record<string, QuestProgress>): string {
  for (const variant of npc.dialogueVariants ?? []) {
    const quest = QUESTS.find((q) => q.id === variant.questId);
    if (quest && effectiveQuestStatus(quest, questProgress) === 'completed') {
      return variant.questId;
    }
  }
  return 'base';
}

/** Picks the right dialogue for an NPC given the player's current quest progress - the first
 *  variant whose linked quest is completed wins (variants should be authored most-advanced-quest
 *  first), falling back to the NPC's base `dialogue` if none of its quests are completed yet. */
export function resolveNpcDialogue(npc: Npc, questProgress: Record<string, QuestProgress>): DialogueLine[] {
  const key = resolveNpcDialogueVariantKey(npc, questProgress);
  if (key === 'base') return npc.dialogue;
  return npc.dialogueVariants!.find((v) => v.questId === key)!.lines;
}

/** Whether this NPC has dialogue the player hasn't heard yet - either they've never talked to this
 *  NPC before (no entry in `seenVariants`, defaults to 'base'), or a new variant has unlocked since
 *  their last conversation. Drives the "!" indicator shown above the NPC while exploring. */
export function hasNewDialogue(
  npc: Npc,
  questProgress: Record<string, QuestProgress>,
  seenVariants: Record<string, string>,
): boolean {
  return resolveNpcDialogueVariantKey(npc, questProgress) !== (seenVariants[npc.id] ?? 'base');
}
