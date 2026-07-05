// Authoritative — the client's src/data/equipment.ts is a display copy only.

export type EquipmentSlot = 'weapon' | 'armor' | 'boots' | 'gloves' | 'charm' | 'lantern' | 'spiritTotem';
// Ascending order: Common < Uncommon < Rare < Mythic < Legendary. Per the canonical equipment
// design (docs/Mytherra-Equipment_breakdown.md) - Legendary is a named, story-tied artifact that
// ends its equipment family, ranked above Mythic.
export type Tier = 'common' | 'uncommon' | 'rare' | 'mythic' | 'legendary';

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
  /** Which equipment family this belongs to (e.g. 'walking-staff') - display/grouping only
   *  (a future "collection" view), not read by any equip mechanic. Per the canonical design,
   *  each region contributes exactly one family per slot, Common through Rare in this pass;
   *  Mythic/Legendary rows wait for the quest content that will grant them. */
  familyId?: string;
  /** Caps ownership at 1 and blocks a second copy from ever being granted - for milestone-only
   *  gear, not shop stock. */
  unique?: boolean;
  /** Lantern-slot only: how much Lantern Oil this lantern holds, and which Lantern Ability
   *  id(s) (see data/lanternAbilities.ts) it grants while equipped. A lantern can grant more than
   *  one; non-lantern equipment leaves both fields undefined. */
  oilCapacity?: number;
  lanternAbilityIds?: string[];
}

// Iron Mountains canonical equipment families (docs/Mytherra-Equipment_breakdown.md). Common
// through Rare only in this pass - Mythic/Legendary rows (Warden's Maul, Memorykeeper's Staff,
// Mountain Guardian Mail, Mantle of Enduring Stone, Spiritwalker/Echostep Boots, Warden's Grips/
// Hands of the First Keeper, Moon Witch Talisman/Heart of the Mountain, Coal Spirit/Mountain
// Guardian Totem) wait for the quest content that will grant them.
export const EQUIPMENT: Record<string, EquipmentDefinition> = {
  'weathered-walking-staff': {
    id: 'weathered-walking-staff',
    slot: 'weapon',
    statBonuses: { maxSpirit: 5, attack: 4 },
    tier: 'common',
    familyId: 'walking-staff',
  },
  'ironwood-walking-staff': {
    id: 'ironwood-walking-staff',
    slot: 'weapon',
    statBonuses: { maxSpirit: 3, attack: 7, speed: 1 },
    tier: 'uncommon',
    familyId: 'walking-staff',
  },
  'spiritwood-walking-staff': {
    id: 'spiritwood-walking-staff',
    slot: 'weapon',
    statBonuses: { maxHp: 10, attack: 10, defense: 2, speed: -2 },
    tier: 'rare',
    familyId: 'walking-staff',
  },
  'worn-keeper-coat': {
    id: 'worn-keeper-coat',
    slot: 'armor',
    statBonuses: { maxHp: 12, defense: 3 },
    tier: 'common',
    familyId: 'keeper-coat',
  },
  'reinforced-keeper-coat': {
    id: 'reinforced-keeper-coat',
    slot: 'armor',
    statBonuses: { maxHp: 18, defense: 5, speed: -1 },
    tier: 'uncommon',
    familyId: 'keeper-coat',
  },
  'veteran-keeper-coat': {
    id: 'veteran-keeper-coat',
    slot: 'armor',
    statBonuses: { maxHp: 20, maxSpirit: 8, defense: 7, speed: 1 },
    tier: 'rare',
    familyId: 'keeper-coat',
  },
  'traveler-boots': {
    id: 'traveler-boots',
    slot: 'boots',
    statBonuses: { defense: 1, speed: 2 },
    tier: 'common',
    familyId: 'traveler-boots',
  },
  'trail-boots': {
    id: 'trail-boots',
    slot: 'boots',
    statBonuses: { defense: 2, speed: 4 },
    tier: 'uncommon',
    familyId: 'traveler-boots',
  },
  'ranger-boots': {
    id: 'ranger-boots',
    slot: 'boots',
    statBonuses: { attack: 1, defense: 3, speed: 6 },
    tier: 'rare',
    familyId: 'traveler-boots',
  },
  'work-gloves': {
    id: 'work-gloves',
    slot: 'gloves',
    statBonuses: { attack: 1, defense: 1 },
    tier: 'common',
    familyId: 'work-gloves',
  },
  'leather-gauntlets': {
    id: 'leather-gauntlets',
    slot: 'gloves',
    statBonuses: { maxHp: 5, attack: 2, defense: 2 },
    tier: 'uncommon',
    familyId: 'work-gloves',
  },
  'keepers-gauntlets': {
    id: 'keepers-gauntlets',
    slot: 'gloves',
    statBonuses: { maxHp: 8, attack: 4, defense: 4 },
    tier: 'rare',
    familyId: 'work-gloves',
  },
  'river-stone-charm': {
    id: 'river-stone-charm',
    slot: 'charm',
    statBonuses: { maxHp: 5 },
    tier: 'common',
    familyId: 'mountain-charm',
  },
  'mountain-knot': {
    id: 'mountain-knot',
    slot: 'charm',
    statBonuses: { speed: 2 },
    tier: 'uncommon',
    familyId: 'mountain-charm',
  },
  'ghost-miners-coin': {
    id: 'ghost-miners-coin',
    slot: 'charm',
    statBonuses: { maxSpirit: 5 },
    tier: 'rare',
    familyId: 'mountain-charm',
  },
  'keepers-lantern': {
    id: 'keepers-lantern',
    slot: 'lantern',
    statBonuses: { maxSpirit: 5 },
    tier: 'legendary',
    oilCapacity: 20,
    lanternAbilityIds: ['lantern-flame'],
  },
  'miners-lost-lantern-equipped': {
    id: 'miners-lost-lantern-equipped',
    slot: 'lantern',
    statBonuses: { maxSpirit: 14, defense: 2 },
    tier: 'legendary',
    unique: true,
    oilCapacity: 35,
    lanternAbilityIds: ['steadfast-ember'],
  },
  'stone-wolf-totem': {
    id: 'stone-wolf-totem',
    slot: 'spiritTotem',
    statBonuses: { attack: 6 },
    tier: 'rare',
    familyId: 'mountain-spirits',
  },
};
