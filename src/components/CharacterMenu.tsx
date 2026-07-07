import { useState } from 'react';
import { Panel } from './common/Panel';
import { TierBadge } from './common/TierBadge';
import { getAssetUrl } from '@/assets/assetManager';
import { useInventoryStore } from '@/state/useInventoryStore';
import { usePlayerStore } from '@/state/usePlayerStore';
import { useAuthStore } from '@/state/useAuthStore';
import { callEquipItem, callUnequipItem, callUseItem } from '@/firebase/functionsClient';
import { resyncSave } from '@/state/hydrate';
import { useOverlayClose } from '@/hooks/useOverlayClose';
import { ITEMS, EQUIPMENT } from '@/data';
import { EQUIPMENT_SLOTS, type EquipmentSlot } from '@/types';
import { formatStatBonuses } from '@/utils/statBonuses';
import { isUsableEffect, itemWouldHaveEffect } from '@/utils/itemEffect';
import styles from './CharacterMenu.module.css';

interface CharacterMenuProps {
  onClose: () => void;
}

const SLOT_LABELS: Record<string, string> = {
  weapon: 'Weapon',
  armor: 'Armor',
  boots: 'Boots',
  gloves: 'Gloves',
  charm: 'Charm',
  lantern: 'Lantern',
  spiritTotem: 'Spirit Totem',
};

type InventorySubTab = 'all' | 'consumable' | 'equipment' | 'keyItem' | 'unique';

const SUBTAB_LABELS: Record<InventorySubTab, string> = {
  all: 'All',
  consumable: 'Consumables',
  equipment: 'Equipment',
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

type SortOption = 'name' | 'quantityDesc';

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
  return 'keyItem'; // keyItem + lanternUpgrade + anything else non-equip, non-potion
}

export function CharacterMenu({ onClose }: CharacterMenuProps) {
  const [tab, setTab] = useState<'inventory' | 'equipment'>('inventory');
  const [subTab, setSubTab] = useState<InventorySubTab>('all');
  const [slotFilter, setSlotFilter] = useState<EquipmentSlot | 'all'>('all');
  const [sortBy, setSortBy] = useState<SortOption>('name');
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [equipPickerSlot, setEquipPickerSlot] = useState<EquipmentSlot | null>(null);
  const inventory = useInventoryStore((s) => s.items);
  const player = usePlayerStore((s) => s.player);
  const patchEquipment = usePlayerStore((s) => s.patchEquipment);
  const uid = useAuthStore((s) => s.user?.uid);
  const [busy, setBusy] = useState(false);
  useOverlayClose(onClose);

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

  return (
    <div className={styles.overlay} onClick={onClose}>
      <Panel className={styles.panel} onClick={(e: React.MouseEvent) => e.stopPropagation()}>
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
            .sort((a, b) =>
              sortBy === 'name' ? a.name.localeCompare(b.name) : b.quantity - a.quantity,
            );

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
                      <TierBadge tier={def.tier} />
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
