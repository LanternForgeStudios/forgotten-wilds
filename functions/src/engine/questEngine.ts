import { QUESTS, type QuestDef, type QuestObjectiveType } from '../data/quests';
import { NPC_DIALOGUE_VARIANT_QUEST_IDS, NPC_DIALOGUE_REPORT_VARIANTS } from '../data/npcDialogueVariants';
import { EQUIPMENT } from '../data/equipment';
import { grantItem } from './inventoryEngine';
import { applyLevelUp } from './levelingEngine';
import { equipIntoSlot } from './equipmentEngine';
import { spiritRankForEssence, regionalReputationRankForTotal } from '../data/leveling';
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

/** True while `questId` is active (not completed) and `objectiveId` is a "report back" beat
 *  that's ready to fire: every objective it names in requiresObjectiveIds is already at its own
 *  requiredCount, but the objective itself hasn't been credited yet - mirrors the client's
 *  isObjectiveReadyToReport (src/utils/npcDialogue.ts) exactly. */
function isObjectiveReadyToReport(questId: string, objectiveId: string, quests: Record<string, QuestProgress>): boolean {
  if (effectiveStatus(questId, quests) !== 'active') return false;
  const def = QUESTS[questId];
  const objective = def?.objectives.find((o) => o.id === objectiveId);
  if (!objective) return false;
  const progress = quests[questId];
  const ownCount = progress?.objectiveCounts?.[objectiveId] ?? 0;
  if (ownCount >= objective.requiredCount) return false;
  const reqIds = objective.requiresObjectiveIds ?? [];
  return reqIds.every((reqId) => {
    const reqObjective = def.objectives.find((o) => o.id === reqId);
    if (!reqObjective) return false;
    return (progress?.objectiveCounts?.[reqId] ?? 0) >= reqObjective.requiredCount;
  });
}

/** Which dialogue variant an NPC is currently showing, as a key (a gating quest id, or 'base' if
 *  none of that NPC's variants are unlocked yet) - mirrors the client's resolveNpcDialogue exactly
 *  (first-completed-quest-wins, most-advanced-first), just returning the key instead of the lines
 *  themselves (this file has no knowledge of dialogue text, only which quest unlocks which variant -
 *  see npcDialogueVariants.ts). Checks "report back" variants first (a more specific/immediate
 *  state), keyed as `${questId}:${objectiveId}`. Used by talkToNpc.ts to track what the player has
 *  and hasn't heard. */
export function currentNpcDialogueVariantKey(npcId: string, quests: Record<string, QuestProgress>): string {
  for (const { questId, objectiveId } of NPC_DIALOGUE_REPORT_VARIANTS[npcId] ?? []) {
    if (isObjectiveReadyToReport(questId, objectiveId, quests)) return `${questId}:${objectiveId}`;
  }
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
  reward: QuestDef['reward'];
}

/** What a call to applyQuestRewards actually granted, aggregated across every quest it completed
 *  this call (a direct completion plus anything reconcileRetroactiveObjectives also swept up) -
 *  returned so callers (the Cloud Functions in functions/src/functions/) can surface it to the
 *  client for the shared reward-acknowledgment popup (see RewardPopup.tsx), instead of a quest's
 *  item/skill grant landing in the save with zero UI feedback. itemIds/grantedSkillIds/
 *  grantedLoreIds only ever contain what was ACTUALLY granted (a unique item already owned, or a
 *  skill/lore already known, is correctly omitted - see grantCompletionRewards). */
export interface QuestRewardSummary {
  questIds: string[];
  xp: number;
  gold: number;
  itemIds: string[];
  grantedSkillIds: string[];
  grantedLoreIds: string[];
}

function emptyQuestRewardSummary(): QuestRewardSummary {
  return { questIds: [], xp: 0, gold: 0, itemIds: [], grantedSkillIds: [], grantedLoreIds: [] };
}

function mergeQuestRewardSummaries(a: QuestRewardSummary, b: QuestRewardSummary): QuestRewardSummary {
  return {
    questIds: [...a.questIds, ...b.questIds],
    xp: a.xp + b.xp,
    gold: a.gold + b.gold,
    itemIds: [...a.itemIds, ...b.itemIds],
    grantedSkillIds: [...a.grantedSkillIds, ...b.grantedSkillIds],
    grantedLoreIds: [...a.grantedLoreIds, ...b.grantedLoreIds],
  };
}

/** True when a summary has nothing worth popping a reward acknowledgment up for - callers use this
 *  to send `null` instead of an all-zero summary object. */
export function isEmptyQuestRewardSummary(summary: QuestRewardSummary): boolean {
  return (
    summary.questIds.length === 0 &&
    summary.xp === 0 &&
    summary.gold === 0 &&
    summary.itemIds.length === 0 &&
    summary.grantedSkillIds.length === 0 &&
    summary.grantedLoreIds.length === 0
  );
}

