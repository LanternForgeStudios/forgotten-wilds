import { useState } from 'react';
import { Panel } from './common/Panel';
import { getAssetUrl } from '@/assets/assetManager';
import { useInventoryStore } from '@/state/useInventoryStore';
import { usePlayerStore } from '@/state/usePlayerStore';
import { useAuthStore } from '@/state/useAuthStore';
import { callEquipItem, callUnequipItem, callUseItem } from '@/firebase/functionsClient';
import { resyncSave } from '@/state/hydrate';
import { useOverlayClose } from '@/hooks/useOverlayClose';
import { ITEMS, EQUIPMENT } from '@/data';
import { EQUIPMENT_SLOTS, type EquipmentSlot } from '@/types';
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

type InventorySubTab = 'all' | 'consumable' | 'equipment' | 'keyItem';

const SUBTAB_LABELS: Record<InventorySubTab, string> = {
  all: 'All',
  consumable: 'Consumables',
  equipment: 'Equipment',
  keyItem: 'Key Items',
};

type SortOption = 'name' | 'quantityDesc';

const STAT_LABELS: Record<string, string> = {
  attack: 'ATK',
  defense: 'DEF',
  speed: 'SPD',
  maxHp: 'Max HP',
  maxSpirit: 'Max Spirit',
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
  return 'keyItem'; // keyItem + lanternUpgrade + anything else non-equip, non-potion
}

export function CharacterMenu({ onClose }: CharacterMenuProps) {
  const [tab, setTab] = useState<'inventory' | 'equipment'>('inventory');
  const [subTab, setSubTab] = useState<InventorySubTab>('all');
  const [sortBy, setSortBy] = useState<SortOption>('name');
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
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
            .filter((entry) => subTab === 'all' || subTabOf(entry) === subTab)
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
                      onClick={() => setSubTab(key)}
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

              <div className={styles.grid}>
                {visible.length === 0 && <p style={{ fontSize: 13, opacity: 0.7 }}>Nothing here.</p>}
                {visible.map((entry) => {
                  const { equipDef, itemDef } = entry;
                  const isEquipped = equipDef && player?.equipment[equipDef.slot] === entry.itemId;
                  const isUsable = itemDef?.effect && (itemDef.effect.healHp || itemDef.effect.healSpirit);
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
                          <span style={{ fontSize: 11, color: 'var(--fw-spirit)' }}>Equipped</span>
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
                          disabled={busy}
                          onClick={(e) => {
                            e.stopPropagation();
                            useItem(entry.itemId);
                          }}
                        >
                          Use
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
                      <p className={styles.detailName}>{selected.name}</p>
                      <p className={styles.detailMeta}>
                        {selected.equipDef
                          ? `${SLOT_LABELS[selected.equipDef.slot]} · x${selected.quantity}`
                          : `${SUBTAB_LABELS[subTabOf(selected)]} · x${selected.quantity}`}
                      </p>
                    </div>
                  </div>
                  <p className={styles.detailDescription}>{selected.description}</p>
                  {selected.equipDef && Object.keys(selected.equipDef.statBonuses).length > 0 && (
                    <p className={styles.detailStats}>
                      {Object.entries(selected.equipDef.statBonuses)
                        .map(([stat, value]) => `${(value as number) > 0 ? '+' : ''}${value} ${STAT_LABELS[stat] ?? stat}`)
                        .join('  ·  ')}
                    </p>
                  )}
                  {selected.itemDef?.effect && (
                    <p className={styles.detailStats}>
                      {selected.itemDef.effect.healHp ? `Restores ${selected.itemDef.effect.healHp} HP  ` : ''}
                      {selected.itemDef.effect.healSpirit ? `Restores ${selected.itemDef.effect.healSpirit} Spirit  ` : ''}
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
              return (
                <div key={slot} className={styles.slotRow}>
                  <span className={styles.slotName}>{SLOT_LABELS[slot]}</span>
                  {equipDef ? (
                    <>
                      <img src={getAssetUrl(equipDef.iconAssetId)} alt="" className={styles.icon} style={{ width: 32, height: 32 }} />
                      <span style={{ fontSize: 13, flex: 1 }}>{equipDef.name}</span>
                      <button className={styles.smallButton} disabled={busy} onClick={() => unequip(slot)}>
                        Unequip
                      </button>
                    </>
                  ) : (
                    <span style={{ fontSize: 13, opacity: 0.5, flex: 1 }}>Empty</span>
                  )}
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
