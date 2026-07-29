import type { EquipmentSlot } from '@/types';

/** Display label per equipment slot - was hand-copied identically in CharacterMenu.tsx,
 *  CharacterStats.tsx, and Shop.tsx; consolidated here so a 4th copy (TradeOfferPanel.tsx) wasn't
 *  needed and future edits don't have to touch N files to stay in sync. */
export const SLOT_LABELS: Record<EquipmentSlot, string> = {
  weapon: 'Weapon',
  chest: 'Chest',
  legs: 'Legs',
  boots: 'Boots',
  gloves: 'Gloves',
  charm: 'Charm',
  lantern: 'Lantern',
  spiritTotem: 'Spirit Totem',
};

/** Order matches how the slot-type filter is meant to read left to right when narrowing an
 *  equipment list (CharacterMenu's Inventory tab, Shop, TradeOfferPanel) - was hand-copied
 *  identically in all three, consolidated here for the same reason as SLOT_LABELS above. Not the
 *  same order as EQUIPMENT_SLOTS's own equip-tab display order. */
export const SLOT_FILTER_ORDER: EquipmentSlot[] = ['chest', 'legs', 'weapon', 'boots', 'gloves', 'lantern', 'charm', 'spiritTotem'];
