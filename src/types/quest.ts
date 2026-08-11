import type { EquipmentSlot } from './stats';

export type QuestObjectiveType =
  | 'talkToNpc'
  | 'defeatEnemies'
  | 'reachLocation'
  | 'collectItem'
  | 'defeatBoss'
  | 'interactWithShrine';

export interface QuestObjective {
  id: string;
  type: QuestObjectiveType;
  description: string;
  targetId: string;
  requiredCount: number;
  /** Other objective ids (within this same quest) that must already be at their own
   *  requiredCount before this one can be credited - display-only mirror of the server's
   *  requiresObjectiveIds (functions/src/data/quests.ts), needed client-side so
   *  resolveNpcDialogueVariantKey (src/utils/npcDialogue.ts) can detect a "report back" moment:
   *  quest active, this objective's prerequisites already done, the objective itself not yet
   *  credited. Only populated on objectives that actually gate a "return and report" beat. */
  requiresObjectiveIds?: string[];
}

export interface QuestReward {
  xp: number;
  gold: number;
  itemIds?: string[];
  spiritEssence?: number;
  /** A Specialty Attack id (see data/skills.ts) granted on completion - display-only mirror of the
   *  server's grantSkillId (functions/src/data/quests.ts). No quest uses this yet. */
  grantSkillId?: string;
  /** A lore entry id (see data/lore.ts) granted on completion - display-only mirror of the
   *  server's grantLoreId (functions/src/data/quests.ts). */
  grantLoreId?: string;
  /** Whether a granted equipment item auto-equips into its slot on completion - display-only
   *  mirror of the server's autoEquip (functions/src/data/quests.ts). */
  autoEquip?: boolean;
  /** Added to Player.regionalReputation on completion - display-only mirror of the server's
   *  regionalReputation (functions/src/data/quests.ts). Currently one global running total, not
   *  tracked per-region. */
  regionalReputation?: number;
  /** Unlocks one of the 3 additional Charm/Spirit Totem slots on completion - display-only mirror
   *  of the server's grantsEquipmentSlot (functions/src/data/quests.ts). */
  grantsEquipmentSlot?: EquipmentSlot;
}

/** Display-only grouping for the Quest Log's tabs - not read by any server logic. */
export type QuestCategory = 'main' | 'side' | 'misc';

export interface Quest {
  id: string;
  name: string;
  giverNpcId: string;
  description: string;
  category: QuestCategory;
  prerequisiteQuestId: string | null;
  objectives: QuestObjective[];
  reward: QuestReward;
}

export type QuestStatus = 'notStarted' | 'active' | 'completed';

export interface QuestProgress {
  status: QuestStatus;
  objectiveCounts: Record<string, number>;
}
