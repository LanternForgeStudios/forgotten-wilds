import { Panel } from './common/Panel';
import { OverlayCloseButton } from './common/OverlayCloseButton';
import {
  EXPLORER_RANK_THRESHOLDS,
  SPIRIT_RANK_THRESHOLDS,
  REGIONAL_REPUTATION_RANK_THRESHOLDS,
} from '@/data/leveling';
import styles from './RankProgressPopup.module.css';

interface RankProgressPopupProps {
  level: number;
  spiritEssence: number;
  regionalReputation: number;
  onClose: () => void;
}

interface TierRow {
  label: string;
  threshold: number;
}

/** One shared renderer for all three rank ladders - each is just a sorted list of {threshold,
 *  rank} pairs (see leveling.ts), differing only in what the threshold measures (level,
 *  spiritEssence, regionalReputation) and how that raw number is labeled. */
function RankLadder({ title, unitLabel, current, rows }: { title: string; unitLabel: string; current: number; rows: TierRow[] }) {
  const ascending = [...rows].sort((a, b) => a.threshold - b.threshold);
  const currentIndex = ascending.reduce((idx, row, i) => (current >= row.threshold ? i : idx), 0);
  const next = ascending[currentIndex + 1];

  return (
    <div className={styles.ladder}>
      <h3 className={styles.ladderTitle}>{title}</h3>
      <ul className={styles.tierList}>
        {ascending.map((row, i) => (
          <li key={row.label} className={i === currentIndex ? styles.tierCurrent : styles.tierRow}>
            <span>{row.label}</span>
            <span className={styles.tierThreshold}>
              {row.threshold} {unitLabel}
            </span>
          </li>
        ))}
      </ul>
      <p className={styles.progressNote}>
        {next
          ? `${Math.max(0, next.threshold - current)} more ${unitLabel} to reach ${next.label}`
          : 'Highest rank reached.'}
      </p>
    </div>
  );
}

export function RankProgressPopup({ level, spiritEssence, regionalReputation, onClose }: RankProgressPopupProps) {
  return (
    <div
      className={styles.overlay}
      onClick={(e) => {
        e.stopPropagation();
        onClose();
      }}
    >
      <Panel className={styles.panel} onClick={(e: React.MouseEvent) => e.stopPropagation()}>
        <OverlayCloseButton onClick={onClose} />
        <h2 className={styles.title}>Rank Progression</h2>
        <RankLadder
          title="Explorer Rank"
          unitLabel="level"
          current={level}
          rows={EXPLORER_RANK_THRESHOLDS.map((t) => ({ label: t.rank, threshold: t.minLevel }))}
        />
        <RankLadder
          title="Spirit Rank"
          unitLabel="essence"
          current={spiritEssence}
          rows={SPIRIT_RANK_THRESHOLDS.map((t) => ({ label: t.rank, threshold: t.minEssence }))}
        />
        <RankLadder
          title="Regional Reputation"
          unitLabel="rep"
          current={regionalReputation}
          rows={REGIONAL_REPUTATION_RANK_THRESHOLDS.map((t) => ({ label: t.rank, threshold: t.minReputation }))}
        />
      </Panel>
    </div>
  );
}
