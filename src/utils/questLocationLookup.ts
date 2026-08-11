import { ENEMIES, LOCATIONS } from '@/data';

/** Reverse of functions/src/functions/collectWorldItem.ts's WORLD_ITEMS map (itemId -> the
 *  interactable refId that grants it) - a collectItem objective's targetId is an item id, not a
 *  map refId, so a quest like "recover the Stone Fragment from Mossy Creek" needs this to resolve
 *  which on-map landmark to highlight. Not every collectItem objective needs an entry here - only
 *  a FIXED landmark pickup does; an enemy-drop item (e.g. wisp-feather) has no fixed position and
 *  is resolved via locationsDroppingItem below instead. Shared by MiniMap.tsx (precise on-map
 *  marker) and JournalOfLegends.tsx (location-level relevance, to know when NOT to also add the
 *  enemy-drop lookup for an item that already has a fixed pickup). Keep in sync by hand if a new
 *  fixed pickup is added. */
export const COLLECT_ITEM_LANDMARK_REF_ID: Record<string, string> = {
  'stone-fragment': 'mossy-creek',
  'wind-fragment': 'fallen-watchtower',
  'water-fragment': 'water-fragment',
  'miners-lost-lantern': 'miners-lost-lantern',
  'wind-stone-golden-prairie': 'wind-stone-golden-prairie',
  'wind-stone-spirit-herd-plains': 'wind-stone-spirit-herd-plains',
  'wind-stone-stone-circle-valley': 'wind-stone-stone-circle-valley',
};

/** Every top-level location id whose encounterTable can spawn this enemy - the reverse of
 *  Location.encounterTable (enemyId -> which locations spawn it, not the other way around).
 *  Used to resolve a `defeatEnemies` quest objective (whose targetId is an enemy id with no fixed
 *  on-map position, unlike a boss) to the location(s) worth showing the player. */
export function locationsSpawningEnemy(enemyId: string): string[] {
  return LOCATIONS.filter((l) => l.encounterTable.some((e) => e.enemyId === enemyId)).map((l) => l.id);
}

/** Every top-level location id where SOME enemy that can drop this item spawns - a two-hop join
 *  (itemId -> enemy ids via each Enemy.lootTable -> location ids via locationsSpawningEnemy).
 *  Used to resolve a `collectItem` quest objective whose item is an enemy drop (not a fixed
 *  landmark pickup - see MiniMap.tsx's COLLECT_ITEM_LANDMARK_REF_ID for those) to the
 *  location(s) worth showing the player. */
export function locationsDroppingItem(itemId: string): string[] {
  const droppingEnemyIds = ENEMIES.filter((e) => e.lootTable.some((drop) => drop.itemId === itemId)).map((e) => e.id);
  const ids = new Set<string>();
  for (const enemyId of droppingEnemyIds) {
    for (const locationId of locationsSpawningEnemy(enemyId)) ids.add(locationId);
  }
  return [...ids];
}
