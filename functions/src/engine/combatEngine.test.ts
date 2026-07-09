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
    expect(mothlingAt25).toEqual({ maxHp: 412, attack: 79, defense: 51, speed: 57 });
    expect(bossAt25).toEqual({ maxHp: 1292, attack: 229, defense: 152, speed: 152 });
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
    return [{ enemyId: mothling.id, level, hp }];
  }

  it('deals damage on attack and reduces enemy hp', () => {
    const result = resolveRound({
      action: { type: 'attack' },
      playerStats: stats({ speed: 999 }), // guarantee player acts first, deterministic ordering
      inventory: [],
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
      enemies: [
        { enemyId: mothling.id, level: 1, hp: mothling.stats.maxHp },
        { enemyId: mothling.id, level: 1, hp: mothling.stats.maxHp },
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
      enemies: [
        { enemyId: mothling.id, level: 1, hp: 0 },
        { enemyId: mothling.id, level: 1, hp: mothling.stats.maxHp },
      ],
    });
    expect(result.enemyHp[1]).toBeLessThan(mothling.stats.maxHp);
  });

  it('every alive enemy still gets a turn even though the player can only target one', () => {
    const result = resolveRound({
      action: { type: 'attack', targetIndex: 0 },
      playerStats: stats({ speed: -999, hp: 999, maxHp: 999 }), // enemies act first, deterministic
      inventory: [],
      enemies: [
        { enemyId: mothling.id, level: 1, hp: mothling.stats.maxHp },
        { enemyId: mothling.id, level: 1, hp: mothling.stats.maxHp },
        { enemyId: mothling.id, level: 1, hp: mothling.stats.maxHp },
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
      enemies: [
        { enemyId: mothling.id, level: 1, hp: 0 },
        { enemyId: mothling.id, level: 1, hp: 1 },
      ],
    });
    expect(almostDone.phase).toBe('victory');
    expect(almostDone.enemyHp.every((hp) => hp <= 0)).toBe(true);

    const notYet = resolveRound({
      action: { type: 'attack', targetIndex: 0 },
      playerStats: stats({ speed: 999, attack: 999 }),
      inventory: [],
      enemies: [
        { enemyId: mothling.id, level: 1, hp: mothling.stats.maxHp },
        { enemyId: mothling.id, level: 1, hp: mothling.stats.maxHp },
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
      enemies: soloEnemies(mothling.stats.maxHp, 1),
    });
    const level5 = resolveRound({
      action: { type: 'defend' },
      playerStats: stats({ speed: -999, hp: 999, maxHp: 999 }),
      inventory: [],
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
      enemies: soloEnemies(),
    });
    const attacking = resolveRound({
      action: { type: 'attack' },
      playerStats: stats({ speed: 999, hp: 999, maxHp: 999 }),
      inventory: [],
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
      enemies: soloEnemies(),
    });
    const attacking = resolveRound({
      action: { type: 'attack' },
      playerStats: stats({ speed: -999, hp: 999, maxHp: 999 }),
      inventory: [],
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
      enemies: [
        { enemyId: mothling.id, level: 20, hp: mothling.stats.maxHp },
        { enemyId: mothling.id, level: 20, hp: mothling.stats.maxHp },
      ],
    });
    const attacking = resolveRound({
      action: { type: 'attack', targetIndex: 0 },
      playerStats: stats({ speed: 999, hp: 999, maxHp: 999 }),
      inventory: [],
      enemies: [
        { enemyId: mothling.id, level: 20, hp: mothling.stats.maxHp },
        { enemyId: mothling.id, level: 20, hp: mothling.stats.maxHp },
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
      { enemyId: mothling.id, level: 20, hp: mothling.stats.maxHp },
      { enemyId: restlessMiner.id, level: 20, hp: restlessMiner.stats.maxHp },
    ];
    const defending = resolveRound({
      action: { type: 'defend' },
      playerStats: stats({ speed: 7, hp: 999, maxHp: 999 }), // between the two enemies' speeds
      inventory: [],
      enemies,
    });
    const attacking = resolveRound({
      action: { type: 'attack', targetIndex: 0 },
      playerStats: stats({ speed: 7, hp: 999, maxHp: 999 }),
      inventory: [],
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
      enemies: [{ enemyId: coalSpirit.id, level: 1, hp: coalSpirit.stats.maxHp }],
    });
    expect(result.playerLanternOil).toBeLessThan(20);
    expect(result.enemyHp[0]).toBeLessThan(coalSpirit.stats.maxHp);
  });

  it('a healing lantern ability restores hp and costs oil, with no target needed', () => {
    const result = resolveRound({
      action: { type: 'lanternAbility', abilityId: 'steadfast-ember' },
      playerStats: stats({ speed: 999, hp: 10 }),
      inventory: [],
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
      enemies: soloEnemies(),
    });
    const bigTank = resolveRound({
      action: { type: 'item', itemIds: ['lantern-oil'] },
      playerStats: stats({ speed: 999, lanternOil: 0, maxLanternOil: 35 }),
      inventory: [{ itemId: 'lantern-oil', quantity: 1 }],
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
      enemies: soloEnemies(),
    });
    const highMaxHp = resolveRound({
      action: { type: 'item', itemIds: ['healing-poultice'] },
      playerStats: stats({ hp: 1, maxHp: 852, speed: 999, defense: 9999 }),
      inventory: [{ itemId: 'healing-poultice', quantity: 1 }],
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
      enemies: [{ enemyId: mothling.id, level: 1, hp: mothling.stats.maxHp }],
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
        enemies: soloEnemies(),
      });
      const single = resolveRound({
        action: { type: 'item', itemIds: ['healing-poultice'] },
        playerStats: stats({ hp: 10, maxHp: 60, speed: 999 }),
        inventory: [{ itemId: 'healing-poultice', quantity: 1 }],
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
        { enemyId: mothling.id, level: 1, hp: mothling.stats.maxHp },
        { enemyId: mothling.id, level: 1, hp: mothling.stats.maxHp },
        { enemyId: mothling.id, level: 1, hp: mothling.stats.maxHp },
      ];
    }

    it('hits every alive enemy, with damage exactly when not missed', () => {
      let missCount = 0;
      for (let i = 0; i < 50; i++) {
        const result = resolveRound({
          action: { type: 'attack', targetAll: true },
          playerStats: stats({ speed: 999 }),
          inventory: [],
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
        enemies: threeMothlings(),
      });
      const singleResult = resolveRound({
        action: { type: 'attack', targetIndex: 0 },
        playerStats: stats({ speed: 999 }),
        inventory: [],
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
        enemies: soloEnemies(),
      });
      const singleResult = resolveRound({
        action: { type: 'attack' },
        playerStats: stats({ speed: 999 }),
        inventory: [],
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
          enemies: [{ enemyId: mothling.id, level: enemyLevel, hp: 999999 }], // isolate from enemy maxHp too
        });
        vi.restoreAllMocks();

        const actualDmgToEnemy = 999999 - result.enemyHp[0];
        const actualDmgToPlayer = 999 - result.playerHp;
        expect(actualDmgToEnemy).toBe(dmgToEnemy);
        expect(actualDmgToPlayer).toBe(dmgToPlayer);

        // No one-shots, no unwinnable grind, at any checkpoint including the level cap.
        // 16/8 mirror ENEMY_STAT_GROWTH_PER_LEVEL.maxHp / STAT_GROWTH_PER_LEVEL.maxHp.
        const enemyMaxHp = mothling.stats.maxHp + 16 * (enemyLevel - 1);
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

  describe('naively single-targeting a 3-enemy group is a genuine, drawn-out loss', () => {
    // Real (non-999-speed) player stats built the same way applyLevelUp would - deliberately not
    // forcing speed:999, since real turn order (enemies are consistently a bit faster than the
    // player at every checkpoint) is exactly what makes a group fight dangerous and must be
    // exercised here, not bypassed. A real 3-mothling roster (real maxHp, not the 999999 isolation
    // trick used above) so HP pools actually deplete over multiple rounds. Simulates the whole
    // fight by looping resolveRound, single-targeting whichever enemy is still alive first (the
    // default/simplest play pattern), until a terminal phase.
    //
    // CROWD_DAMAGE_FACTOR was deliberately raised (playtest-driven, see git history) past the
    // point where this stays winnable - single-targeting one enemy at a time while all 3 attack
    // back every round is now a losing strategy at every level checkpoint, by design: a 3+ enemy
    // pack is meant to force smarter play (target-all, items, fleeing, or simply avoiding the
    // fight) rather than being safely tankable via "attack the same guy every turn." What this
    // test still guards against is a *stomp* - the fight should take real, escalating attrition
    // (many rounds, meaningful damage dealt both ways) to lose, not end in the first round or two.
    it.each([10, 25, 50, 75, 100])('player level %i vs a real 3-mothling group: a real fight, ultimately lost', (playerLevel) => {
      vi.spyOn(Math, 'random').mockReturnValue(0.5);
      const playerMaxHp = 60 + 8 * (playerLevel - 1);
      let playerHp = playerMaxHp;
      const playerStats = stats({
        attack: 8 + 2 * (playerLevel - 1),
        defense: 5 + (playerLevel - 1),
        speed: 6 + (playerLevel - 1),
      });
      const enemyLevel = Math.max(1, Math.round(playerLevel / 2));
      let enemies = [
        { enemyId: mothling.id, level: enemyLevel, hp: mothling.stats.maxHp + 16 * (enemyLevel - 1) },
        { enemyId: mothling.id, level: enemyLevel, hp: mothling.stats.maxHp + 16 * (enemyLevel - 1) },
        { enemyId: mothling.id, level: enemyLevel, hp: mothling.stats.maxHp + 16 * (enemyLevel - 1) },
      ];

      let phase: string = 'continue';
      let rounds = 0;
      while (phase === 'continue' && rounds < 200) {
        const targetIndex = enemies.findIndex((e) => e.hp > 0);
        const result = resolveRound({
          action: { type: 'attack', targetIndex },
          playerStats: { ...playerStats, hp: playerHp, maxHp: playerMaxHp },
          inventory: [],
          enemies,
        });
        playerHp = result.playerHp;
        enemies = enemies.map((e, i) => ({ ...e, hp: result.enemyHp[i] }));
        phase = result.phase;
        rounds++;
      }
      vi.restoreAllMocks();

      expect(phase).toBe('defeat');
      // Not a stomp: at every checkpoint this takes well over a dozen rounds of real attrition
      // (verified by hand: 15-33 rounds across these 5 levels) before the player actually falls -
      // a naive single-target strategy against a 3-enemy pack should read as "you fought hard and
      // lost," not "you were wiped in the opening exchange."
      expect(rounds).toBeGreaterThanOrEqual(10);
    });
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
      { enemyId: mothling.id, level: 1, hp: mothling.stats.maxHp },
      { enemyId: mothling.id, level: 1, hp: mothling.stats.maxHp },
      { enemyId: mothling.id, level: 1, hp: mothling.stats.maxHp },
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
      enemies: threeMothlings(),
    });
    const attacking = resolveRound({
      action: { type: 'attack', targetIndex: 0 },
      playerStats: stats({ speed: -999, hp: 999, maxHp: 999 }),
      inventory: [],
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
      enemies: [{ enemyId: mothling.id, level: 1, hp: mothling.stats.maxHp }],
    });
    const attacking = resolveRound({
      action: { type: 'attack' },
      playerStats: stats({ speed: -999, hp: 999, maxHp: 999 }),
      inventory: [],
      enemies: [{ enemyId: mothling.id, level: 1, hp: mothling.stats.maxHp }],
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
      enemies: [{ enemyId: mothling.id, level: 1, hp: mothling.stats.maxHp }],
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
      enemies: [{ enemyId: mothling.id, level: 1, hp: mothling.stats.maxHp }],
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
      enemies: [{ enemyId: boss.id, level: 1, hp: boss.stats.maxHp }],
    });
    const bossWithAdds = resolveRound({
      action: { type: 'defend' },
      playerStats: stats({ speed: -999, hp: 9999, maxHp: 9999 }),
      inventory: [],
      enemies: [
        { enemyId: boss.id, level: 1, hp: boss.stats.maxHp },
        { enemyId: mothling.id, level: 1, hp: mothling.stats.maxHp },
        { enemyId: mothling.id, level: 1, hp: mothling.stats.maxHp },
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
      enemies: threeMothlings(),
    });
    expect(failedFlee.phase).toBe('continue');
    expect(failedFlee.enemyHits).toHaveLength(3);
    expect(failedFlee.enemyHits.map((h) => h.attackerIndex).sort()).toEqual([0, 1, 2]);
  });
});
