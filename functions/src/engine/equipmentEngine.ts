import type { StatBonuses } from '../data/equipment';
import type { Stats } from '../shared-types';

/** Mutates stats in place, applying (sign=1) or removing (sign=-1) an item's bonuses, clamping current
 *  hp/spirit so they never exceed the resulting max after the change. */
export function adjustStatsForBonuses(stats: Stats, bonuses: StatBonuses, sign: 1 | -1): void {
  if (bonuses.maxHp) stats.maxHp = Math.max(1, stats.maxHp + sign * bonuses.maxHp);
  if (bonuses.maxSpirit) stats.maxSpirit = Math.max(0, stats.maxSpirit + sign * bonuses.maxSpirit);
  if (bonuses.attack) stats.attack = Math.max(0, stats.attack + sign * bonuses.attack);
  if (bonuses.defense) stats.defense = Math.max(0, stats.defense + sign * bonuses.defense);
  if (bonuses.speed) stats.speed = Math.max(0, stats.speed + sign * bonuses.speed);

  stats.hp = Math.min(stats.hp, stats.maxHp);
  stats.spirit = Math.min(stats.spirit, stats.maxSpirit);
}

/** Unlike the generic stat bonuses above (which stack additively across several equipped slots),
 *  only one lantern can ever be equipped at a time, so its oil capacity fully *replaces* the
 *  previous value rather than adding to it. Current oil clamps down if the new capacity is lower -
 *  swapping lanterns is not a way to top off for free. */
export function setLanternOilCapacity(stats: Stats, oilCapacity: number): void {
  stats.maxLanternOil = Math.max(0, oilCapacity);
  stats.lanternOil = Math.min(stats.lanternOil, stats.maxLanternOil);
}
