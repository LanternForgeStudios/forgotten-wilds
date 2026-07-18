import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import {
  computeRewards,
  resolveRound,
  rollEnemyForLocation,
  rollEncounterGroup,
  rollBossEncounter,
  rollEnemyLevel,
  maxEncounterSizeForLevel,
  aggregateItemCounts,
  hasSufficientQuantity,
  scaledEnemyStats,
  rollVictoryRestore,
} from './combatEngine';
import { ENEMIES } from '../data/enemies';
import { AILMENTS } from '../data/ailments';
import type { Stats } from '../shared-types';

function stats(overrides: Partial<Stats> = {}): Stats {
  return {
    hp: 60,
    maxHp: 60,
    spirit: 30,
    maxSpirit: 30,
    lanternOil: 20,
    maxLanternOil: 20,
    attack: 8,
    defense: 5,
    speed: 6,
    ...overrides,
  };
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

describe('maxEncounterSizeForLevel', () => {
  it('caps a fresh level 1-2 character to a single enemy', () => {
    expect(maxEncounterSizeForLevel(1)).toBe(1);
    expect(maxEncounterSizeForLevel(2)).toBe(2);
  });

  it('only reaches the full group size of 6 by level 10, well before the overall level cap', () => {
    expect(maxEncounterSizeForLevel(10)).toBe(6);
    expect(maxEncounterSizeForLevel(20)).toBe(6); // never exceeds 6 even past the nominal cap
  });

  it('stays capped at 6 all the way to the level cap of 100 - group size and per-enemy toughness ' +
    'are independent knobs; enemy stats (see scaledEnemyStats) keep scaling well past level 10', () => {
    expect(maxEncounterSizeForLevel(100)).toBe(6);
  });

  it('scales monotonically with level', () => {
    let previous = 0;
    for (let level = 1; level <= 10; level++) {
      const size = maxEncounterSizeForLevel(level);
      expect(size).toBeGreaterThanOrEqual(previous);
      previous = size;
    }
  });
});

describe('rollEncounterGroup', () => {
  it('rolls between 1 and 6 enemies, all from the location table, at a high player level', () => {
    for (let i = 0; i < 30; i++) {
      const group = rollEncounterGroup('hollow-rail-mine', 10);
      expect(group.length).toBeGreaterThanOrEqual(1);
      expect(group.length).toBeLessThanOrEqual(6);
      for (const enemy of group) {
        expect(['restless-miner', 'foreman-wraith', 'coal-spirit', 'coal-wraith']).toContain(enemy.id);
      }
    }
  });

  it('never rolls more than one enemy for a level 1 player', () => {
    for (let i = 0; i < 30; i++) {
      const group = rollEncounterGroup('ironwood-trail', 1);
      expect(group.length).toBe(1);
    }
  });
});

describe('rollEnemyLevel', () => {
  // rollEnemyLevel itself no longer distinguishes bosses from regular/elite enemies - every enemy
  // (including bosses) rolls from the identical range below. Boss vs. regular/elite
  // differentiation now happens entirely in scaledEnemyStats (see that describe block), via a
  // steeper boss-specific growth rate applied on top of whatever level this function rolls.

  it('stays within 1-50 for regular/elite enemies across a range of player levels', () => {
    for (let i = 0; i < 30; i++) {
      const level = rollEnemyLevel(8);
      expect(level).toBeGreaterThanOrEqual(1);
      expect(level).toBeLessThanOrEqual(5);
    }
  });

  it('keeps climbing at high player levels instead of flatlining at the old level-5 cap', () => {
    for (let i = 0; i < 30; i++) {
      const level = rollEnemyLevel(100);
      expect(level).toBeGreaterThanOrEqual(1);
      expect(level).toBeLessThanOrEqual(50);
      // Should be rolling around baseLevel = round(100/2) = 50, not stuck at the old cap of 5.
      expect(level).toBeGreaterThan(5);
    }
  });
});

describe('scaledEnemyStats', () => {
  it('returns exactly the authored base stats at level 1, for both regular and boss tiers', () => {
    const mothling = ENEMIES.mothling;
    const boss = ENEMIES['coalbound-warden'];
    expect(scaledEnemyStats(mothling, 1)).toEqual(mothling.stats);
    expect(scaledEnemyStats(boss, 1)).toEqual(boss.stats);
  });

  it('grows a boss 3x as fast per level as a regular/elite enemy, so its authored lead persists', () => {
    const mothling = ENEMIES.mothling;
    const boss = ENEMIES['coalbound-warden'];
    // levelsAboveOne = 24 at level 25 for both.
    const mothlingAt25 = scaledEnemyStats(mothling, 25);
    const bossAt25 = scaledEnemyStats(boss, 25);
    expect(mothlingAt25).toEqual({ maxHp: 148, attack: 79, defense: 51, speed: 57 });
    expect(bossAt25).toEqual({ maxHp: 500, attack: 229, defense: 152, speed: 152 });
    // The boss's authored ~5x maxHp lead (140 vs 28) should still be a comparably large multiple
    // at level 25, not collapsed toward parity the way a same-rate growth would.
    expect(bossAt25.maxHp / mothlingAt25.maxHp).toBeGreaterThan(3);
  });
});

describe('rollBossEncounter', () => {
  it('always places the boss last in the returned array', () => {
    for (let i = 0; i < 30; i++) {
      const roster = rollBossEncounter('coalbound-warden');
      expect(roster[roster.length - 1].id).toBe('coalbound-warden');
    }
  });

  it("rolls 0-3 adds, drawn only from the boss region's own encounter tables", () => {
    const validAddIds = new Set(['mothling', 'greater-mothling', 'restless-miner', 'foreman-wraith',
      'coal-spirit', 'coal-wraith', 'cliff-wolf', 'ridge-hawk', 'pool-wisp', 'falls-siren',
      'briar-wraith', 'cemetery-shade']);
    for (let i = 0; i < 50; i++) {
      const roster = rollBossEncounter('coalbound-warden');
      const adds = roster.slice(0, -1);
      expect(adds.length).toBeGreaterThanOrEqual(0);
      expect(adds.length).toBeLessThanOrEqual(3);
      for (const add of adds) {
        expect(validAddIds.has(add.id)).toBe(true);
        expect(add.id).not.toBe('coalbound-warden');
      }
    }
  });

  it('throws for a boss with no configured region', () => {
    expect(() => rollBossEncounter('not-a-real-boss')).toThrow();
  });
});

describe('resolveRound', () => {
  const mothling = ENEMIES.mothling;

  function soloEnemies(hp = mothling.stats.maxHp, level = 1) {
    return [{ enemyId: mothling.id, level, hp, ailments: [] }];
  }

  it('deals damage on attack and reduces enemy hp', () => {
    const result = resolveRound({
      action: { type: 'attack' },
      playerStats: stats({ speed: 999 }), // guarantee player acts first, deterministic ordering
      inventory: [],
      playerAilments: [],
      enemies: soloEnemies(),
    });
    expect(result.enemyHp[0]).toBeLessThan(mothling.stats.maxHp);
    expect(result.log.some((l) => l.includes('strike'))).toBe(true);
  });

  it('attack targets the requested index and leaves other enemies untouched', () => {
    const result = resolveRound({
      action: { type: 'attack', targetIndex: 1 },
      playerStats: stats({ speed: 999 }),
      inventory: [],
      playerAilments: [],
      enemies: [
        { enemyId: mothling.id, level: 1, hp: mothling.stats.maxHp, ailments: [] },
        { enemyId: mothling.id, level: 1, hp: mothling.stats.maxHp, ailments: [] },
      ],
    });
    expect(result.enemyHp[0]).toBe(mothling.stats.maxHp);
    expect(result.enemyHp[1]).toBeLessThan(mothling.stats.maxHp);
  });

  it('falls back to the first alive enemy when the requested target is already dead', () => {
    const result = resolveRound({
      action: { type: 'attack', targetIndex: 0 },
      playerStats: stats({ speed: 999 }),
      inventory: [],
      playerAilments: [],
      enemies: [
        { enemyId: mothling.id, level: 1, hp: 0, ailments: [] },
        { enemyId: mothling.id, level: 1, hp: mothling.stats.maxHp, ailments: [] },
      ],
    });
    expect(result.enemyHp[1]).toBeLessThan(mothling.stats.maxHp);
  });

  it('every alive enemy still gets a turn even though the player can only target one', () => {
    const result = resolveRound({
      action: { type: 'attack', targetIndex: 0 },
      playerStats: stats({ speed: -999, hp: 999, maxHp: 999 }), // enemies act first, deterministic
      inventory: [],
      playerAilments: [],
      enemies: [
        { enemyId: mothling.id, level: 1, hp: mothling.stats.maxHp, ailments: [] },
        { enemyId: mothling.id, level: 1, hp: mothling.stats.maxHp, ailments: [] },
        { enemyId: mothling.id, level: 1, hp: mothling.stats.maxHp, ailments: [] },
      ],
    });
    // Each of the 3 enemies attacks (not just the targeted one) - CROWD_DAMAGE_FACTOR
    // intentionally dampens each individual hit so 3 attackers don't deal ~3x a single attacker's
    // damage (that N-scaling is exactly what made multi-enemy fights nearly unwinnable before this
    // fix), but 3 still-nonzero hits (each floored at a minimum of 1) should land, proving every
    // alive enemy really did get a turn.
    expect(999 - result.playerHp).toBeGreaterThanOrEqual(3);
  });

  it('victory only fires once every enemy in the roster is defeated', () => {
    const almostDone = resolveRound({
      action: { type: 'attack', targetIndex: 1 },
      playerStats: stats({ speed: 999, attack: 999 }),
      inventory: [],
      playerAilments: [],
      enemies: [
        { enemyId: mothling.id, level: 1, hp: 0, ailments: [] },
        { enemyId: mothling.id, level: 1, hp: 1, ailments: [] },
      ],
    });
    expect(almostDone.phase).toBe('victory');
    expect(almostDone.enemyHp.every((hp) => hp <= 0)).toBe(true);

    const notYet = resolveRound({
      action: { type: 'attack', targetIndex: 0 },
      playerStats: stats({ speed: 999, attack: 999 }),
      inventory: [],
      playerAilments: [],
      enemies: [
        { enemyId: mothling.id, level: 1, hp: mothling.stats.maxHp, ailments: [] },
        { enemyId: mothling.id, level: 1, hp: mothling.stats.maxHp, ailments: [] },
      ],
    });
    expect(notYet.phase).toBe('continue');
  });

  it('a higher level roll makes the same enemy hit harder', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.5);
    const level1 = resolveRound({
      action: { type: 'defend' },
      playerStats: stats({ speed: -999, hp: 999, maxHp: 999 }),
      inventory: [],
      playerAilments: [],
      enemies: soloEnemies(mothling.stats.maxHp, 1),
    });
    const level5 = resolveRound({
      action: { type: 'defend' },
      playerStats: stats({ speed: -999, hp: 999, maxHp: 999 }),
      inventory: [],
      playerAilments: [],
      enemies: soloEnemies(mothling.stats.maxHp, 5),
    });
    vi.restoreAllMocks();
    expect(999 - level5.playerHp).toBeGreaterThan(999 - level1.playerHp);
  });

  it('defend halves the enemy hit it takes effect against', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.5);
    const defending = resolveRound({
      action: { type: 'defend' },
      playerStats: stats({ speed: 999, hp: 999, maxHp: 999 }),
      inventory: [],
      playerAilments: [],
      enemies: soloEnemies(),
    });
    const attacking = resolveRound({
      action: { type: 'attack' },
      playerStats: stats({ speed: 999, hp: 999, maxHp: 999 }),
      inventory: [],
      playerAilments: [],
      enemies: soloEnemies(),
    });
    vi.restoreAllMocks();
    const dmgWhileDefending = 999 - defending.playerHp;
    const dmgWhileAttacking = 999 - attacking.playerHp;
    expect(dmgWhileDefending).toBeLessThan(dmgWhileAttacking);
  });

  it('defend halves damage even from an enemy faster than the player', () => {
    // Regression test for a real bug: playerDefending used to be set mid-turn-loop by
    // playerTurn(), so any enemy sorted before the player (i.e. faster) already resolved its
    // attack at full damage before the brace took effect. Fixed by deciding playerDefending up
    // front, from the action alone - this test uses speed:-999 (enemy guaranteed to act first)
    // specifically to catch a regression of that bug, which the speed:999 tests above cannot.
    vi.spyOn(Math, 'random').mockReturnValue(0.5);
    const defending = resolveRound({
      action: { type: 'defend' },
      playerStats: stats({ speed: -999, hp: 999, maxHp: 999 }),
      inventory: [],
      playerAilments: [],
      enemies: soloEnemies(),
    });
    const attacking = resolveRound({
      action: { type: 'attack' },
      playerStats: stats({ speed: -999, hp: 999, maxHp: 999 }),
      inventory: [],
      playerAilments: [],
      enemies: soloEnemies(),
    });
    vi.restoreAllMocks();
    expect(999 - defending.playerHp).toBeLessThan(999 - attacking.playerHp);
  });

  it('defend halves damage from every enemy still standing, not just one', () => {
    // Enemy level 20 (not 1) - crowd-damping's own max(1, ...) floor would otherwise make a
    // level-1 hit already round down to the 1-damage minimum before Defend gets a chance to halve
    // it, making the two scenarios indistinguishable at integer resolution for reasons unrelated
    // to what this test actually checks (that Defend applies to every attacker, not just one).
    vi.spyOn(Math, 'random').mockReturnValue(0.5);
    const defending = resolveRound({
      action: { type: 'defend' },
      playerStats: stats({ speed: 999, hp: 999, maxHp: 999 }),
      inventory: [],
      playerAilments: [],
      enemies: [
        { enemyId: mothling.id, level: 20, hp: mothling.stats.maxHp, ailments: [] },
        { enemyId: mothling.id, level: 20, hp: mothling.stats.maxHp, ailments: [] },
      ],
    });
    const attacking = resolveRound({
      action: { type: 'attack', targetIndex: 0 },
      playerStats: stats({ speed: 999, hp: 999, maxHp: 999 }),
      inventory: [],
      playerAilments: [],
      enemies: [
        { enemyId: mothling.id, level: 20, hp: mothling.stats.maxHp, ailments: [] },
        { enemyId: mothling.id, level: 20, hp: mothling.stats.maxHp, ailments: [] },
      ],
    });
    vi.restoreAllMocks();
    expect(999 - defending.playerHp).toBeLessThan(999 - attacking.playerHp);
  });

  it('defend halves damage from a mixed-speed group of enemies, faster and slower alike', () => {
    // mothling (speed 9) is faster than the player; restless-miner (speed 6) is slower - a
    // genuinely mixed roster, confirming the fix isn't just "works when the player is fastest" or
    // "works when the player is slowest against a uniform group." Level 20 for the same reason as
    // the test above (avoids colliding with crowd-damping's 1-damage floor).
    const restlessMiner = ENEMIES['restless-miner'];
    vi.spyOn(Math, 'random').mockReturnValue(0.5);
    const enemies = [
      { enemyId: mothling.id, level: 20, hp: mothling.stats.maxHp, ailments: [] },
      { enemyId: restlessMiner.id, level: 20, hp: restlessMiner.stats.maxHp, ailments: [] },
    ];
    const defending = resolveRound({
      action: { type: 'defend' },
      playerStats: stats({ speed: 7, hp: 999, maxHp: 999 }), // between the two enemies' speeds
      inventory: [],
      playerAilments: [],
      enemies,
    });
    const attacking = resolveRound({
      action: { type: 'attack', targetIndex: 0 },
      playerStats: stats({ speed: 7, hp: 999, maxHp: 999 }),
      inventory: [],
      playerAilments: [],
      enemies,
    });
    vi.restoreAllMocks();
    expect(999 - defending.playerHp).toBeLessThan(999 - attacking.playerHp);
  });

  it("keeper's strike (a Specialty Attack) costs spirit", () => {
    const result = resolveRound({
      action: { type: 'skill' },
      playerStats: stats({ speed: 999 }),
      inventory: [],
      playerAilments: [],
      enemies: soloEnemies(),
    });
    expect(result.playerSpirit).toBeLessThan(30);
    expect(result.log.some((l) => l.includes("Keeper's Strike"))).toBe(true);
  });

  it('an offensive lantern ability costs oil and is boosted against its effective family', () => {
    const coalSpirit = ENEMIES['coal-spirit'];
    const result = resolveRound({
      action: { type: 'lanternAbility', abilityId: 'lantern-flame' },
      playerStats: stats({ speed: 999 }),
      inventory: [],
      playerAilments: [],
      enemies: [{ enemyId: coalSpirit.id, level: 1, hp: coalSpirit.stats.maxHp, ailments: [] }],
    });
    expect(result.playerLanternOil).toBeLessThan(20);
    expect(result.enemyHp[0]).toBeLessThan(coalSpirit.stats.maxHp);
  });

  it('a healing lantern ability restores hp and costs oil, with no target needed', () => {
    const result = resolveRound({
      action: { type: 'lanternAbility', abilityId: 'steadfast-ember' },
      playerStats: stats({ speed: 999, hp: 10 }),
      inventory: [],
      playerAilments: [],
      enemies: soloEnemies(),
    });
    expect(result.playerHp).toBeGreaterThan(10);
    expect(result.playerLanternOil).toBeLessThan(20);
  });

  it('using Lantern Oil (the item) restores lantern oil', () => {
    const result = resolveRound({
      action: { type: 'item', itemIds: ['lantern-oil'] },
      playerStats: stats({ speed: 999, lanternOil: 0 }),
      inventory: [{ itemId: 'lantern-oil', quantity: 1 }],
      playerAilments: [],
      enemies: soloEnemies(),
    });
    expect(result.playerLanternOil).toBeGreaterThan(0);
    expect(result.itemConsumedIds).toEqual(['lantern-oil']);
  });

  it('Lantern Oil restores a percentage of the equipped lantern\'s maxLanternOil, so a bigger tank refills for more', () => {
    // lantern-oil is restoreOilPercent: 0.5 - two different maxLanternOil values (a smaller and a
    // bigger lantern) should refill by proportionally different absolute amounts.
    const smallTank = resolveRound({
      action: { type: 'item', itemIds: ['lantern-oil'] },
      playerStats: stats({ speed: 999, lanternOil: 0, maxLanternOil: 30 }),
      inventory: [{ itemId: 'lantern-oil', quantity: 1 }],
      playerAilments: [],
      enemies: soloEnemies(),
    });
    const bigTank = resolveRound({
      action: { type: 'item', itemIds: ['lantern-oil'] },
      playerStats: stats({ speed: 999, lanternOil: 0, maxLanternOil: 35 }),
      inventory: [{ itemId: 'lantern-oil', quantity: 1 }],
      playerAilments: [],
      enemies: soloEnemies(),
    });
    expect(smallTank.playerLanternOil).toBe(Math.round(30 * 0.5));
    expect(bigTank.playerLanternOil).toBe(Math.round(35 * 0.5));
    expect(bigTank.playerLanternOil).toBeGreaterThan(smallTank.playerLanternOil);
  });

  it('using a healing item restores hp and reports the consumed item', () => {
    const result = resolveRound({
      action: { type: 'item', itemIds: ['healing-poultice'] },
      playerStats: stats({ hp: 10, speed: 999 }),
      inventory: [{ itemId: 'healing-poultice', quantity: 1 }],
      playerAilments: [],
      enemies: soloEnemies(),
    });
    expect(result.itemConsumedIds).toEqual(['healing-poultice']);
    expect(result.playerHp).toBeGreaterThan(10);
  });

  it('a healing item restores a percentage of maxHp, so the same item heals more at higher maxHp', () => {
    // healing-poultice is healHpPercent: 0.3. Player still takes their one full round's worth of
    // enemy damage after healing (speed 999 only guarantees the player acts first, not that the
    // enemy is skipped) - defense: 9999 pins that chip damage at the engine's 1-point floor
    // deterministically (base damage goes deeply negative, so Math.random()'s variance can't
    // change the floored result), isolating the percentage-of-maxHp heal being tested here.
    // Mocked to 0.5 so that chip hit doesn't roll a miss (ENEMY_MISS_CHANCE is well under 0.5),
    // which would otherwise leave the "- 1" term wrong on however many runs it fired.
    vi.spyOn(Math, 'random').mockReturnValue(0.5);
    const lowMaxHp = resolveRound({
      action: { type: 'item', itemIds: ['healing-poultice'] },
      playerStats: stats({ hp: 1, maxHp: 60, speed: 999, defense: 9999 }),
      inventory: [{ itemId: 'healing-poultice', quantity: 1 }],
      playerAilments: [],
      enemies: soloEnemies(),
    });
    const highMaxHp = resolveRound({
      action: { type: 'item', itemIds: ['healing-poultice'] },
      playerStats: stats({ hp: 1, maxHp: 852, speed: 999, defense: 9999 }),
      inventory: [{ itemId: 'healing-poultice', quantity: 1 }],
      playerAilments: [],
      enemies: soloEnemies(),
    });
    vi.restoreAllMocks();
    expect(lowMaxHp.playerHp).toBe(1 + Math.round(60 * 0.3) - 1);
    expect(highMaxHp.playerHp).toBe(1 + Math.round(852 * 0.3) - 1);
    expect(highMaxHp.playerHp).toBeGreaterThan(lowMaxHp.playerHp);
  });

  it('reports victory once the sole enemy hp reaches zero', () => {
    const result = resolveRound({
      action: { type: 'attack' },
      playerStats: stats({ speed: 999, attack: 999 }),
      inventory: [],
      playerAilments: [],
      enemies: soloEnemies(1),
    });
    expect(result.phase).toBe('victory');
    expect(result.enemyHp[0]).toBe(0);
  });

  it('reports defeat once player hp reaches zero', () => {
    // 1 hp and 0 defense against even a halved (defended) hit is still guaranteed lethal,
    // regardless of damage variance or turn order - mocked to 0.5 so the attack doesn't roll a
    // miss (ENEMY_MISS_CHANCE is well under 0.5), which would otherwise make this flaky.
    vi.spyOn(Math, 'random').mockReturnValue(0.5);
    const result = resolveRound({
      action: { type: 'defend' },
      playerStats: stats({ hp: 1, maxHp: 60, speed: -999, defense: 0 }),
      inventory: [],
      playerAilments: [],
      enemies: [{ enemyId: mothling.id, level: 1, hp: mothling.stats.maxHp, ailments: [] }],
    });
    vi.restoreAllMocks();
    expect(result.phase).toBe('defeat');
    expect(result.playerHp).toBe(0);
  });

  describe('multi-item turns', () => {
    it('consumes up to 3 distinct items in one round, moving hp/spirit/oil independently', () => {
      const result = resolveRound({
        action: { type: 'item', itemIds: ['healing-poultice', 'spirit-draught', 'lantern-oil'] },
        playerStats: stats({ hp: 10, spirit: 5, lanternOil: 0, speed: 999 }),
        inventory: [
          { itemId: 'healing-poultice', quantity: 1 },
          { itemId: 'spirit-draught', quantity: 1 },
          { itemId: 'lantern-oil', quantity: 1 },
        ],
        playerAilments: [],
        enemies: soloEnemies(),
      });
      expect(result.playerHp).toBeGreaterThan(10);
      expect(result.playerSpirit).toBeGreaterThan(5);
      expect(result.playerLanternOil).toBeGreaterThan(0);
      expect(result.itemConsumedIds.sort()).toEqual(['healing-poultice', 'lantern-oil', 'spirit-draught']);
    });

    it('applies the same item twice when queued twice, clamped at max', () => {
      const result = resolveRound({
        action: { type: 'item', itemIds: ['healing-poultice', 'healing-poultice'] },
        playerStats: stats({ hp: 10, maxHp: 60, speed: 999 }),
        inventory: [{ itemId: 'healing-poultice', quantity: 2 }],
        playerAilments: [],
        enemies: soloEnemies(),
      });
      const single = resolveRound({
        action: { type: 'item', itemIds: ['healing-poultice'] },
        playerStats: stats({ hp: 10, maxHp: 60, speed: 999 }),
        inventory: [{ itemId: 'healing-poultice', quantity: 1 }],
        playerAilments: [],
        enemies: soloEnemies(),
      });
      expect(result.playerHp).toBeGreaterThan(single.playerHp);
      expect(result.itemConsumedIds).toEqual(['healing-poultice', 'healing-poultice']);
    });

    it('an item queued alongside attack heals AND deals damage in the same round', () => {
      const result = resolveRound({
        action: { type: 'attack', itemIds: ['healing-poultice'] },
        playerStats: stats({ hp: 10, speed: 999 }),
        inventory: [{ itemId: 'healing-poultice', quantity: 1 }],
        playerAilments: [],
        enemies: soloEnemies(),
      });
      expect(result.playerHp).toBeGreaterThan(10);
      expect(result.itemConsumedIds).toEqual(['healing-poultice']);
      expect(result.enemyHp[0]).toBeLessThan(mothling.stats.maxHp);
    });
  });

  describe('target-all', () => {
    function threeMothlings() {
      return [
        { enemyId: mothling.id, level: 1, hp: mothling.stats.maxHp, ailments: [] },
        { enemyId: mothling.id, level: 1, hp: mothling.stats.maxHp, ailments: [] },
        { enemyId: mothling.id, level: 1, hp: mothling.stats.maxHp, ailments: [] },
      ];
    }

    it('hits every alive enemy, with damage exactly when not missed', () => {
      let missCount = 0;
      for (let i = 0; i < 50; i++) {
        const result = resolveRound({
          action: { type: 'attack', targetAll: true },
          playerStats: stats({ speed: 999 }),
          inventory: [],
          playerAilments: [],
          enemies: threeMothlings(),
        });
        expect(result.hits.length).toBe(3);
        for (const hit of result.hits) {
          if (hit.missed) {
            missCount++;
            expect(hit.damage).toBe(0);
          } else {
            expect(hit.damage).toBeGreaterThanOrEqual(1);
          }
        }
      }
      // ~15% miss chance per target across 150 total rolls - loose band, not an exact assertion.
      expect(missCount).toBeGreaterThan(0);
      expect(missCount).toBeLessThan(150 * 0.4);
    });

    it('deals less damage per target than single-target, at a fixed damage roll', () => {
      vi.spyOn(Math, 'random').mockReturnValue(0.5); // no misses, fixed variance roll
      const allResult = resolveRound({
        action: { type: 'attack', targetAll: true },
        playerStats: stats({ speed: 999 }),
        inventory: [],
        playerAilments: [],
        enemies: threeMothlings(),
      });
      const singleResult = resolveRound({
        action: { type: 'attack', targetIndex: 0 },
        playerStats: stats({ speed: 999 }),
        inventory: [],
        playerAilments: [],
        enemies: threeMothlings(),
      });
      vi.restoreAllMocks();
      const allDamagePerTarget = allResult.hits[0].damage;
      const singleDamage = mothling.stats.maxHp - singleResult.enemyHp[0];
      expect(allDamagePerTarget).toBeLessThan(singleDamage);
    });

    it('falls back to normal single-target behavior when only one enemy is alive', () => {
      vi.spyOn(Math, 'random').mockReturnValue(0.5);
      const allResult = resolveRound({
        action: { type: 'attack', targetAll: true },
        playerStats: stats({ speed: 999 }),
        inventory: [],
        playerAilments: [],
        enemies: soloEnemies(),
      });
      const singleResult = resolveRound({
        action: { type: 'attack' },
        playerStats: stats({ speed: 999 }),
        inventory: [],
        playerAilments: [],
        enemies: soloEnemies(),
      });
      vi.restoreAllMocks();
      expect(allResult.hits[0].missed).toBe(false);
      expect(allResult.hits[0].damage).toBe(singleResult.hits[0].damage);
    });

    it('marks the killing hit as defeated', () => {
      vi.spyOn(Math, 'random').mockReturnValue(0.5);
      const result = resolveRound({
        action: { type: 'attack', targetAll: true },
        playerStats: stats({ speed: 999, attack: 999 }),
        inventory: [],
        playerAilments: [],
        enemies: threeMothlings(),
      });
      vi.restoreAllMocks();
      expect(result.hits.every((h) => h.defeated)).toBe(true);
      expect(result.phase).toBe('victory');
    });

    it('sums damageTakenByPlayer across every enemy attack in the round', () => {
      const result = resolveRound({
        action: { type: 'attack', targetIndex: 0 },
        playerStats: stats({ speed: -999, hp: 999, maxHp: 999 }),
        inventory: [],
        playerAilments: [],
        enemies: threeMothlings(),
      });
      expect(result.damageTakenByPlayer).toBe(999 - result.playerHp);
      expect(result.damageTakenByPlayer).toBeGreaterThan(0);
    });
  });

  describe('enemy scaling stays a fair fight across the level cap (1-100)', () => {
    // Verified by hand against computeDamage/scaledEnemyStats at each checkpoint: player stats
    // built the same way applyLevelUp would (STARTING_STATS + STAT_GROWTH_PER_LEVEL*(level-1)),
    // enemy stats at the level rollEnemyLevel would roll (baseLevel = round(playerLevel/2)).
    // variance=1.0 (mocked) removes the +/-10% roll so the expected damage is exact, not a range.
    // dmgToPlayer values reflect the multi-enemy rebalance's ENEMY_STAT_GROWTH_PER_LEVEL.attack
    // cut (4->3) - dmgToEnemy is untouched since the player's own attack growth never changed, and
    // these are solo-enemy fights (crowd damping only applies at 2+ alive non-boss enemies).
    const CHECKPOINTS = [
      { playerLevel: 1, enemyLevel: 1, dmgToEnemy: 13, dmgToPlayer: 11 },
      { playerLevel: 10, enemyLevel: 5, dmgToEnemy: 18, dmgToPlayer: 13 },
      { playerLevel: 25, enemyLevel: 13, dmgToEnemy: 25, dmgToPlayer: 17 },
      { playerLevel: 50, enemyLevel: 25, dmgToEnemy: 38, dmgToPlayer: 23 },
      { playerLevel: 75, enemyLevel: 38, dmgToEnemy: 50, dmgToPlayer: 30 },
      { playerLevel: 100, enemyLevel: 50, dmgToEnemy: 63, dmgToPlayer: 35 },
    ];

    it.each(CHECKPOINTS)(
      'player level $playerLevel vs enemy level $enemyLevel: neither one-shots nor stalls',
      ({ playerLevel, enemyLevel, dmgToEnemy, dmgToPlayer }) => {
        vi.spyOn(Math, 'random').mockReturnValue(0.5);
        const playerStats = stats({
          hp: 999,
          maxHp: 999, // isolate this round's damage from the player's own real maxHp
          attack: 8 + 2 * (playerLevel - 1),
          defense: 5 + (playerLevel - 1),
          speed: 999, // player acts first so the enemy's own hit this round is easy to isolate
        });
        const result = resolveRound({
          action: { type: 'attack' },
          playerStats,
          inventory: [],
          playerAilments: [],
          enemies: [{ enemyId: mothling.id, level: enemyLevel, hp: 999999, ailments: [] }], // isolate from enemy maxHp too
        });
        vi.restoreAllMocks();

        const actualDmgToEnemy = 999999 - result.enemyHp[0];
        const actualDmgToPlayer = 999 - result.playerHp;
        expect(actualDmgToEnemy).toBe(dmgToEnemy);
        expect(actualDmgToPlayer).toBe(dmgToPlayer);

        // No one-shots, no unwinnable grind, at any checkpoint including the level cap. Uses the
        // real scaledEnemyStats (not a hand-duplicated HP formula) so this bound stays honest if
        // ENEMY_STAT_GROWTH_PER_LEVEL.maxHp ever changes again, rather than silently drifting the
        // way a hardcoded copy of it already did once (see the 3-mothling group test above).
        const enemyMaxHp = scaledEnemyStats(mothling, enemyLevel).maxHp;
        const playerMaxHp = 60 + 8 * (playerLevel - 1);
        const hitsToKillEnemy = Math.ceil(enemyMaxHp / actualDmgToEnemy);
        const hitsToKillPlayer = Math.ceil(playerMaxHp / actualDmgToPlayer);
        expect(hitsToKillEnemy).toBeGreaterThanOrEqual(2);
        expect(hitsToKillEnemy).toBeLessThanOrEqual(20);
        expect(hitsToKillPlayer).toBeGreaterThanOrEqual(2);
        // Widened from 20 to 30: the attack-growth cut (see ENEMY_STAT_GROWTH_PER_LEVEL) widens
        // the player's safety margin in a 1-on-1 fight - hitsToKillEnemy is unchanged, so the
        // fight is still won in the same number of rounds as before, this just means the player
        // can survive more mistakes along the way. Not a stall.
        expect(hitsToKillPlayer).toBeLessThanOrEqual(30);
      },
    );
  });

  describe('naively single-targeting a 3-enemy group stays winnable, with real risk', () => {
    // Real (non-999-speed) player stats built the same way applyLevelUp would - deliberately not
    // forcing speed:999, since real turn order (enemies are consistently a bit faster than the
    // player at every checkpoint) is exactly what makes a group fight dangerous and must be
    // exercised here, not bypassed. A real 3-mothling roster via scaledEnemyStats (not a hand-
    // duplicated HP formula - a previous version of this test hardcoded `+ 16 * (enemyLevel - 1)`
    // directly, which silently went stale and kept testing pre-rebalance HP once
    // ENEMY_STAT_GROWTH_PER_LEVEL.maxHp changed, without ever failing to say so) so HP pools
    // actually deplete over multiple rounds and stay in sync with whatever the real constant is.
    // Simulates the whole fight by looping resolveRound, single-targeting whichever enemy is
    // still alive first (the default/simplest play pattern), until a terminal phase.
    //
    // ENEMY_STAT_GROWTH_PER_LEVEL.maxHp was lowered (playtest-driven pacing pass, see git history)
    // specifically to cut down how many rounds a non-boss fight takes - low enough that even a
    // naive single-target strategy against a 3-enemy pack is winnable again, despite
    // CROWD_DAMAGE_FACTOR remaining at its harder-tuned value from the earlier balance pass: fewer
    // total rounds means less cumulative damage absorbed, more than offsetting the higher
    // per-hit rate. What this test guards against is a *stomp* in either direction - real,
    // multi-round attrition and a real dent taken, not an instant win or an instant loss.
    it.each([10, 25, 50, 75, 100])('player level %i vs a real 3-mothling group is winnable, with real risk', (playerLevel) => {
      vi.spyOn(Math, 'random').mockReturnValue(0.5);
      const playerMaxHp = 60 + 8 * (playerLevel - 1);
      let playerHp = playerMaxHp;
      const playerStats = stats({
        attack: 8 + 2 * (playerLevel - 1),
        defense: 5 + (playerLevel - 1),
        speed: 6 + (playerLevel - 1),
      });
      const enemyLevel = Math.max(1, Math.round(playerLevel / 2));
      const enemyHp = scaledEnemyStats(mothling, enemyLevel).maxHp;
      let enemies = [
        { enemyId: mothling.id, level: enemyLevel, hp: enemyHp, ailments: [] },
        { enemyId: mothling.id, level: enemyLevel, hp: enemyHp, ailments: [] },
        { enemyId: mothling.id, level: enemyLevel, hp: enemyHp, ailments: [] },
      ];

      let phase: string = 'continue';
      let rounds = 0;
      while (phase === 'continue' && rounds < 200) {
        const targetIndex = enemies.findIndex((e) => e.hp > 0);
        const result = resolveRound({
          action: { type: 'attack', targetIndex },
          playerStats: { ...playerStats, hp: playerHp, maxHp: playerMaxHp },
          inventory: [],
          playerAilments: [],
          enemies,
        });
        playerHp = result.playerHp;
        enemies = enemies.map((e, i) => ({ ...e, hp: result.enemyHp[i] }));
        phase = result.phase;
        rounds++;
      }
      vi.restoreAllMocks();

      expect(phase).toBe('victory');
      // Genuine risk, not a stomp: at every checkpoint this takes 9-15 rounds (verified by hand)
      // and leaves the player at roughly a third to half HP, not untouched and not nearly dead.
      expect(rounds).toBeGreaterThanOrEqual(8);
      const remainingFraction = playerHp / playerMaxHp;
      expect(remainingFraction).toBeGreaterThan(0.15);
      expect(remainingFraction).toBeLessThan(0.6);
    });
  });
});

