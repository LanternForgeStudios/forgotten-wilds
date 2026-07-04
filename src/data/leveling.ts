// Display copy only — functions/src/data/leveling.ts is authoritative for level-up resolution.

/** XP required to reach each level; index 0 unused, index 1 = level 1 (0 XP). */
export const XP_THRESHOLDS: number[] = [0, 0, 40, 100, 180, 280, 400, 540, 700, 880, 1080];

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
