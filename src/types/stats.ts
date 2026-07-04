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
  | 'armor'
  | 'boots'
  | 'gloves'
  | 'charm'
  | 'lantern'
  | 'spiritTotem';

export const EQUIPMENT_SLOTS: EquipmentSlot[] = [
  'weapon',
  'armor',
  'boots',
  'gloves',
  'charm',
  'lantern',
  'spiritTotem',
];

export type SpiritRank = 'Unawakened' | 'Attuned' | 'Resonant' | 'Warden';

export type ExplorerRank = 'Newcomer' | 'Wayfarer' | 'Pathfinder' | 'Keeper';