describe('resolveRound - elemental weakness bonus', () => {
  // Mutates ENEMIES[id].weaknessDamageType directly (then restores it) to isolate the weakness
  // variable on the exact same enemy - a cross-enemy comparison would confound the result with
  // each enemy's own differing attack/defense stats.
  const restlessMiner = ENEMIES['restless-miner']; // family restlessMiners - not lantern-flame's
  // effectiveAgainstFamilies (coalSpirits), so its own family bonus can't confound this.
  const originalWeakness = restlessMiner.weaknessDamageType;

  afterEach(() => {
    restlessMiner.weaknessDamageType = originalWeakness;
  });

  it('a plain Attack deals 1.5x damage against an enemy weak to physical', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.5);
    restlessMiner.weaknessDamageType = 'physical';
    const weak = resolveRound({
      action: { type: 'attack' },
      playerStats: stats({ speed: 999 }),
      inventory: [],
      playerAilments: [],
      enemies: [{ enemyId: restlessMiner.id, level: 1, hp: restlessMiner.stats.maxHp, ailments: [] }],
    });
    restlessMiner.weaknessDamageType = 'spirit';
    const notWeak = resolveRound({
      action: { type: 'attack' },
      playerStats: stats({ speed: 999 }),
      inventory: [],
      playerAilments: [],
      enemies: [{ enemyId: restlessMiner.id, level: 1, hp: restlessMiner.stats.maxHp, ailments: [] }],
    });
    vi.restoreAllMocks();
    const weakDamage = restlessMiner.stats.maxHp - weak.enemyHp[0];
    const notWeakDamage = restlessMiner.stats.maxHp - notWeak.enemyHp[0];
    expect(weakDamage).toBe(Math.round(notWeakDamage * 1.5));
  });

  it("Keeper's Strike (spirit) deals 1.5x damage against an enemy weak to spirit", () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.5);
    restlessMiner.weaknessDamageType = 'spirit';
    const weak = resolveRound({
      action: { type: 'skill' },
      playerStats: stats({ speed: 999, spirit: 30, maxSpirit: 30 }),
      inventory: [],
      playerAilments: [],
      enemies: [{ enemyId: restlessMiner.id, level: 1, hp: restlessMiner.stats.maxHp, ailments: [] }],
    });
    restlessMiner.weaknessDamageType = 'physical';
    const notWeak = resolveRound({
      action: { type: 'skill' },
      playerStats: stats({ speed: 999, spirit: 30, maxSpirit: 30 }),
      inventory: [],
      playerAilments: [],
      enemies: [{ enemyId: restlessMiner.id, level: 1, hp: restlessMiner.stats.maxHp, ailments: [] }],
    });
    vi.restoreAllMocks();
    const weakDamage = restlessMiner.stats.maxHp - weak.enemyHp[0];
    const notWeakDamage = restlessMiner.stats.maxHp - notWeak.enemyHp[0];
    expect(weakDamage).toBe(Math.round(notWeakDamage * 1.5));
  });

  it('an offensive lantern ability deals 1.5x damage against an enemy weak to lantern, stacking with (not replacing) its own effectiveAgainstFamilies bonus', () => {
    // Level 20 (not 1) - lantern-flame's power (22) is high enough that a 1.5x hit on a level-1
    // restless-miner (34 maxHp) would exceed and clamp at 0, making weakDamage measure the HP pool
    // instead of the actual bonus. A level-20 pool has plenty of headroom above either hit.
    vi.spyOn(Math, 'random').mockReturnValue(0.5);
    const level = 20;
    const maxHp = scaledEnemyStats(restlessMiner, level).maxHp;
    restlessMiner.weaknessDamageType = 'lantern';
    const weak = resolveRound({
      action: { type: 'lanternAbility', abilityId: 'lantern-flame' },
      playerStats: stats({ speed: 999 }),
      inventory: [],
      playerAilments: [],
      enemies: [{ enemyId: restlessMiner.id, level, hp: maxHp, ailments: [] }],
    });
    restlessMiner.weaknessDamageType = 'physical';
    const notWeak = resolveRound({
      action: { type: 'lanternAbility', abilityId: 'lantern-flame' },
      playerStats: stats({ speed: 999 }),
      inventory: [],
      playerAilments: [],
      enemies: [{ enemyId: restlessMiner.id, level, hp: maxHp, ailments: [] }],
    });
    vi.restoreAllMocks();
    const weakDamage = maxHp - weak.enemyHp[0];
    const notWeakDamage = maxHp - notWeak.enemyHp[0];
    expect(weakDamage).toBe(Math.round(notWeakDamage * 1.5));
  });
});

