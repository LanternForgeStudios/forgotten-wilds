import { QUESTS } from '@/data';
import { effectiveQuestStatus } from '@/engine/quests/questStatus';
import type { DialogueLine, Npc, Quest, QuestProgress } from '@/types';

/** True while `quest` is active (not completed) and `objectiveId` is a "report back" beat that's
 *  ready to fire: every objective it names in requiresObjectiveIds is already at its own
 *  requiredCount, but the objective itself hasn't been credited yet. This is the moment the player
 *  is walking back to an NPC having just done the fetch/kill/shrine step elsewhere - the dialogue
 *  box for THAT exact conversation renders off quest state captured before the talkToNpc call
 *  resolves (see talkToNpc.ts's comment on shownVariantKey), so this has to be checked from the
 *  pre-credit state, not the post-credit one. */
function isObjectiveReadyToReport(quest: Quest, objectiveId: string, questProgress: Record<string, QuestProgress>): boolean {
  if (effectiveQuestStatus(quest, questProgress) !== 'active') return false;
  const objective = quest.objectives.find((o) => o.id === objectiveId);
  if (!objective) return false;
  const progress = questProgress[quest.id];
  const ownCount = progress?.objectiveCounts?.[objectiveId] ?? 0;
  if (ownCount >= objective.requiredCount) return false;
  const reqIds = objective.requiresObjectiveIds ?? [];
  // A referenced prerequisite id that doesn't resolve to a real objective (should never happen with
  // correctly-authored quest data) is treated as already-satisfied, not blocking - matches the
  // server's objectivePrerequisitesSatisfied (functions/src/engine/questEngine.ts) exactly, so both
  // sides compute the same dialogue key from the same quest state.
  return reqIds.every((reqId) => {
    const reqObjective = quest.objectives.find((o) => o.id === reqId);
    if (!reqObjective) return true;
    return (progress?.objectiveCounts?.[reqId] ?? 0) >= reqObjective.requiredCount;
  });
}

/** Which dialogue variant an NPC is currently showing, as a key - mirrors the server's
 *  currentNpcDialogueVariantKey (functions/src/engine/questEngine.ts) exactly. Checks "report
 *  back" variants first (a more specific/immediate state - see isObjectiveReadyToReport), keyed
 *  as `${questId}:${objectiveId}`; then falls through to the first completed-quest variant
 *  (most-advanced-first); then 'base'. */
export function resolveNpcDialogueVariantKey(npc: Npc, questProgress: Record<string, QuestProgress>): string {
  for (const variant of npc.dialogueVariants ?? []) {
    if (!variant.reportForObjectiveId) continue;
    const quest = QUESTS.find((q) => q.id === variant.questId);
    if (quest && isObjectiveReadyToReport(quest, variant.reportForObjectiveId, questProgress)) {
      return `${variant.questId}:${variant.reportForObjectiveId}`;
    }
  }
  for (const variant of npc.dialogueVariants ?? []) {
    if (variant.reportForObjectiveId) continue;
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
  const separatorIndex = key.indexOf(':');
  if (separatorIndex !== -1) {
    const questId = key.slice(0, separatorIndex);
    const objectiveId = key.slice(separatorIndex + 1);
    return npc.dialogueVariants!.find((v) => v.questId === questId && v.reportForObjectiveId === objectiveId)!.lines;
  }
  return npc.dialogueVariants!.find((v) => v.questId === key && !v.reportForObjectiveId)!.lines;
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
