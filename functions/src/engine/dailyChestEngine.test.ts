import { afterEach, describe, expect, it, vi } from 'vitest';
import { chestTierForLevel, rollChestRewards } from './dailyChestEngine';
import { ELITE_CHEST_LEVEL_THRESHOLD } from '../data/dailyChest';
import { ITEMS } from '../data/items';
import { EQUIPMENT } from '../data/equipment';

describe('chestTierForLevel', () => {
  it('is standard below the elite threshold and elite at/above it', () => {
    expect(chestTierForLevel(ELITE_CHEST_LEVEL_THRESHOLD - 1)).toBe('standard');
    expect(chestTierForLevel(ELITE_CHEST_LEVEL_THRESHOLD)).toBe('elite');
    expect(chestTierForLevel(100)).toBe('elite');
  });
});

describe('rollChestRewards', () => {
  afterEach(() => vi.restoreAllMocks());

  it('always grants a guaranteed gold amount and a guaranteed item, with no bonus rolls landing at Math.random() = 0.99', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.99);
    const standard = rollChestRewards('standard');
    expect(standard.gold).toBeGreaterThanOrEqual(20);
    expect(standard.gold).toBeLessThanOrEqual(40);
    expect(standard.itemIds).toHaveLength(1);
    expect(standard.premiumCurrency).toBe(0);
  });

  it('grants every bonus slot when every chance check rolls a hit (Math.random() = 0)', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0);
    const elite = rollChestRewards('elite');
    // guaranteed item + rare equipment (rolled first, so the plain-equipment branch never fires)
    // + material = 3 items; bonus gold and premium currency both landed too.
    expect(elite.itemIds).toHaveLength(3);
    expect(elite.gold).toBeGreaterThan(60);
    expect(elite.premiumCurrency).toBeGreaterThan(0);
  });

  it('never grants equipment above Rare tier, even for Elite chests rolled repeatedly', () => {
    for (let i = 0; i < 50; i++) {
      const { itemIds } = rollChestRewards('elite');
      for (const id of itemIds) {
        const equip = EQUIPMENT[id];
        if (equip) expect(['common', 'uncommon', 'rare']).toContain(equip.tier);
      }
    }
  });

  it('only ever grants non-unique items', () => {
    for (let i = 0; i < 50; i++) {
      const { itemIds } = rollChestRewards('elite');
      for (const id of itemIds) {
        const def = ITEMS[id] ?? EQUIPMENT[id];
        expect(def?.unique).not.toBe(true);
      }
    }
  });

  it("Elite's guaranteed gold range sits strictly above Standard's", () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.99);
    const standard = rollChestRewards('standard');
    const elite = rollChestRewards('elite');
    expect(elite.gold).toBeGreaterThan(standard.gold);
  });
});
