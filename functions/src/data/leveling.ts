// Authoritative — the client's src/data/leveling.ts is a display copy only.

export const XP_THRESHOLDS: number[] = [0, 0, 40, 100, 180, 280, 400, 540, 700, 880, 1080];

// Reflects a fresh character with the default starting equipment already on (the keepers-lantern
// equipped by createCharacter.ts) - maxSpirit/maxLanternOil here already include its bonuses,
// since character creation sets equipment directly rather than going through equipItem.
export const STARTING_STATS = {
  hp: 60,
  maxHp: 60,
  spirit: 30,
  maxSpirit: 30,
  lanternOil: 20,
  maxLanternOil: 20,
  // Locked at 0/0 until the Guardian of Ironwood quest chain unlocks Dash - see interactWithShrine.ts.
  stamina: 0,
  maxStamina: 0,
  attack: 8,
  defense: 5,
  speed: 6,
};

/** Base Stamina capacity granted the moment it's unlocked, before any per-level growth below is
 *  added in for players who are already past level 1 when they finish the quest chain. */
export const BASE_STAMINA_ON_UNLOCK = 40;

export const STAT_GROWTH_PER_LEVEL = {
  maxHp: 8,
  maxSpirit: 4,
  maxStamina: 5,
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
