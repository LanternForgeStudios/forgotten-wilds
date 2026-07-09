import { ITEMS } from '../data/items';
import { EQUIPMENT } from '../data/equipment';
import type { InventoryItem, PlayerSave } from '../shared-types';

/** Whether granting one more copy of this item would violate its `unique` cap - a one-of-a-kind
 *  trophy/relic (checked against both `ITEMS` and `EQUIPMENT`, since either table can mark an id
 *  unique) that must never be duplicated, regardless of which system is trying to grant it. */
export function wouldDuplicateUnique(inventory: InventoryItem[], itemId: string): boolean {
  const isUnique = !!(ITEMS[itemId]?.unique || EQUIPMENT[itemId]?.unique);
  if (!isUnique) return false;
  return inventory.some((i) => i.itemId === itemId);
}

/**
 * Adds `quantity` of `itemId` to `save.inventory` (stacking onto an existing entry, or pushing a
 * new one) - the "grant an item" mutation shared by shop purchases, chests, combat loot, quest
 * rewards, and trades, so the unique-item cap is enforced identically everywhere an item can be
 * granted. Returns `false` (and leaves `save` untouched) if this would duplicate a unique item;
 * the caller decides how to react - throw (a deliberate purchase), or silently skip (loot/rewards,
 * where duplicating isn't the player's fault and shouldn't surface as an error).
 *
 * Also records `itemId` into `save.journal.itemsDiscovered` (the Journal's Items tab compendium)
 * the first time it's ever granted - only for real ITEMS-table entries, not equipment
 * (EQUIPMENT[itemId]), since equipment already has full coverage via the Equipment tab.
 * Centralized here rather than at each call site so a future new item-granting path can't forget
 * the bookkeeping. Takes the whole `save` (not just `inventory`) specifically so it can backfill
 * `journal.itemsDiscovered` for an existing player's save read from Firestore before this field
 * existed - self-heals the first time any such save passes through here, since `save` gets
 * written back in the same transaction that called this.
 */
export function grantItem(save: PlayerSave, itemId: string, quantity = 1): boolean {
  if (wouldDuplicateUnique(save.inventory, itemId)) return false;
  const entry = save.inventory.find((i) => i.itemId === itemId);
  if (entry) entry.quantity += quantity;
  else save.inventory.push({ itemId, quantity });
  if (!save.journal.itemsDiscovered) save.journal.itemsDiscovered = [];
  if (ITEMS[itemId] && !save.journal.itemsDiscovered.includes(itemId)) save.journal.itemsDiscovered.push(itemId);
  return true;
}