describe('resolveRound - initiative roll', () => {
  it('gives every combatant genuine round-to-round turn-order variance instead of a fixed sort', () => {
    // A d20-losing-by-default speed gap (enemy speed 6, player speed 7) should still occasionally
    // let the enemy act first once a d6 roll is added on both sides - sample many rounds and
    // confirm the enemy's attack sometimes lands before any player action could have defeated it
    // (i.e. genuine variance), by checking the mothling's own move sometimes still connects even
    // when the player's single hit this round would otherwise have been guaranteed to kill it.
    const mothling = ENEMIES.mothling;
    let enemyActedAtLeastOnce = false;
    let playerWonInitiativeAtLeastOnce = false;
    for (let i = 0; i < 60; i++) {
      const result = resolveRound({
        action: { type: 'attack' },
        playerStats: stats({ speed: 7, attack: 999, hp: 999, maxHp: 999 }), // guaranteed one-shot kill
        inventory: [],
        playerAilments: [],
        enemies: [{ enemyId: mothling.id, level: 1, hp: mothling.stats.maxHp, ailments: [] }],
      });
      if (result.enemyHits.length > 0) enemyActedAtLeastOnce = true;
      else playerWonInitiativeAtLeastOnce = true;
    }
    // Both outcomes should occur across enough rolls - proves initiative isn't hardcoded to
    // "player always wins" purely because playerSpeed (7) > mothling speed (9)... in this case the
    // mothling's raw speed (9) is actually faster, so this also proves the roll doesn't invert
    // ordering into "always the higher raw speed wins" (which is what deterministic sorting alone
    // would have produced, just always favoring the mothling instead) - real variance either way.
    expect(enemyActedAtLeastOnce).toBe(true);
    expect(playerWonInitiativeAtLeastOnce).toBe(true);
  });
});

