import { describe, expect, it } from 'vitest';
import { applyLevelUp } from './levelingEngine';
import { explorerRankForLevel, levelForXp } from '../data/leveling';
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
    journal: { creaturesDiscovered: [], locationsVisited: [], loreUnlocked: [], bossesDefeated: [], itemsDiscovered: [] },
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

  it('tops off lanternOil to max on level-up when a lantern is equipped', () => {
    const save = saveAtLevel(1, 100);
    save.player.equipment.lantern = 'keepers-lantern';
    save.player.stats.lanternOil = 5;
    applyLevelUp(save);
    expect(save.player.stats.lanternOil).toBe(save.player.stats.maxLanternOil);
  });

  it('leaves lanternOil untouched on level-up when no lantern is equipped', () => {
    const save = saveAtLevel(1, 100);
    save.player.equipment.lantern = null;
    save.player.stats.lanternOil = 5;
    applyLevelUp(save);
    expect(save.player.stats.lanternOil).toBe(5);
  });

  it('reaches level 50 (checkpoint for the level-100 cap) with the expected stat totals', () => {
    // xpForLevel(50) = 10*50*51 - 20 = 25480
    const save = saveAtLevel(1, 25480);
    applyLevelUp(save);
    expect(save.player.level).toBe(50);
    expect(save.player.stats.maxHp).toBe(452);
    expect(save.player.stats.attack).toBe(106);
    expect(save.player.stats.defense).toBe(54);
    expect(save.player.stats.speed).toBe(55);
  });
});

describe('applyLevelUp: explorerRank', () => {
  it('promotes explorerRank when a level-up crosses a rank boundary', () => {
    // xpForLevel(11) = 10*11*12 - 20 = 1300 - level 11 is the Wayfarer boundary.
    const save = saveAtLevel(1, 1300);
    applyLevelUp(save);
    expect(save.player.level).toBe(11);
    expect(save.player.explorerRank).toBe('Wayfarer');
  });

  it('self-heals explorerRank even when no level-up happens this call - covers saves from before this field was level-driven', () => {
    // xpForLevel(25) = 10*25*26 - 20 = 6480 - already at level 25, no threshold to cross.
    const save = saveAtLevel(25, 6480);
    save.player.explorerRank = 'Newcomer'; // stale, as if predating this feature
    applyLevelUp(save);
    expect(save.player.level).toBe(25);
    expect(save.player.explorerRank).toBe('Pathfinder');
  });
});

describe('explorerRankForLevel', () => {
  it('resolves every tier boundary correctly', () => {
    expect(explorerRankForLevel(1)).toBe('Newcomer');
    expect(explorerRankForLevel(10)).toBe('Newcomer');
    expect(explorerRankForLevel(11)).toBe('Wayfarer');
    expect(explorerRankForLevel(100)).toBe('Legend of Mytherra');
    expect(explorerRankForLevel(91)).toBe('Legend of Mytherra');
    expect(explorerRankForLevel(90)).toBe('Lantern Sage');
  });
});

describe('levelForXp at the level-100 cap', () => {
  it('reaches exactly level 100 at the xp threshold, and one xp below is still level 99', () => {
    expect(levelForXp(100980)).toBe(100);
    expect(levelForXp(100979)).toBe(99);
  });

  it('never exceeds the level cap no matter how much xp is granted', () => {
    expect(levelForXp(999999999)).toBe(100);
  });
});
