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

/** Groups a flat, possibly-duplicated itemId list (e.g. 3 separate Moth Dust drops) into one
 *  {itemId, count} entry per distinct id - shared by every reward-list display (battle victory,
 *  Endless Battle wave clear, PvP match end) so "Moth Dust x3" renders as a single row instead of
 *  three identical ones. Preserves first-seen order rather than sorting, so the list reads in the
 *  same order the drops actually resolved in. */
export function groupRewardItemIds(itemIds: string[]): { itemId: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const id of itemIds) counts.set(id, (counts.get(id) ?? 0) + 1);
  return [...counts.entries()].map(([itemId, count]) => ({ itemId, count }));
}
