import { describe, expect, it } from 'vitest';
import { advanceQuests, applyQuestRewards, currentNpcDialogueVariantKey, effectiveStatus } from './questEngine';
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
    journal: { creaturesDiscovered: [], locationsVisited: [], loreUnlocked: [], bossesDefeated: [], itemsDiscovered: [] },
    openedChests: [],
    updatedAt: 0,
    ...overrides,
  };
}

describe('effectiveStatus', () => {
  it('is active for a quest with no prerequisite and no stored progress', () => {
    expect(effectiveStatus('a-new-keeper', {})).toBe('active');
  });

  it('is locked when its prerequisite has not been completed', () => {
    expect(effectiveStatus('ash-hallow-tour', {})).toBe('locked');
  });

  it('is active once its prerequisite is completed', () => {
    const quests: Record<string, QuestProgress> = {
      'a-new-keeper': { status: 'completed', objectiveCounts: {} },
    };
    expect(effectiveStatus('ash-hallow-tour', quests)).toBe('active');
  });

  it('stays completed once completed, regardless of prerequisite bookkeeping', () => {
    const quests: Record<string, QuestProgress> = {
      'a-new-keeper': { status: 'completed', objectiveCounts: {} },
    };
    expect(effectiveStatus('a-new-keeper', quests)).toBe('completed');
  });
});

describe('advanceQuests', () => {
  it('advances a matching objective and does not complete it early', () => {
    const quests: Record<string, QuestProgress> = {
      'beneath-hollow-rail': { status: 'completed', objectiveCounts: {} },
    };
    const completions = advanceQuests(quests, { type: 'defeatEnemies', targetId: 'restless-miner' });
    expect(quests['into-hollow-rail'].objectiveCounts['clear-shafts']).toBe(1);
    expect(completions).toHaveLength(0);
  });

  it('completes the quest once the required count is reached', () => {
    const quests: Record<string, QuestProgress> = {
      'beneath-hollow-rail': { status: 'completed', objectiveCounts: {} },
      'into-hollow-rail': { status: 'active', objectiveCounts: { 'clear-shafts': 2 } },
    };
    const completions = advanceQuests(quests, { type: 'defeatEnemies', targetId: 'restless-miner' });
    expect(quests['into-hollow-rail'].status).toBe('completed');
    expect(completions).toEqual([{ questId: 'into-hollow-rail', reward: expect.any(Object) }]);
  });

  it('does not advance a locked (prerequisite-unmet) quest', () => {
    const quests: Record<string, QuestProgress> = {};
    const completions = advanceQuests(quests, { type: 'reachLocation', targetId: 'hollow-rail-mine' });
    expect(quests['beneath-hollow-rail']).toBeUndefined();
    expect(completions).toHaveLength(0);
  });

  it('ignores events that do not match any active objective', () => {
    const quests: Record<string, QuestProgress> = {
      'beneath-hollow-rail': { status: 'completed', objectiveCounts: {} },
    };
    const completions = advanceQuests(quests, { type: 'defeatEnemies', targetId: 'coal-spirit' });
    expect(completions).toHaveLength(0);
    expect(quests['into-hollow-rail']).toBeUndefined();
  });
});

