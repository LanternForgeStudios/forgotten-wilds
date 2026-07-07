// Display copy only — functions/src/data/leveling.ts is authoritative for level-up resolution.

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
