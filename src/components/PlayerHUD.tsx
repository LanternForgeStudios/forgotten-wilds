import { usePlayerStore } from '@/state/usePlayerStore';
import { Panel } from './common/Panel';
import styles from './PlayerHUD.module.css';

export function PlayerHUD() {
  const player = usePlayerStore((s) => s.player);
  if (!player) return null;

  const hpPct = Math.max(0, Math.min(100, (player.stats.hp / player.stats.maxHp) * 100));
  const spiritPct = Math.max(0, Math.min(100, (player.stats.spirit / player.stats.maxSpirit) * 100));

  return (
    <Panel className={styles.hud}>
      <p className={styles.name}>
        <span>{player.name}</span>
        <span>Lv. {player.level}</span>
      </p>
      <div className={styles.barRow}>
        <span className={styles.barLabel}>HP</span>
        <div className={styles.barTrack}>
          <div className={styles.barFillHp} style={{ width: `${hpPct}%` }} />
        </div>
        <span className={styles.barValue}>
          {player.stats.hp}/{player.stats.maxHp}
        </span>
      </div>
      <div className={styles.barRow}>
        <span className={styles.barLabel}>SP</span>
        <div className={styles.barTrack}>
          <div className={styles.barFillSpirit} style={{ width: `${spiritPct}%` }} />
        </div>
        <span className={styles.barValue}>
          {player.stats.spirit}/{player.stats.maxSpirit}
        </span>
      </div>
      <p className={styles.gold}>{player.gold}g</p>
    </Panel>
  );
}
