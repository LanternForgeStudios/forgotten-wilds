import type { EquipmentSlot, Stats } from './stats';

export type ItemCategory = 'consumable' | 'equipment' | 'keyItem' | 'lanternUpgrade';

/** Rarity/power tier shared by every inventory-eligible thing (consumables, key items, and
 *  equipment alike), in ascending order: Common < Uncommon < Rare < Mythic < Legendary. Mythic
 *  and Legendary are reserved for items tied to a specific milestone (major side quests/shrine
 *  restoration/Guardian blessings for Mythic; main story bosses/Guardian rewards/secret endgame
 *  content for Legendary - a named, story-tied artifact that ends its equipment family), never
 *  shop stock. Per the canonical equipment design (docs/Mytherra-Equipment_breakdown.md). */
export type Tier = 'common' | 'uncommon' | 'rare' | 'mythic' | 'legendary';

export interface ItemEffect {
  healHp?: number;
  healSpirit?: number;
  reviveOnDefeat?: boolean;
  /** Refills the equipped lantern's Oil, clamped to its capacity. Usable in and out of combat,
   *  same as the other consumable effects. */
  restoreOil?: number;
}

export interface Item {
  id: string;
  name: string;
  description: string;
  category: ItemCategory;
  iconAssetId: string;
  effect?: ItemEffect;
  stackable: boolean;
  tier: Tier;
  /** Caps ownership at 1 and blocks a second copy from ever being granted (loot, purchase, quest
   *  reward) - for one-of-a-kind trophies and quest relics, not regular stackable consumables. */
  unique?: boolean;
}

export interface EquipmentItem {
  id: string;
  name: string;
  description: string;
  slot: EquipmentSlot;
  iconAssetId: string;
  statBonuses: Partial<Stats>;
  tier: Tier;
  /** Which equipment family this belongs to (e.g. 'walking-staff') - display/grouping only, not
   *  read by any equip mechanic. See functions/src/data/equipment.ts for the full explanation. */
  familyId?: string;
  unique?: boolean;
  /** Lantern-slot only: how much Lantern Oil this lantern holds, and which Lantern Ability id(s)
   *  (src/data/lanternAbilities.ts) it grants while equipped. */
  oilCapacity?: number;
  lanternAbilityIds?: string[];
}

export interface InventoryItem {
  itemId: string;
  quantity: number;
}

export interface ShopListing {
  itemId: string;
  price: number;
  currency: 'gold';
}
