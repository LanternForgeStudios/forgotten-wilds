import { AILMENTS } from '@/data';
import type { AilmentResistance, Stats } from '@/types';

/** Sums every equipped item's ailmentResistance entries by ailmentId, clamped to [0,1] per
 *  ailment - mirrors the server's applyAilmentResistance/computeAilmentResistances (additive,
 *  then clamped), display-only so nothing here is authoritative. Used by the Combat Stats
 *  screen's Ailment Resistance summary. */
export function aggregateAilmentResistances(resistanceLists: (AilmentResistance[] | undefined)[]): Record<string, number> {
  const totals: Record<string, number> = {};
  for (const list of resistanceLists) {
    for (const { ailmentId, reductionPercent } of list ?? []) {
      totals[ailmentId] = Math.min(1, (totals[ailmentId] ?? 0) + reductionPercent);
    }
  }
  return totals;
}

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

/** Renders an equipment item's ailmentResistance entries as "Poison Resist +30%", or '' if it
 *  grants none. `reductionPercent` is a 0-1 fraction (see EquipmentItem.ailmentResistance's own
 *  doc comment) - multiplied by 100 for display, rounded to drop float noise (0.15 * 100 can land
 *  on 14.999999999999998 in JS). Falls back to the raw ailmentId if it's not a recognized entry
 *  in AILMENTS (shouldn't happen for authored content, but fails safely rather than rendering
 *  nothing). */
export function formatAilmentResistance(resistances: AilmentResistance[] | undefined): string {
  if (!resistances || resistances.length === 0) return '';
  return resistances
    .map((r) => `${AILMENTS[r.ailmentId]?.name ?? r.ailmentId} Resist +${Math.round(r.reductionPercent * 100)}%`)
    .join('  ·  ');
}
