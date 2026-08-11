import { Panel } from './common/Panel';
import { OverlayCloseButton } from './common/OverlayCloseButton';
import { getAssetUrl } from '@/assets/assetManager';
import { ITEMS } from '@/data';
import { itemDisplayName, itemIconAssetId } from '@/utils/itemName';
import { itemEffectGroupOf, ITEM_EFFECT_GROUP_ORDER, ITEM_EFFECT_GROUP_LABELS } from '@/utils/itemEffect';
import styles from './ItemUseMenu.module.css';

export interface ItemMenuEntry {
  itemId: string;
  quantity: number;
  /** Whether using one more of this item right now would do anything (a cure item with no
   *  matching active ailment, or a healing/spirit/oil item already at its max, would not) -
   *  computed by the caller since the exact stat/ailment shape differs slightly between solo
   *  combat's Stats object and party/PvP's PartyPlayerStats. */
  wouldHelp: boolean;
  /** How many of this item are already queued to be used when "Done" is pressed. */
  queued: number;
}

interface ItemUseMenuProps {
  items: ItemMenuEntry[];
  /** The shared 3-items-per-turn cap (see CombatScene.tsx's own canQueueMore) - false disables
   *  every "+"/Add button regardless of an individual item's own wouldHelp. */
  canQueueMore: boolean;
  /** True while the queued items are actually being applied (the "Done" round-trip in flight) -
   *  disables every +/-/Add/Remove button and swaps the Done button's own label. */
  busy: boolean;
  onQueue: (itemId: string) => void;
  onDequeue: (itemId: string) => void;
  onDone: () => void;
  onClose: () => void;
}

/** Groups a battle's usable items by effect (HP/Spirit/Oil/Cure - see ITEM_EFFECT_GROUP_ORDER)
 *  into side-by-side columns instead of one long flat list, with the Cure group specifically
 *  split into 2 sub-columns (up to 5 possible ailment cures made it the tallest group by far).
 *  Shared by CombatScene.tsx (solo), EndlessBattlePanel.tsx (party/Endless Battle), and
 *  PvpBattlePanel.tsx (PvP) so all three combat surfaces present the same item tray the same way,
 *  replacing two of those screens' own narrower single-column list with solo combat's original,
 *  more organized layout. */
export function ItemUseMenu({ items, canQueueMore, busy, onQueue, onDequeue, onDone, onClose }: ItemUseMenuProps) {
  return (
    <div className={styles.overlay} onClick={() => !busy && onClose()}>
      <Panel className={styles.itemMenuPanel} onClick={(e: React.MouseEvent) => e.stopPropagation()}>
        {!busy && <OverlayCloseButton onClick={onClose} />}
        <h3 className={styles.title}>Use Items</h3>
        {items.length === 0 ? (
          <p style={{ fontSize: 12 }}>No usable items.</p>
        ) : (
          <div className={styles.itemMenuColumns}>
            {ITEM_EFFECT_GROUP_ORDER.map((group) => {
              const groupItems = items.filter((i) => itemEffectGroupOf(ITEMS.find((d) => d.id === i.itemId)) === group);
              if (groupItems.length === 0) return null;
              return (
                <div key={group} className={group === 'cure' ? styles.itemMenuColumnGrid : styles.itemMenuColumn}>
                  <p className={styles.itemMenuColumnTitle}>{ITEM_EFFECT_GROUP_LABELS[group]}</p>
                  {groupItems.map((entry) => {
                    const def = ITEMS.find((d) => d.id === entry.itemId);
                    const cureAilmentId = def?.effect?.cureAilmentId;
                    const canAdd = entry.wouldHelp && canQueueMore && entry.queued < entry.quantity;
                    return (
                      <div
                        key={entry.itemId}
                        className={cureAilmentId && entry.wouldHelp ? `${styles.itemRow} ${styles.itemRowCureReady}` : styles.itemRow}
                      >
                        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          {itemIconAssetId(entry.itemId) && (
                            <img
                              src={getAssetUrl(itemIconAssetId(entry.itemId)!)}
                              alt=""
                              style={{ width: 20, height: 20, imageRendering: 'pixelated', flexShrink: 0 }}
                            />
                          )}
                          <span>
                            {itemDisplayName(entry.itemId)} x{entry.quantity}
                            {entry.queued > 0 && ` — queued: ${entry.queued}`}
                            {!entry.wouldHelp && (cureAilmentId ? ' (Not needed)' : ' (Full)')}
                          </span>
                        </span>
                        <div style={{ display: 'flex', gap: 4 }}>
                          <button
                            type="button"
                            className={styles.smallButton}
                            disabled={busy || entry.queued === 0}
                            onClick={() => onDequeue(entry.itemId)}
                          >
                            -
                          </button>
                          <button
                            type="button"
                            className={styles.smallButton}
                            disabled={busy || !canAdd}
                            title={
                              entry.wouldHelp
                                ? undefined
                                : cureAilmentId
                                  ? 'Not needed right now - you do not have that ailment.'
                                  : 'Already at maximum - using this would have no effect.'
                            }
                            onClick={() => onQueue(entry.itemId)}
                          >
                            +
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        )}
        <button type="button" className={styles.smallButton} disabled={busy} onClick={onDone} style={{ marginTop: 12 }}>
          {busy ? 'Using items…' : 'Done'}
        </button>
      </Panel>
    </div>
  );
}
