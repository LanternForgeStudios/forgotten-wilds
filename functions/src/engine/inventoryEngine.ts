import { ITEMS } from '../data/items';
import { EQUIPMENT } from '../data/equipment';
import type { ItemEffect } from '../data/items';
import type { ActiveAilment, InventoryItem, PlayerEquipment, PlayerSave, Stats } from '../shared-types';

/** Whether an item is currently equipped in any slot - shared by sellItem.ts (can't sell something
 *  you're wearing) and tradeEngine.ts's validateTradeOfferItems (can't offer it in a trade either),
 *  so both enforce the exact same "unequip first" rule via one implementation. */
export function isItemEquipped(equipment: PlayerEquipment, itemId: string): boolean {
  return Object.values(equipment).includes(itemId);
}

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
 * the first time it's ever granted - both real ITEMS-table entries and EQUIPMENT-table entries,
 * so equipment stays in the player's permanent Journal history even after it's sold/traded away
 * (the live Equipment tab only ever shows current holdings). Centralized here rather than at each
 * call site so a future new item-granting path can't forget the bookkeeping. Takes the whole
 * `save` (not just `inventory`) specifically so it can backfill `journal.itemsDiscovered` for an
 * existing player's save read from Firestore before this field existed - self-heals the first
 * time any such save passes through here, since `save` gets written back in the same transaction
 * that called this.
 */
export function grantItem(save: PlayerSave, itemId: string, quantity = 1): boolean {
  if (wouldDuplicateUnique(save.inventory, itemId)) return false;
  const entry = save.inventory.find((i) => i.itemId === itemId);
  if (entry) entry.quantity += quantity;
  else save.inventory.push({ itemId, quantity });
  if (!save.journal.itemsDiscovered) save.journal.itemsDiscovered = [];
  if ((ITEMS[itemId] || EQUIPMENT[itemId]) && !save.journal.itemsDiscovered.includes(itemId)) {
    save.journal.itemsDiscovered.push(itemId);
  }
  return true;
}

/** Removes `quantity` of `itemId` from `save.inventory` (dropping the entry entirely once it
 * hits zero) - grantItem's inverse, and the "consume an item" mutation shared by every call site
 * that debits inventory directly: selling, using, escrowing into a trade, and combat's per-turn
 * item consumption. No-ops if the item isn't present - callers that need a "do they have enough"
 * error message validate that themselves beforehand, since the right wording differs per call site.
 */
export function removeItem(save: PlayerSave, itemId: string, quantity = 1): void {
  const entry = save.inventory.find((i) => i.itemId === itemId);
  if (entry) entry.quantity -= quantity;
  save.inventory = save.inventory.filter((i) => i.quantity > 0);
}

/** Whether using an item with this effect would actually do anything right now - shared by
 * useItem.ts (free item use outside a combat round) and resolveCombatAction.ts (items queued
 * alongside a combat action), so "that would have no effect right now" means the same thing in
 * both places. `playerAilments` is only ever non-empty mid-combat; outside combat a cureAilmentId
 * item simply can never have an effect, which is correct - there's nothing to cure. */
export function itemWouldHaveEffect(effect: ItemEffect, stats: Stats, playerAilments: ActiveAilment[]): boolean {
  return (
    (!!effect.healHpPercent && stats.hp < stats.maxHp) ||
    (!!effect.healSpiritPercent && stats.spirit < stats.maxSpirit) ||
    (!!effect.restoreOilPercent && stats.lanternOil < stats.maxLanternOil) ||
    (!!effect.cureAilmentId && playerAilments.some((a) => a.ailmentId === effect.cureAilmentId))
  );
}
