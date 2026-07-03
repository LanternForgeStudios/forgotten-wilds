// Authoritative — the client's src/data/quests.ts is a display copy only.

export type QuestObjectiveType = 'talkToNpc' | 'defeatEnemies' | 'reachLocation' | 'collectItem' | 'defeatBoss';

export interface QuestObjectiveDef {
  id: string;
  type: QuestObjectiveType;
  targetId: string;
  requiredCount: number;
}

export interface QuestDef {
  id: string;
  prerequisiteQuestId: string | null;
  objectives: QuestObjectiveDef[];
  reward: { xp: number; gold: number; itemIds?: string[] };
}

export const QUESTS: Record<string, QuestDef> = {
  'keepers-first-light': {
    id: 'keepers-first-light',
    prerequisiteQuestId: null,
    objectives: [{ id: 'talk-elias', type: 'talkToNpc', targetId: 'elias-rowan', requiredCount: 1 }],
    reward: { xp: 10, gold: 20 },
  },
  'mothlight-on-the-ridge': {
    id: 'mothlight-on-the-ridge',
    prerequisiteQuestId: 'keepers-first-light',
    objectives: [{ id: 'defeat-mothlings', type: 'defeatEnemies', targetId: 'mothling', requiredCount: 3 }],
    reward: { xp: 30, gold: 35, itemIds: ['healing-poultice'] },
  },
  'echoes-in-the-mine': {
    id: 'echoes-in-the-mine',
    prerequisiteQuestId: 'mothlight-on-the-ridge',
    objectives: [{ id: 'reach-mine', type: 'reachLocation', targetId: 'hollow-rail-mine', requiredCount: 1 }],
    reward: { xp: 25, gold: 20 },
  },
  'the-miners-lantern': {
    id: 'the-miners-lantern',
    prerequisiteQuestId: 'echoes-in-the-mine',
    objectives: [{ id: 'collect-lantern', type: 'collectItem', targetId: 'miners-lost-lantern', requiredCount: 1 }],
    reward: { xp: 40, gold: 25, itemIds: ['miners-lost-lantern-equipped'] },
  },
  'the-coalbound-warden': {
    id: 'the-coalbound-warden',
    prerequisiteQuestId: 'the-miners-lantern',
    objectives: [{ id: 'defeat-warden', type: 'defeatBoss', targetId: 'coalbound-warden', requiredCount: 1 }],
    reward: { xp: 150, gold: 100, itemIds: ['wardens-ember-heart'] },
  },
};

/** Ordered so UI/engine code can walk the chain; matches the requirements doc's quest order. */
export const QUEST_ORDER = [
  'keepers-first-light',
  'mothlight-on-the-ridge',
  'echoes-in-the-mine',
  'the-miners-lantern',
  'the-coalbound-warden',
];
