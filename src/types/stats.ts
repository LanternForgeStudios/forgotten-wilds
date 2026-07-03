export interface Stats {
  hp: number;
  maxHp: number;
  spirit: number;
  maxSpirit: number;
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
