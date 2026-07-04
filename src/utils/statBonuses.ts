import type { Stats } from '@/types';

export const STAT_BONUS_LABELS: Record<string, string> = {
  attack: 'ATK',
  defense: 'DEF',
  speed: 'SPD',
  maxHp: 'Max HP',
  maxSpirit: 'Max Spirit',
};

/** Renders an equipment item's stat bonuses as "+4 ATK  ·  +1 DEF", or '' if it grants none
 *  (e.g. a lantern whose only effect is its Lantern Ability, not a stat). */
export function formatStatBonuses(bonuses: Partial<Stats>): string {
  return Object.entries(bonuses)
    .filter(([, value]) => value)
    .map(([stat, value]) => `${(value as number) > 0 ? '+' : ''}${value} ${STAT_BONUS_LABELS[stat] ?? stat}`)
    .join('  ·  ');
}