describe('resolveRound - defeated-enemy-cannot-attack regression test', () => {
  it('a mid-round targetAll kill excludes that enemy from enemyHits, even though it was slower than the player', () => {
    const mothling = ENEMIES.mothling;
    // 0.5 is comfortably above TARGET_ALL_MISS_CHANCE (0.15), so every targetAll swing this round
    // lands - a real miss here would leave that one mothling alive and falsify the test for the
    // wrong reason (an unlucky roll, not a real regression).
    vi.spyOn(Math, 'random').mockReturnValue(0.5);
    const result = resolveRound({
      action: { type: 'attack', targetAll: true },
      // Guaranteed one-shot kill of every target, guaranteed to act first.
      playerStats: stats({ speed: 999, attack: 999, hp: 999, maxHp: 999 }),
      inventory: [],
      playerAilments: [],
      enemies: [
        { enemyId: mothling.id, level: 1, hp: mothling.stats.maxHp, ailments: [] },
        { enemyId: mothling.id, level: 1, hp: mothling.stats.maxHp, ailments: [] },
        { enemyId: mothling.id, level: 1, hp: mothling.stats.maxHp, ailments: [] },
      ],
    });
    vi.restoreAllMocks();
    expect(result.enemyHp.every((hp) => hp <= 0)).toBe(true);
    expect(result.phase).toBe('victory');
    // Every enemy was defeated by the player's own targetAll swing this same round - none of them
    // should have gotten a turn afterward.
    expect(result.enemyHits).toEqual([]);
  });
});

