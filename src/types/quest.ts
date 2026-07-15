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
