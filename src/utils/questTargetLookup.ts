import { NPCS, QUESTS } from '@/data';
import { effectiveQuestStatus } from '@/engine/quests/questStatus';
import { COLLECT_ITEM_LANDMARK_REF_ID } from '@/utils/questLocationLookup';
import type { QuestProgress, TileMap } from '@/types';

/** Which map-object refIds on `map` are the current, unmet target of an active (non-hidden) quest
 *  objective - drives the overworld's above-head quest-target marker (see ExplorationScene.ts's
 *  questMarker attachment). Mirrors MiniMap.tsx's own per-objective target-resolution rules
 *  (reachLocation/interactWithShrine/defeatBoss/collectItem/talkToNpc - defeatEnemies has no fixed
 *  position, never included) as a deliberately separate implementation rather than a shared
 *  import, so this newer feature can't regress the already-shipped minimap rendering. Keep the two
 *  in sync by hand if the resolution rules ever change. */
export function resolveActiveQuestTargetRefIds(
  map: Pick<TileMap, 'objects'>,
  questProgress: Record<string, QuestProgress>,
  hiddenQuestIds: Set<string>,
): Set<string> {
  const refIds = new Set<string>();
  for (const quest of QUESTS) {
    if (hiddenQuestIds.has(quest.id)) continue;
    if (effectiveQuestStatus(quest, questProgress) !== 'active') continue;
    const counts = questProgress[quest.id]?.objectiveCounts ?? {};
    for (const objective of quest.objectives) {
      if ((counts[objective.id] ?? 0) >= objective.requiredCount) continue;
      if (
        objective.type === 'reachLocation' ||
        objective.type === 'interactWithShrine' ||
        objective.type === 'defeatBoss'
      ) {
        refIds.add(objective.targetId);
      } else if (objective.type === 'collectItem') {
        const landmarkRefId = COLLECT_ITEM_LANDMARK_REF_ID[objective.targetId];
        if (landmarkRefId) refIds.add(landmarkRefId);
      } else if (objective.type === 'talkToNpc') {
        const npcOnThisMap = map.objects.some((o) => o.type === 'npc' && o.refId === objective.targetId);
        if (npcOnThisMap) {
          refIds.add(objective.targetId);
        } else {
          // The target NPC isn't on this map - if they live inside a building that IS on this
          // map, mark that building's own transition refId instead (same fallback MiniMap uses).
          const npcLocationId = NPCS.find((n) => n.id === objective.targetId)?.locationId;
          if (npcLocationId) refIds.add(npcLocationId);
        }
      }
    }
  }
  return refIds;
}
