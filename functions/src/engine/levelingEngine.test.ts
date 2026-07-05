import { describe, expect, it } from 'vitest';
import { applyLevelUp } from './levelingEngine';
import type { PlayerSave } from '../shared-types';

function saveAtLevel(level: number, xp: number): PlayerSave {
  return {
    displayName: 'Tester',
    createdAt: 0,
    lastLoginAt: 0,
    player: {
      uid: 'u1',
      name: 'Tester',
      level,
      xp,
      gold: 0,
      spiritEssence: 0,
      festivalTokens: 0,
      premiumCurrency: 0,
      stats: { hp: 60, maxHp: 60, spirit: 30, maxSpirit: 30, attack: 8, defense: 5, speed: 6, lanternOil: 20, maxLanternOil: 20, stamina: 0, maxStamina: 0 },
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
  };
}

describe('applyLevelUp', () => {
  it('does nothing when xp has not crossed the next threshold', () => {
    const save = saveAtLevel(1, 10);
    applyLevelUp(save);
    expect(save.player.level).toBe(1);
    expect(save.player.stats.maxHp).toBe(60);
  });

  it('levels up and grows stats when xp crosses a threshold - this is the fix for quest-only xp never leveling up', () => {
    // Level 3 threshold is 100 xp (XP_THRESHOLDS), reached here purely by "quest xp" with no
    // combat involved at all - previously only combat's own inline logic applied level-ups.
    const save = saveAtLevel(1, 100);
    applyLevelUp(save);
    expect(save.player.level).toBe(3);
    expect(save.player.stats.maxHp).toBeGreaterThan(60);
    expect(save.player.stats.hp).toBe(save.player.stats.maxHp);
  });

  it('applies growth for every level gained in one multi-level jump, not just one', () => {
    const save = saveAtLevel(1, 100); // crosses levels 2 and 3 in one grant
    const singleLevelGrowth = 8; // STAT_GROWTH_PER_LEVEL.maxHp
    applyLevelUp(save);
    expect(save.player.level).toBe(3);
    expect(save.player.stats.maxHp).toBe(60 + singleLevelGrowth * 2);
  });

  it('is idempotent - calling it again with unchanged xp does not re-apply growth', () => {
    const save = saveAtLevel(1, 100);
    applyLevelUp(save);
    const maxHpAfterFirstCall = save.player.stats.maxHp;
    applyLevelUp(save);
    expect(save.player.stats.maxHp).toBe(maxHpAfterFirstCall);
  });

  it('leaves maxStamina untouched at 0 if Stamina has not been unlocked yet', () => {
    const save = saveAtLevel(1, 100);
    applyLevelUp(save);
    expect(save.player.stats.maxStamina).toBe(0);
  });

  it('grows maxStamina once it has already been unlocked', () => {
    const save = saveAtLevel(1, 100);
    save.player.stats.maxStamina = 40;
    save.player.stats.stamina = 40;
    applyLevelUp(save);
    expect(save.player.stats.maxStamina).toBeGreaterThan(40);
  });
});
