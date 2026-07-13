import { useState } from 'react';
import { useInventoryStore } from '@/state/useInventoryStore';
import { usePlayerStore } from '@/state/usePlayerStore';
import { ITEMS, EQUIPMENT } from '@/data';
import { SLOT_LABELS } from '@/utils/equipmentSlotLabels';
import type { EquipmentSlot, ItemCategory } from '@/types';
import styles from './UserProfile.module.css';
import subtabStyles from './CharacterMenu.module.css';

/** Same filter dimension as Shop.tsx's Sell tab - every real ItemCategory, plus a synthesized
 *  'equipment' bucket for anything found in EQUIPMENT (which has no `category` field of its own). */
type TradeTypeFilter = ItemCategory | 'equipment' | 'all';

const TRADE_TYPE_LABELS: Record<Exclude<TradeTypeFilter, 'all'>, string> = {
  consumable: 'Consumables',
  equipment: 'Equipment',
  keyItem: 'Key Items',
  lanternUpgrade: 'Lantern Upgrades',
  materials: 'Materials',
};

const SLOT_FILTER_ORDER: EquipmentSlot[] = ['armor', 'weapon', 'boots', 'gloves', 'lantern', 'charm', 'spiritTotem'];

function tradeTypeOf(itemDef: (typeof ITEMS)[number] | undefined, equipDef: (typeof EQUIPMENT)[number] | undefined): TradeTypeFilter {
  if (equipDef) return 'equipment';
  return itemDef?.category ?? 'materials';
}

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
  // Component-local, not lifted to UserProfile.tsx - this panel is reused for both a fresh
  // proposal and a counter-offer across different trade targets, so there's no reason a filter
  // choice should persist across sessions.
  const [typeFilter, setTypeFilter] = useState<TradeTypeFilter>('all');
  const [slotFilter, setSlotFilter] = useState<EquipmentSlot | 'all'>('all');

  const equippedItemIds = new Set(Object.values(player?.equipment ?? {}).filter((id): id is string => !!id));
  const pickable = inventory
    .filter((entry) => {
      const isUnique = !!(ITEMS.find((i) => i.id === entry.itemId)?.unique || EQUIPMENT.find((e) => e.id === entry.itemId)?.unique);
      return !isUnique && !equippedItemIds.has(entry.itemId);
    })
    .filter((entry) => {
      if (typeFilter === 'all') return true;
      const itemDef = ITEMS.find((i) => i.id === entry.itemId);
      const equipDef = EQUIPMENT.find((e) => e.id === entry.itemId);
      return tradeTypeOf(itemDef, equipDef) === typeFilter;
    })
    .filter((entry) => {
      if (typeFilter !== 'equipment' || slotFilter === 'all') return true;
      return EQUIPMENT.find((e) => e.id === entry.itemId)?.slot === slotFilter;
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
      <div className={subtabStyles.subtabs} style={{ marginBottom: 8 }}>
        <button
          className={`${subtabStyles.subtab} ${typeFilter === 'all' ? subtabStyles.subtabActive : ''}`}
          onClick={() => {
            setTypeFilter('all');
            setSlotFilter('all');
          }}
        >
          All
        </button>
        {(Object.keys(TRADE_TYPE_LABELS) as Exclude<TradeTypeFilter, 'all'>[]).map((key) => (
          <button
            key={key}
            className={`${subtabStyles.subtab} ${typeFilter === key ? subtabStyles.subtabActive : ''}`}
            onClick={() => {
              setTypeFilter(key);
              setSlotFilter('all');
            }}
          >
            {TRADE_TYPE_LABELS[key]}
          </button>
        ))}
      </div>
      {typeFilter === 'equipment' && (
        <div className={subtabStyles.subtabs} style={{ marginBottom: 8 }}>
          <button
            className={`${subtabStyles.subtab} ${slotFilter === 'all' ? subtabStyles.subtabActive : ''}`}
            onClick={() => setSlotFilter('all')}
          >
            All Slots
          </button>
          {SLOT_FILTER_ORDER.map((slot) => (
            <button
              key={slot}
              className={`${subtabStyles.subtab} ${slotFilter === slot ? subtabStyles.subtabActive : ''}`}
              onClick={() => setSlotFilter(slot)}
            >
              {SLOT_LABELS[slot]}
            </button>
          ))}
        </div>
      )}
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
