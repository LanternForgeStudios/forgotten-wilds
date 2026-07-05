import { ITEMS, SHOP_PRICES } from '../data/items';
import { EQUIPMENT } from '../data/equipment';

/** Flat sell value for a tier when there's no shop buy price to halve - e.g. chest/quest-only
 *  equipment. Scales with tier so "can't be bought" doesn't mean "worthless." */
const TIER_FALLBACK_SELL_VALUE: Record<string, number> = {
  common: 15,
  uncommon: 30,
  rare: 60,
  mythic: 150,
  legendary: 300,
};

/**
 * What the shop pays for one unit of an item, or undefined if it can't be sold at all - either
 * the id is unknown, or it's a `unique` one-of-a-kind item/relic (those must never be given up
 * for gold, since the server refuses to ever grant a second copy of a unique item).
 *
 * Purchasable items sell for half their buy price (floor, minimum 1g). Items that were never for
 * sale (chest/quest-only gear, non-unique key items) get a flat value based on tier instead, since
 * there's no buy price to halve.
 */
export function sellPriceFor(itemId: string): number | undefined {
  const itemDef = ITEMS[itemId];
  const equipDef = EQUIPMENT[itemId];
  if (!itemDef && !equipDef) return undefined;
  if (itemDef?.unique || equipDef?.unique) return undefined;

  const buyPrice = SHOP_PRICES[itemId];
  if (buyPrice !== undefined) return Math.max(1, Math.floor(buyPrice / 2));

  const tier = itemDef?.tier ?? equipDef?.tier;
  return tier ? TIER_FALLBACK_SELL_VALUE[tier] : undefined;
}
