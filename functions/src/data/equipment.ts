// Authoritative — the client's src/data/equipment.ts is a display copy only.

export type EquipmentSlot = 'weapon' | 'armor' | 'boots' | 'gloves' | 'charm' | 'lantern' | 'spiritTotem';
export type Tier = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary' | 'mythic';

export interface StatBonuses {
  maxHp?: number;
  maxSpirit?: number;
  attack?: number;
  defense?: number;
  speed?: number;
}

export interface EquipmentDefinition {
  id: string;
  slot: EquipmentSlot;
  statBonuses: StatBonuses;
  tier: Tier;
  /** Caps ownership at 1 and blocks a second copy from ever being granted - for milestone-only
   *  gear, not shop stock. */
  unique?: boolean;
  /** Lantern-slot only: how much Lantern Oil this lantern holds, and which Lantern Ability
   *  id(s) (see data/lanternAbilities.ts) it grants while equipped. A lantern can grant more than
   *  one; non-lantern equipment leaves both fields undefined. */
  oilCapacity?: number;
  lanternAbilityIds?: string[];
}

export const EQUIPMENT: Record<string, EquipmentDefinition> = {
  'miners-pick': { id: 'miners-pick', slot: 'weapon', statBonuses: { attack: 4 }, tier: 'common' },
  'keepers-lantern-staff': {
    id: 'keepers-lantern-staff',
    slot: 'weapon',
    statBonuses: { attack: 8, speed: 1 },
    tier: 'uncommon',
  },
  'travelers-coat': { id: 'travelers-coat', slot: 'armor', statBonuses: { defense: 4 }, tier: 'common' },
  'ironwood-vest': {
    id: 'ironwood-vest',
    slot: 'armor',
    statBonuses: { defense: 8, maxHp: 10 },
    tier: 'uncommon',
  },
  'worn-trail-boots': { id: 'worn-trail-boots', slot: 'boots', statBonuses: { speed: 2 }, tier: 'common' },
  'ridge-runner-boots': { id: 'ridge-runner-boots', slot: 'boots', statBonuses: { speed: 5 }, tier: 'uncommon' },
  'frayed-gloves': { id: 'frayed-gloves', slot: 'gloves', statBonuses: { attack: 2 }, tier: 'common' },
  'miners-leather-gloves': {
    id: 'miners-leather-gloves',
    slot: 'gloves',
    statBonuses: { attack: 5, defense: 1 },
    tier: 'uncommon',
  },
  'ash-hallow-token': { id: 'ash-hallow-token', slot: 'charm', statBonuses: { maxSpirit: 8 }, tier: 'common' },
  'warding-charm': {
    id: 'warding-charm',
    slot: 'charm',
    statBonuses: { maxSpirit: 10, defense: 3 },
    tier: 'uncommon',
  },
  'moonlit-charm': { id: 'moonlit-charm', slot: 'charm', statBonuses: { maxSpirit: 16 }, tier: 'rare' },
  'keepers-lantern': {
    id: 'keepers-lantern',
    slot: 'lantern',
    statBonuses: { maxSpirit: 5 },
    tier: 'common',
    oilCapacity: 20,
    lanternAbilityIds: ['lantern-flame'],
  },
  'miners-lost-lantern-equipped': {
    id: 'miners-lost-lantern-equipped',
    slot: 'lantern',
    statBonuses: { maxSpirit: 14, defense: 2 },
    tier: 'rare',
    unique: true,
    oilCapacity: 35,
    lanternAbilityIds: ['steadfast-ember'],
  },
  'carved-totem': {
    id: 'carved-totem',
    slot: 'spiritTotem',
    statBonuses: { attack: 1, defense: 1 },
    tier: 'common',
  },
  'emberwood-totem': {
    id: 'emberwood-totem',
    slot: 'spiritTotem',
    statBonuses: { attack: 3, speed: 2 },
    tier: 'uncommon',
  },
};