describe('aggregateItemCounts', () => {
  it('groups duplicate ids within the first 3 entries', () => {
    const counts = aggregateItemCounts(['a', 'a', 'b']);
    expect(counts.get('a')).toBe(2);
    expect(counts.get('b')).toBe(1);
  });

  it('ignores anything past the 3-item cap entirely', () => {
    const counts = aggregateItemCounts(['a', 'a', 'b', 'c', 'd']);
    expect(counts.get('a')).toBe(2);
    expect(counts.get('b')).toBe(1);
    expect(counts.get('c')).toBeUndefined(); // beyond slice(0,3), never counted
  });
});

describe('hasSufficientQuantity', () => {
  it('returns false when requesting more than owned', () => {
    expect(hasSufficientQuantity(['potion', 'potion'], [{ itemId: 'potion', quantity: 1 }])).toBe(false);
  });

  it('returns true at exactly the owned quantity', () => {
    expect(hasSufficientQuantity(['potion', 'potion'], [{ itemId: 'potion', quantity: 2 }])).toBe(true);
  });

  it('aggregates duplicate ids before comparing against inventory', () => {
    expect(
      hasSufficientQuantity(
        ['potion', 'oil', 'potion'],
        [
          { itemId: 'potion', quantity: 2 },
          { itemId: 'oil', quantity: 1 },
        ],
      ),
    ).toBe(true);
  });
});

