import { useState } from 'react';
import { Panel } from './common/Panel';
import { OverlayCloseButton } from './common/OverlayCloseButton';
import { TierBadge } from './common/TierBadge';
import { getAssetUrl } from '@/assets/assetManager';
import { useInventoryStore } from '@/state/useInventoryStore';
import { usePlayerStore } from '@/state/usePlayerStore';
import { useAuthStore } from '@/state/useAuthStore';
import { callEquipItem, callUnequipItem, callUseItem, callCraftItem } from '@/firebase/functionsClient';
import { resyncSave } from '@/state/hydrate';
import { useOverlayClose } from '@/hooks/useOverlayClose';
import { ITEMS, EQUIPMENT, RECIPES } from '@/data';
import { EQUIPMENT_SLOTS, type EquipmentSlot, type Item, type Tier } from '@/types';
import { formatStatBonuses } from '@/utils/statBonuses';
import { bestEquipmentIds } from '@/utils/equipmentScore';
import { isUsableEffect, itemWouldHaveEffect } from '@/utils/itemEffect';
import { SLOT_LABELS } from '@/utils/equipmentSlotLabels';
import { TIER_LABELS } from '@/utils/tier';
import styles from './CharacterMenu.module.css';

interface CharacterMenuProps {
  onClose: () => void;
}

type InventorySubTab = 'all' | 'consumable' | 'equipment' | 'materials' | 'keyItem' | 'unique';

const SUBTAB_LABELS: Record<InventorySubTab, string> = {
  all: 'All',
  consumable: 'Consumables',
  equipment: 'Equipment',
  materials: 'Materials',
  keyItem: 'Key Items',
  unique: 'Unique',
};

/** Order matches how the slot-type filter is meant to read left to right when narrowing the
 *  Inventory tab's Equipment subtab, not EQUIPMENT_SLOTS's equip-tab display order. */
const SLOT_FILTER_ORDER: EquipmentSlot[] = ['armor', 'weapon', 'boots', 'gloves', 'lantern', 'charm', 'spiritTotem'];

const SLOT_FILTER_LABELS: Record<EquipmentSlot, string> = {
  weapon: 'Weapon',
  armor: 'Armor',
  boots: 'Boots',
  gloves: 'Gloves',
  charm: 'Charm',
  lantern: 'Lanterns',
  spiritTotem: 'Spirit Totem',
};

// Crafting tab: recipes (RECIPES) are keyed by their output item's own id, one recipe per
// craftable consumable - grouped here by which stat the output restores (or 'cure' for an
// ailment-cure item) so the tab reads as 4 short lists instead of one flat 17-item grid.
type CraftGroup = 'hp' | 'spirit' | 'oil' | 'cure';

const CRAFT_GROUP_ORDER: CraftGroup[] = ['hp', 'spirit', 'oil', 'cure'];

const CRAFT_GROUP_LABELS: Record<CraftGroup, string> = {
  hp: 'Healing Poultices',
  spirit: 'Spirit Draughts',
  oil: 'Lantern Oil',
  cure: 'Ailment Cures',
};

const TIER_ORDER: Record<Tier, number> = { common: 0, uncommon: 1, rare: 2, mythic: 3, legendary: 4 };

function craftGroupOf(itemDef: Item | undefined): CraftGroup | undefined {
  if (!itemDef?.effect) return undefined;
  if (itemDef.effect.healHpPercent) return 'hp';
  if (itemDef.effect.healSpiritPercent) return 'spirit';
  if (itemDef.effect.restoreOilPercent) return 'oil';
  if (itemDef.effect.cureAilmentId) return 'cure';
  return undefined;
}

type SortOption = 'name' | 'quantityDesc' | 'category';

/** Group ordering for the "Category" sort - matches how the subtab filter buttons read left to
 *  right (Equipment, Consumables, Key Items); 'all'/'unique' never come back from subTabOf()
 *  itself (that's a cross-cutting filter, not a real category) but are included so the lookup
 *  type-checks against every InventorySubTab value. */
const CATEGORY_SORT_ORDER: Record<InventorySubTab, number> = {
  equipment: 0,
  consumable: 1,
  materials: 2,
  keyItem: 3,
  all: 99,
  unique: 99,
};

