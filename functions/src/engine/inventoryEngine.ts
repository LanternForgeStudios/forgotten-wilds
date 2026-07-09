import { ITEMS } from '../data/items';
import { EQUIPMENT } from '../data/equipment';
import type { InventoryItem } from '../shared-types';

/** Whether granting one more copy of this item would violate its `unique` cap - a one-of-a-kind
 *  trophy/relic (checked against both `ITEMS` and `EQUIPMENT`, since either table can mark an id
 *  unique) that must never be duplicated, regardless of which system is trying to grant it. */
export function wouldDuplicateUnique(inventory: InventoryItem[], itemId: string): boolean {
  const isUnique = !!(ITEMS[itemId]?.unique || EQUIPMENT[itemId]?.unique);
  if (!isUnique) return false;
  return inventory.some((i) => i.itemId === itemId);
}

/**
 * Adds `quantity` of `itemId` to `inventory` (stacking onto an existing entry, or pushing a new
 * one) - the "grant an item" mutation shared by shop purchases, chests, combat loot, quest
 * rewards, and trades, so the unique-item cap is enforced identically everywhere an item can be
 * granted. Returns `false` (and leaves `inventory` untouched) if this would duplicate a unique
 * item; the caller decides how to react - throw (a deliberate purchase), or silently skip
 * (loot/rewards, where duplicating isn't the player's fault and shouldn't surface as an error).
 *
 * Also records `itemId` into `itemsDiscovered` (the Journal's Items tab compendium) the first
 * time it's ever granted - only for real ITEMS-table entries, not equipment (EQUIPMENT[itemId]),
 * since equipment already has full coverage via the Equipment tab. Centralized here rather than
 * at each call site so a future new item-granting path can't forget the bookkeeping.
 */
export function grantItem(
  inventory: InventoryItem[],
  itemId: string,
  itemsDiscovered: string[],
  quantity = 1,
): boolean {
  if (wouldDuplicateUnique(inventory, itemId)) return false;
  const entry = inventory.find((i) => i.itemId === itemId);
  if (entry) entry.quantity += quantity;
  else inventory.push({ itemId, quantity });
  if (ITEMS[itemId] && !itemsDiscovered.includes(itemId)) itemsDiscovered.push(itemId);
  return true;
}