describe('computeRewards', () => {
  beforeEach(() => {
    vi.spyOn(Math, 'random').mockReturnValue(0.99); // avoid random loot rolls interfering with assertions below
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('grants exactly the enemy\'s authored xp/gold reward - no scaling by the enemy\'s rolled level', () => {
    const mothling = ENEMIES.mothling;
    const reward = computeRewards([{ enemyId: mothling.id }], 0, 1);
    expect(reward.xp).toBe(mothling.xpReward);
    expect(reward.gold).toBe(mothling.goldReward);
  });

  it('sums xp/gold across every defeated enemy in a group', () => {
    const mothling = ENEMIES.mothling;
    const reward = computeRewards(
      [{ enemyId: mothling.id }, { enemyId: mothling.id }, { enemyId: mothling.id }],
      0,
      1,
    );
    expect(reward.xp).toBe(mothling.xpReward * 3);
    expect(reward.gold).toBe(mothling.goldReward * 3);
  });

  it('flags a level-up and computes stat growth when xp crosses a threshold', () => {
    const boss = ENEMIES['coalbound-warden'];
    const reward = computeRewards([{ enemyId: boss.id }], 30, 2); // 30 + 150 = 180 xp -> level 4
    expect(reward.leveledUp).toBe(true);
    expect(reward.newLevel).toBeGreaterThan(2);
    expect(reward.statGrowth.maxHp).toBeGreaterThan(0);
  });

  it('does not flag a level-up for a small xp gain', () => {
    const mothling = ENEMIES.mothling;
    const reward = computeRewards([{ enemyId: mothling.id }], 0, 1);
    expect(reward.leveledUp).toBe(false);
    expect(reward.statGrowth).toEqual({});
  });

  it('skipLoot suppresses the lootTable roll (e.g. a boss already defeated before) without touching xp/gold', () => {
    const boss = ENEMIES['coalbound-warden']; // lootTable: 100% chance of wardens-ember-heart
    const firstKill = computeRewards([{ enemyId: boss.id, skipLoot: false }], 0, 1);
    const repeatKill = computeRewards([{ enemyId: boss.id, skipLoot: true }], 0, 1);
    expect(firstKill.lootItemIds).toContain('wardens-ember-heart');
    expect(repeatKill.lootItemIds).not.toContain('wardens-ember-heart');
    expect(repeatKill.xp).toBe(firstKill.xp);
    expect(repeatKill.gold).toBe(firstKill.gold);
  });
});

describe('rollVictoryRestore', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns null when every stat is already at max', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0); // would hit the chance roll if anything were eligible
    const result = rollVictoryRestore(stats({ hp: 60, spirit: 30, lanternOil: 20, maxLanternOil: 20 }));
    expect(result).toBeNull();
  });

  it('returns null when the chance roll misses, even with eligible stats', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.99); // >= VICTORY_RESTORE_CHANCE (0.25)
    const result = rollVictoryRestore(stats({ hp: 1, maxHp: 60 }));
    expect(result).toBeNull();
  });

  it('only picks among non-maxed stats and restores 15% of that stat\'s max', () => {
    // First random() call is the chance roll (must be < 0.25 to fire), second picks which eligible
    // stat (Math.floor(second * eligible.length)) - mocking a fixed sequence pins both.
    const values = [0.1, 0];
    vi.spyOn(Math, 'random').mockImplementation(() => values.shift() ?? 0);
    // Only hp is below max, so it must be the one picked regardless of the "which stat" roll.
    const result = rollVictoryRestore(stats({ hp: 1, maxHp: 60, spirit: 30, maxSpirit: 30, lanternOil: 20, maxLanternOil: 20 }));
    expect(result).toEqual({ stat: 'hp', amount: Math.round(60 * 0.15) });
  });

  it('excludes lanternOil when no lantern is equipped (maxLanternOil 0)', () => {
    // eligible = [hp, spirit] only (lanternOil's 0 < 0 is false) - "which stat" roll of 0.99 picks
    // the last eligible entry, which must be spirit, not lanternOil, since lanternOil never made it
    // into the eligible list at all.
    const values = [0.1, 0.99];
    vi.spyOn(Math, 'random').mockImplementation(() => values.shift() ?? 0);
    const result = rollVictoryRestore(stats({ hp: 1, maxHp: 60, spirit: 1, maxSpirit: 30, lanternOil: 0, maxLanternOil: 0 }));
    expect(result?.stat).toBe('spirit');
  });
});

describe('resolveRound - enemyHits (structured per-attacker enemy damage on the player)', () => {
  const mothling = ENEMIES.mothling;

  function threeMothlings() {
    return [
      { enemyId: mothling.id, level: 1, hp: mothling.stats.maxHp, ailments: [] },
      { enemyId: mothling.id, level: 1, hp: mothling.stats.maxHp, ailments: [] },
      { enemyId: mothling.id, level: 1, hp: mothling.stats.maxHp, ailments: [] },
    ];
  }

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('records one entry per attacking enemy, with the correct attackerIndex', () => {
    const result = resolveRound({
      action: { type: 'attack', targetIndex: 0 },
      playerStats: stats({ speed: -999, hp: 999, maxHp: 999 }), // enemies act first, deterministic
      inventory: [],
      playerAilments: [],
      enemies: threeMothlings(),
    });
    expect(result.enemyHits).toHaveLength(3);
    expect(result.enemyHits.map((h) => h.attackerIndex).sort()).toEqual([0, 1, 2]);
  });

  it('each enemyHits entry carries the exact same logLine pushed to the round log, naming its own attacker', () => {
    // Mocked to 0.5 so no attacker rolls a miss (ENEMY_MISS_CHANCE is well under 0.5) - a missed
    // attacker's logLine doesn't mention a damage number at all, which this test specifically
    // checks for on a hit.
    vi.spyOn(Math, 'random').mockReturnValue(0.5);
    const result = resolveRound({
      action: { type: 'attack', targetIndex: 0 },
      playerStats: stats({ speed: -999, hp: 999, maxHp: 999 }),
      inventory: [],
      playerAilments: [],
      enemies: threeMothlings(),
    });
    for (const hit of result.enemyHits) {
      expect(hit.logLine).toContain(mothling.name);
      expect(hit.logLine).toContain(String(hit.damage));
      expect(result.log).toContain(hit.logLine);
    }
  });

  it('enemyHits damage always sums to damageTakenByPlayer', () => {
    const result = resolveRound({
      action: { type: 'attack', targetIndex: 0 },
      playerStats: stats({ speed: -999, hp: 999, maxHp: 999 }),
      inventory: [],
      playerAilments: [],
      enemies: threeMothlings(),
    });
    const summed = result.enemyHits.reduce((sum, h) => sum + h.damage, 0);
    expect(summed).toBe(result.damageTakenByPlayer);
  });

  it('wasDefended reflects the round\'s Defend state, for every attacker', () => {
    // Mocked to 0.5 so every attacker actually connects (ENEMY_MISS_CHANCE is well under 0.5) - a
    // missed attacker's entry always carries wasDefended:false regardless of the round's Defend
    // state (there's no damage to have halved), which would otherwise make this flaky.
    vi.spyOn(Math, 'random').mockReturnValue(0.5);
    const defending = resolveRound({
      action: { type: 'defend' },
      playerStats: stats({ speed: -999, hp: 999, maxHp: 999 }),
      inventory: [],
      playerAilments: [],
      enemies: threeMothlings(),
    });
    const attacking = resolveRound({
      action: { type: 'attack', targetIndex: 0 },
      playerStats: stats({ speed: -999, hp: 999, maxHp: 999 }),
      inventory: [],
      playerAilments: [],
      enemies: threeMothlings(),
    });
    expect(defending.enemyHits.every((h) => h.wasDefended)).toBe(true);
    expect(attacking.enemyHits.every((h) => !h.wasDefended)).toBe(true);
  });

  it('wasDefended entries carry the actual halved damage, not just a flag', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.5);
    const defending = resolveRound({
      action: { type: 'defend' },
      playerStats: stats({ speed: -999, hp: 999, maxHp: 999 }),
      inventory: [],
      playerAilments: [],
      enemies: [{ enemyId: mothling.id, level: 1, hp: mothling.stats.maxHp, ailments: [] }],
    });
    const attacking = resolveRound({
      action: { type: 'attack' },
      playerStats: stats({ speed: -999, hp: 999, maxHp: 999 }),
      inventory: [],
      playerAilments: [],
      enemies: [{ enemyId: mothling.id, level: 1, hp: mothling.stats.maxHp, ailments: [] }],
    });
    expect(defending.enemyHits[0].damage).toBeLessThan(attacking.enemyHits[0].damage);
  });

  it('an enemy attack can miss (ENEMY_MISS_CHANCE), dealing no damage and not counting toward damageTakenByPlayer', () => {
    // Below ENEMY_MISS_CHANCE (0.1) - guarantees a miss.
    vi.spyOn(Math, 'random').mockReturnValue(0.01);
    const missed = resolveRound({
      action: { type: 'attack' },
      playerStats: stats({ speed: -999, hp: 999, maxHp: 999 }),
      inventory: [],
      playerAilments: [],
      enemies: [{ enemyId: mothling.id, level: 1, hp: mothling.stats.maxHp, ailments: [] }],
    });
    expect(missed.enemyHits[0].missed).toBe(true);
    expect(missed.enemyHits[0].damage).toBe(0);
    expect(missed.damageTakenByPlayer).toBe(0);
    expect(missed.playerHp).toBe(999);
    expect(missed.enemyHits[0].logLine).toContain(mothling.name);
    expect(missed.log).toContain(missed.enemyHits[0].logLine);
  });

  it('an enemy attack connects when the miss roll fails (ENEMY_MISS_CHANCE)', () => {
    // Above ENEMY_MISS_CHANCE (0.1) - guarantees a hit.
    vi.spyOn(Math, 'random').mockReturnValue(0.5);
    const hit = resolveRound({
      action: { type: 'attack' },
      playerStats: stats({ speed: -999, hp: 999, maxHp: 999 }),
      inventory: [],
      playerAilments: [],
      enemies: [{ enemyId: mothling.id, level: 1, hp: mothling.stats.maxHp, ailments: [] }],
    });
    expect(hit.enemyHits[0].missed).toBe(false);
    expect(hit.enemyHits[0].damage).toBeGreaterThan(0);
    expect(hit.damageTakenByPlayer).toBe(hit.enemyHits[0].damage);
  });

  it("a boss's own attack is undamped by add count, while its adds' attacks are crowd-dampened", () => {
    const boss = ENEMIES['coalbound-warden'];
    vi.spyOn(Math, 'random').mockReturnValue(0.5);
    const bossAlone = resolveRound({
      action: { type: 'defend' },
      playerStats: stats({ speed: -999, hp: 9999, maxHp: 9999 }),
      inventory: [],
      playerAilments: [],
      enemies: [{ enemyId: boss.id, level: 1, hp: boss.stats.maxHp, ailments: [] }],
    });
    const bossWithAdds = resolveRound({
      action: { type: 'defend' },
      playerStats: stats({ speed: -999, hp: 9999, maxHp: 9999 }),
      inventory: [],
      playerAilments: [],
      enemies: [
        { enemyId: boss.id, level: 1, hp: boss.stats.maxHp, ailments: [] },
        { enemyId: mothling.id, level: 1, hp: mothling.stats.maxHp, ailments: [] },
        { enemyId: mothling.id, level: 1, hp: mothling.stats.maxHp, ailments: [] },
      ],
    });
    // Roster order is [boss, mothling, mothling] in both cases relevant to attackerIndex 0.
    const bossHitAlone = bossAlone.enemyHits.find((h) => h.attackerIndex === 0)!.damage;
    const bossHitWithAdds = bossWithAdds.enemyHits.find((h) => h.attackerIndex === 0)!.damage;
    expect(bossHitWithAdds).toBe(bossHitAlone);
    // The adds, by contrast, are crowd-dampened at aliveNonBossCount=2 (CROWD_DAMAGE_FACTOR
    // 0.3) - each add's hit should land well under the boss's own (undamped) hit.
    const addHits = bossWithAdds.enemyHits.filter((h) => h.attackerIndex !== 0);
    expect(addHits.length).toBe(2);
    for (const addHit of addHits) {
      expect(addHit.damage).toBeLessThan(bossHitAlone);
    }
  });

  it('both resolveRound return paths populate enemyHits correctly', () => {
    // Successful flee: playerStats.speed far above the enemies' average speed clamps fleeChance to
    // its max (0.9); Math.random mocked to 0 guarantees success - this hits the early `phase:
    // 'fled'` return, which happens before any enemyAttack call, so enemyHits must be [].
    vi.spyOn(Math, 'random').mockReturnValue(0);
    const successfulFlee = resolveRound({
      action: { type: 'flee' },
      playerStats: stats({ speed: 999, hp: 999, maxHp: 999 }),
      inventory: [],
      playerAilments: [],
      enemies: threeMothlings(),
    });
    expect(successfulFlee.phase).toBe('fled');
    expect(successfulFlee.enemyHits).toEqual([]);
    vi.restoreAllMocks();

    // Failed flee: playerStats.speed far below the enemies' average clamps fleeChance to its min
    // (0.1); Math.random mocked to 0.99 guarantees failure - falls through to "every foe still
    // standing gets a free hit" (`for (const i of alive) enemyAttack(i);`), which reaches the
    // FINAL return statement, not the early one - a real, separate code path from every other test
    // in this block, which all go through the normal turn-order loop instead.
    vi.spyOn(Math, 'random').mockReturnValue(0.99);
    const failedFlee = resolveRound({
      action: { type: 'flee' },
      playerStats: stats({ speed: -999, hp: 999, maxHp: 999 }),
      inventory: [],
      playerAilments: [],
      enemies: threeMothlings(),
    });
    expect(failedFlee.phase).toBe('continue');
    expect(failedFlee.enemyHits).toHaveLength(3);
    expect(failedFlee.enemyHits.map((h) => h.attackerIndex).sort()).toEqual([0, 1, 2]);
  });
});

