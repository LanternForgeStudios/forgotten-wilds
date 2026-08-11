import { Panel } from './common/Panel';
import { OverlayCloseButton } from './common/OverlayCloseButton';
import { AILMENTS } from '@/data';
import { AILMENT_TINT_COLORS } from '@/utils/ailmentTint';
import { describeSkill } from '@/utils/moveDescription';
import type { Skill } from '@/types';
import styles from './SkillSelectMenu.module.css';

interface SkillSelectMenuProps {
  skills: Skill[];
  /** Current Spirit total - a skill whose spiritCost exceeds this renders disabled. */
  playerSpirit: number;
  onSelect: (skillId: string) => void;
  onClose: () => void;
}

/** Fixed display order (not alphabetical/data order) so the groups read left-to-right in a
 *  consistent, learnable position every time this menu opens, regardless of which specialties a
 *  given player happens to know. 'none' (no ailment - e.g. Keeper's Strike) sorts last, after
 *  every real ailment group. */
const AILMENT_GROUP_ORDER = ['burn', 'freeze', 'poison', 'silence', 'stun', 'none'];

/** Stun has no entry in AILMENT_TINT_COLORS (see ailmentTint.ts's own comment - it uses a banner,
 *  not a screen tint, in actual combat), and 'none' isn't a real ailment at all - both need a
 *  group-header color here that AILMENT_TINT_COLORS was never meant to provide. */
const FALLBACK_GROUP_COLORS: Record<string, string> = {
  stun: 'rgba(224, 169, 74, 0.22)',
  none: 'rgba(255, 255, 255, 0.12)',
};

/** Groups a player's known Spirit Specialties by which ailment they inflict (every player Skill
 *  shares the same 'spirit' damageType, so grouping by that literal field would put everything in
 *  one bucket - grouping by ailment is what actually differentiates them, see the 2026-08
 *  specialty rebalance). Shared by CombatScene.tsx (solo) and EndlessBattlePanel.tsx (party/
 *  Endless Battle) so both combat surfaces present the same specialty roster the same way,
 *  replacing each screen's own narrow one-per-row vertical list - overwhelming once a player has
 *  learned most of the 13 available specialties - with a wider grid split into labeled groups. */
export function SkillSelectMenu({ skills, playerSpirit, onSelect, onClose }: SkillSelectMenuProps) {
  const groups = new Map<string, Skill[]>();
  for (const skill of skills) {
    const key = skill.inflictsAilmentId ?? 'none';
    const list = groups.get(key) ?? [];
    list.push(skill);
    groups.set(key, list);
  }
  const orderedGroupIds = [...groups.keys()].sort(
    (a, b) => AILMENT_GROUP_ORDER.indexOf(a) - AILMENT_GROUP_ORDER.indexOf(b),
  );

  return (
    <div className={styles.overlay} onClick={onClose}>
      <Panel className={styles.panel} onClick={(e: React.MouseEvent) => e.stopPropagation()}>
        <OverlayCloseButton onClick={onClose} />
        <h3 className={styles.title}>Select Spirit Ability</h3>
        {orderedGroupIds.map((ailmentId) => {
          const groupSkills = groups.get(ailmentId)!;
          const groupColor = AILMENT_TINT_COLORS[ailmentId] ?? FALLBACK_GROUP_COLORS[ailmentId];
          const groupLabel = ailmentId === 'none' ? 'Direct Damage' : (AILMENTS[ailmentId]?.name ?? ailmentId);
          return (
            <div key={ailmentId} className={styles.group} style={{ background: groupColor }}>
              <p className={styles.groupLabel}>{groupLabel}</p>
              <div className={styles.grid}>
                {groupSkills.map((skill) => (
                  <button
                    key={skill.id}
                    type="button"
                    className={styles.skillButton}
                    disabled={playerSpirit < skill.spiritCost}
                    title={describeSkill(skill)}
                    onClick={() => onSelect(skill.id)}
                  >
                    {skill.name}
                    <span className={styles.spCost}>{skill.spiritCost} SP</span>
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </Panel>
    </div>
  );
}
