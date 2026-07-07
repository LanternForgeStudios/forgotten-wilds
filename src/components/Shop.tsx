import { useState } from 'react';
import { Panel } from './common/Panel';
import { TierBadge } from './common/TierBadge';
import { getAssetUrl } from '@/assets/assetManager';
import { usePlayerStore } from '@/state/usePlayerStore';
import { useInventoryStore } from '@/state/useInventoryStore';
import { useAuthStore } from '@/state/useAuthStore';
import { callPurchaseItem, callSellItem } from '@/firebase/functionsClient';
import { resyncSave } from '@/state/hydrate';
import { useOverlayClose } from '@/hooks/useOverlayClose';
import { useToastStore } from '@/state/useToastStore';
import { sellPriceFor } from '@/utils/sellPrice';
import { formatStatBonuses } from '@/utils/statBonuses';
import { SHOP_LISTINGS, SHOP_TITLES, SHOP_CATALOGS, ITEMS, EQUIPMENT } from '@/data';
import styles from './CharacterMenu.module.css';

interface ShopProps {
  shopId: string;
  onClose: () => void;
}

function defFor(itemId: string) {
  return ITEMS.find((i) => i.id === itemId) ?? EQUIPMENT.find((e) => e.id === itemId);
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

export function Shop({ shopId, onClose }: ShopProps) {
  const [tab, setTab] = useState<'buy' | 'sell'>('buy');
  const player = usePlayerStore((s) => s.player);
  const inventory = useInventoryStore((s) => s.items);
  const uid = useAuthStore((s) => s.user?.uid);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const pushToast = useToastStore((s) => s.push);
  useOverlayClose(onClose);

  async function buy(itemId: string, name: string, price: number) {
    if (busy) return;
    setBusy(itemId);
    setError(null);
    try {
      await callPurchaseItem(itemId, shopId);
      if (uid) await resyncSave(uid);
      pushToast(`Bought ${name} for ${price}g`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not complete that purchase.');
    } finally {
      setBusy(null);
    }
  }

  async function sell(itemId: string, name: string, price: number) {
    if (busy) return;
    setBusy(itemId);
    setError(null);
    try {
      await callSellItem(itemId, 1);
      if (uid) await resyncSave(uid);
      pushToast(`Sold ${name} for ${price}g`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not sell that item.');
    } finally {
      setBusy(null);
    }
  }

  const catalog = SHOP_CATALOGS[shopId] ?? [];
  const listings = SHOP_LISTINGS.filter((l) => catalog.includes(l.itemId));
  const selectedDef = selectedItemId ? defFor(selectedItemId) : undefined;
  const selectedOwnedQuantity = selectedItemId
    ? (inventory.find((i) => i.itemId === selectedItemId)?.quantity ?? 0)
    : 0;

  return (
    <div className={styles.overlay} onClick={onClose}>
      <Panel className={styles.panel} onClick={(e: React.MouseEvent) => e.stopPropagation()}>
        <h2 style={{ color: 'var(--fw-accent)', margin: '0 0 12px' }}>{SHOP_TITLES[shopId] ?? 'Shop'}</h2>
        <p style={{ fontSize: 13, marginTop: 0 }}>Your gold: {player?.gold ?? 0}g</p>

        <div className={styles.tabs}>
          <button
            className={`${styles.tab} ${tab === 'buy' ? styles.tabActive : ''}`}
            onClick={() => setTab('buy')}
          >
            Buy
          </button>
          <button
            className={`${styles.tab} ${tab === 'sell' ? styles.tabActive : ''}`}
            onClick={() => setTab('sell')}
          >
            Sell
          </button>
        </div>

        {tab === 'buy' && (
          <div className={styles.grid}>
            {listings.length === 0 && <p style={{ fontSize: 13, opacity: 0.7 }}>Nothing for sale here.</p>}
            {listings.map((listing) => {
              const def = defFor(listing.itemId);
              const iconAssetId = def && 'iconAssetId' in def ? def.iconAssetId : undefined;
              const name = def?.name ?? listing.itemId;
              const canAfford = (player?.gold ?? 0) >= listing.price;
              const isBusy = busy === listing.itemId;
              const isSelected = selectedItemId === listing.itemId;
              return (
                <div
                  key={listing.itemId}
                  className={`${styles.itemCard} ${isSelected ? styles.itemCardSelected : ''}`}
                  onClick={() => setSelectedItemId(listing.itemId)}
                >
                  {iconAssetId && <img src={getAssetUrl(iconAssetId)} alt="" className={styles.icon} />}
                  <span className={styles.itemName}>{name}</span>
                  {def?.tier && <TierBadge tier={def.tier} />}
                  <span style={{ fontSize: 11, opacity: 0.8 }}>{listing.price}g</span>
                  <button
                    className={styles.smallButton}
                    disabled={!!busy || !canAfford}
                    onClick={(e) => {
                      e.stopPropagation();
                      buy(listing.itemId, name, listing.price);
                    }}
                  >
                    {isBusy ? 'Buying…' : 'Buy'}
                  </button>
                </div>
              );
            })}
          </div>
        )}

        {tab === 'sell' && (() => {
          const sellable = inventory
            .map((entry) => ({ entry, price: sellPriceFor(entry.itemId) }))
            .filter((row): row is { entry: (typeof inventory)[number]; price: number } => row.price !== undefined);

          return (
            <div className={styles.grid}>
              {sellable.length === 0 && <p style={{ fontSize: 13, opacity: 0.7 }}>Nothing to sell.</p>}
              {sellable.map(({ entry, price }) => {
                const def = defFor(entry.itemId);
                const iconAssetId = def && 'iconAssetId' in def ? def.iconAssetId : undefined;
                const name = def?.name ?? entry.itemId;
                const equippedSlot = def && 'slot' in def ? def.slot : undefined;
                const isEquipped = equippedSlot ? player?.equipment[equippedSlot] === entry.itemId : false;
                const isBusy = busy === entry.itemId;
                const isSelected = selectedItemId === entry.itemId;
                return (
                  <div
                    key={entry.itemId}
                    className={`${styles.itemCard} ${isSelected ? styles.itemCardSelected : ''}`}
                    onClick={() => setSelectedItemId(entry.itemId)}
                  >
                    {iconAssetId && <img src={getAssetUrl(iconAssetId)} alt="" className={styles.icon} />}
                    <span className={styles.itemName}>{name}</span>
                    {def?.tier && <TierBadge tier={def.tier} />}
                    <span style={{ fontSize: 11, opacity: 0.8 }}>x{entry.quantity}</span>
                    <span style={{ fontSize: 11, opacity: 0.8 }}>{price}g each</span>
                    {isEquipped ? (
                      <span style={{ fontSize: 11, color: 'var(--fw-spirit)' }}>Equipped</span>
                    ) : (
                      <button
                        className={styles.smallButton}
                        disabled={!!busy}
                        onClick={(e) => {
                          e.stopPropagation();
                          sell(entry.itemId, name, price);
                        }}
                      >
                        {isBusy ? 'Selling…' : 'Sell 1'}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          );
        })()}

        {selectedDef && (
          <div className={styles.detailPanel}>
            <div className={styles.detailHeader}>
              {'iconAssetId' in selectedDef && selectedDef.iconAssetId && (
                <img src={getAssetUrl(selectedDef.iconAssetId)} alt="" className={styles.detailIcon} />
              )}
              <div>
                <p className={styles.detailName}>
                  {selectedDef.name} <TierBadge tier={selectedDef.tier} style={{ marginLeft: 6 }} />
                </p>
                <p className={styles.detailMeta}>
                  {'slot' in selectedDef ? SLOT_LABELS[selectedDef.slot] : 'category' in selectedDef ? selectedDef.category : ''}
                  {selectedOwnedQuantity > 0 && ` · You own x${selectedOwnedQuantity}`}
                  {selectedDef.unique && ' · Unique (cannot be lost, sold, or traded)'}
                </p>
              </div>
            </div>
            <p className={styles.detailDescription}>{selectedDef.description}</p>
            {'statBonuses' in selectedDef && formatStatBonuses(selectedDef.statBonuses) && (
              <p className={styles.detailStats}>{formatStatBonuses(selectedDef.statBonuses)}</p>
            )}
            {'effect' in selectedDef && selectedDef.effect && (
              <p className={styles.detailStats}>
                {selectedDef.effect.healHpPercent
                  ? `Restores ${Math.round(selectedDef.effect.healHpPercent * 100)}% HP  `
                  : ''}
                {selectedDef.effect.healSpiritPercent
                  ? `Restores ${Math.round(selectedDef.effect.healSpiritPercent * 100)}% Spirit  `
                  : ''}
                {selectedDef.effect.restoreOilPercent
                  ? `Restores ${Math.round(selectedDef.effect.restoreOilPercent * 100)}% Lantern Oil  `
                  : ''}
              </p>
            )}
          </div>
        )}

        {error && (
          <p style={{ color: 'var(--fw-danger)', fontSize: 13 }}>{error}</p>
        )}
        <p className={styles.closeHint}>Click outside or press Esc to close</p>
      </Panel>
    </div>
  );
}
