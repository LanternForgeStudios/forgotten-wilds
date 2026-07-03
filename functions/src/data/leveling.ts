// Authoritative — the client's src/data/leveling.ts is a display copy only.

export const XP_THRESHOLDS: number[] = [0, 0, 40, 100, 180, 280, 400, 540, 700, 880, 1080];

export const STARTING_STATS = {
  hp: 60,
  maxHp: 60,
  spirit: 30,
  maxSpirit: 30,
  attack: 8,
  defense: 5,
  speed: 6,
};

export const STAT_GROWTH_PER_LEVEL = {
  maxHp: 8,
  maxSpirit: 4,
  attack: 2,
  defense: 1,
  speed: 1,
};

export function levelForXp(xp: number): number {
  let level = 1;
  for (let i = 1; i < XP_THRESHOLDS.length; i++) {
    if (xp >= XP_THRESHOLDS[i]) level = i;
  }
  return level;
}
