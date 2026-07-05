import { useState } from 'react';
import { Panel } from './common/Panel';
import { useQuestStore } from '@/state/useQuestStore';
import { useOverlayClose } from '@/hooks/useOverlayClose';
import { QUESTS, NPCS, LOCATIONS } from '@/data';
import { effectiveQuestStatus } from '@/engine/quests/questStatus';
import type { Quest, QuestCategory } from '@/types';
import styles from './QuestLog.module.css';

interface QuestLogProps {
  onClose: () => void;
}

/** Quest givers who aren't a regular NPC (e.g. a shrine/landmark interactable) - mapped to the
 *  location they're physically found in, same as any NPC's locationId would resolve to. */
const NON_NPC_GIVER_LOCATIONS: Record<string, string> = {};

/** Collapses a sub-location (Elias' house, Mara's shop, the Inn) up to its Main Area, same
 *  bucketing Journal of Legends uses for discovered locations - a quest "earned in Ash Hallow"
 *  shouldn't fragment into three near-empty region sections for one town. */
function mainLocationId(locationId: string): string {
  return LOCATIONS.find((l) => l.id === locationId)?.parentLocationId ?? locationId;
}

/** Where a quest was picked up, for grouping - undefined only if the giver can't be resolved at
 *  all (shouldn't happen for real content, but keeps grouping from crashing on bad data). */
function questMainLocationId(quest: Quest): string | undefined {
  const npcLocationId = NPCS.find((n) => n.id === quest.giverNpcId)?.locationId;
  const locationId = npcLocationId ?? NON_NPC_GIVER_LOCATIONS[quest.giverNpcId];
  return locationId ? mainLocationId(locationId) : undefined;
}

const CATEGORY_TABS: { id: QuestCategory; label: string }[] = [
  { id: 'main', label: 'Main Story' },
  { id: 'side', label: 'Side Quests' },
  { id: 'misc', label: 'Other' },
];

export function QuestLog({ onClose }: QuestLogProps) {
  const progress = useQuestStore((s) => s.progress);
  const [categoryTab, setCategoryTab] = useState<QuestCategory>('main');
  // Tracks *collapsed* regions rather than expanded ones, so every region defaults to open on
  // first view (there are only a handful of quests right now) without needing to precompute ids.
  const [collapsedRegions, setCollapsedRegions] = useState<Set<string>>(new Set());
  useOverlayClose(onClose);

  function toggleRegion(id: string) {
    setCollapsedRegions((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const questsInTab = QUESTS.filter((q) => q.category === categoryTab);
  const regionIds = Array.from(
    new Set(questsInTab.map((q) => questMainLocationId(q)).filter((id): id is string => !!id)),
  );
  // Keep region order stable (matches LOCATIONS array order, i.e. introduction order) rather than
  // reshuffling as quests are discovered.
  regionIds.sort((a, b) => LOCATIONS.findIndex((l) => l.id === a) - LOCATIONS.findIndex((l) => l.id === b));

  const regions = regionIds
    .map((regionId) => {
      const regionQuests = questsInTab.filter((q) => questMainLocationId(q) === regionId);
      const visibleQuests = regionQuests.filter((q) => effectiveQuestStatus(q, progress) !== 'locked');
      const completedCount = regionQuests.filter((q) => effectiveQuestStatus(q, progress) === 'completed').length;
      return { regionId, regionQuests, visibleQuests, completedCount };
    })
    // A region with quests that are all still locked has nothing to show yet - per "just show the
    // ones given," don't render an empty section for it at all.
    .filter((r) => r.visibleQuests.length > 0);

  return (
    <div className={styles.overlay} onClick={onClose}>
      <Panel className={styles.panel} style={{ textAlign: 'left' }} onClick={(e: React.MouseEvent) => e.stopPropagation()}>
        <h2 className={styles.title}>Journal of Legends — Quests</h2>

        <div className={styles.filterBar}>
          {CATEGORY_TABS.map((t) => (
            <button
              key={t.id}
              className={`${styles.filterTab} ${categoryTab === t.id ? styles.filterTabActive : ''}`}
              onClick={() => setCategoryTab(t.id)}
            >
              {t.label}
            </button>
          ))}
        </div>

        {regions.length === 0 && <p className={styles.objective}>No quests here yet.</p>}

        {regions.map(({ regionId, regionQuests, visibleQuests, completedCount }) => {
          const expanded = !collapsedRegions.has(regionId);
          return (
            <div key={regionId} className={styles.region}>
              <button className={styles.regionHeader} onClick={() => toggleRegion(regionId)}>
                <span>
                  {expanded ? '▾' : '▸'} {LOCATIONS.find((l) => l.id === regionId)?.name ?? regionId}
                </span>
                <span className={styles.regionCount}>
                  {completedCount}/{regionQuests.length}
                </span>
              </button>
              {expanded &&
                visibleQuests.map((quest) => {
                  const status = effectiveQuestStatus(quest, progress);
                  const counts = progress[quest.id]?.objectiveCounts ?? {};
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
            </div>
          );
        })}
        <p className={styles.closeHint}>Click outside or press Esc to close</p>
      </Panel>
    </div>
  );
}
