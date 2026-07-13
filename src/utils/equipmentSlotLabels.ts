import type { EquipmentSlot } from '@/types';

/** Display label per equipment slot - was hand-copied identically in CharacterMenu.tsx,
 *  CharacterStats.tsx, and Shop.tsx; consolidated here so a 4th copy (TradeOfferPanel.tsx) wasn't
 *  needed and future edits don't have to touch N files to stay in sync. */
export const SLOT_LABELS: Record<EquipmentSlot, string> = {
  weapon: 'Weapon',
  armor: 'Armor',
  boots: 'Boots',
  gloves: 'Gloves',
  charm: 'Charm',
  lantern: 'Lantern',
  spiritTotem: 'Spirit Totem',
};
