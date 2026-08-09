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

  it('always grants gold in [15, 35]', () => {
    for (let i = 0; i < 20; i++) {
      const reward = rollApothecaryReward();
      expect(reward.gold).toBeGreaterThanOrEqual(15);
      expect(reward.gold).toBeLessThanOrEqual(35);
    }
  });

  it('grants a bonus item when the roll succeeds', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0); // < REWARD_ITEM_CHANCE, and picks pool[0]
    const reward = rollApothecaryReward();
    expect(reward.itemIds).toHaveLength(1);
  });

  it('grants no bonus item when the roll misses', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.999); // >= REWARD_ITEM_CHANCE (0.7)
    const reward = rollApothecaryReward();
    expect(reward.itemIds).toHaveLength(0);
  });
});
