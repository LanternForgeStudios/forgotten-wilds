import { ITEMS, EQUIPMENT } from '@/data';

/** Resolves an itemId to its display name, checking both ITEMS and EQUIPMENT (either table can
 *  own an id) - shared by every place that names a loot/reward/trade item without already having
 *  its definition in hand. Falls back to a de-hyphenated id so an unrecognized itemId still
 *  renders as readable text instead of a raw slug. */
export function itemDisplayName(itemId: string): string {
  return EQUIPMENT.find((e) => e.id === itemId)?.name ?? ITEMS.find((i) => i.id === itemId)?.name ?? itemId.replace(/-/g, ' ');
}

/** Same "check both tables" lookup as itemDisplayName, for whichever table owns `itemId`'s icon. */
export function itemIconAssetId(itemId: string): string | undefined {
  return EQUIPMENT.find((e) => e.id === itemId)?.iconAssetId ?? ITEMS.find((i) => i.id === itemId)?.iconAssetId;
}
