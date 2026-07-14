import { ITEMS } from '../data/items';
import { EQUIPMENT } from '../data/equipment';
import { grantItem, isItemEquipped } from './inventoryEngine';
import type { InventoryItem, PlayerEquipment, PlayerSave, TradeOfferSide } from '../shared-types';

export interface TradeItemRequest {
  itemId: string;
  quantity: number;
}

/** Consolidates any duplicate itemId entries in a raw trade-offer request (summing quantities) so
 *  validation/escrow always deals with exactly one entry per itemId - defensive against a
 *  malformed request listing the same item twice. Trade offers are already `{itemId, quantity}`
 *  pairs (not a flat repeated-id list like combat's item-use requests), so this isn't the same
 *  job as combatEngine.ts's aggregateItemCounts and doesn't reuse it. */
export function mergeTradeItemRequests(items: TradeItemRequest[]): TradeItemRequest[] {
  const merged = new Map<string, number>();
  for (const { itemId, quantity } of items) {
    merged.set(itemId, (merged.get(itemId) ?? 0) + quantity);
  }
  return Array.from(merged, ([itemId, quantity]) => ({ itemId, quantity }));
}

export interface TradeValidationResult {
  ok: boolean;
  message?: string;
}

/** Validates a proposed/countered trade offer's items against the offering player's current
 *  inventory and equipment - reused by both proposeTrade and respondToTradeOffer's counter path.
 *  Rejects any unique item outright (so a unique item can never enter offer.items in the first
 *  place - see escrowOffer/mergeOfferInto's own doc comments for why that matters), any
 *  currently-equipped item (mirrors sellItem.ts's "unequip before selling" rule), and any
 *  quantity the player doesn't actually have enough of. Does not check gold - callers do
 *  `gold <= save.player.gold` inline, a one-line check not worth its own function. */
export function validateTradeOfferItems(
  items: TradeItemRequest[],
  inventory: InventoryItem[],
  equipment: PlayerEquipment,
): TradeValidationResult {
  for (const { itemId, quantity } of items) {
    if (!Number.isFinite(quantity) || !Number.isInteger(quantity) || quantity < 1) {
      return { ok: false, message: 'Invalid item quantity.' };
    }
    if (ITEMS[itemId]?.unique || EQUIPMENT[itemId]?.unique) {
      return { ok: false, message: 'Unique items cannot be traded.' };
    }
    if (isItemEquipped(equipment, itemId)) {
      return { ok: false, message: 'Unequip that item before offering it in a trade.' };
    }
    const owned = inventory.find((i) => i.itemId === itemId)?.quantity ?? 0;
    if (owned < quantity) {
      return { ok: false, message: 'You do not own enough of that item.' };
    }
  }
  return { ok: true };
}

/** Physically removes an already-validated offer's items/gold from `save` - the escrow itself.
 *  Only ever called after validateTradeOfferItems (+ an inline `gold <= save.player.gold` check)
 *  both pass, and only ever with a merged (mergeTradeItemRequests) item list, so each itemId
 *  appears at most once. This is what makes an escrowed item unusable elsewhere - it is, at this
 *  point, simply absent from the offering player's own save. */
export function escrowOffer(save: PlayerSave, offer: TradeOfferSide): void {
  for (const { itemId, quantity } of offer.items) {
    const entry = save.inventory.find((i) => i.itemId === itemId);
    if (entry) entry.quantity -= quantity;
  }
  save.inventory = save.inventory.filter((i) => i.quantity > 0);
  save.player.gold -= offer.gold;
}

/** Returns an escrowed offer to the same player who offered it - decline, reject, and cancel all
 *  end here. Since validateTradeOfferItems already rejects unique items outright before an offer
 *  is ever escrowed, offer.items can never actually contain one - this can't fail. */
export function releaseOffer(save: PlayerSave, offer: TradeOfferSide): void {
  for (const { itemId, quantity } of offer.items) {
    grantItem(save, itemId, quantity);
  }
  save.player.gold += offer.gold;
}

/** Grants the *other* side's escrowed offer on a completed trade (finalizeTrade's accept path) -
 *  same merge as releaseOffer, kept as a separate function purely so call sites read as "give me
 *  what they offered" rather than "give them back what they offered." Goes through grantItem's
 *  unique-cap check as defense-in-depth: since offer.items can never contain a unique item (see
 *  above), the only way this could ever matter is a content hot-fix marking an item unique after
 *  it was offered - astronomically unlikely, but grantItem already does this check for free. */
export function mergeOfferInto(save: PlayerSave, offer: TradeOfferSide): void {
  for (const { itemId, quantity } of offer.items) {
    grantItem(save, itemId, quantity);
  }
  save.player.gold += offer.gold;
}
