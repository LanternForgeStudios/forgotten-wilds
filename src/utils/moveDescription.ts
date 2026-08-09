import { AILMENTS } from '@/data';
import type { LanternAbility } from '@/data';
import type { Skill } from '@/types';

const DAMAGE_TYPE_LABELS: Record<Skill['damageType'], string> = {
  physical: 'Physical',
  spirit: 'Spirit',
  lantern: 'Lantern',
};

/** Composes a fuller tooltip for a Specialty Attack button - the authored `description` is pure
 *  flavor text (e.g. "A focused blow channeling lantern-light through the blade"), with no
 *  mechanical info of its own, so this appends what it actually does: damage type (every Skill is
 *  offensive - there's no defensive/healing Skill, that's what Lantern Abilities are for) and any
 *  ailment it can inflict. */
export function describeSkill(skill: Skill): string {
  const parts = [skill.description, `Offense - ${DAMAGE_TYPE_LABELS[skill.damageType]} damage.`];
  if (skill.inflictsAilmentId) {
    const ailmentName = AILMENTS[skill.inflictsAilmentId]?.name ?? skill.inflictsAilmentId;
    parts.push(`May inflict ${ailmentName}.`);
  }
  return parts.join(' ');
}

/** +2% offensive power / healing percentage per Lantern Oil upgrade tier - display-only mirror of
 *  functions/src/engine/combatMath.ts's LANTERN_ABILITY_POWER_SCALE_PER_TIER, kept in sync by hand
 *  per the client/server data-split convention. */
const LANTERN_ABILITY_POWER_SCALE_PER_TIER = 0.02;

/** Same idea as describeSkill, for a Lantern Ability - category already distinguishes offense from
 *  defense/healing, but the authored description alone doesn't say so explicitly. Includes the
 *  actual numbers (power, or % HP restored) scaled by `oilTier` (the upgrade tier bought for the
 *  lantern granting this ability - see data/lanternOilUpgrades.ts), so the displayed value matches
 *  what combat will actually do, not just the unscaled base. */
export function describeLanternAbility(ability: LanternAbility, oilTier = 0): string {
  const multiplier = 1 + oilTier * LANTERN_ABILITY_POWER_SCALE_PER_TIER;
  let categoryLabel: string;
  if (ability.category === 'offensive') {
    const power = Math.round((ability.power ?? 0) * multiplier);
    categoryLabel = `Offense - deals damage (power ${power}).`;
  } else if (ability.category === 'defensive') {
    categoryLabel = 'Defense - halves incoming damage this round.';
  } else {
    const percent = Math.round((ability.healHpPercent ?? 0) * multiplier * 100);
    categoryLabel = `Healing - restores ${percent}% HP.`;
  }
  return `${ability.description} ${categoryLabel}`;
}