interface ResolvedItem {
  itemId: string;
  quantity: number;
  name: string;
  description: string;
  iconAssetId?: string;
  equipDef?: (typeof EQUIPMENT)[number];
  itemDef?: (typeof ITEMS)[number];
}

function subTabOf(entry: ResolvedItem): InventorySubTab {
  if (entry.equipDef) return 'equipment';
  if (entry.itemDef?.category === 'consumable') return 'consumable';
  if (entry.itemDef?.category === 'materials') return 'materials';
  return 'keyItem'; // keyItem + lanternUpgrade + anything else non-equip, non-potion
}

/** Marks an equipment card/row as the strongest the player owns for its slot (see
 *  equipmentScore) - shown regardless of whether that item is currently equipped, so it reads
 *  the same in the Inventory tab's Equipment view, the Equipment tab's slot rows, and the equip
 *  picker overlay. */
function BestBadge() {
  return (
    <span
      style={{
        fontSize: 9,
        fontWeight: 'bold',
        color: 'var(--fw-accent)',
        border: '1px solid var(--fw-accent)',
        borderRadius: 3,
        padding: '1px 4px',
        textTransform: 'uppercase',
        letterSpacing: 0.3,
      }}
      title="The strongest item you own for this slot"
    >
      ★ Best
    </span>
  );
}

/** Shown next to a currently-equipped item that isn't the strongest one owned - the Equipment
 *  tab's own nudge to go swap it in, since that's the one place an equipped-but-suboptimal item
 *  would otherwise look no different from an equipped-and-best one. */
function BetterAvailableHint() {
  return (
    <span style={{ fontSize: 10, color: 'var(--fw-danger)', opacity: 0.85 }} title="You own a stronger item for this slot">
      Better available
    </span>
  );
}