/** Every quest's objectives, indexed by `${type}:${targetId}` - lets advanceQuests jump straight
 *  to the (usually 0-2) quests that could possibly care about a given event instead of scanning
 *  every quest in the game and re-`.find()`-ing its objectives on every single combat/NPC/quest
 *  event fired. Built once at module load since QUESTS is static content, not per-player data. */
const OBJECTIVE_INDEX = new Map<string, { questId: string; objective: QuestDef['objectives'][number] }[]>();
for (const [questId, def] of Object.entries(QUESTS)) {
  // No quest today defines two objectives with the same type+targetId, but guard against it
  // anyway so this stays equivalent to the old code's `.find()` (first-objective-wins) semantics
  // rather than crediting the same event against a quest twice.
  const seenKeysForQuest = new Set<string>();
  for (const objective of def.objectives) {
    const key = `${objective.type}:${objective.targetId}`;
    if (seenKeysForQuest.has(key)) continue;
    seenKeysForQuest.add(key);
    const entries = OBJECTIVE_INDEX.get(key);
    if (entries) entries.push({ questId, objective });
    else OBJECTIVE_INDEX.set(key, [{ questId, objective }]);
  }
}

/** Quest ids with at least one retroactively-satisfiable objective (collectItem/reachLocation) -
 *  lets reconcileRetroactiveObjectives skip every quest that only has talkToNpc/defeatEnemies/
 *  defeatBoss/interactWithShrine objectives (the majority) without checking each one's status. */
const RETROACTIVE_OBJECTIVE_TYPES = new Set<QuestObjectiveType>(['collectItem', 'reachLocation']);
const RETROACTIVE_QUEST_IDS = Object.entries(QUESTS)
  .filter(([, def]) => def.objectives.some((o) => RETROACTIVE_OBJECTIVE_TYPES.has(o.type)))
  .map(([questId]) => questId);

/** Shared by advanceQuests and reconcileRetroactiveObjectives - both need to check whether a
 *  just-updated quest's objectiveCounts now satisfy every objective, and if so mark it completed
 *  and record it for reward-granting. Mutates `progress.status` in place; returns whether it
 *  completed. */
function checkQuestCompletion(
  questId: string,
  def: QuestDef,
  progress: QuestProgress,
  completions: QuestCompletion[],
): boolean {
  const allComplete = def.objectives.every((o) => (progress.objectiveCounts[o.id] ?? 0) >= o.requiredCount);
  if (allComplete) {
    progress.status = 'completed';
    completions.push({ questId, reward: def.reward });
  }
  return allComplete;
}

/** Whether every objective an objective declares via `requiresObjectiveIds` is already satisfied
 *  in `progress` - true (no gate) when the field is unset. Looks each prerequisite's own
 *  `requiredCount` up in `def` rather than assuming 1, since a prerequisite could itself be a
 *  multi-count objective (e.g. "collect 3 of these" before the report-back beat unlocks). */
function objectivePrerequisitesSatisfied(def: QuestDef, objective: QuestDef['objectives'][number], progress: QuestProgress): boolean {
  if (!objective.requiresObjectiveIds?.length) return true;
  return objective.requiresObjectiveIds.every((prereqId) => {
    const prereqDef = def.objectives.find((o) => o.id === prereqId);
    if (!prereqDef) return true;
    return (progress.objectiveCounts[prereqId] ?? 0) >= prereqDef.requiredCount;
  });
}

/**
 * Mutates `quests` in place, advancing any active quest whose objective matches the event.
 * Returns the list of quests that became newly completed this call (for granting rewards).
 */
export function advanceQuests(quests: Record<string, QuestProgress>, event: QuestAdvanceEvent): QuestCompletion[] {
  const completions: QuestCompletion[] = [];
  const matches = OBJECTIVE_INDEX.get(`${event.type}:${event.targetId}`) ?? [];

  for (const { questId, objective } of matches) {
    if (effectiveStatus(questId, quests) !== 'active') continue;
    const def = QUESTS[questId];

    const progress = quests[questId] ?? { status: 'active', objectiveCounts: {} };
    // An objective with an implied sequence (see requiresObjectiveIds's own doc comment) simply
    // doesn't credit this event yet if its prerequisite objective(s) haven't fired - the player
    // has to trigger the same event again (e.g. talk to the NPC a second time) once they have.
    if (!objectivePrerequisitesSatisfied(def, objective, progress)) continue;
    const current = progress.objectiveCounts[objective.id] ?? 0;
    progress.objectiveCounts[objective.id] = Math.min(objective.requiredCount, current + (event.amount ?? 1));
    progress.status = 'active';
    quests[questId] = progress;

    checkQuestCompletion(questId, def, progress, completions);
  }

  return completions;
}

