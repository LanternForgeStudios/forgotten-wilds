import { describe, expect, it } from 'vitest';
import { advanceQuests, applyQuestRewards, effectiveStatus } from './questEngine';
import type { PlayerSave, QuestProgress } from '../shared-types';

function emptySave(overrides: Partial<PlayerSave> = {}): PlayerSave {
  return {
    displayName: 'Tester',
    createdAt: 0,
    lastLoginAt: 0,
    player: {
      uid: 'u1',
      name: 'Tester',
      level: 1,
      xp: 0,
      gold: 0,
      spiritEssence: 0,
      festivalTokens: 0,
      premiumCurrency: 0,
      stats: { hp: 60, maxHp: 60, spirit: 30, maxSpirit: 30, attack: 8, defense: 5, speed: 6 },
      spiritRank: 'Unawakened',
      explorerRank: 'Newcomer',
      regionalReputation: 0,
      equipment: { weapon: null, armor: null, boots: null, gloves: null, charm: null, lantern: null, spiritTotem: null },
      currentLocationId: 'ash-hallow',
    },
    inventory: [],
    quests: {},
    journal: { creaturesDiscovered: [], locationsVisited: [], loreUnlocked: [], bossesDefeated: [] },
    openedChests: [],
    updatedAt: 0,
    ...overrides,
  };
}

describe('effectiveStatus', () => {
  it('is active for a quest with no prerequisite and no stored progress', () => {
    expect(effectiveStatus('keepers-first-light', {})).toBe('active');
  });

  it('is locked when its prerequisite has not been completed', () => {
    expect(effectiveStatus('mothlight-on-the-ridge', {})).toBe('locked');
  });

  it('is active once its prerequisite is completed', () => {
    const quests: Record<string, QuestProgress> = {
      'keepers-first-light': { status: 'completed', objectiveCounts: {} },
    };
    expect(effectiveStatus('mothlight-on-the-ridge', quests)).toBe('active');
  });

  it('stays completed once completed, regardless of prerequisite bookkeeping', () => {
    const quests: Record<string, QuestProgress> = {
      'keepers-first-light': { status: 'completed', objectiveCounts: {} },
    };
    expect(effectiveStatus('keepers-first-light', quests)).toBe('completed');
  });
});

describe('advanceQuests', () => {
  it('advances a matching objective and does not complete it early', () => {
    const quests: Record<string, QuestProgress> = {
      'keepers-first-light': { status: 'completed', objectiveCounts: {} },
    };
    const completions = advanceQuests(quests, { type: 'defeatEnemies', targetId: 'mothling' });
    expect(quests['mothlight-on-the-ridge'].objectiveCounts['defeat-mothlings']).toBe(1);
    expect(completions).toHaveLength(0);
  });

  it('completes the quest once the required count is reached', () => {
    const quests: Record<string, QuestProgress> = {
      'keepers-first-light': { status: 'completed', objectiveCounts: {} },
      'mothlight-on-the-ridge': { status: 'active', objectiveCounts: { 'defeat-mothlings': 2 } },
    };
    const completions = advanceQuests(quests, { type: 'defeatEnemies', targetId: 'mothling' });
    expect(quests['mothlight-on-the-ridge'].status).toBe('completed');
    expect(completions).toEqual([{ questId: 'mothlight-on-the-ridge', reward: expect.any(Object) }]);
  });

  it('does not advance a locked (prerequisite-unmet) quest', () => {
    const quests: Record<string, QuestProgress> = {};
    const completions = advanceQuests(quests, { type: 'reachLocation', targetId: 'hollow-rail-mine' });
    expect(quests['echoes-in-the-mine']).toBeUndefined();
    expect(completions).toHaveLength(0);
  });

  it('ignores events that do not match any active objective', () => {
    const quests: Record<string, QuestProgress> = {
      'keepers-first-light': { status: 'completed', objectiveCounts: {} },
    };
    const completions = advanceQuests(quests, { type: 'defeatEnemies', targetId: 'coal-spirit' });
    expect(completions).toHaveLength(0);
    expect(quests['mothlight-on-the-ridge']).toBeUndefined();
  });
});

describe('applyQuestRewards', () => {
  it('adds xp, gold, and reward items to the save', () => {
    const save = emptySave();
    applyQuestRewards(save, [
      { questId: 'keepers-first-light', reward: { xp: 10, gold: 20, itemIds: ['healing-poultice'] } },
    ]);
    expect(save.player.xp).toBe(10);
    expect(save.player.gold).toBe(20);
    expect(save.inventory).toEqual([{ itemId: 'healing-poultice', quantity: 1 }]);
  });

  it('stacks reward items onto existing inventory quantities', () => {
    const save = emptySave({ inventory: [{ itemId: 'healing-poultice', quantity: 2 }] });
    applyQuestRewards(save, [
      { questId: 'mothlight-on-the-ridge', reward: { xp: 30, gold: 35, itemIds: ['healing-poultice'] } },
    ]);
    expect(save.inventory).toEqual([{ itemId: 'healing-poultice', quantity: 3 }]);
  });
});
