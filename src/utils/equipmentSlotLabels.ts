import { QUESTS } from '@/data';
import type { EquipmentSlot, QuestProgress } from '@/types';

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
  charm2: 'Charm II',
  charm3: 'Charm III',
  charm4: 'Charm IV',
  spiritTotem2: 'Spirit Totem II',
  spiritTotem3: 'Spirit Totem III',
  spiritTotem4: 'Spirit Totem IV',
};

/** Order matches how the slot-type filter is meant to read left to right when narrowing an
 *  equipment list (CharacterMenu's Inventory tab, Shop, TradeOfferPanel) - was hand-copied
 *  identically in all three, consolidated here for the same reason as SLOT_LABELS above. Not the
 *  same order as EQUIPMENT_SLOTS's own equip-tab display order. */
export const SLOT_FILTER_ORDER: EquipmentSlot[] = ['chest', 'legs', 'weapon', 'boots', 'gloves', 'lantern', 'charm', 'spiritTotem'];

/** Which of the 4 slots a Charm/Spirit Totem item can occupy - mirrors
 *  functions/src/engine/equipmentEngine.ts's CHARM_SLOTS/TOTEM_SLOTS. Used by CharacterMenu.tsx to
 *  treat all 4 charm rows (and all 4 totem rows) as one family when deciding which owned items are
 *  "eligible" for a given slot row, and to pick a sensible default target slot for a one-click
 *  "Equip" from the Inventory tab. */
export const CHARM_SLOTS: EquipmentSlot[] = ['charm', 'charm2', 'charm3', 'charm4'];
export const TOTEM_SLOTS: EquipmentSlot[] = ['spiritTotem', 'spiritTotem2', 'spiritTotem3', 'spiritTotem4'];

/** The slot family a given slot belongs to (itself, for charm/charm2-4, spiritTotem/spiritTotem2-4;
 *  the family's own 4-member array for a lookup by any of its own members). */
export function slotFamily(slot: EquipmentSlot): EquipmentSlot[] {
  if (CHARM_SLOTS.includes(slot)) return CHARM_SLOTS;
  if (TOTEM_SLOTS.includes(slot)) return TOTEM_SLOTS;
  return [slot];
}

/** Which quest's completion unlocks a given equipment slot - derived from QUESTS' own
 *  reward.grantsEquipmentSlot field rather than a second hand-maintained table, mirroring
 *  functions/src/functions/equipItem.ts's own SLOT_UNLOCK_QUEST_ID derivation server-side, so this
 *  can't silently drift from the quest data that's actually authoritative. A slot with no entry
 *  here is always unlocked. Originally local to CharacterMenu.tsx; consolidated here so Shop.tsx's
 *  own "is this a genuine upgrade" check (isEquipmentUpgrade) can share it instead of treating a
 *  locked, empty charm2-4/spiritTotem2-4 slot as an open upgrade opportunity. */
export const SLOT_UNLOCK_QUEST_ID: Partial<Record<EquipmentSlot, string>> = (() => {
  const map: Partial<Record<EquipmentSlot, string>> = {};
  for (const quest of QUESTS) {
    if (quest.reward.grantsEquipmentSlot) map[quest.reward.grantsEquipmentSlot] = quest.id;
  }
  return map;
})();

/** Whether `slot` is currently equippable - always true for a slot with no unlock quest, else only
 *  once that quest is completed. */
export function isSlotUnlocked(slot: EquipmentSlot, questProgress: Record<string, QuestProgress>): boolean {
  const questId = SLOT_UNLOCK_QUEST_ID[slot];
  return !questId || questProgress[questId]?.status === 'completed';
}
