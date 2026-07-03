import type { EquipmentSlot, Stats } from './stats';

export type ItemCategory = 'consumable' | 'equipment' | 'keyItem' | 'lanternUpgrade';

export interface ItemEffect {
  healHp?: number;
  healSpirit?: number;
  reviveOnDefeat?: boolean;
}

export interface Item {
  id: string;
  name: string;
  description: string;
  category: ItemCategory;
  iconAssetId: string;
  effect?: ItemEffect;
  stackable: boolean;
}

export interface EquipmentItem {
  id: string;
  name: string;
  description: string;
  slot: EquipmentSlot;
  iconAssetId: string;
  statBonuses: Partial<Stats>;
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