describe('applyQuestRewards', () => {
  it('adds xp, gold, and reward items to the save', () => {
    const save = emptySave();
    applyQuestRewards(save, [
      { questId: 'a-new-keeper', reward: { xp: 10, gold: 20, itemIds: ['healing-poultice'] } },
    ]);
    expect(save.player.xp).toBe(10);
    expect(save.player.gold).toBe(20);
    expect(save.inventory).toEqual([{ itemId: 'healing-poultice', quantity: 1 }]);
  });

  it('stacks reward items onto existing inventory quantities', () => {
    const save = emptySave({ inventory: [{ itemId: 'healing-poultice', quantity: 2 }] });
    applyQuestRewards(save, [
      { questId: 'ash-hallow-tour', reward: { xp: 30, gold: 35, itemIds: ['healing-poultice'] } },
    ]);
    expect(save.inventory).toEqual([{ itemId: 'healing-poultice', quantity: 3 }]);
  });

  it('triggers a level-up from quest xp alone, with no combat involved', () => {
    const save = emptySave();
    applyQuestRewards(save, [{ questId: 'a-new-keeper', reward: { xp: 100, gold: 0 } }]);
    expect(save.player.level).toBeGreaterThan(1);
    expect(save.player.stats.maxHp).toBeGreaterThan(60);
  });

  it('auto-credits a collectItem objective the player already satisfies once its quest activates', () => {
    // Player found a stone-fragment while exploring, well before 'fragments-of-the-first-promise'
    // (which needs it) ever unlocked - completing its prerequisite here should immediately credit
    // that objective from existing inventory, with no separate trip back to where it was found.
    const save = emptySave({
      inventory: [{ itemId: 'stone-fragment', quantity: 1 }],
      quests: {
        'strange-tracks': { status: 'completed', objectiveCounts: {} },
        'the-forgotten-shrine': { status: 'active', objectiveCounts: { 'talk-spirit-child': 1 } },
      },
    });
    const completions = advanceQuests(save.quests, { type: 'interactWithShrine', targetId: 'spirit-grove' });
    applyQuestRewards(save, completions);

    expect(save.quests['the-forgotten-shrine'].status).toBe('completed');
    expect(effectiveStatus('fragments-of-the-first-promise', save.quests)).toBe('active');
    expect(save.quests['fragments-of-the-first-promise'].objectiveCounts['get-stone']).toBe(1);
    // water/wind fragments weren't in inventory, so those objectives (and the quest itself)
    // correctly remain unsatisfied.
    expect(save.quests['fragments-of-the-first-promise'].objectiveCounts['get-water'] ?? 0).toBe(0);
    expect(save.quests['fragments-of-the-first-promise'].status).toBe('active');
  });
});

describe('currentNpcDialogueVariantKey', () => {
  it("returns 'base' for an NPC with no quest completed yet", () => {
    expect(currentNpcDialogueVariantKey('hunter-garrick', {})).toBe('base');
  });

  it('returns the first (most-advanced) completed variant quest, not just any completed one', () => {
    // hunter-garrick's variants are ordered ['shadows-on-raven-ridge', 'strange-tracks'] -
    // completing both should still resolve to the first (most-advanced) match.
    const quests = {
      'shadows-on-raven-ridge': { status: 'completed' as const, objectiveCounts: {} },
      'strange-tracks': { status: 'completed' as const, objectiveCounts: {} },
    };
    expect(currentNpcDialogueVariantKey('hunter-garrick', quests)).toBe('shadows-on-raven-ridge');
  });

  it('falls back to a less-advanced variant when only that one is completed', () => {
    const quests = { 'strange-tracks': { status: 'completed' as const, objectiveCounts: {} } };
    expect(currentNpcDialogueVariantKey('hunter-garrick', quests)).toBe('strange-tracks');
  });

  it("returns 'base' for an NPC with no dialogue variants at all", () => {
    expect(currentNpcDialogueVariantKey('mara-ash', { 'a-new-keeper': { status: 'completed', objectiveCounts: {} } })).toBe(
      'base',
    );
  });

  it('gives a different answer before vs. after the gating quest completes - this is why talkToNpc.ts must compute the key before calling advanceQuests, not after', () => {
    const quests: Record<string, { status: 'active' | 'completed'; objectiveCounts: Record<string, number> }> = {
      'shadows-on-raven-ridge': { status: 'active', objectiveCounts: {} },
    };
    const keyBeforeCompletion = currentNpcDialogueVariantKey('hunter-garrick', quests);
    expect(keyBeforeCompletion).toBe('base');

    quests['shadows-on-raven-ridge'].status = 'completed';
    const keyAfterCompletion = currentNpcDialogueVariantKey('hunter-garrick', quests);
    expect(keyAfterCompletion).toBe('shadows-on-raven-ridge');
    expect(keyAfterCompletion).not.toBe(keyBeforeCompletion);
  });
});
