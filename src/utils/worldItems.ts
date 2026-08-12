/** refId -> granted itemId, for the minority of world-item interactables whose refId does NOT
 *  equal the item collectWorldItem.ts actually grants (mirrors the divergent entries in
 *  functions/src/data/locations.ts's WORLD_ITEMS - every "-cache"/"-tunnel" named refId, plus the
 *  two original prologue-era fragments). Shared by OverworldScene.tsx and DungeonScene.tsx so
 *  "is this already collected" checks resolve through one table instead of each scene assuming
 *  refId===itemId independently - that assumption silently and permanently breaks a "collected"
 *  sprite/label swap the moment it's wrong (2026-08-10: reported for the Winter Count hides,
 *  which never flipped to their collected state). Every dungeon world item happens to have
 *  refId===itemId today, so this is a no-op for DungeonScene right now - kept shared so a future
 *  dungeon item reusing the "-cache"/"-tunnel" naming convention doesn't reintroduce the same bug. */
const WORLD_ITEM_GRANTED_ITEM_ID: Record<string, string> = {
  'mossy-creek': 'stone-fragment',
  'fallen-watchtower': 'wind-fragment',
  'frostbound-treatise-cache': 'frostbound-treatise',
  'ember-codex-tunnel': 'ember-codex',
  'bogwater-almanac-cache': 'bogwater-almanac',
  'drowned-ledger-cache': 'drowned-ledger',
  'winter-count-hide-i-cache': 'winter-count-hide-i',
  'winter-count-hide-ii-cache': 'winter-count-hide-ii',
  'heartwood-recording-i-cache': 'heartwood-recording-i',
  'heartwood-recording-ii-cache': 'heartwood-recording-ii',
  'desert-relic-i-cache': 'desert-relic-i',
  'desert-relic-ii-cache': 'desert-relic-ii',
  'lost-scout-effects-i-cache': 'lost-scout-effects-i',
  'lost-scout-effects-ii-cache': 'lost-scout-effects-ii',
};

/** The itemId actually granted by collectWorldItem.ts for a given interactable refId - identical
 *  to the refId for most world items, diverging only for the entries above. */
export function grantedItemIdFor(refId: string): string {
  return WORLD_ITEM_GRANTED_ITEM_ID[refId] ?? refId;
}
