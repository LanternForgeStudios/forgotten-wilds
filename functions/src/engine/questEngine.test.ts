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
      regionalReputationRank: 'Stranger',
      difficulty: 'medium',
      equipment: { weapon: null, chest: null, legs: null, boots: null, gloves: null, charm: null, lantern: null, spiritTotem: null },
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

  // 'frostbound-pages' is a real 3-objective chain (get-frostbound-treatise -> talk-elias-frostbound
  // -> talk-miriam-frostbound) with requiresObjectiveIds set on both talkToNpc objectives -
  // regression coverage for the real out-of-order-completion bug this field was added to fix (a
  // player could previously talk to the quest-giver NPC before ever finding the item, which
  // credited the "report back" objective immediately and let the quest complete without the
  // player ever making the actual return trip).
  it('does not credit a report-back objective if its required objective has not fired yet', () => {
    const quests: Record<string, QuestProgress> = {
      'the-mountain-remembers': { status: 'completed', objectiveCounts: {} },
    };
    // elias-rowan is also a-new-keeper's own talkToNpc target, so this event legitimately advances
    // that unrelated quest too - the assertion here is specifically that frostbound-pages' own
    // report-back objective did NOT credit, not that nothing in the whole game responded.
    advanceQuests(quests, { type: 'talkToNpc', targetId: 'elias-rowan' });
    expect(quests['frostbound-pages']?.objectiveCounts['talk-elias-frostbound'] ?? 0).toBe(0);
    expect(quests['frostbound-pages']?.status ?? 'active').not.toBe('completed');
  });

  it('credits a report-back objective once its required objective is satisfied, in the same order the player actually did it', () => {
    const quests: Record<string, QuestProgress> = {
      'the-mountain-remembers': { status: 'completed', objectiveCounts: {} },
    };
    // Talking to Elias first (as in the regression test above) does nothing.
    advanceQuests(quests, { type: 'talkToNpc', targetId: 'elias-rowan' });
    // Finding the treatise unlocks the first report-back objective...
    advanceQuests(quests, { type: 'collectItem', targetId: 'frostbound-treatise' });
    expect(quests['frostbound-pages'].objectiveCounts['get-frostbound-treatise']).toBe(1);
    // ...but talking to Miriam still doesn't credit until Elias has actually been told.
    advanceQuests(quests, { type: 'talkToNpc', targetId: 'historian-miriam' });
    expect(quests['frostbound-pages'].objectiveCounts['talk-miriam-frostbound'] ?? 0).toBe(0);
    // Now the chain resolves in the real intended order.
    advanceQuests(quests, { type: 'talkToNpc', targetId: 'elias-rowan' });
    expect(quests['frostbound-pages'].objectiveCounts['talk-elias-frostbound']).toBe(1);
    const completions = advanceQuests(quests, { type: 'talkToNpc', targetId: 'historian-miriam' });
    expect(quests['frostbound-pages'].status).toBe('completed');
    expect(completions).toEqual([{ questId: 'frostbound-pages', reward: expect.any(Object) }]);
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

  it('returns a summary of what was actually granted, for the client reward popup', () => {
    // Also a regression test for a real bug: a save with no knownSkillIds at all (predating that
    // field) crashed with a bare INTERNAL error on any grantSkillId reward reached outside combat
    // (talkToNpc/collectWorldItem/etc never backfilled it themselves) - see applyQuestRewards's own
    // backfill comment. emptySave() deliberately omits knownSkillIds to exercise that path.
    const save = emptySave();
    const summary = applyQuestRewards(save, [
      { questId: 'a-new-keeper', reward: { xp: 10, gold: 20, itemIds: ['healing-poultice'], grantSkillId: 'frost-lance', grantLoreId: 'lore-great-silence' } },
    ]);
    expect(summary).toEqual({
      questIds: ['a-new-keeper'],
      xp: 10,
      gold: 20,
      itemIds: ['healing-poultice'],
      grantedSkillIds: ['frost-lance'],
      grantedLoreIds: ['lore-great-silence'],
    });
  });

  it('omits an already-known skill/lore from the summary, even though the quest still completes', () => {
    const save = emptySave({
      player: { ...emptySave().player, knownSkillIds: ['frost-lance'] },
      journal: { creaturesDiscovered: [], locationsVisited: [], loreUnlocked: ['lore-great-silence'], bossesDefeated: [], itemsDiscovered: [] },
    });
    const summary = applyQuestRewards(save, [
      { questId: 'a-new-keeper', reward: { xp: 0, gold: 0, grantSkillId: 'frost-lance', grantLoreId: 'lore-great-silence' } },
    ]);
    expect(summary.questIds).toEqual(['a-new-keeper']);
    expect(summary.grantedSkillIds).toEqual([]);
    expect(summary.grantedLoreIds).toEqual([]);
  });

  it('adds regionalReputation to the save, additively across multiple completions', () => {
    const save = emptySave();
    applyQuestRewards(save, [
      { questId: 'a-new-keeper', reward: { xp: 0, gold: 0, regionalReputation: 15 } },
    ]);
    expect(save.player.regionalReputation).toBe(15);
    applyQuestRewards(save, [
      { questId: 'ash-hallow-tour', reward: { xp: 0, gold: 0, regionalReputation: 5 } },
    ]);
    expect(save.player.regionalReputation).toBe(20);
  });

  it('leaves regionalReputation untouched when a reward does not set it', () => {
    const save = emptySave();
    applyQuestRewards(save, [{ questId: 'a-new-keeper', reward: { xp: 10, gold: 0 } }]);
    expect(save.player.regionalReputation).toBe(0);
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

  it('autoEquip fills an empty slot with a granted equipment item, applies its stat bonuses, in addition to inventory', () => {
    const save = emptySave();
    applyQuestRewards(save, [
      { questId: 'a-new-keeper', reward: { xp: 10, gold: 20, itemIds: ['travelers-cloak'], autoEquip: true } },
    ]);
    expect(save.player.equipment.chest).toBe('travelers-cloak');
    expect(save.inventory).toEqual([{ itemId: 'travelers-cloak', quantity: 1 }]);
    // travelers-cloak: { maxHp: 5, speed: 1 } - regression check for a real bug where autoEquip
    // set the equipment slot directly without ever calling adjustStatsForBonuses, so a
    // quest-granted item showed as equipped but its bonuses never actually applied to stats.
    expect(save.player.stats.maxHp).toBe(65);
    expect(save.player.stats.speed).toBe(7);
  });

  it('autoEquip never overwrites gear already equipped in that slot, or its stats', () => {
    const save = emptySave({
      player: {
        ...emptySave().player,
        equipment: { weapon: null, chest: 'ash-hallow-formal-attire', legs: null, boots: null, gloves: null, charm: null, lantern: null, spiritTotem: null },
      },
    });
    applyQuestRewards(save, [
      { questId: 'a-new-keeper', reward: { xp: 10, gold: 20, itemIds: ['travelers-cloak'], autoEquip: true } },
    ]);
    expect(save.player.equipment.chest).toBe('ash-hallow-formal-attire');
    expect(save.inventory).toEqual([{ itemId: 'travelers-cloak', quantity: 1 }]);
    expect(save.player.stats.maxHp).toBe(60);
    expect(save.player.stats.speed).toBe(6);
  });

  it('adds a grantLoreId reward to the journal, without duplicating an already-unlocked entry', () => {
    const save = emptySave({ journal: { creaturesDiscovered: [], locationsVisited: [], loreUnlocked: ['lore-great-silence'], bossesDefeated: [], itemsDiscovered: [] } });
    applyQuestRewards(save, [
      { questId: 'frostbound-pages', reward: { xp: 0, gold: 0, grantLoreId: 'forgotten-treatise-i' } },
    ]);
    expect(save.journal.loreUnlocked).toEqual(['lore-great-silence', 'forgotten-treatise-i']);

    applyQuestRewards(save, [
      { questId: 'frostbound-pages', reward: { xp: 0, gold: 0, grantLoreId: 'forgotten-treatise-i' } },
    ]);
    expect(save.journal.loreUnlocked).toEqual(['lore-great-silence', 'forgotten-treatise-i']);
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

  describe('report-back variants', () => {
    // frostbound-pages: get-frostbound-treatise (collectItem) -> talk-elias-frostbound (requires
    // get-frostbound-treatise) -> talk-miriam-frostbound (requires talk-elias-frostbound).
    // elias-rowan's own dialogueVariants order puts 'the-mountain-remembers' (frostbound-pages's
    // prerequisiteQuestId) right after 'frostbound-pages' itself, so it's the expected fallback
    // whenever the report-back variant isn't currently ready.
    it('does not offer the report variant while its own prerequisite objective is unmet', () => {
      const quests = {
        'the-mountain-remembers': { status: 'completed' as const, objectiveCounts: {} },
        'frostbound-pages': { status: 'active' as const, objectiveCounts: {} },
      };
      expect(currentNpcDialogueVariantKey('elias-rowan', quests)).toBe('the-mountain-remembers');
    });

    it('offers the report variant once the prerequisite objective is credited but the report objective itself is not', () => {
      const quests = {
        'the-mountain-remembers': { status: 'completed' as const, objectiveCounts: {} },
        'frostbound-pages': { status: 'active' as const, objectiveCounts: { 'get-frostbound-treatise': 1 } },
      };
      expect(currentNpcDialogueVariantKey('elias-rowan', quests)).toBe('frostbound-pages:talk-elias-frostbound');
    });

    it('stops offering the report variant once its own objective is credited, reverting to the prior completed variant while the quest is still active', () => {
      const quests = {
        'the-mountain-remembers': { status: 'completed' as const, objectiveCounts: {} },
        'frostbound-pages': {
          status: 'active' as const,
          objectiveCounts: { 'get-frostbound-treatise': 1, 'talk-elias-frostbound': 1 },
        },
      };
      expect(currentNpcDialogueVariantKey('elias-rowan', quests)).toBe('the-mountain-remembers');
    });

    it('resolves to the quest-completed variant, not the report variant, once the whole quest is completed', () => {
      const quests = {
        'the-mountain-remembers': { status: 'completed' as const, objectiveCounts: {} },
        'frostbound-pages': { status: 'completed' as const, objectiveCounts: {} },
      };
      expect(currentNpcDialogueVariantKey('elias-rowan', quests)).toBe('frostbound-pages');
    });
  });
});
