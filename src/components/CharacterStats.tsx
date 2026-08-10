import { useState } from 'react';
import { Panel } from './common/Panel';
import { OverlayCloseButton } from './common/OverlayCloseButton';
import { getAssetUrl } from '@/assets/assetManager';
import { usePlayerStore } from '@/state/usePlayerStore';
import { useOverlayClose } from '@/hooks/useOverlayClose';
import { useNow } from '@/hooks/useNow';
import { AILMENTS, EQUIPMENT, STARTING_STATS, STAT_GROWTH_PER_LEVEL, XP_THRESHOLDS } from '@/data';
import { EQUIPMENT_SLOTS } from '@/types';
import { aggregateAilmentResistances, formatAilmentResistance, formatStatBonuses } from '@/utils/statBonuses';
import { StatBonusesText, AilmentResistanceText } from '@/components/common/StatBonusText';
import { predictedStamina } from '@/utils/staminaRegen';
import { SLOT_LABELS } from '@/utils/equipmentSlotLabels';
import { RankProgressPopup } from './RankProgressPopup';
import styles from './CharacterStats.module.css';

interface CharacterStatsProps {
  onClose: () => void;
}

/** Combat stats that both level growth and equipment can contribute to - the ones worth breaking
 *  down into Base/Equipment/Total. Resource maxes (HP/Spirit) grow the same way but are shown
 *  alongside their current value instead, since "how full is the bar" matters more there. */
const GROWTH_STATS = ['attack', 'defense', 'speed'] as const;

/** Base value at the player's current level, from level growth alone (no gear) - mirrors the same
 *  formula the server applies on level-up, display-only so nothing here is authoritative. */
function baseAtLevel(stat: keyof typeof STAT_GROWTH_PER_LEVEL, level: number): number {
  return STARTING_STATS[stat] + STAT_GROWTH_PER_LEVEL[stat] * (level - 1);
}

