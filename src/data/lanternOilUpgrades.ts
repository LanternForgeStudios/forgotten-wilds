/** Display-only client mirror of functions/src/data/lanternOilUpgrades.ts - see that file's own
 *  doc comment for the full design reasoning. Keep both in sync by hand (see CLAUDE.md's
 *  client/server data-split convention); the server copy is what actually validates/charges gold. */

export const LANTERN_OIL_UPGRADE_PER_TIER = 15;
export const LANTERN_OIL_UPGRADE_MAX_TIER = 25;

export const LANTERN_OIL_UPGRADE_PRICES: number[] = [
  500, 700, 950, 1300, 1800, 2500, 3400, 4700, 6400, 8800, 12000, 16500, 22500, 31000, 42500, 58000, 80000, 110000, 150000, 205000,
  280000, 385000, 530000, 730000, 1000000,
];

export const LANTERN_OIL_UPGRADE_GATES: Record<string, { bossId: string; shopId: string; regionName: string }> = {
  'keepers-lantern': { bossId: 'coalbound-warden', shopId: 'mara-ash-general-store', regionName: 'Iron Mountains' },
  'miners-lost-lantern-equipped': { bossId: 'coalbound-warden', shopId: 'mara-ash-general-store', regionName: 'Iron Mountains' },
  'lantern-of-still-waters-equipped': { bossId: 'ancient-serpent-guardian', shopId: 'remy-general-store', regionName: 'Crimson Bayou' },
  'lantern-of-open-skies-equipped': { bossId: 'great-thunderbird', shopId: 'wyatt-general-store', regionName: 'Endless Prairie' },
  'lantern-of-ancient-roots-equipped': { bossId: 'cedar-giant', shopId: 'byron-general-store', regionName: 'Whispering Pines' },
  'lantern-of-forgotten-stars-equipped': { bossId: 'canyon-giant', shopId: 'mateo-general-store', regionName: 'Shattered Desert' },
  'lantern-of-winters-resolve-equipped': { bossId: 'winter-stag', shopId: 'bjorn-general-store', regionName: 'Frozen Frontier' },
};
