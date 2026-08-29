import type { ItemCategory } from '@/types';

/** Display label for every real ItemCategory - previously hand-duplicated (with drift risk, though
 *  none had actually drifted yet) across CharacterMenu.tsx, TradeOfferPanel.tsx, Shop.tsx,
 *  JournalOfLegends.tsx, and common/ItemDetailPopup.tsx. A caller with its own extra cross-cutting
 *  buckets (e.g. CharacterMenu's Inventory tab also has 'all'/'unique', which aren't real
 *  categories) should build its own label record from these values rather than being forced into
 *  this exact key set. */
export const ITEM_CATEGORY_LABELS: Record<ItemCategory, string> = {
  consumable: 'Consumables',
  equipment: 'Equipment',
  keyItem: 'Key Items',
  lanternUpgrade: 'Lantern Upgrades',
  materials: 'Materials',
};

/** Resolves which category bucket an item/equipment pair falls into for a "type" filter dimension
 *  (Trade offer picker, Shop's Sell tab) - equipment has no `category` field of its own (a separate
 *  EQUIPMENT table from ITEMS), so this synthesizes 'equipment' for anything found there. Was
 *  duplicated verbatim as tradeTypeOf (TradeOfferPanel.tsx) and sellTypeOf (Shop.tsx). */
export function resolveItemCategory(itemDef: { category: ItemCategory } | undefined, equipDef: object | undefined): ItemCategory {
  if (equipDef) return 'equipment';
  return itemDef?.category ?? 'materials';
}
