// Display copy only — functions/src/data/leveling.ts is authoritative for level-up resolution.

import type { ExplorerRank } from '@/types';

export const MAX_LEVEL = 100;

// xpForLevel(L) = 10*L*(L+1) - 20 for L>=2 - the exact closed form of what used to be a hand-typed
// array. Index 0 unused, index 1 = level 1 (0 XP).
export const XP_THRESHOLDS: number[] = Array.from({ length: MAX_LEVEL + 1 }, (_, level) =>
  level < 2 ? 0 : 10 * level * (level + 1) - 20,
);

export const STARTING_STATS = {
  hp: 60,
  maxHp: 60,
  spirit: 30,
  maxSpirit: 30,
  lanternOil: 20,
  maxLanternOil: 20,
  // Locked at 0/0 until the Guardian of Ironwood quest chain unlocks Dash.
  stamina: 0,
  maxStamina: 0,
  attack: 8,
  defense: 5,
  speed: 6,
};

export const STAT_GROWTH_PER_LEVEL = {
  maxHp: 8,
  maxSpirit: 4,
  maxStamina: 5,
  attack: 2,
  defense: 1,
  speed: 1,
};

// 10 tiers of 10 levels each across the level-100 cap - reuses the 4 pre-existing ExplorerRank
// names (Newcomer/Wayfarer/Pathfinder/Keeper) in their natural early-game order and extends
// upward. Kept in sync by hand with functions/src/data/leveling.ts.
const EXPLORER_RANK_THRESHOLDS: { minLevel: number; rank: ExplorerRank }[] = [
  { minLevel: 91, rank: 'Legend of Mytherra' },
  { minLevel: 81, rank: 'Lantern Sage' },
  { minLevel: 71, rank: 'Deepwalker' },
  { minLevel: 61, rank: 'Wayshaper' },
  { minLevel: 51, rank: 'Keeper' },
  { minLevel: 41, rank: 'Ridgewalker' },
  { minLevel: 31, rank: 'Trailblazer' },
  { minLevel: 21, rank: 'Pathfinder' },
  { minLevel: 11, rank: 'Wayfarer' },
  { minLevel: 1, rank: 'Newcomer' },
];

export function explorerRankForLevel(level: number): ExplorerRank {
  return EXPLORER_RANK_THRESHOLDS.find((t) => level >= t.minLevel)!.rank;
}
