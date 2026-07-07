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
    // regardless of damage variance or turn order.
    const result = resolveRound({
      action: { type: 'defend' },
      playerStats: stats({ hp: 1, maxHp: 60, speed: -999, defense: 0 }),
      inventory: [],
      enemies: [{ enemyId: mothling.id, level: 1, hp: mothling.stats.maxHp }],
    });
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

  describe('multi-enemy encounters stay winnable across the level cap', () => {
    // Real (non-999-speed) player stats built the same way applyLevelUp would - deliberately not
    // forcing speed:999, since real turn order (enemies are consistently a bit faster than the
    // player at every checkpoint) is exactly what makes a group fight dangerous and must be
    // exercised here, not bypassed. A real 3-mothling roster (real maxHp, not the 999999 isolation
    // trick used above) so HP pools actually deplete over multiple rounds. Simulates the whole
    // fight by looping resolveRound, single-targeting whichever enemy is still alive first (the
    // default/simplest play pattern), until a terminal phase - this is the actual gap the fix
    // needed to close (no earlier test constructed a real N-enemy roster and played out a full
    // multi-round fight against the player's real HP pool).
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

      expect(phase).toBe('victory');
      // Genuine risk, not a stomp and not a stall: the player should end the fight meaningfully
      // hurt (win with real attrition) but never lose outright.
      const remainingFraction = playerHp / playerMaxHp;
      expect(remainingFraction).toBeGreaterThan(0.05);
      expect(remainingFraction).toBeLessThan(0.4);
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

  it('grants the enemy xp/gold reward at level 1 (no scaling)', () => {
    const mothling = ENEMIES.mothling;
    const reward = computeRewards([{ enemyId: mothling.id, level: 1 }], 0, 1);
    expect(reward.xp).toBe(mothling.xpReward);
    expect(reward.gold).toBe(mothling.goldReward);
  });

  it('sums xp/gold across every defeated enemy in a group', () => {
    const mothling = ENEMIES.mothling;
    const reward = computeRewards(
      [
        { enemyId: mothling.id, level: 1 },
        { enemyId: mothling.id, level: 1 },
        { enemyId: mothling.id, level: 1 },
      ],
      0,
      1,
    );
    expect(reward.xp).toBe(mothling.xpReward * 3);
    expect(reward.gold).toBe(mothling.goldReward * 3);
  });

  it('scales xp/gold up for a higher-level roll of the same enemy', () => {
    const mothling = ENEMIES.mothling;
    const level1 = computeRewards([{ enemyId: mothling.id, level: 1 }], 0, 1);
    const level5 = computeRewards([{ enemyId: mothling.id, level: 5 }], 0, 1);
    expect(level5.xp).toBeGreaterThan(level1.xp);
    expect(level5.gold).toBeGreaterThan(level1.gold);
  });

  it('flags a level-up and computes stat growth when xp crosses a threshold', () => {
    const boss = ENEMIES['coalbound-warden'];
    const reward = computeRewards([{ enemyId: boss.id, level: 1 }], 30, 2); // 30 + 150 = 180 xp -> level 4
    expect(reward.leveledUp).toBe(true);
    expect(reward.newLevel).toBeGreaterThan(2);
    expect(reward.statGrowth.maxHp).toBeGreaterThan(0);
  });

  it('does not flag a level-up for a small xp gain', () => {
    const mothling = ENEMIES.mothling;
    const reward = computeRewards([{ enemyId: mothling.id, level: 1 }], 0, 1);
    expect(reward.leveledUp).toBe(false);
    expect(reward.statGrowth).toEqual({});
  });

  it('skipLoot suppresses the lootTable roll (e.g. a boss already defeated before) without touching xp/gold', () => {
    const boss = ENEMIES['coalbound-warden']; // lootTable: 100% chance of wardens-ember-heart
    const firstKill = computeRewards([{ enemyId: boss.id, level: 1, skipLoot: false }], 0, 1);
    const repeatKill = computeRewards([{ enemyId: boss.id, level: 1, skipLoot: true }], 0, 1);
    expect(firstKill.lootItemIds).toContain('wardens-ember-heart');
    expect(repeatKill.lootItemIds).not.toContain('wardens-ember-heart');
    expect(repeatKill.xp).toBe(firstKill.xp);
    expect(repeatKill.gold).toBe(firstKill.gold);
  });
});