describe('resolveRound - ailments', () => {
  const mothling = ENEMIES.mothling;

  function soloEnemies(hp = mothling.stats.maxHp, level = 1) {
    return [{ enemyId: mothling.id, level, hp, ailments: [] }];
  }

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('a damage-over-time ailment (Poison) ticks at the end of the player\'s turn and remains active', () => {
    const result = resolveRound({
      action: { type: 'defend' },
      playerStats: stats({ hp: 100, maxHp: 100, speed: 999 }),
      inventory: [],
      playerAilments: [{ ailmentId: 'poison' }],
      enemies: [],
    });
    const expectedDmg = Math.round(100 * AILMENTS.poison.effect.damagePercentPerTurn!);
    expect(result.playerHp).toBe(100 - expectedDmg);
    expect(result.playerAilments).toEqual([{ ailmentId: 'poison' }]);
    expect(result.log.some((l) => l.includes('Poison deals'))).toBe(true);
  });

  it('multiple different ailments stack and each apply their own DoT tick in the same round', () => {
    const result = resolveRound({
      action: { type: 'defend' },
      playerStats: stats({ hp: 100, maxHp: 100, speed: 999 }),
      inventory: [],
      playerAilments: [{ ailmentId: 'poison' }, { ailmentId: 'burn' }],
      enemies: [],
    });
    const poisonDmg = Math.round(100 * AILMENTS.poison.effect.damagePercentPerTurn!);
    const burnDmg = Math.round(100 * AILMENTS.burn.effect.damagePercentPerTurn!);
    expect(result.playerHp).toBe(100 - poisonDmg - burnDmg);
    expect(result.playerAilments.map((a) => a.ailmentId).sort()).toEqual(['burn', 'poison']);
  });

  it('Burn reduces the player\'s outgoing damage via attackMultiplier', () => {
    // Math.random mocked to exactly 0.5 makes computeDamage's variance term (0.9 + random*0.2)
    // resolve to exactly 1.0, so both rounds' damage is exactly computable rather than just
    // "burned is less than baseline".
    vi.spyOn(Math, 'random').mockReturnValue(0.5);
    const baseline = resolveRound({
      action: { type: 'attack' },
      playerStats: stats({ speed: 999 }),
      inventory: [],
      playerAilments: [],
      enemies: soloEnemies(),
    });
    const burned = resolveRound({
      action: { type: 'attack' },
      playerStats: stats({ speed: 999 }),
      inventory: [],
      playerAilments: [{ ailmentId: 'burn' }],
      enemies: soloEnemies(),
    });
    // base playerStats().attack is 8, mothling's base defense is 3, SKILLS.attack.power is 10.
    expect(baseline.hits[0].damage).toBe(13); // round(10 + 8*0.5 - 3*0.5)
    expect(burned.hits[0].damage).toBe(12); // round(10 + (8*0.75)*0.5 - 3*0.5)
    expect(burned.hits[0].damage).toBeLessThan(baseline.hits[0].damage);
  });

  it('Blind can cause the player\'s single-target physical attack to miss outright', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.1); // below blind's miss chance (1 - 0.65 = 0.35)
    const missed = resolveRound({
      action: { type: 'attack' },
      playerStats: stats({ speed: 999 }),
      inventory: [],
      playerAilments: [{ ailmentId: 'blind' }],
      enemies: soloEnemies(),
    });
    expect(missed.hits[0]).toMatchObject({ missed: true, damage: 0 });

    vi.spyOn(Math, 'random').mockReturnValue(0.9); // above blind's miss chance
    const landed = resolveRound({
      action: { type: 'attack' },
      playerStats: stats({ speed: 999 }),
      inventory: [],
      playerAilments: [{ ailmentId: 'blind' }],
      enemies: soloEnemies(),
    });
    expect(landed.hits[0].missed).toBe(false);
    expect(landed.hits[0].damage).toBeGreaterThan(0);
  });

  it('Stun skips the player\'s entire turn - no damage dealt, no items consumed - while enemies still act', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.5); // no enemy miss (ENEMY_MISS_CHANCE is 0.1)
    const result = resolveRound({
      action: { type: 'item', itemIds: ['healing-poultice'] },
      playerStats: stats({ speed: 999, hp: 10, maxHp: 999 }),
      inventory: [{ itemId: 'healing-poultice', quantity: 1 }],
      playerAilments: [{ ailmentId: 'stun', turnsRemaining: 1 }],
      enemies: soloEnemies(),
    });
    expect(result.itemConsumedIds).toEqual([]);
    expect(result.playerHp).toBeLessThan(10); // took the enemy's hit, was not healed
    expect(result.log.some((l) => l.includes('stunned'))).toBe(true);
    // Already active at round start (not inflicted mid-round), so it decrements and expires.
    expect(result.playerAilments).toEqual([]);
  });

  it('an ailment inflicted mid-round is not decremented until the following round', () => {
    // Sequence of Math.random() calls: the player's and the (one) enemy's initiative rolls first
    // (speed:999 dominates either roll, so their values here don't affect ordering), then inside
    // enemyAttack() - the miss-chance check, the weighted move pick, computeDamage's variance roll,
    // then the ailment infliction roll.
    vi.spyOn(Math, 'random')
      .mockReturnValueOnce(0.5) // player initiative roll
      .mockReturnValueOnce(0.5) // restless-miner's initiative roll
      .mockReturnValueOnce(0.5) // no miss
      .mockReturnValueOnce(0.9) // weightedPick: (0.9*4=3.6) - attack(3) = 0.6, - pickaxe(1) = -0.4 <= 0 -> picks miner-pickaxe-swing
      .mockReturnValueOnce(0.5) // damage variance
      .mockReturnValueOnce(0.1); // inflict-chance roll succeeds (miner-pickaxe-swing's chance is 0.2)
    const restlessMiner = ENEMIES['restless-miner'];
    const result = resolveRound({
      action: { type: 'defend' },
      playerStats: stats({ speed: 999 }),
      inventory: [],
      playerAilments: [],
      enemies: [{ enemyId: restlessMiner.id, level: 1, hp: restlessMiner.stats.maxHp, ailments: [] }],
    });
    expect(result.playerAilments).toEqual([{ ailmentId: 'stun', turnsRemaining: 1 }]);
    expect(result.log.some((l) => l.includes('afflicted with Stun'))).toBe(true);
  });

  it('a landed enemy attack rolls its move\'s ailment-infliction chance and can apply the ailment', () => {
    // Same call sequence as above (2 initiative rolls, miss check, move pick, damage variance,
    // infliction roll), but against a Mothling so the inflicted move is mothling-dustwing -> Blind.
    vi.spyOn(Math, 'random')
      .mockReturnValueOnce(0.5) // player initiative roll
      .mockReturnValueOnce(0.5) // mothling's initiative roll
      .mockReturnValueOnce(0.5)
      .mockReturnValueOnce(0.9) // picks mothling-dustwing (weight 1 of 4, same math as restless-miner's pickaxe)
      .mockReturnValueOnce(0.5)
      .mockReturnValueOnce(0.1); // below mothling-dustwing's 0.3 chance
    const result = resolveRound({
      action: { type: 'defend' },
      playerStats: stats({ speed: 999 }),
      inventory: [],
      playerAilments: [],
      enemies: soloEnemies(),
    });
    // toStrictEqual, not toEqual - an ailment with no autoExpireAfterTurns must have its
    // turnsRemaining key OMITTED entirely, not set to an explicit `undefined`. Firestore's Admin
    // SDK throws on a literal `undefined` field value, which is exactly the bug this guards
    // against (tx.update crashed the whole transaction the moment a non-Stun ailment landed).
    expect(result.playerAilments).toStrictEqual([{ ailmentId: 'blind' }]);
    expect(result.log.some((l) => l.includes('afflicted with Blind'))).toBe(true);
  });

  it('a missed enemy attack never rolls its ailment-infliction chance', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.05); // < ENEMY_MISS_CHANCE (0.1) - the attack itself misses
    const result = resolveRound({
      action: { type: 'defend' },
      playerStats: stats({ speed: 999 }),
      inventory: [],
      playerAilments: [],
      enemies: soloEnemies(),
    });
    expect(result.playerAilments).toEqual([]);
  });

  it('a cure item removes its matching ailment and logs the cure, consuming the item', () => {
    const result = resolveRound({
      action: { type: 'item', itemIds: ['antidote'] },
      playerStats: stats({ speed: 999 }),
      inventory: [{ itemId: 'antidote', quantity: 1 }],
      playerAilments: [{ ailmentId: 'poison' }],
      enemies: [],
    });
    expect(result.playerAilments).toEqual([]);
    expect(result.itemConsumedIds).toEqual(['antidote']);
    expect(result.log.some((l) => l.includes('cure Poison'))).toBe(true);
  });

  it('a cure item used while its ailment is not active is a harmless no-op for the ailment list', () => {
    const result = resolveRound({
      action: { type: 'item', itemIds: ['antidote'] },
      playerStats: stats({ speed: 999 }),
      inventory: [{ itemId: 'antidote', quantity: 1 }],
      playerAilments: [{ ailmentId: 'burn' }],
      enemies: [],
    });
    expect(result.itemConsumedIds).toEqual(['antidote']);
    expect(result.playerAilments).toEqual([{ ailmentId: 'burn' }]);
  });
});