export function CharacterMenu({ onClose }: CharacterMenuProps) {
  const [tab, setTab] = useState<'inventory' | 'equipment' | 'crafting'>('inventory');
  const [subTab, setSubTab] = useState<InventorySubTab>('all');
  const [slotFilter, setSlotFilter] = useState<EquipmentSlot | 'all'>('all');
  const [sortBy, setSortBy] = useState<SortOption>('name');
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [equipPickerSlot, setEquipPickerSlot] = useState<EquipmentSlot | null>(null);
  const [craftingSelectedId, setCraftingSelectedId] = useState<string | null>(null);
  const inventory = useInventoryStore((s) => s.items);
  const player = usePlayerStore((s) => s.player);
  const patchEquipment = usePlayerStore((s) => s.patchEquipment);
  const uid = useAuthStore((s) => s.user?.uid);
  const [busy, setBusy] = useState(false);
  useOverlayClose(onClose);

  // Every EquipmentItem def the player owns, grouped by slot, purely to drive the "Best" badge -
  // recomputed each render (inventory is small; no need for useMemo here).
  const ownedEquipmentBySlot = new Map<EquipmentSlot, (typeof EQUIPMENT)[number][]>();
  for (const entry of inventory) {
    const def = EQUIPMENT.find((e) => e.id === entry.itemId);
    if (!def) continue;
    const list = ownedEquipmentBySlot.get(def.slot) ?? [];
    list.push(def);
    ownedEquipmentBySlot.set(def.slot, list);
  }
  const bestIdsBySlot = new Map<EquipmentSlot, Set<string>>();
  for (const [slot, defs] of ownedEquipmentBySlot) {
    bestIdsBySlot.set(slot, bestEquipmentIds(defs));
  }

  async function equip(itemId: string, slot: EquipmentSlot) {
    if (busy) return;
    setBusy(true);
    patchEquipment(slot, itemId); // instant feedback; resync below reconciles with the server
    try {
      await callEquipItem(itemId);
      if (uid) await resyncSave(uid);
    } finally {
      setBusy(false);
    }
  }

  async function unequip(slot: EquipmentSlot) {
    if (busy) return;
    setBusy(true);
    patchEquipment(slot, null); // instant feedback; resync below reconciles with the server
    try {
      await callUnequipItem(slot);
      if (uid) await resyncSave(uid);
    } finally {
      setBusy(false);
    }
  }

  async function useItem(itemId: string) {
    if (busy) return;
    setBusy(true);
    try {
      await callUseItem(itemId);
      if (uid) await resyncSave(uid);
    } finally {
      setBusy(false);
    }
  }

  async function craft(recipeId: string) {
    if (busy) return;
    setBusy(true);
    try {
      await callCraftItem(recipeId);
      if (uid) await resyncSave(uid);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={styles.overlay} onClick={onClose}>
      <Panel className={styles.panel} onClick={(e: React.MouseEvent) => e.stopPropagation()}>
        <OverlayCloseButton onClick={onClose} />
        <div className={styles.tabs}>
          <button
            className={`${styles.tab} ${tab === 'inventory' ? styles.tabActive : ''}`}
            onClick={() => setTab('inventory')}
          >
            Inventory
          </button>
          <button
            className={`${styles.tab} ${tab === 'equipment' ? styles.tabActive : ''}`}
            onClick={() => setTab('equipment')}
          >
            Equipment
          </button>
          <button
            className={`${styles.tab} ${tab === 'crafting' ? styles.tabActive : ''}`}
            onClick={() => setTab('crafting')}
          >
            Crafting
          </button>
        </div>

        {tab === 'inventory' && (() => {
          const resolved: ResolvedItem[] = inventory.map((entry) => {
            const equipDef = EQUIPMENT.find((e) => e.id === entry.itemId);
            const itemDef = ITEMS.find((i) => i.id === entry.itemId);
            return {
              itemId: entry.itemId,
              quantity: entry.quantity,
              name: equipDef?.name ?? itemDef?.name ?? entry.itemId.replace(/-/g, ' '),
              description: equipDef?.description ?? itemDef?.description ?? '',
              iconAssetId: equipDef?.iconAssetId ?? itemDef?.iconAssetId,
              equipDef,
              itemDef,
            };
          });

          const visible = resolved
            .filter((entry) => {
              if (subTab === 'all') return true;
              if (subTab === 'unique') return !!(entry.equipDef?.unique ?? entry.itemDef?.unique);
              return subTabOf(entry) === subTab;
            })
            .filter((entry) => {
              if (subTab !== 'equipment' || slotFilter === 'all') return true;
              return entry.equipDef?.slot === slotFilter;
            })
            .sort((a, b) => {
              if (sortBy === 'name') return a.name.localeCompare(b.name);
              if (sortBy === 'quantityDesc') return b.quantity - a.quantity;
              const categoryDiff = CATEGORY_SORT_ORDER[subTabOf(a)] - CATEGORY_SORT_ORDER[subTabOf(b)];
              return categoryDiff !== 0 ? categoryDiff : a.name.localeCompare(b.name);
            });

          const selected = selectedItemId ? resolved.find((r) => r.itemId === selectedItemId) : undefined;

          return (
            <div>
              <div className={styles.toolbar}>
                <div className={styles.subtabs}>
                  {(Object.keys(SUBTAB_LABELS) as InventorySubTab[]).map((key) => (
                    <button
                      key={key}
                      className={`${styles.subtab} ${subTab === key ? styles.subtabActive : ''}`}
                      onClick={() => {
                        setSubTab(key);
                        setSlotFilter('all');
                      }}
                    >
                      {SUBTAB_LABELS[key]}
                    </button>
                  ))}
                </div>
                <select
                  className={styles.sortSelect}
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as SortOption)}
                >
                  <option value="name">Sort: Name (A–Z)</option>
                  <option value="quantityDesc">Sort: Quantity (high to low)</option>
                  <option value="category">Sort: Category</option>
                </select>
              </div>

              {subTab === 'equipment' && (
                <div className={styles.subtabs} style={{ marginBottom: 10 }}>
                  <button
                    className={`${styles.subtab} ${slotFilter === 'all' ? styles.subtabActive : ''}`}
                    onClick={() => setSlotFilter('all')}
                  >
                    All
                  </button>
                  {SLOT_FILTER_ORDER.map((slot) => (
                    <button
                      key={slot}
                      className={`${styles.subtab} ${slotFilter === slot ? styles.subtabActive : ''}`}
                      onClick={() => setSlotFilter(slot)}
                    >
                      {SLOT_FILTER_LABELS[slot]}
                    </button>
                  ))}
                </div>
              )}

              <div className={styles.grid}>
                {visible.length === 0 && <p style={{ fontSize: 13, opacity: 0.7 }}>Nothing here.</p>}
                {visible.map((entry) => {
                  const { equipDef, itemDef } = entry;
                  const isEquipped = equipDef && player?.equipment[equipDef.slot] === entry.itemId;
                  const isUsable = isUsableEffect(itemDef?.effect);
                  const wouldHelp = player ? itemWouldHaveEffect(itemDef?.effect, player.stats) : false;
                  const isSelected = selectedItemId === entry.itemId;
                  return (
                    <div
                      key={entry.itemId}
                      className={`${styles.itemCard} ${isSelected ? styles.itemCardSelected : ''}`}
                      onClick={() => setSelectedItemId(entry.itemId)}
                    >
                      {entry.iconAssetId && <img src={getAssetUrl(entry.iconAssetId)} alt="" className={styles.icon} />}
                      <span className={styles.itemName}>{entry.name}</span>
                      <span style={{ fontSize: 11, opacity: 0.7 }}>x{entry.quantity}</span>
                      {equipDef && bestIdsBySlot.get(equipDef.slot)?.has(entry.itemId) && <BestBadge />}
                      {equipDef &&
                        (isEquipped ? (
                          <>
                            <span style={{ fontSize: 11, color: 'var(--fw-spirit)' }}>Equipped</span>
                            {formatStatBonuses(equipDef.statBonuses) && (
                              <span style={{ fontSize: 10, color: 'var(--fw-spirit)', opacity: 0.85 }}>
                                {formatStatBonuses(equipDef.statBonuses)}
                              </span>
                            )}
                          </>
                        ) : (
                          <button
                            className={styles.smallButton}
                            disabled={busy}
                            onClick={(e) => {
                              e.stopPropagation();
                              equip(entry.itemId, equipDef.slot);
                            }}
                          >
                            Equip
                          </button>
                        ))}
                      {isUsable && (
                        <button
                          className={styles.smallButton}
                          disabled={busy || !wouldHelp}
                          title={wouldHelp ? undefined : 'Already at maximum - using this would have no effect.'}
                          onClick={(e) => {
                            e.stopPropagation();
                            useItem(entry.itemId);
                          }}
                        >
                          {wouldHelp ? 'Use' : 'Full'}
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>

              {selected && (
                <div className={styles.detailPanel}>
                  <div className={styles.detailHeader}>
                    {selected.iconAssetId && (
                      <img src={getAssetUrl(selected.iconAssetId)} alt="" className={styles.detailIcon} />
                    )}
                    <div>
                      <p className={styles.detailName}>
                        {selected.name} {(selected.equipDef ?? selected.itemDef) && (
                          <TierBadge tier={(selected.equipDef ?? selected.itemDef)!.tier} style={{ marginLeft: 6 }} />
                        )}
                      </p>
                      <p className={styles.detailMeta}>
                        {selected.equipDef
                          ? `${SLOT_LABELS[selected.equipDef.slot]} · x${selected.quantity}`
                          : `${SUBTAB_LABELS[subTabOf(selected)]} · x${selected.quantity}`}
                        {(selected.equipDef?.unique ?? selected.itemDef?.unique) && ' · Unique (cannot be lost, sold, or traded)'}
                      </p>
                    </div>
                  </div>
                  <p className={styles.detailDescription}>{selected.description}</p>
                  {selected.equipDef && formatStatBonuses(selected.equipDef.statBonuses) && (
                    <p className={styles.detailStats}>{formatStatBonuses(selected.equipDef.statBonuses)}</p>
                  )}
                  {selected.itemDef?.effect && (
                    <p className={styles.detailStats}>
                      {selected.itemDef.effect.healHpPercent
                        ? `Restores ${Math.round(selected.itemDef.effect.healHpPercent * 100)}% HP  `
                        : ''}
                      {selected.itemDef.effect.healSpiritPercent
                        ? `Restores ${Math.round(selected.itemDef.effect.healSpiritPercent * 100)}% Spirit  `
                        : ''}
                      {selected.itemDef.effect.restoreOilPercent
                        ? `Restores ${Math.round(selected.itemDef.effect.restoreOilPercent * 100)}% Lantern Oil  `
                        : ''}
                      {selected.itemDef.effect.reviveOnDefeat ? 'Revives on defeat' : ''}
                    </p>
                  )}
                </div>
              )}
            </div>
          );
        })()}

        {tab === 'equipment' && player && (
          <div>
            {EQUIPMENT_SLOTS.map((slot) => {
              const itemId = player.equipment[slot];
              const equipDef = itemId ? EQUIPMENT.find((e) => e.id === itemId) : undefined;
              const eligible = inventory.filter((entry) => EQUIPMENT.find((e) => e.id === entry.itemId)?.slot === slot);
              return (
                <div key={slot} className={styles.slotRow}>
                  <span className={styles.slotName}>{SLOT_LABELS[slot]}</span>
                  {equipDef ? (
                    <>
                      <img src={getAssetUrl(equipDef.iconAssetId)} alt="" className={styles.icon} style={{ width: 32, height: 32 }} />
                      <span style={{ fontSize: 13, flex: 1 }}>
                        {equipDef.name}
                        {formatStatBonuses(equipDef.statBonuses) && (
                          <span style={{ fontSize: 11, color: 'var(--fw-spirit)', marginLeft: 8 }}>
                            {formatStatBonuses(equipDef.statBonuses)}
                          </span>
                        )}
                        <span style={{ marginLeft: 8 }}>
                          {bestIdsBySlot.get(slot)?.has(equipDef.id) ? <BestBadge /> : <BetterAvailableHint />}
                        </span>
                      </span>
                      <button className={styles.smallButton} disabled={busy} onClick={() => unequip(slot)}>
                        Unequip
                      </button>
                    </>
                  ) : (
                    <>
                      <span style={{ fontSize: 13, opacity: 0.5, flex: 1 }}>Empty</span>
                      {eligible.length > 0 && (
                        <button className={styles.smallButton} disabled={busy} onClick={() => setEquipPickerSlot(slot)}>
                          Equip
                        </button>
                      )}
                    </>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {tab === 'crafting' && (() => {
          const recipeIds = Object.keys(RECIPES);
          const groups = CRAFT_GROUP_ORDER.map((group) => ({
            group,
            recipeIds: recipeIds
              .filter((id) => craftGroupOf(ITEMS.find((i) => i.id === RECIPES[id].outputItemId)) === group)
              .sort((a, b) => {
                const tierA = ITEMS.find((i) => i.id === RECIPES[a].outputItemId)?.tier;
                const tierB = ITEMS.find((i) => i.id === RECIPES[b].outputItemId)?.tier;
                return (tierA ? TIER_ORDER[tierA] : 0) - (tierB ? TIER_ORDER[tierB] : 0);
              }),
          })).filter((g) => g.recipeIds.length > 0);

          const selectedRecipe = craftingSelectedId ? RECIPES[craftingSelectedId] : undefined;
          const selectedItem = selectedRecipe ? ITEMS.find((i) => i.id === selectedRecipe.outputItemId) : undefined;
          const canCraft =
            !!selectedRecipe &&
            selectedRecipe.materials.every(
              (m) => (inventory.find((entry) => entry.itemId === m.itemId)?.quantity ?? 0) >= m.quantity,
            );

          return (
            <div>
              {groups.map(({ group, recipeIds: ids }) => (
                <div key={group} style={{ marginBottom: 14 }}>
                  <p className={styles.detailStats} style={{ margin: '0 0 6px' }}>
                    <strong>{CRAFT_GROUP_LABELS[group]}</strong>
                  </p>
                  <div className={styles.grid}>
                    {ids.map((recipeId) => {
                      const item = ITEMS.find((i) => i.id === RECIPES[recipeId].outputItemId);
                      if (!item) return null;
                      const isSelected = craftingSelectedId === recipeId;
                      return (
                        <div
                          key={recipeId}
                          className={`${styles.itemCard} ${isSelected ? styles.itemCardSelected : ''}`}
                          onClick={() => setCraftingSelectedId(recipeId)}
                        >
                          {item.iconAssetId && <img src={getAssetUrl(item.iconAssetId)} alt="" className={styles.icon} />}
                          <span className={styles.itemName}>{item.name}</span>
                          <TierBadge tier={item.tier} />
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}

              {selectedRecipe && selectedItem && (
                <div className={styles.detailPanel}>
                  <div className={styles.detailHeader}>
                    {selectedItem.iconAssetId && (
                      <img src={getAssetUrl(selectedItem.iconAssetId)} alt="" className={styles.detailIcon} />
                    )}
                    <div>
                      <p className={styles.detailName}>
                        {selectedItem.name} <TierBadge tier={selectedItem.tier} style={{ marginLeft: 6 }} />
                      </p>
                      <p className={styles.detailMeta}>{TIER_LABELS[selectedItem.tier]} recipe</p>
                    </div>
                  </div>
                  <p className={styles.detailDescription}>{selectedItem.description}</p>
                  <p className={styles.detailStats} style={{ marginBottom: 4 }}>
                    <strong>Materials needed</strong>
                  </p>
                  {selectedRecipe.materials.map((m) => {
                    const owned = inventory.find((entry) => entry.itemId === m.itemId)?.quantity ?? 0;
                    const short = owned < m.quantity;
                    const materialName = ITEMS.find((i) => i.id === m.itemId)?.name ?? m.itemId.replace(/-/g, ' ');
                    return (
                      <p
                        key={m.itemId}
                        style={{ fontSize: 12, margin: '2px 0', color: short ? 'var(--fw-danger)' : 'var(--fw-text)' }}
                      >
                        {materialName}: {owned} / {m.quantity}
                        {short ? ` (need ${m.quantity - owned} more)` : ''}
                      </p>
                    );
                  })}
                  <button
                    className={styles.smallButton}
                    style={{ marginTop: 10 }}
                    disabled={busy || !canCraft}
                    onClick={() => craft(craftingSelectedId!)}
                  >
                    Craft
                  </button>
                </div>
              )}
            </div>
          );
        })()}

        <p className={styles.closeHint}>Click outside or press Esc to close</p>
      </Panel>

      {equipPickerSlot && (
        <div
          className={styles.overlay}
          style={{ zIndex: 30 }}
          onClick={(e) => {
            e.stopPropagation();
            setEquipPickerSlot(null);
          }}
        >
          <Panel className={styles.panel} onClick={(e: React.MouseEvent) => e.stopPropagation()}>
            <h3 style={{ color: 'var(--fw-accent)', margin: '0 0 12px' }}>Equip {SLOT_LABELS[equipPickerSlot]}</h3>
            <div className={styles.grid}>
              {inventory
                .filter((entry) => EQUIPMENT.find((e) => e.id === entry.itemId)?.slot === equipPickerSlot)
                .map((entry) => {
                  const def = EQUIPMENT.find((e) => e.id === entry.itemId)!;
                  const slot = equipPickerSlot;
                  return (
                    <div
                      key={entry.itemId}
                      className={styles.itemCard}
                      onClick={() => {
                        equip(entry.itemId, slot);
                        setEquipPickerSlot(null);
                      }}
                    >
                      <img src={getAssetUrl(def.iconAssetId)} alt="" className={styles.icon} />
                      <span className={styles.itemName}>{def.name}</span>
                      <span style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                        <TierBadge tier={def.tier} />
                        {bestIdsBySlot.get(equipPickerSlot)?.has(entry.itemId) && <BestBadge />}
                      </span>
                      <p style={{ fontSize: 11, opacity: 0.85, margin: 0, textAlign: 'center' }}>{def.description}</p>
                      {formatStatBonuses(def.statBonuses) && (
                        <span style={{ fontSize: 10, color: 'var(--fw-spirit)' }}>{formatStatBonuses(def.statBonuses)}</span>
                      )}
                    </div>
                  );
                })}
            </div>
            <button className={styles.smallButton} style={{ marginTop: 12 }} onClick={() => setEquipPickerSlot(null)}>
              Cancel
            </button>
          </Panel>
        </div>
      )}
    </div>
  );
}
