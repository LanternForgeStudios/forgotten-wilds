import { useState } from 'react';
import { Panel } from './common/Panel';
import { useJournalStore } from '@/state/useJournalStore';
import { useQuestStore } from '@/state/useQuestStore';
import { useSceneStore } from '@/state/useSceneStore';
import { useOverlayClose } from '@/hooks/useOverlayClose';
import { sceneForLocationKind } from '@/utils/sceneForLocationKind';
import { effectiveQuestStatus } from '@/engine/quests/questStatus';
import { getAssetUrl } from '@/assets/assetManager';
import { ENEMY_TIER_LABELS, ENEMY_TIER_COLORS } from '@/utils/enemyTier';
import { ENEMIES, ITEMS, SKILLS, LOCATIONS, LORE_ENTRIES, QUESTS, NPCS } from '@/data';
import type { Enemy, EnemyTier, Quest, QuestCategory } from '@/types';
import styles from './CharacterMenu.module.css';
import questStyles from './QuestLog.module.css';

/** Fast Travel is earned via the Prologue's shrine-restoration quest (MSF-P-003, "The First
 *  Flame") - matches the MSQ's `fast_travel_unlocked` world flag. Ordinary step-by-step map
 *  transitions are unaffected; this only gates the Journal's "jump straight there" button. */
const FAST_TRAVEL_UNLOCK_QUEST = 'the-first-flame';

interface JournalOfLegendsProps {
  onClose: () => void;
}

type Tab = 'quests' | 'locations' | 'echoes' | 'lore' | 'bosses';

const TABS: { id: Tab; label: string }[] = [
  { id: 'quests', label: 'Quests' },
  { id: 'locations', label: 'Locations' },
  { id: 'echoes', label: 'Echoes' },
  { id: 'lore', label: 'Lore' },
  { id: 'bosses', label: 'Bosses' },
];

const ENEMY_FAMILY_LABELS: Record<Enemy['family'], string> = {
  mothlings: 'Mothlings',
  restlessMiners: 'Restless Miners',
  coalSpirits: 'Coal Spirits',
  cliffDwellers: 'Cliff Dwellers',
  waterSpirits: 'Water Spirits',
  briarSpirits: 'Briar Spirits',
  boss: 'Boss',
};

function matchesEnemyQuery(enemy: Enemy | undefined, query: string): boolean {
  if (!query) return true;
  if (!enemy) return false;
  return enemy.name.toLowerCase().includes(query) || enemy.loreBlurb.toLowerCase().includes(query);
}

/** Quest givers who aren't a regular NPC (e.g. a shrine/landmark interactable) - mapped to the
 *  location they're physically found in, same as any NPC's locationId would resolve to. */
const NON_NPC_GIVER_LOCATIONS: Record<string, string> = {};

/** Collapses a sub-location (Elias' house, Mara's shop, the Inn) up to its Main Area, same
 *  bucketing this Journal's own Locations tab uses - a quest "earned in Ash Hallow" shouldn't
 *  fragment into three near-empty region sections for one town. */
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

const QUEST_CATEGORY_TABS: { id: QuestCategory; label: string }[] = [
  { id: 'main', label: 'Main Story' },
  { id: 'side', label: 'Side Quests' },
  { id: 'misc', label: 'Other' },
];

