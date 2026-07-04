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
}

export interface Quest {
  id: string;
  name: string;
  giverNpcId: string;
  description: string;
  prerequisiteQuestId: string | null;
  objectives: QuestObjective[];
  reward: QuestReward;
}

export type QuestStatus = 'notStarted' | 'active' | 'completed';

export interface QuestProgress {
  status: QuestStatus;
  objectiveCounts: Record<string, number>;
}
