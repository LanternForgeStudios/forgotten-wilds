import { useState } from 'react';
import { Panel } from './common/Panel';
import { useQuestStore } from '@/state/useQuestStore';
import { useOverlayClose } from '@/hooks/useOverlayClose';
import { QUESTS, NPCS, LOCATIONS } from '@/data';
import { effectiveQuestStatus } from '@/engine/quests/questStatus';
import type { Quest } from '@/types';
import styles from './QuestLog.module.css';

interface QuestLogProps {
  onClose: () => void;
}

/** Quest givers who aren't a regular NPC (e.g. a shrine guardian interactable) - mapped to the
 *  location they're physically found in, same as any NPC's locationId would resolve to. */
const NON_NPC_GIVER_LOCATIONS: Record<string, string> = {
  'guardian-of-ironwood': 'ironwood-trail',
};

/** Collapses a sub-location (Elias' house, Mara's shop, the Inn) up to its Main Area, same
 *  bucketing Journal of Legends uses for discovered locations - a quest "earned in Ash Hallow"
 *  shouldn't fragment into three near-empty filter tabs for one town. */
function mainLocationId(locationId: string): string {
  return LOCATIONS.find((l) => l.id === locationId)?.parentLocationId ?? locationId;
}

/** Where a quest was picked up, for filtering - undefined only if the giver can't be resolved at
 *  all (shouldn't happen for real content, but keeps the filter from crashing on bad data). */
function questMainLocationId(quest: Quest): string | undefined {
  const npcLocationId = NPCS.find((n) => n.id === quest.giverNpcId)?.locationId;
  const locationId = npcLocationId ?? NON_NPC_GIVER_LOCATIONS[quest.giverNpcId];
  return locationId ? mainLocationId(locationId) : undefined;
}

export function QuestLog({ onClose }: QuestLogProps) {
  const progress = useQuestStore((s) => s.progress);
  const [locationFilter, setLocationFilter] = useState<string>('all');
  useOverlayClose(onClose);

  const visibleQuests = QUESTS.filter((q) => effectiveQuestStatus(q, progress) !== 'locked');
  const filterLocationIds = Array.from(
    new Set(visibleQuests.map((q) => questMainLocationId(q)).filter((id): id is string => !!id)),
  );
  // Keep filter tabs in the same order locations are introduced (LOCATIONS array order), not
  // discovery order, so the tab bar doesn't reshuffle as quests come in.
  filterLocationIds.sort(
    (a, b) => LOCATIONS.findIndex((l) => l.id === a) - LOCATIONS.findIndex((l) => l.id === b),
  );

  const questsToShow = QUESTS.filter((quest) => {
    const status = effectiveQuestStatus(quest, progress);
    if (status === 'locked') return locationFilter === 'all';
    if (locationFilter === 'all') return true;
    return questMainLocationId(quest) === locationFilter;
  });

  return (
    <div className={styles.overlay} onClick={onClose}>
      <Panel className={styles.panel} style={{ textAlign: 'left' }} onClick={(e: React.MouseEvent) => e.stopPropagation()}>
        <h2 className={styles.title}>Journal of Legends — Quests</h2>

        {filterLocationIds.length > 1 && (
          <div className={styles.filterBar}>
            <button
              className={`${styles.filterTab} ${locationFilter === 'all' ? styles.filterTabActive : ''}`}
              onClick={() => setLocationFilter('all')}
            >
              All
            </button>
            {filterLocationIds.map((id) => (
              <button
                key={id}
                className={`${styles.filterTab} ${locationFilter === id ? styles.filterTabActive : ''}`}
                onClick={() => setLocationFilter(id)}
              >
                {LOCATIONS.find((l) => l.id === id)?.name ?? id}
              </button>
            ))}
          </div>
        )}

        {questsToShow.map((quest) => {
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
        {questsToShow.length === 0 && <p className={styles.objective}>No quests here yet.</p>}
        <p className={styles.closeHint}>Click outside or press Esc to close</p>
      </Panel>
    </div>
  );
}
