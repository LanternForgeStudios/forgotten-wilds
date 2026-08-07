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

/** Same idea as describeSkill, for a Lantern Ability - category already distinguishes offense from
 *  defense/healing, but the authored description alone doesn't say so explicitly. */
export function describeLanternAbility(ability: LanternAbility): string {
  const categoryLabel =
    ability.category === 'offensive' ? 'Offense - deals damage.' : ability.category === 'defensive' ? 'Defense - halves incoming damage this round.' : 'Healing - restores HP.';
  return `${ability.description} ${categoryLabel}`;
}
