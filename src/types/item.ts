import type { EquipmentSlot, Stats } from './stats';

// 'materials' is for non-unique enemy-drop items with no usable effect of their own (moth dust,
// ember shard, etc.) - future crafting-system fodder. 'keyItem' is reserved for unique, story/
// quest-significant items (Guardian Sigil fragments, boss trophies) that a crafting system would
// never consume.
export type ItemCategory = 'consumable' | 'equipment' | 'keyItem' | 'lanternUpgrade' | 'materials';

/** Rarity/power tier shared by every inventory-eligible thing (consumables, key items, and
 *  equipment alike), in ascending order: Common < Uncommon < Rare < Mythic < Legendary. Mythic
 *  and Legendary are reserved for items tied to a specific milestone (major side quests/shrine
 *  restoration/Guardian blessings for Mythic; main story bosses/Guardian rewards/secret endgame
 *  content for Legendary - a named, story-tied artifact that ends its equipment family), never
 *  shop stock. Per the canonical equipment design (docs/Mytherra-Equipment_breakdown.md). */
export type Tier = 'common' | 'uncommon' | 'rare' | 'mythic' | 'legendary';

export interface ItemEffect {
  /** Fraction (0-1) of maxHp/maxSpirit to restore - percentage rather than a flat amount so a
   *  potion stays proportionally useful as those maxes grow with level. */
  healHpPercent?: number;
  healSpiritPercent?: number;
  reviveOnDefeat?: boolean;
  /** Fraction (0-1) of the equipped lantern's maxLanternOil to restore - percentage rather than a
   *  flat amount so the same item stays useful across lantern tiers. */
  restoreOilPercent?: number;
  /** Immediately removes this ailment (see AILMENTS in data/ailments.ts) if the player currently
   *  has it - a dedicated cure item (Antidote/Burn Salve/etc.), not layered onto a healing potion. */
  cureAilmentId?: string;
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
