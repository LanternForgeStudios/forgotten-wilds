import { useState } from 'react';
import { Panel } from './common/Panel';
import { useJournalStore } from '@/state/useJournalStore';
import { ENEMIES, LOCATIONS, LORE_ENTRIES } from '@/data';
import styles from './CharacterMenu.module.css';

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
  const [tab, setTab] = useState<Tab>('creatures');

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
            {journal.locationsVisited.map((id) => {
              const loc = LOCATIONS.find((l) => l.id === id);
              return (
                <div key={id} className={styles.slotRow}>
                  <span style={{ fontSize: 13, flex: 1 }}>
                    <strong>{loc?.name ?? id}</strong>
                    <br />
                    <span style={{ opacity: 0.7 }}>{loc?.description}</span>
                  </span>
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

        <p className={styles.closeHint}>Click outside to close</p>
      </Panel>
    </div>
  );
}
