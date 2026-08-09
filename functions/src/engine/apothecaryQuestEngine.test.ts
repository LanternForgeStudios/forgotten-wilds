import { describe, expect, it, vi, afterEach } from 'vitest';
import { generateApothecaryQuest, rollApothecaryReward } from './apothecaryQuestEngine';

describe('generateApothecaryQuest', () => {
  afterEach(() => vi.restoreAllMocks());

  it('picks a materialId from the given pool and a requiredCount in [3, 6]', () => {
    for (let i = 0; i < 20; i++) {
      const quest = generateApothecaryQuest(['moth-dust', 'rusted-token']);
      expect(['moth-dust', 'rusted-token']).toContain(quest.materialId);
      expect(quest.requiredCount).toBeGreaterThanOrEqual(3);
      expect(quest.requiredCount).toBeLessThanOrEqual(6);
    }
  });

  it('always picks the only material when the pool has exactly one', () => {
    const quest = generateApothecaryQuest(['bog-ash']);
    expect(quest.materialId).toBe('bog-ash');
  });

  it('throws rather than silently producing an invalid quest for an empty pool', () => {
    expect(() => generateApothecaryQuest([])).toThrow();
  });
});

describe('rollApothecaryReward', () => {
  afterEach(() => vi.restoreAllMocks());

  // 'moth-dust' has no SHOP_PRICES entry and is tier 'common', so sellPriceFor falls back to the
  // flat common tier value (15g) - deterministic, so the floor math below is exact.
  const MATERIAL_SELL_PRICE = 15;

  it('never pays less than 60% of what selling the materials would have', () => {
    for (const requiredCount of [3, 4, 5, 6]) {
      const floor = Math.ceil(MATERIAL_SELL_PRICE * requiredCount * 0.6);
      for (let i = 0; i < 20; i++) {
        const reward = rollApothecaryReward('moth-dust', requiredCount);
        expect(reward.gold).toBeGreaterThanOrEqual(floor);
      }
    }
  });

  it('grants xp that scales with requiredCount', () => {
    for (let i = 0; i < 20; i++) {
      const reward = rollApothecaryReward('moth-dust', 3);
      expect(reward.xp).toBeGreaterThanOrEqual(3 * 4);
      expect(reward.xp).toBeLessThanOrEqual(3 * 7);
    }
    for (let i = 0; i < 20; i++) {
      const reward = rollApothecaryReward('moth-dust', 6);
      expect(reward.xp).toBeGreaterThanOrEqual(6 * 4);
      expect(reward.xp).toBeLessThanOrEqual(6 * 7);
    }
  });

  it('grants a bonus item when the roll succeeds', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0); // < REWARD_ITEM_CHANCE, and picks pool[0]
    const reward = rollApothecaryReward('moth-dust', 3);
    expect(reward.itemIds).toHaveLength(1);
  });

  it('grants no bonus item when the roll misses', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.999); // >= REWARD_ITEM_CHANCE (0.7)
    const reward = rollApothecaryReward('moth-dust', 3);
    expect(reward.itemIds).toHaveLength(0);
  });
});
