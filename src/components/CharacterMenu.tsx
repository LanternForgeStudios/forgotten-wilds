import { useState } from 'react';
import { Panel } from './common/Panel';
import { getAssetUrl } from '@/assets/assetManager';
import { useInventoryStore } from '@/state/useInventoryStore';
import { usePlayerStore } from '@/state/usePlayerStore';
import { useAuthStore } from '@/state/useAuthStore';
import { callEquipItem, callUnequipItem } from '@/firebase/functionsClient';
import { resyncSave } from '@/state/hydrate';
import { useOverlayClose } from '@/hooks/useOverlayClose';
import { ITEMS, EQUIPMENT } from '@/data';
import { EQUIPMENT_SLOTS } from '@/types';
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

export function CharacterMenu({ onClose }: CharacterMenuProps) {
  const [tab, setTab] = useState<'inventory' | 'equipment'>('inventory');
  const inventory = useInventoryStore((s) => s.items);
  const player = usePlayerStore((s) => s.player);
  const uid = useAuthStore((s) => s.user?.uid);
  const [busy, setBusy] = useState(false);
  useOverlayClose(onClose);

  async function equip(itemId: string) {
    if (busy) return;
    setBusy(true);
    try {
      await callEquipItem(itemId);
      if (uid) await resyncSave(uid);
    } finally {
      setBusy(false);
    }
  }

  async function unequip(slot: string) {
    if (busy) return;
    setBusy(true);
    try {
      await callUnequipItem(slot);
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

        {tab === 'inventory' && (
          <div className={styles.grid}>
            {inventory.length === 0 && <p style={{ fontSize: 13, opacity: 0.7 }}>Your pack is empty.</p>}
            {inventory.map((entry) => {
              const equipDef = EQUIPMENT.find((e) => e.id === entry.itemId);
              const itemDef = ITEMS.find((i) => i.id === entry.itemId);
              const iconAssetId = equipDef?.iconAssetId ?? itemDef?.iconAssetId;
              const name = equipDef?.name ?? itemDef?.name ?? entry.itemId.replace(/-/g, ' ');
              return (
                <div key={entry.itemId} className={styles.itemCard}>
                  {iconAssetId && <img src={getAssetUrl(iconAssetId)} alt="" className={styles.icon} />}
                  <span className={styles.itemName}>{name}</span>
                  <span style={{ fontSize: 11, opacity: 0.7 }}>x{entry.quantity}</span>
                  {equipDef && (
                    <button className={styles.smallButton} disabled={busy} onClick={() => equip(entry.itemId)}>
                      Equip
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}

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
