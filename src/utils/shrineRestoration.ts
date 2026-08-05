import type { QuestProgress } from '@/types';

/** Which quest's completion restores a given shrine (the quest whose own `interactWithShrine`
 *  objective targets that shrine's refId) - kept in sync by hand with the identical objective
 *  targetIds in functions/src/data/quests.ts. Each shrine's lit/dormant sprite must be driven by
 *  ITS OWN restoration quest, not by whether Stamina/Dash happens to be unlocked (a single global
 *  flag set once by rekindling-spirit-grove and never unset) - a shrine reached after that point in
 *  the MSQ would otherwise render as already-lit the instant the player walks in, before ever
 *  restoring it. */
export const SHRINE_RESTORED_QUEST: Record<string, string> = {
  'ash-hallow-shrine': 'the-first-flame',
  'spirit-grove': 'rekindling-spirit-grove',
  'mine-shrine': 'the-shrine-below',
  'mother-cypress-shrine': 'seeds-of-memory',
  'stone-circle-carvings': 'the-stone-circles',
  'ancient-wind-mechanism': 'temple-above-the-clouds',
};

/** Sprite asset id for a shrine's current lit/dormant state, given its refId and the player's
 *  quest progress - shared by Town/Overworld/Dungeon so all three render every shrine consistently. */
export function shrineSpriteAssetId(refId: string, questProgress: Record<string, QuestProgress>): string {
  const questId = SHRINE_RESTORED_QUEST[refId];
  const restored = questId ? questProgress[questId]?.status === 'completed' : false;
  return restored ? 'structure.shrine-activated' : 'structure.shrine-dormant';
}
