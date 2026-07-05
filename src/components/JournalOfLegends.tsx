import { useState } from 'react';
import { Panel } from './common/Panel';
import { useJournalStore } from '@/state/useJournalStore';
import { useQuestStore } from '@/state/useQuestStore';
import { useSceneStore } from '@/state/useSceneStore';
import { useOverlayClose } from '@/hooks/useOverlayClose';
import { sceneForLocationKind } from '@/utils/sceneForLocationKind';
import { ENEMIES, LOCATIONS, LORE_ENTRIES } from '@/data';
import styles from './CharacterMenu.module.css';

/** Fast Travel is earned via the Prologue's shrine-restoration quest (MSF-P-003, "The First
 *  Flame") - matches the MSQ's `fast_travel_unlocked` world flag. Ordinary step-by-step map
 *  transitions are unaffected; this only gates the Journal's "jump straight there" button. */
const FAST_TRAVEL_UNLOCK_QUEST = 'the-first-flame';

interface JournalOfLegendsProps {
  onClose: () => void;
}

type Tab = 'creatures' | 'locations' | 'lore' | 'bosses';

const TABS: { id: Tab; label: string }[] = [
  { id: 'creatures', label: 'Creatures' },
  { id: 'locations', label: 'Locations' },
  { id: 'lore', label: 'Lore' },
  { id: 'bosses', label: 'Bosses' },
];

export function JournalOfLegends({ onClose }: JournalOfLegendsProps) {
  const journal = useJournalStore((s) => s.journal);
  const questProgress = useQuestStore((s) => s.progress);
  const fastTravelUnlocked = questProgress[FAST_TRAVEL_UNLOCK_QUEST]?.status === 'completed';
  const goTo = useSceneStore((s) => s.goTo);
  const currentLocationId = useSceneStore((s) => s.params.locationId);
  const [tab, setTab] = useState<Tab>('creatures');
  const [expandedLocations, setExpandedLocations] = useState<Set<string>>(new Set());
  useOverlayClose(onClose);

  function travelTo(locationId: string) {
    const loc = LOCATIONS.find((l) => l.id === locationId);
    if (!loc) return;
    goTo(sceneForLocationKind(loc.kind), { locationId: loc.id });
    onClose();
  }

  function toggleExpanded(locationId: string) {
    setExpandedLocations((prev) => {
      const next = new Set(prev);
      if (next.has(locationId)) next.delete(locationId);
      else next.add(locationId);
      return next;
    });
  }

  return (
    <div className={styles.overlay} onClick={onClose}>
      <Panel className={styles.panel} onClick={(e: React.MouseEvent) => e.stopPropagation()}>
        <h2 style={{ color: 'var(--fw-accent)', margin: '0 0 12px' }}>Journal of Legends</h2>
        <div className={styles.tabs}>
          {TABS.map((t) => (
            <button
              key={t.id}
              className={`${styles.tab} ${tab === t.id ? styles.tabActive : ''}`}
              onClick={() => setTab(t.id)}
            >
              {t.label}
            </button>
          ))}
        </div>

        {tab === 'creatures' && (
          <div>
            {journal.creaturesDiscovered.length === 0 && <p style={{ fontSize: 13, opacity: 0.7 }}>No creatures discovered yet.</p>}
            {journal.creaturesDiscovered.map((id) => {
              const enemy = ENEMIES.find((e) => e.id === id);
              return (
                <div key={id} className={styles.slotRow}>
                  <span style={{ fontSize: 13, flex: 1 }}>
                    <strong>{enemy?.name ?? id}</strong>
                    <br />
                    <span style={{ opacity: 0.7 }}>{enemy?.loreBlurb}</span>
                  </span>
                </div>
              );
            })}
          </div>
        )}

        {tab === 'locations' && (
          <div>
            {journal.locationsVisited
              .filter((id) => !LOCATIONS.find((l) => l.id === id)?.parentLocationId)
              .map((id) => {
                const loc = LOCATIONS.find((l) => l.id === id);
                const canTravel = loc?.fastTravel && id !== currentLocationId && fastTravelUnlocked;
                const children = LOCATIONS.filter(
                  (l) => l.parentLocationId === id && journal.locationsVisited.includes(l.id),
                );
                const expanded = expandedLocations.has(id);
                return (
                  <div key={id}>
                    <div
                      className={styles.slotRow}
                      style={{ cursor: children.length > 0 ? 'pointer' : 'default' }}
                      onClick={() => children.length > 0 && toggleExpanded(id)}
                    >
                      <span style={{ fontSize: 13, flex: 1 }}>
                        <strong>
                          {children.length > 0 && (expanded ? '▾ ' : '▸ ')}
                          {loc?.name ?? id}
                        </strong>
                        <br />
                        <span style={{ opacity: 0.7 }}>{loc?.description}</span>
                      </span>
                      {canTravel && (
                        <button
                          className={styles.smallButton}
                          onClick={(e) => {
                            e.stopPropagation();
                            travelTo(id);
                          }}
                        >
                          Travel Here
                        </button>
                      )}
                      {loc?.fastTravel && id === currentLocationId && (
                        <span style={{ fontSize: 11, opacity: 0.6 }}>You are here</span>
                      )}
                      {loc?.fastTravel && id !== currentLocationId && !fastTravelUnlocked && (
                        <span style={{ fontSize: 11, opacity: 0.6 }}>Restore the Ash Hallow shrine to unlock Fast Travel</span>
                      )}
                    </div>
                    {expanded &&
                      children.map((child) => (
                        <div key={child.id} className={styles.slotRow} style={{ paddingLeft: 24 }}>
                          <span style={{ fontSize: 12, flex: 1 }}>
                            <strong>{child.name}</strong>
                            <br />
                            <span style={{ opacity: 0.7 }}>{child.description}</span>
                          </span>
                        </div>
                      ))}
                  </div>
                );
              })}
          </div>
        )}

        {tab === 'lore' && (
          <div>
            {journal.loreUnlocked.length === 0 && <p style={{ fontSize: 13, opacity: 0.7 }}>No lore unlocked yet.</p>}
            {journal.loreUnlocked.map((id) => {
              const entry = LORE_ENTRIES.find((l) => l.id === id);
              if (!entry) return null;
              return (
                <div key={id} className={styles.slotRow}>
                  <span style={{ fontSize: 13, flex: 1 }}>
                    <strong>{entry.title}</strong>
                    <br />
                    <span style={{ opacity: 0.7 }}>{entry.body}</span>
                  </span>
                </div>
              );
            })}
          </div>
        )}

        {tab === 'bosses' && (
          <div>
            {journal.bossesDefeated.length === 0 && <p style={{ fontSize: 13, opacity: 0.7 }}>No bosses defeated yet.</p>}
            {journal.bossesDefeated.map((id) => {
              const enemy = ENEMIES.find((e) => e.id === id);
              return (
                <div key={id} className={styles.slotRow}>
                  <span style={{ fontSize: 13, flex: 1 }}>
                    <strong>{enemy?.name ?? id}</strong> — defeated
                  </span>
                </div>
              );
            })}
          </div>
        )}

        <p className={styles.closeHint}>Click outside or press Esc to close</p>
      </Panel>
    </div>
  );
}
