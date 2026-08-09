import { AILMENTS } from '@/data';
import { STAT_BONUS_LABELS } from '@/utils/statBonuses';
import type { AilmentResistance, Stats } from '@/types';

/** Colored equivalent of utils/statBonuses.ts's formatStatBonuses - same "+4 ATK  ·  +1 DEF"
 *  content, but each term is individually colored: blue (var(--fw-spirit)) for a positive stat,
 *  red (var(--fw-danger)) for a negative one, so a debuff item reads as a downside at a glance
 *  instead of looking identical to a buff. Renders null (nothing) when bonuses is empty, mirroring
 *  formatStatBonuses' own '' case, so callers can gate on truthiness the same way. */
export function StatBonusesText({ bonuses }: { bonuses: Partial<Stats> }) {
  const entries = Object.entries(bonuses).filter(([, value]) => value) as [string, number][];
  if (entries.length === 0) return null;
  return (
    <>
      {entries.map(([stat, value], i) => (
        <span key={stat}>
          {i > 0 && <span style={{ opacity: 0.6 }}>{'  ·  '}</span>}
          <span style={{ color: value > 0 ? 'var(--fw-spirit)' : 'var(--fw-danger)' }}>
            {value > 0 ? '+' : ''}
            {value} {STAT_BONUS_LABELS[stat] ?? stat}
          </span>
        </span>
      ))}
    </>
  );
}

/** Colored equivalent of utils/statBonuses.ts's formatAilmentResistance - rendered in green
 *  (var(--fw-success)), its own distinct color from stat bonuses above, since an ailment
 *  resistance is a different kind of benefit (defensive utility, not a raw stat). Renders null
 *  when resistances is empty/undefined. */
export function AilmentResistanceText({ resistances }: { resistances: AilmentResistance[] | undefined }) {
  if (!resistances || resistances.length === 0) return null;
  return (
    <>
      {resistances.map((r, i) => (
        <span key={r.ailmentId}>
          {i > 0 && <span style={{ opacity: 0.6 }}>{'  ·  '}</span>}
          <span style={{ color: 'var(--fw-success)' }}>
            {AILMENTS[r.ailmentId]?.name ?? r.ailmentId} Resist +{Math.round(r.reductionPercent * 100)}%
          </span>
        </span>
      ))}
    </>
  );
}