function grantCompletionRewards(save: PlayerSave, completions: QuestCompletion[]): QuestRewardSummary {
  const summary = emptyQuestRewardSummary();
  for (const { questId, reward } of completions) {
    summary.questIds.push(questId);
    summary.xp += reward.xp;
    summary.gold += reward.gold;
    save.player.xp += reward.xp;
    save.player.gold += reward.gold;
    save.player.spiritEssence += reward.spiritEssence ?? 0;
    save.player.regionalReputation += reward.regionalReputation ?? 0;
    // Unconditional, not just when this reward actually granted essence/reputation - self-heals
    // any save whose rank predates these derivations existing, same spirit as applyLevelUp's own
    // explorerRank self-heal.
    save.player.spiritRank = spiritRankForEssence(save.player.spiritEssence);
    save.player.regionalReputationRank = regionalReputationRankForTotal(save.player.regionalReputation);
    for (const itemId of reward.itemIds ?? []) {
      // A unique reward item already owned some other way is skipped, not an error - the quest
      // still completes and its xp/gold still land. grantItem's own return value (true only when
      // it actually landed in the inventory) is what keeps a skipped unique out of the summary too.
      if (grantItem(save, itemId)) summary.itemIds.push(itemId);
      // Only fills an empty slot - never swaps out gear the player already equipped some other way.
      const equipDef = reward.autoEquip ? EQUIPMENT[itemId] : undefined;
      if (equipDef && !save.player.equipment[equipDef.slot]) {
        equipIntoSlot(save, itemId, equipDef);
      }
    }
    // Already-known is a no-op, not an error - same "safe to re-grant" spirit as the item case
    // above (matters if this quest is ever re-completable, or the player already learned it some
    // other way).
    if (reward.grantSkillId && !save.player.knownSkillIds.includes(reward.grantSkillId)) {
      save.player.knownSkillIds.push(reward.grantSkillId);
      summary.grantedSkillIds.push(reward.grantSkillId);
    }
    if (reward.grantLoreId && !save.journal.loreUnlocked.includes(reward.grantLoreId)) {
      save.journal.loreUnlocked.push(reward.grantLoreId);
      summary.grantedLoreIds.push(reward.grantLoreId);
    }
  }
  return summary;
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
  const questIds = RETROACTIVE_QUEST_IDS;
  let changed = true;
  for (let pass = 0; changed && pass < questIds.length; pass++) {
    changed = false;
    for (const questId of questIds) {
      if (effectiveStatus(questId, save.quests) !== 'active') continue;
      const def = QUESTS[questId];
      const progress = save.quests[questId] ?? { status: 'active' as const, objectiveCounts: {} };
      let progressChanged = false;
      for (const o of def.objectives) {
        const current = progress.objectiveCounts[o.id] ?? 0;
        if (current >= o.requiredCount) continue;
        if (!objectivePrerequisitesSatisfied(def, o, progress)) continue;
        let retroactiveCount: number | undefined;
        if (o.type === 'collectItem') {
          // Clamped to actual owned quantity (matching advanceQuests's own amount-aware
          // increment above) rather than a blind "owns any amount -> fully satisfied" - only
          // correct by coincidence today since every collectItem objective happens to use
          // requiredCount: 1, but would under-require the moment one uses a higher count.
          const owned = save.inventory.find((i) => i.itemId === o.targetId)?.quantity ?? 0;
          if (owned > 0) retroactiveCount = Math.min(o.requiredCount, owned);
        } else if (o.type === 'reachLocation' && save.journal.locationsVisited.includes(o.targetId)) {
          retroactiveCount = o.requiredCount;
        }
        if (retroactiveCount !== undefined && retroactiveCount > current) {
          progress.objectiveCounts[o.id] = retroactiveCount;
          progressChanged = true;
        }
      }
      if (!progressChanged) continue;
      progress.status = 'active';
      save.quests[questId] = progress;
      changed = true;
      checkQuestCompletion(questId, def, progress, completions);
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
export function applyQuestRewards(save: PlayerSave, completions: QuestCompletion[]): QuestRewardSummary {
  // Backfill for a save written before knownSkillIds existed - same one-line pattern
  // resolveCombatAction.ts already uses (see that file's own comment for the full "bare INTERNAL
  // error" story). Centralized here rather than at each of this function's 6 call sites, since a
  // grantSkillId reward reachable from ANY of them (not just combat) would otherwise crash the
  // moment an old save completed one - confirmed live by this file's own test suite.
  if (!save.player.knownSkillIds) save.player.knownSkillIds = ['keepers-strike'];
  const direct = grantCompletionRewards(save, completions);
  const retroactive = grantCompletionRewards(save, reconcileRetroactiveObjectives(save));
  applyLevelUp(save);
  return mergeQuestRewardSummaries(direct, retroactive);
}