export function JournalOfLegends({ onClose }: JournalOfLegendsProps) {
  const journal = useJournalStore((s) => s.journal);
  const questProgress = useQuestStore((s) => s.progress);
  const fastTravelUnlocked = questProgress[FAST_TRAVEL_UNLOCK_QUEST]?.status === 'completed';
  const goTo = useSceneStore((s) => s.goTo);
  const currentLocationId = useSceneStore((s) => s.params.locationId);
  const [tab, setTab] = useState<Tab>('quests');
  const [expandedLocations, setExpandedLocations] = useState<Set<string>>(new Set());
  const [questCategoryTab, setQuestCategoryTab] = useState<QuestCategory>('main');
  const [activeQuestsOnly, setActiveQuestsOnly] = useState(true);
  const [locationSearch, setLocationSearch] = useState('');
  // Tracks *collapsed* quest regions rather than expanded ones, so every region defaults to open
  // on first view without needing to precompute ids.
  const [collapsedQuestRegions, setCollapsedQuestRegions] = useState<Set<string>>(new Set());
  const [echoesSearch, setEchoesSearch] = useState('');
  const [echoesFamilyFilter, setEchoesFamilyFilter] = useState<Enemy['family'] | 'all'>('all');
  const [echoesTierFilter, setEchoesTierFilter] = useState<EnemyTier | 'all'>('all');
  const [bossesSearch, setBossesSearch] = useState('');
  // Shared between the Echoes and Bosses tabs - enemy ids are unique across ENEMIES regardless of
  // which tab opened the card, and only one tab is ever visible at a time.
  const [selectedEnemyId, setSelectedEnemyId] = useState<string | null>(null);
  useOverlayClose(onClose);

  function toggleQuestRegion(id: string) {
    setCollapsedQuestRegions((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

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

  const locationQuery = locationSearch.trim().toLowerCase();
  function matchesLocationQuery(loc?: { name: string; description: string }): boolean {
    if (!locationQuery) return true;
    return !!loc && (loc.name.toLowerCase().includes(locationQuery) || loc.description.toLowerCase().includes(locationQuery));
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

        {tab === 'quests' &&
          (() => {
            const questsInTab = QUESTS.filter((q) => q.category === questCategoryTab);
            const regionIds = Array.from(
              new Set(questsInTab.map((q) => questMainLocationId(q)).filter((id): id is string => !!id)),
            );
            // Keep region order stable (matches LOCATIONS array order, i.e. introduction order)
            // rather than reshuffling as quests are discovered.
            regionIds.sort((a, b) => LOCATIONS.findIndex((l) => l.id === a) - LOCATIONS.findIndex((l) => l.id === b));

            const regions = regionIds
              .map((regionId) => {
                const regionQuests = questsInTab.filter((q) => questMainLocationId(q) === regionId);
                const visibleQuests = regionQuests
                  .filter((q) => {
                    const status = effectiveQuestStatus(q, questProgress);
                    if (status === 'locked') return false;
                    if (activeQuestsOnly && status !== 'active') return false;
                    return true;
                  })
                  // Active quests first within a region so what's still to do doesn't get buried
                  // below everything already completed there.
                  .sort((a, b) => {
                    const aActive = effectiveQuestStatus(a, questProgress) === 'active' ? 0 : 1;
                    const bActive = effectiveQuestStatus(b, questProgress) === 'active' ? 0 : 1;
                    return aActive - bActive;
                  });
                const completedCount = regionQuests.filter(
                  (q) => effectiveQuestStatus(q, questProgress) === 'completed',
                ).length;
                return { regionId, regionQuests, visibleQuests, completedCount };
              })
              // A region with quests that are all still locked has nothing to show yet - just
              // show the ones given, don't render an empty section for it.
              .filter((r) => r.visibleQuests.length > 0);

            return (
              <div>
                <div
                  className={styles.tabs}
                  style={{ marginBottom: 10, justifyContent: 'space-between', alignItems: 'center' }}
                >
                  <div className={styles.tabs}>
                    {QUEST_CATEGORY_TABS.map((t) => (
                      <button
                        key={t.id}
                        className={`${styles.tab} ${questCategoryTab === t.id ? styles.tabActive : ''}`}
                        onClick={() => setQuestCategoryTab(t.id)}
                      >
                        {t.label}
                      </button>
                    ))}
                  </div>
                  <label style={{ fontSize: 12, display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={activeQuestsOnly}
                      onChange={(e) => setActiveQuestsOnly(e.target.checked)}
                    />
                    Active only
                  </label>
                </div>

                {regions.length === 0 && <p style={{ fontSize: 13, opacity: 0.7 }}>No quests here yet.</p>}

                {regions.map(({ regionId, regionQuests, visibleQuests, completedCount }) => {
                  const expanded = !collapsedQuestRegions.has(regionId);
                  return (
                    <div key={regionId} className={questStyles.region}>
                      <button className={questStyles.regionHeader} onClick={() => toggleQuestRegion(regionId)}>
                        <span>
                          {expanded ? '▾' : '▸'} {LOCATIONS.find((l) => l.id === regionId)?.name ?? regionId}
                        </span>
                        <span className={questStyles.regionCount}>
                          {completedCount}/{regionQuests.length}
                        </span>
                      </button>
                      {expanded &&
                        visibleQuests.map((quest) => {
                          const status = effectiveQuestStatus(quest, questProgress);
                          const counts = questProgress[quest.id]?.objectiveCounts ?? {};
                          return (
                            <div key={quest.id} className={questStyles.quest}>
                              <p className={questStyles.questName}>
                                {quest.name}
                                <span
                                  className={`${questStyles.status} ${
                                    status === 'completed' ? questStyles.statusCompleted : questStyles.statusActive
                                  }`}
                                >
                                  {status}
                                </span>
                              </p>
                              <p className={questStyles.objective}>{quest.description}</p>
                              {quest.objectives.map((o) => (
                                <p key={o.id} className={questStyles.objective}>
                                  • {o.description} ({Math.min(counts[o.id] ?? 0, o.requiredCount)}/{o.requiredCount})
                                </p>
                              ))}
                            </div>
                          );
                        })}
                    </div>
                  );
                })}
              </div>
            );
          })()}

        {tab === 'echoes' &&
          (() => {
            const query = echoesSearch.trim().toLowerCase();
            const discoveredFamilies = Array.from(
              new Set(
                journal.creaturesDiscovered
                  .map((id) => ENEMIES.find((e) => e.id === id)?.family)
                  .filter((f): f is Enemy['family'] => !!f && f !== 'boss'),
              ),
            );
            const visible = journal.creaturesDiscovered.filter((id) => {
              const enemy = ENEMIES.find((e) => e.id === id);
              if (echoesFamilyFilter !== 'all' && enemy?.family !== echoesFamilyFilter) return false;
              if (echoesTierFilter !== 'all' && enemy?.tier !== echoesTierFilter) return false;
              return matchesEnemyQuery(enemy, query);
            });
            return (
              <div>
                <input
                  type="text"
                  className={styles.searchInput}
                  placeholder="Search echoes..."
                  value={echoesSearch}
                  onChange={(e) => setEchoesSearch(e.target.value)}
                />
                <div className={styles.subtabs} style={{ marginBottom: 6 }}>
                  <button
                    className={`${styles.subtab} ${echoesFamilyFilter === 'all' ? styles.subtabActive : ''}`}
                    onClick={() => setEchoesFamilyFilter('all')}
                  >
                    All Families
                  </button>
                  {discoveredFamilies.map((family) => (
                    <button
                      key={family}
                      className={`${styles.subtab} ${echoesFamilyFilter === family ? styles.subtabActive : ''}`}
                      onClick={() => setEchoesFamilyFilter(family)}
                    >
                      {ENEMY_FAMILY_LABELS[family]}
                    </button>
                  ))}
                </div>
                <div className={styles.subtabs} style={{ marginBottom: 10 }}>
                  {(['all', 'regular', 'elite'] as const).map((tier) => (
                    <button
                      key={tier}
                      className={`${styles.subtab} ${echoesTierFilter === tier ? styles.subtabActive : ''}`}
                      onClick={() => setEchoesTierFilter(tier)}
                    >
                      {tier === 'all' ? 'All Tiers' : ENEMY_TIER_LABELS[tier]}
                    </button>
                  ))}
                </div>
                {journal.creaturesDiscovered.length === 0 && <p style={{ fontSize: 13, opacity: 0.7 }}>No echoes discovered yet.</p>}
                {journal.creaturesDiscovered.length > 0 && visible.length === 0 && (
                  <p style={{ fontSize: 13, opacity: 0.7 }}>No echoes match those filters.</p>
                )}
                {visible.map((id) => {
                  const enemy = ENEMIES.find((e) => e.id === id);
                  return (
                    <div
                      key={id}
                      className={styles.slotRow}
                      style={{ cursor: 'pointer' }}
                      onClick={() => setSelectedEnemyId(id)}
                    >
                      <span style={{ fontSize: 13, flex: 1 }}>
                        <strong>{enemy?.name ?? id}</strong>
                        {enemy && (
                          <span style={{ fontSize: 10, color: ENEMY_TIER_COLORS[enemy.tier], marginLeft: 8 }}>
                            {ENEMY_TIER_LABELS[enemy.tier]}
                          </span>
                        )}
                        <br />
                        <span style={{ opacity: 0.7 }}>{enemy?.loreBlurb}</span>
                      </span>
                    </div>
                  );
                })}
              </div>
            );
          })()}

        {tab === 'locations' && (
          <div>
            <input
              type="text"
              className={styles.searchInput}
              placeholder="Search locations..."
              value={locationSearch}
              onChange={(e) => setLocationSearch(e.target.value)}
            />
            {journal.locationsVisited
              .filter((id) => !LOCATIONS.find((l) => l.id === id)?.parentLocationId)
              .map((id) => {
                const loc = LOCATIONS.find((l) => l.id === id);
                const canTravel = loc?.fastTravel && id !== currentLocationId && fastTravelUnlocked;
                const allChildren = LOCATIONS.filter(
                  (l) => l.parentLocationId === id && journal.locationsVisited.includes(l.id),
                );
                const parentMatches = matchesLocationQuery(loc);
                const matchingChildren = allChildren.filter(matchesLocationQuery);
                if (locationQuery && !parentMatches && matchingChildren.length === 0) return null;
                // A parent that only matched because a child did gets its full child list shown
                // (not just the matching one) so the result still reads as a normal location entry;
                // a parent that didn't match itself only shows the children that did.
                const children = parentMatches ? allChildren : matchingChildren;
                // Auto-expand when the only reason this location is showing at all is a matching
                // child - otherwise the match would be hidden behind a collapsed toggle.
                const expanded = expandedLocations.has(id) || (!!locationQuery && !parentMatches && matchingChildren.length > 0);
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

        {tab === 'bosses' &&
          (() => {
            const query = bossesSearch.trim().toLowerCase();
            const visible = journal.bossesDefeated.filter((id) => matchesEnemyQuery(ENEMIES.find((e) => e.id === id), query));
            return (
              <div>
                <input
                  type="text"
                  className={styles.searchInput}
                  placeholder="Search bosses..."
                  value={bossesSearch}
                  onChange={(e) => setBossesSearch(e.target.value)}
                />
                {journal.bossesDefeated.length === 0 && <p style={{ fontSize: 13, opacity: 0.7 }}>No bosses defeated yet.</p>}
                {journal.bossesDefeated.length > 0 && visible.length === 0 && (
                  <p style={{ fontSize: 13, opacity: 0.7 }}>No bosses match that search.</p>
                )}
                {visible.map((id) => {
                  const enemy = ENEMIES.find((e) => e.id === id);
                  return (
                    <div
                      key={id}
                      className={styles.slotRow}
                      style={{ cursor: 'pointer' }}
                      onClick={() => setSelectedEnemyId(id)}
                    >
                      <span style={{ fontSize: 13, flex: 1 }}>
                        <strong>{enemy?.name ?? id}</strong> — defeated
                      </span>
                    </div>
                  );
                })}
              </div>
            );
          })()}

        <p className={styles.closeHint}>Click outside or press Esc to close</p>
      </Panel>

      {selectedEnemyId &&
        (() => {
          const enemy = ENEMIES.find((e) => e.id === selectedEnemyId);
          if (!enemy) return null;
          const moves = enemy.moves
            .map((m) => SKILLS.find((s) => s.id === m.skillId))
            .filter((s): s is NonNullable<typeof s> => !!s);
          const drops = enemy.lootTable
            .map((d) => ({ ...d, item: ITEMS.find((i) => i.id === d.itemId) }))
            .filter((d) => !!d.item);
          return (
            <div
              className={styles.overlay}
              style={{ zIndex: 30 }}
              onClick={(e) => {
                e.stopPropagation();
                setSelectedEnemyId(null);
              }}
            >
              <Panel className={styles.panel} onClick={(e: React.MouseEvent) => e.stopPropagation()}>
                <div className={styles.detailHeader}>
                  <img src={getAssetUrl(enemy.battleSpriteAssetId)} alt="" className={styles.detailIcon} style={{ width: 56, height: 56 }} />
                  <div>
                    <p className={styles.detailName} style={{ fontSize: 16 }}>
                      {enemy.name}
                      <span style={{ fontSize: 11, color: ENEMY_TIER_COLORS[enemy.tier], marginLeft: 8 }}>
                        {ENEMY_TIER_LABELS[enemy.tier]}
                      </span>
                    </p>
                    <p className={styles.detailMeta}>{ENEMY_FAMILY_LABELS[enemy.family]}</p>
                  </div>
                </div>
                <p className={styles.detailDescription}>{enemy.loreBlurb}</p>

                <p className={styles.detailStats} style={{ marginBottom: 4 }}>
                  <strong>Base Stats</strong>
                </p>
                <p className={questStyles.objective}>
                  HP {enemy.stats.maxHp} &nbsp;·&nbsp; ATK {enemy.stats.attack} &nbsp;·&nbsp; DEF {enemy.stats.defense} &nbsp;·&nbsp;
                  SPD {enemy.stats.speed}
                </p>

                <p className={styles.detailStats} style={{ marginTop: 10, marginBottom: 4 }}>
                  <strong>Special Attacks</strong>
                </p>
                {moves.length === 0 && <p className={questStyles.objective}>None known.</p>}
                {moves.map((move) => (
                  <p key={move.id} className={questStyles.objective}>
                    • {move.name} — {move.description}
                  </p>
                ))}

                <p className={styles.detailStats} style={{ marginTop: 10, marginBottom: 4 }}>
                  <strong>Weaknesses</strong>
                </p>
                <p className={questStyles.objective}>
                  {enemy.weaknesses && enemy.weaknesses.length > 0 ? enemy.weaknesses.join(', ') : 'Unknown'}
                </p>

                <p className={styles.detailStats} style={{ marginTop: 10, marginBottom: 4 }}>
                  <strong>Ailments Inflicted</strong>
                </p>
                <p className={questStyles.objective}>
                  {enemy.ailmentsInflicted && enemy.ailmentsInflicted.length > 0 ? enemy.ailmentsInflicted.join(', ') : 'None known'}
                </p>

                <p className={styles.detailStats} style={{ marginTop: 10, marginBottom: 4 }}>
                  <strong>Drops</strong>
                </p>
                {drops.length === 0 && <p className={questStyles.objective}>None known.</p>}
                {drops.map((d) => (
                  <p key={d.itemId} className={questStyles.objective}>
                    • {d.item!.name} ({Math.round(d.chance * 100)}% chance, x{d.minQuantity}
                    {d.maxQuantity !== d.minQuantity ? `-${d.maxQuantity}` : ''})
                  </p>
                ))}

                <p className={styles.detailStats} style={{ marginTop: 10, marginBottom: 4 }}>
                  <strong>Rewards</strong>
                </p>
                <p className={questStyles.objective}>
                  {enemy.xpReward} XP &nbsp;·&nbsp; {enemy.goldReward} gold
                </p>

                <button
                  className={styles.smallButton}
                  style={{ marginTop: 12 }}
                  onClick={() => setSelectedEnemyId(null)}
                >
                  Close
                </button>
              </Panel>
            </div>
          );
        })()}
    </div>
  );
}
