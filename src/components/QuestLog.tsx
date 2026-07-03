import { Panel } from './common/Panel';
import { useQuestStore } from '@/state/useQuestStore';
import { QUESTS } from '@/data';
import { effectiveQuestStatus } from '@/engine/quests/questStatus';
import styles from './QuestLog.module.css';

interface QuestLogProps {
  onClose: () => void;
}

export function QuestLog({ onClose }: QuestLogProps) {
  const progress = useQuestStore((s) => s.progress);

  return (
    <div className={styles.overlay} onClick={onClose}>
      <Panel className={styles.panel} style={{ textAlign: 'left' }}>
        <h2 className={styles.title}>Journal of Legends — Quests</h2>
        {QUESTS.map((quest) => {
          const status = effectiveQuestStatus(quest, progress);
          const counts = progress[quest.id]?.objectiveCounts ?? {};
          if (status === 'locked') {
            return (
              <div key={quest.id} className={`${styles.quest} ${styles.locked}`}>
                <p className={styles.questName}>??? </p>
              </div>
            );
          }
          return (
            <div key={quest.id} className={styles.quest}>
              <p className={styles.questName}>
                {quest.name}
                <span className={`${styles.status} ${status === 'completed' ? styles.statusCompleted : styles.statusActive}`}>
                  {status}
                </span>
              </p>
              <p className={styles.objective}>{quest.description}</p>
              {quest.objectives.map((o) => (
                <p key={o.id} className={styles.objective}>
                  • {o.description} ({Math.min(counts[o.id] ?? 0, o.requiredCount)}/{o.requiredCount})
                </p>
              ))}
            </div>
          );
        })}
        <p className={styles.closeHint}>Click to close</p>
      </Panel>
    </div>
  );
}
