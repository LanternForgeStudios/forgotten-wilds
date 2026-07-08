import { useState } from 'react';
import { useInventoryStore } from '@/state/useInventoryStore';
import { usePlayerStore } from '@/state/usePlayerStore';
import { ITEMS, EQUIPMENT } from '@/data';
import styles from './UserProfile.module.css';

interface TradeOfferPanelProps {
  title: string;
  submitLabel: string;
  busy: boolean;
  onSubmit: (items: { itemId: string; quantity: number }[], gold: number) => void;
  onCancel: () => void;
}

/** Builds an items+gold offer - used both for a fresh trade proposal and for the recipient's
 *  counter-offer, since both are the exact same "pick what you're willing to give up" shape.
 *  Only non-unique, non-equipped items are pickable (mirrors tradeEngine.ts's
 *  validateTradeOfferItems server-side - this is just the client-side reflection of the same
 *  rule, not a substitute for it, since the server re-validates everything regardless). */
export function TradeOfferPanel({ title, submitLabel, busy, onSubmit, onCancel }: TradeOfferPanelProps) {
  const inventory = useInventoryStore((s) => s.items);
  const player = usePlayerStore((s) => s.player);
  const [selected, setSelected] = useState<Record<string, number>>({});
  const [goldInput, setGoldInput] = useState('0');

  const equippedItemIds = new Set(Object.values(player?.equipment ?? {}).filter((id): id is string => !!id));
  const pickable = inventory.filter((entry) => {
    const isUnique = !!(ITEMS.find((i) => i.id === entry.itemId)?.unique || EQUIPMENT.find((e) => e.id === entry.itemId)?.unique);
    return !isUnique && !equippedItemIds.has(entry.itemId);
  });

  function itemName(itemId: string): string {
    return EQUIPMENT.find((e) => e.id === itemId)?.name ?? ITEMS.find((i) => i.id === itemId)?.name ?? itemId.replace(/-/g, ' ');
  }

  function setQuantity(itemId: string, quantity: number, max: number) {
    const clamped = Math.max(0, Math.min(max, Math.floor(quantity) || 0));
    setSelected((prev) => {
      const next = { ...prev };
      if (clamped === 0) delete next[itemId];
      else next[itemId] = clamped;
      return next;
    });
  }

  const gold = Math.max(0, Math.min(player?.gold ?? 0, Math.floor(Number(goldInput)) || 0));
  const items = Object.entries(selected).map(([itemId, quantity]) => ({ itemId, quantity }));
  const isEmpty = items.length === 0 && gold === 0;

  return (
    <div className={styles.tradePanel}>
      <h3 className={styles.sectionTitle}>{title}</h3>
      <div className={styles.list}>
        {pickable.length === 0 && <p className={styles.empty}>No tradeable items in your inventory.</p>}
        {pickable.map((entry) => (
          <div key={entry.itemId} className={styles.row}>
            <span className={styles.rowName}>
              {itemName(entry.itemId)} (own {entry.quantity})
            </span>
            <input
              className={styles.tradeQuantityInput}
              type="number"
              min={0}
              max={entry.quantity}
              value={selected[entry.itemId] ?? 0}
              onChange={(e) => setQuantity(entry.itemId, Number(e.target.value), entry.quantity)}
            />
          </div>
        ))}
      </div>
      <div className={styles.row}>
        <span className={styles.rowName}>Gold (you have {player?.gold ?? 0})</span>
        <input
          className={styles.tradeQuantityInput}
          type="number"
          min={0}
          max={player?.gold ?? 0}
          value={goldInput}
          onChange={(e) => setGoldInput(e.target.value)}
        />
      </div>
      <div className={styles.searchBar}>
        <button className={styles.smallButton} disabled={busy || isEmpty} onClick={() => onSubmit(items, gold)}>
          {submitLabel}
        </button>
        <button className={styles.smallButton} disabled={busy} onClick={onCancel}>
          Cancel
        </button>
      </div>
    </div>
  );
}
