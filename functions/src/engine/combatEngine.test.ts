import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { computeRewards, resolveRound, rollEnemyForLocation } from './combatEngine';
import { ENEMIES } from '../data/enemies';
import type { Stats } from '../shared-types';

function stats(overrides: Partial<Stats> = {}): Stats {
  return { hp: 60, maxHp: 60, spirit: 30, maxSpirit: 30, attack: 8, defense: 5, speed: 6, ...overrides };
}

describe('rollEnemyForLocation', () => {
  it('rolls only enemies from the given location table', () => {
    for (let i = 0; i < 20; i++) {
      const enemy = rollEnemyForLocation('ironwood-trail');
      expect(['mothling', 'greater-mothling']).toContain(enemy.id);
    }
  });

  it('throws for a location with no encounter table', () => {
    expect(() => rollEnemyForLocation('ash-hallow')).toThrow();
  });
});

describe('resolveRound', () => {
  const mothling = ENEMIES.mothling;

  it('deals damage on attack and reduces enemy hp', () => {
    const result = resolveRound({
      action: { type: 'attack' },
      playerStats: stats({ speed: 999 }), // guarantee player acts first, deterministic ordering
      inventory: [],
      enemy: mothling,
      enemyHp: mothling.stats.maxHp,
      enemyName: mothling.name,
    });
    expect(result.enemyHp).toBeLessThan(mothling.stats.maxHp);
    expect(result.log.some((l) => l.includes('strike'))).toBe(true);
  });

  it('defend halves the enemy hit it takes effect against', () => {
    // Defending only guards the hit that lands after the defend action resolves, so the player
    // must act first this round (higher speed) for the brace to be in place in time.
    vi.spyOn(Math, 'random').mockReturnValue(0.5);
    const defending = resolveRound({
      action: { type: 'defend' },
      playerStats: stats({ speed: 999, hp: 999, maxHp: 999 }),
      inventory: [],
      enemy: mothling,
      enemyHp: mothling.stats.maxHp,
      enemyName: mothling.name,
    });
    const attacking = resolveRound({
      action: { type: 'attack' },
      playerStats: stats({ speed: 999, hp: 999, maxHp: 999 }),
      inventory: [],
      enemy: mothling,
      enemyHp: mothling.stats.maxHp,
      enemyName: mothling.name,
    });
    vi.restoreAllMocks();
    const dmgWhileDefending = 999 - defending.playerHp;
    const dmgWhileAttacking = 999 - attacking.playerHp;
    expect(dmgWhileDefending).toBeLessThan(dmgWhileAttacking);
  });

  it('spirit art costs spirit and is boosted against coal spirits', () => {
    const coalSpirit = ENEMIES['coal-spirit'];
    const result = resolveRound({
      action: { type: 'spiritArt' },
      playerStats: stats({ speed: 999 }),
      inventory: [],
      enemy: coalSpirit,
      enemyHp: coalSpirit.stats.maxHp,
      enemyName: coalSpirit.name,
    });
    expect(result.playerSpirit).toBeLessThan(30);
  });

  it('using a healing item restores hp and reports the consumed item', () => {
    const result = resolveRound({
      action: { type: 'item', itemId: 'healing-poultice' },
      playerStats: stats({ hp: 10, speed: 999 }),
      inventory: [{ itemId: 'healing-poultice', quantity: 1 }],
      enemy: mothling,
      enemyHp: mothling.stats.maxHp,
      enemyName: mothling.name,
    });
    expect(result.itemConsumedId).toBe('healing-poultice');
    expect(result.playerHp).toBeGreaterThan(10);
  });

  it('reports victory once enemy hp reaches zero', () => {
    const result = resolveRound({
      action: { type: 'attack' },
      playerStats: stats({ speed: 999, attack: 999 }),
      inventory: [],
      enemy: mothling,
      enemyHp: 1,
      enemyName: mothling.name,
    });
    expect(result.phase).toBe('victory');
    expect(result.enemyHp).toBe(0);
  });

  it('reports defeat once player hp reaches zero', () => {
    const result = resolveRound({
      action: { type: 'defend' },
      playerStats: stats({ hp: 1, maxHp: 60, speed: -999, defense: 0 }),
      inventory: [],
      enemy: { ...mothling, stats: { ...mothling.stats, attack: 999 } },
      enemyHp: mothling.stats.maxHp,
      enemyName: mothling.name,
    });
    expect(result.phase).toBe('defeat');
    expect(result.playerHp).toBe(0);
  });
});

describe('computeRewards', () => {
  beforeEach(() => {
    vi.spyOn(Math, 'random').mockReturnValue(0.99); // avoid random loot rolls interfering with assertions below
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('grants the enemy xp/gold reward', () => {
    const mothling = ENEMIES.mothling;
    const reward = computeRewards(mothling, 0, 1);
    expect(reward.xp).toBe(mothling.xpReward);
    expect(reward.gold).toBe(mothling.goldReward);
  });

  it('flags a level-up and computes stat growth when xp crosses a threshold', () => {
    const boss = ENEMIES['coalbound-warden'];
    const reward = computeRewards(boss, 30, 2); // 30 + 150 = 180 xp -> level 4 per XP_THRESHOLDS
    expect(reward.leveledUp).toBe(true);
    expect(reward.newLevel).toBeGreaterThan(2);
    expect(reward.statGrowth.maxHp).toBeGreaterThan(0);
  });

  it('does not flag a level-up for a small xp gain', () => {
    const mothling = ENEMIES.mothling;
    const reward = computeRewards(mothling, 0, 1);
    expect(reward.leveledUp).toBe(false);
    expect(reward.statGrowth).toEqual({});
  });
});