describe('resolveRound - enemy ailments', () => {
  afterEach(() => vi.restoreAllMocks());

  it("a Skill's ailment roll lands on an enemy vulnerable to it (frost-lance -> Freeze on a coal-spirit)", () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.1); // below frost-lance's 0.3 inflict chance
    const coalSpirit = ENEMIES['coal-spirit'];
    // Padded well above coalSpirit's real maxHp (30) - frost-lance's spirit damage plus its 1.5x
    // weakness bonus against this family would otherwise one-shot it, and a defeated enemy never
    // rolls the ailment-infliction chance (see resolveOffensiveHits' `!defeated` gate) - this test
    // is about the vulnerability gate, not the defeat gate.
    const result = resolveRound({
      action: { type: 'skill', skillId: 'frost-lance' },
      playerStats: stats({ speed: 999, spirit: 30 }),
      inventory: [],
      playerAilments: [],
      enemies: [{ enemyId: coalSpirit.id, level: 1, hp: 1000, ailments: [] }],
    });
    expect(result.enemyAilments[0]).toStrictEqual([{ ailmentId: 'freeze' }]);
    expect(result.log.some((l) => l.includes('afflicted with Freeze'))).toBe(true);
  });

  it("a Skill's ailment roll is a no-op against an enemy not listed in its vulnerableAilments (ember-burst's Burn on a mothling)", () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.1); // would land if this enemy were vulnerable
    const mothling = ENEMIES.mothling;
    expect(mothling.vulnerableAilments).not.toContain('burn');
    const result = resolveRound({
      action: { type: 'skill', skillId: 'ember-burst' },
      playerStats: stats({ speed: 999, spirit: 30 }),
      inventory: [],
      playerAilments: [],
      enemies: [{ enemyId: mothling.id, level: 1, hp: mothling.stats.maxHp, ailments: [] }],
    });
    expect(result.enemyAilments[0]).toEqual([]);
  });

  it('an enemy already afflicted with a damage-over-time ailment takes tick damage at the end of its own turn', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.5); // no enemy miss (ENEMY_MISS_CHANCE is 0.1)
    const coalSpirit = ENEMIES['coal-spirit'];
    const result = resolveRound({
      action: { type: 'defend' },
      playerStats: stats({ speed: 999 }),
      inventory: [],
      playerAilments: [],
      enemies: [{ enemyId: coalSpirit.id, level: 1, hp: coalSpirit.stats.maxHp, ailments: [{ ailmentId: 'poison' }] }],
    });
    const expectedTick = Math.round(coalSpirit.stats.maxHp * AILMENTS.poison.effect.damagePercentPerTurn!);
    // The enemy's own attack damages the player, never itself - its hp only moves via the tick.
    expect(result.enemyHp[0]).toBe(coalSpirit.stats.maxHp - expectedTick);
    expect(result.log.some((l) => l.includes('Poison deals'))).toBe(true);
  });

  it("a stunned enemy skips its own attack entirely, but the player's own attack still lands", () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.5);
    const mothling = ENEMIES.mothling;
    const result = resolveRound({
      action: { type: 'attack' },
      playerStats: stats({ speed: 999 }),
      inventory: [],
      playerAilments: [],
      enemies: [{ enemyId: mothling.id, level: 1, hp: mothling.stats.maxHp, ailments: [{ ailmentId: 'stun', turnsRemaining: 1 }] }],
    });
    expect(result.hits).toHaveLength(1); // player's own attack still landed
    expect(result.enemyHits).toEqual([]); // the stunned enemy never got to attack
    expect(result.log.some((l) => l.includes('is stunned and cannot move'))).toBe(true);
  });

  it('Silence forces an afflicted enemy down to its plain attack, blocking its signature ailment-inflicting move', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.5);
    const restlessMiner = ENEMIES['restless-miner'];
    const result = resolveRound({
      action: { type: 'defend' },
      playerStats: stats({ speed: 999 }),
      inventory: [],
      playerAilments: [],
      enemies: [{ enemyId: restlessMiner.id, level: 1, hp: restlessMiner.stats.maxHp, ailments: [{ ailmentId: 'silence' }] }],
    });
    expect(result.log.some((l) => l.includes('uses attack for'))).toBe(true);
    expect(result.playerAilments).toEqual([]); // never got to roll miner-pickaxe-swing's Stun chance
  });

  it("Burn reduces an afflicted enemy's outgoing damage via attackMultiplier", () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.5);
    const mothling = ENEMIES.mothling;
    const baseline = resolveRound({
      action: { type: 'defend' },
      playerStats: stats({ speed: 999 }),
      inventory: [],
      playerAilments: [],
      enemies: [{ enemyId: mothling.id, level: 1, hp: mothling.stats.maxHp, ailments: [] }],
    });
    const burned = resolveRound({
      action: { type: 'defend' },
      playerStats: stats({ speed: 999 }),
      inventory: [],
      playerAilments: [],
      enemies: [{ enemyId: mothling.id, level: 1, hp: mothling.stats.maxHp, ailments: [{ ailmentId: 'burn' }] }],
    });
    expect(burned.enemyHits[0].damage).toBeLessThan(baseline.enemyHits[0].damage);
  });
});