export function CharacterStats({ onClose }: CharacterStatsProps) {
  const player = usePlayerStore((s) => s.player);
  const now = useNow(250);
  const [showRankProgress, setShowRankProgress] = useState(false);
  useOverlayClose(() => (showRankProgress ? setShowRankProgress(false) : onClose()));

  if (!player) return null;

  const displayedStamina =
    player.stats.maxStamina > 0
      ? Math.round(predictedStamina(player.stats.stamina, player.stats.maxStamina, player.staminaUpdatedAt, now))
      : 0;

  const equippedDefs = EQUIPMENT_SLOTS.map((slot) => {
    const itemId = player.equipment[slot];
    return { slot, def: itemId ? EQUIPMENT.find((e) => e.id === itemId) : undefined };
  });
  const ailmentResistances = aggregateAilmentResistances(equippedDefs.map(({ def }) => def?.ailmentResistance));
  const resistedAilmentIds = Object.keys(ailmentResistances).filter((id) => ailmentResistances[id] > 0);

  const xpIntoLevel = player.level < XP_THRESHOLDS.length - 1 ? player.xp - XP_THRESHOLDS[player.level] : 0;
  const xpSpan =
    player.level < XP_THRESHOLDS.length - 1
      ? XP_THRESHOLDS[player.level + 1] - XP_THRESHOLDS[player.level]
      : 0;

  return (
    <div className={styles.overlay} onClick={onClose}>
      <Panel className={styles.panel} onClick={(e: React.MouseEvent) => e.stopPropagation()}>
        <OverlayCloseButton onClick={onClose} />
        <div className={styles.header}>
          <h2 className={styles.name}>{player.name}</h2>
          <span
            className={styles.level}
            style={{ cursor: 'pointer', textDecoration: 'underline dotted' }}
            title="See rank progression"
            onClick={() => setShowRankProgress(true)}
          >
            Level {player.level}
          </span>
        </div>
        {showRankProgress && (
          <RankProgressPopup
            level={player.level}
            spiritEssence={player.spiritEssence}
            regionalReputation={player.regionalReputation}
            onClose={() => setShowRankProgress(false)}
          />
        )}
        <p className={styles.xpLine}>
          {xpSpan > 0 ? `${xpIntoLevel} / ${xpSpan} XP to Level ${player.level + 1}` : 'Max Level'}
        </p>

        <div className={styles.ranks}>
          <span>
            Spirit Rank <strong>{player.spiritRank}</strong>
          </span>
          <span>
            Explorer Rank <strong>{player.explorerRank}</strong>
          </span>
          <span>
            Regional Reputation <strong>{player.regionalReputationRank}</strong> ({player.regionalReputation})
          </span>
        </div>

        <div className={styles.section}>
          <h3 className={styles.sectionTitle}>Resources</h3>
          <div className={styles.resourceGrid}>
            <div className={styles.resourceRow}>
              <span>HP</span>
              <span>
                {player.stats.hp} / {player.stats.maxHp}
              </span>
            </div>
            <div className={styles.resourceRow}>
              <span>Spirit</span>
              <span>
                {player.stats.spirit} / {player.stats.maxSpirit}
              </span>
            </div>
            <div className={styles.resourceRow}>
              <span>Lantern Oil</span>
              <span>
                {player.stats.lanternOil} / {player.stats.maxLanternOil}
              </span>
            </div>
            {player.stats.maxStamina > 0 && (
              <div className={styles.resourceRow}>
                <span>Stamina</span>
                <span>
                  {displayedStamina} / {player.stats.maxStamina}
                </span>
              </div>
            )}
          </div>
        </div>

        <div className={styles.section}>
          <h3 className={styles.sectionTitle}>Combat Stats</h3>
          <table className={styles.statTable}>
            <thead>
              <tr>
                <th></th>
                <th>Base</th>
                <th>Equipment</th>
                <th>Total</th>
              </tr>
            </thead>
            <tbody>
              {GROWTH_STATS.map((stat) => {
                const base = baseAtLevel(stat, player.level);
                const total = player.stats[stat];
                const fromEquipment = total - base;
                return (
                  <tr key={stat}>
                    <td className={styles.statName}>{stat}</td>
                    <td>{base}</td>
                    <td>
                      {fromEquipment > 0 ? '+' : ''}
                      {fromEquipment}
                    </td>
                    <td className={styles.statTotal}>{total}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {resistedAilmentIds.length > 0 && (
          <div className={styles.section}>
            <h3 className={styles.sectionTitle}>Ailment Resistance</h3>
            <table className={styles.statTable}>
              <tbody>
                {resistedAilmentIds.map((ailmentId) => (
                  <tr key={ailmentId}>
                    <td className={styles.statName}>{AILMENTS[ailmentId]?.name ?? ailmentId}</td>
                    <td className={styles.statTotal}>{Math.round(ailmentResistances[ailmentId] * 100)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className={styles.section}>
          <h3 className={styles.sectionTitle}>Currency</h3>
          <div className={styles.currencyRow}>
            <span>{player.gold}g Gold</span>
            {/* Spirit Essence / Festival Tokens hidden from display for now (2026-08) - not
                removed, so they're easy to re-show later; player.spiritEssence still drives
                Spirit Rank regardless of whether the raw number is shown here. */}
            <span>{player.premiumCurrency} Premium Currency</span>
          </div>
        </div>

        <div className={styles.section}>
          <h3 className={styles.sectionTitle}>Equipped</h3>
          {equippedDefs.map(({ slot, def }) => (
            <div key={slot} className={styles.slotRow}>
              <span className={styles.slotName}>{SLOT_LABELS[slot]}</span>
              {def ? (
                <>
                  <img src={getAssetUrl(def.iconAssetId)} alt="" className={styles.icon} />
                  <span className={styles.slotItemName}>
                    {def.name}
                    {formatStatBonuses(def.statBonuses) && (
                      <span className={styles.slotBonus}>
                        {' '}
                        <StatBonusesText bonuses={def.statBonuses} />
                      </span>
                    )}
                    {formatAilmentResistance(def.ailmentResistance) && (
                      <span className={styles.slotBonus}>
                        {' '}
                        <AilmentResistanceText resistances={def.ailmentResistance} />
                      </span>
                    )}
                  </span>
                </>
              ) : (
                <span className={styles.slotEmpty}>Empty</span>
              )}
            </div>
          ))}
        </div>

        <p className={styles.closeHint}>Click outside or press Esc to close</p>
      </Panel>
    </div>
  );
}
