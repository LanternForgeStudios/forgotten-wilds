export interface Stats {
  hp: number;
  maxHp: number;
  spirit: number;
  maxSpirit: number;
  /** Fuel for the equipped lantern's ability - capacity comes entirely from whichever lantern is
   *  equipped (see EquipmentItem.oilCapacity), same pattern as any other equipment-derived stat.
   *  0/0 with nothing equipped, since there's no lantern ability to fuel without one. */
  lanternOil: number;
  maxLanternOil: number;
  /** Powers Dash - unlike every other resource here, it regenerates on its own over real time
   *  rather than needing rest/items (see staminaUpdatedAt on Player). Stays 0/0 until the
   *  Guardian of Ironwood quest chain unlocks it, regardless of level. */
  stamina: number;
  maxStamina: number;
  attack: number;
  defense: number;
  speed: number;
}

export type EquipmentSlot =
  | 'weapon'
  | 'chest'
  | 'legs'
  | 'boots'
  | 'gloves'
  | 'charm'
  | 'lantern'
  | 'spiritTotem'
  // 3 additional Charm/Totem slots each, unlocked one at a time by a side quest - see
  // functions/src/shared-types/index.ts's matching field for the full design reasoning.
  | 'charm2'
  | 'charm3'
  | 'charm4'
  | 'spiritTotem2'
  | 'spiritTotem3'
  | 'spiritTotem4';

export const EQUIPMENT_SLOTS: EquipmentSlot[] = [
  'weapon',
  'chest',
  'legs',
  'boots',
  'gloves',
  'charm',
  'charm2',
  'charm3',
  'charm4',
  'lantern',
  'spiritTotem',
  'spiritTotem2',
  'spiritTotem3',
  'spiritTotem4',
];

export type SpiritRank = 'Unawakened' | 'Attuned' | 'Resonant' | 'Warden';

/** Awarded automatically from player level, in 10-level chunks across the level-100 cap - see
 *  explorerRankForLevel in data/leveling.ts for the exact level boundaries. */
export type ExplorerRank =
  | 'Newcomer'
  | 'Wayfarer'
  | 'Pathfinder'
  | 'Trailblazer'
  | 'Ridgewalker'
  | 'Keeper'
  | 'Wayshaper'
  | 'Deepwalker'
  | 'Lantern Sage'
  | 'Legend of Mytherra';

/** Awarded automatically from the player's regionalReputation total, in 5 tiers - see
 *  regionalReputationRankForTotal in data/leveling.ts for the exact thresholds. A pure display
 *  label over the existing single global regionalReputation counter, not a per-region tracker
 *  and not a gate on anything. */
export type RegionalReputationRank = 'Stranger' | 'Acquaintance' | 'Trusted Ally' | 'Honored Friend' | 'Living Legend of Mytherra';

/** Solo-combat-only difficulty preference - see functions/src/shared-types/index.ts's matching
 *  field for the full design reasoning (party/Endless Battle and PvP always resolve at
 *  'medium' regardless of this setting). */
export type Difficulty = 'easy' | 'medium' | 'hard';
