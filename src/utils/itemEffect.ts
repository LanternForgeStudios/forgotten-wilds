import type { ItemEffect, Stats } from '@/types';

/** Whether this item has any effect that the "Use" button applies at all (as opposed to a key
 *  item/equipment with no direct-use effect). */
export function isUsableEffect(effect: ItemEffect | undefined): boolean {
  return !!effect && !!(effect.healHp || effect.healSpirit || effect.restoreOil);
}

/** Whether using this item would actually change anything right now - the resource(s) it
 *  restores aren't already at max. Display-only mirror of the guard the server itself enforces
 *  (useItem.ts/resolveCombatAction.ts) - greys out the button rather than inviting a click the
 *  server would just reject as having no effect. */
export function itemWouldHaveEffect(effect: ItemEffect | undefined, stats: Stats): boolean {
  if (!effect) return false;
  return (
    (!!effect.healHp && stats.hp < stats.maxHp) ||
    (!!effect.healSpirit && stats.spirit < stats.maxSpirit) ||
    (!!effect.restoreOil && stats.lanternOil < stats.maxLanternOil)
  );
}
