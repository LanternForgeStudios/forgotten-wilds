import type { EquipmentItem, Tier } from '@/types';

const TIER_WEIGHT: Record<Tier, number> = { common: 0, uncommon: 1, rare: 2, mythic: 3, legendary: 4 };

/** Rough single-number "power level" for ranking same-slot equipment against each other, purely
 *  to drive the "is this the best I own" badge in CharacterMenu - tier dominates (a legendary
 *  always outranks a rare regardless of its raw stat total, matching how tier reads to players),
 *  with the sum of all stat bonuses (positive and negative) as a same-tier tiebreaker. Display-
 *  only - never used for anything that affects actual combat math. */
export function equipmentScore(def: EquipmentItem): number {
  const statTotal = Object.values(def.statBonuses).reduce((sum: number, v) => sum + (v ?? 0), 0);
  return TIER_WEIGHT[def.tier] * 1000 + statTotal;
}

/** Given every EquipmentItem definition the player owns for one slot, returns the id(s) tied for
 *  the highest equipmentScore - a Set (not a single id) since a tie should mark more than one
 *  item "best" rather than picking an arbitrary winner. */
export function bestEquipmentIds(defs: EquipmentItem[]): Set<string> {
  if (defs.length === 0) return new Set();
  const maxScore = Math.max(...defs.map(equipmentScore));
  return new Set(defs.filter((d) => equipmentScore(d) === maxScore).map((d) => d.id));
}
