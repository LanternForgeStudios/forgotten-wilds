import { useState } from 'react';
import { Panel } from './common/Panel';
import { getAssetUrl } from '@/assets/assetManager';
import { usePlayerStore } from '@/state/usePlayerStore';
import { useAuthStore } from '@/state/useAuthStore';
import { callPurchaseItem } from '@/firebase/functionsClient';
import { resyncSave } from '@/state/hydrate';
import { SHOP_LISTINGS, ITEMS, EQUIPMENT } from '@/data';
import styles from './CharacterMenu.module.css';

interface ShopProps {
  onClose: () => void;
}

export function Shop({ onClose }: ShopProps) {
  const player = usePlayerStore((s) => s.player);
  const uid = useAuthStore((s) => s.user?.uid);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function buy(itemId: string) {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await callPurchaseItem(itemId);
      if (uid) await resyncSave(uid);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not complete that purchase.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={styles.overlay} onClick={onClose}>
      <Panel className={styles.panel} onClick={(e: React.MouseEvent) => e.stopPropagation()}>
        <h2 style={{ color: 'var(--fw-accent)', margin: '0 0 12px' }}>Mara Vale's General Store</h2>
        <p style={{ fontSize: 13, marginTop: 0 }}>Your gold: {player?.gold ?? 0}g</p>
        <div className={styles.grid}>
          {SHOP_LISTINGS.map((listing) => {
            const def = ITEMS.find((i) => i.id === listing.itemId) ?? EQUIPMENT.find((e) => e.id === listing.itemId);
            const iconAssetId = def && 'iconAssetId' in def ? def.iconAssetId : undefined;
            const name = def?.name ?? listing.itemId;
            const canAfford = (player?.gold ?? 0) >= listing.price;
            return (
              <div key={listing.itemId} className={styles.itemCard}>
                {iconAssetId && <img src={getAssetUrl(iconAssetId)} alt="" className={styles.icon} />}
                <span className={styles.itemName}>{name}</span>
                <span style={{ fontSize: 11, opacity: 0.8 }}>{listing.price}g</span>
                <button
                  className={styles.smallButton}
                  disabled={busy || !canAfford}
                  onClick={() => buy(listing.itemId)}
                >
                  Buy
                </button>
              </div>
            );
          })}
        </div>
        {error && (
          <p style={{ color: 'var(--fw-danger)', fontSize: 13 }}>{error}</p>
        )}
        <p className={styles.closeHint}>Click outside to close</p>
      </Panel>
    </div>
  );
}
