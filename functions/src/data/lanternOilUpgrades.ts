/** Per-lantern gold-bought Lantern Oil capacity upgrades - gated behind defeating that lantern's
 *  own region's story boss (see LANTERN_OIL_UPGRADE_GATES), purchased at that region's General
 *  Store. Server-authoritative; src/data/lanternOilUpgrades.ts is the display-only client mirror
 *  (see CLAUDE.md's client/server data-split convention) - keep both in sync by hand. */

export const LANTERN_OIL_UPGRADE_PER_TIER = 15;
export const LANTERN_OIL_UPGRADE_MAX_TIER = 25;

/** Gold cost to buy tier N+1, indexed by the CURRENT tier (0-24) - i.e. going from tier 0 to tier
 *  1 costs LANTERN_OIL_UPGRADE_PRICES[0]. 25 entries, one per tier. Deliberately NOT a doubling
 *  curve (500g doubled 25 times would reach ~16.7 billion gold by the last tier) - instead a
 *  rounded-to-clean-numbers approximation of exponential growth from 500g (tier 1) to exactly
 *  1,000,000g (tier 25), so the ladder stays a meaningful long-term gold sink without becoming
 *  mathematically unreachable. Total cost to fully max one lantern: ~3,683,550g for +375 max Oil.
 */
export const LANTERN_OIL_UPGRADE_PRICES: number[] = [
  500, 700, 950, 1300, 1800, 2500, 3400, 4700, 6400, 8800, 12000, 16500, 22500, 31000, 42500, 58000, 80000, 110000, 150000, 205000,
  280000, 385000, 530000, 730000, 1000000,
];

/** Which boss must be defeated (journal.bossesDefeated) and which General Store sells the
 *  upgrade, per legendary lantern equipment id. Iron Mountains has two Legendary Lanterns
 *  (the starter keepers-lantern and the dungeon-found miners-lost-lantern-equipped) sharing one
 *  region/boss/shop - every other region has exactly one lantern. A lantern with no entry here
 *  (any non-Legendary lantern, if one is ever added) is simply never upgradeable. */
export const LANTERN_OIL_UPGRADE_GATES: Record<string, { bossId: string; shopId: string; regionName: string }> = {
  'keepers-lantern': { bossId: 'coalbound-warden', shopId: 'mara-ash-general-store', regionName: 'Iron Mountains' },
  'miners-lost-lantern-equipped': { bossId: 'coalbound-warden', shopId: 'mara-ash-general-store', regionName: 'Iron Mountains' },
  'lantern-of-still-waters-equipped': { bossId: 'ancient-serpent-guardian', shopId: 'remy-general-store', regionName: 'Crimson Bayou' },
  'lantern-of-open-skies-equipped': { bossId: 'great-thunderbird', shopId: 'wyatt-general-store', regionName: 'Endless Prairie' },
  'lantern-of-ancient-roots-equipped': { bossId: 'cedar-giant', shopId: 'byron-general-store', regionName: 'Whispering Pines' },
  'lantern-of-forgotten-stars-equipped': { bossId: 'canyon-giant', shopId: 'mateo-general-store', regionName: 'Shattered Desert' },
  'lantern-of-winters-resolve-equipped': { bossId: 'winter-stag', shopId: 'bjorn-general-store', regionName: 'Frozen Frontier' },
};
