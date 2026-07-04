import { ITEMS, EQUIPMENT, SHOP_LISTINGS } from '@/data';
import type { Tier } from '@/types';

// Display copy only — functions/src/engine/pricingEngine.ts is authoritative for sellItem.
const TIER_FALLBACK_SELL_VALUE: Record<Tier, number> = {
  common: 15,
  uncommon: 30,
  rare: 60,
  epic: 120,
  legendary: 250,
  mythic: 500,
};

/** Display-only estimate of what the shop will pay for one unit of an item - undefined if it
 *  can't be sold at all (unknown id, or a unique one-of-a-kind item). Mirrors the server's
 *  pricingEngine.sellPriceFor; the actual gold change always comes from sellItem's response. */
export function sellPriceFor(itemId: string): number | undefined {
  const itemDef = ITEMS.find((i) => i.id === itemId);
  const equipDef = EQUIPMENT.find((e) => e.id === itemId);
  if (!itemDef && !equipDef) return undefined;
  if (itemDef?.unique || equipDef?.unique) return undefined;

  const listing = SHOP_LISTINGS.find((l) => l.itemId === itemId);
  if (listing) return Math.max(1, Math.floor(listing.price / 2));

  const tier = itemDef?.tier ?? equipDef?.tier;
  return tier ? TIER_FALLBACK_SELL_VALUE[tier] : undefined;
}
