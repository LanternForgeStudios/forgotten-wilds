import { useState } from 'react';
import { Panel } from './common/Panel';
import { OverlayCloseButton } from './common/OverlayCloseButton';
import { TierBadge } from './common/TierBadge';
import { BestBadge } from './common/BestBadge';
import { getAssetUrl } from '@/assets/assetManager';
import { equipmentScore } from '@/utils/equipmentScore';
import { slotFamily } from '@/utils/equipmentSlotLabels';
import { usePlayerStore } from '@/state/usePlayerStore';
import { useInventoryStore } from '@/state/useInventoryStore';
import { useAuthStore } from '@/state/useAuthStore';
import { useQuestStore } from '@/state/useQuestStore';
import { useJournalStore } from '@/state/useJournalStore';
import { callPurchaseItem, callSellItem, callUpgradeLanternOil } from '@/firebase/functionsClient';
import { resyncSave } from '@/state/hydrate';
import { useOverlayClose } from '@/hooks/useOverlayClose';
import { useToastStore } from '@/state/useToastStore';
import { sellPriceFor } from '@/utils/sellPrice';
import { formatAilmentResistance, formatStatBonuses } from '@/utils/statBonuses';
import { SLOT_LABELS, SLOT_FILTER_ORDER } from '@/utils/equipmentSlotLabels';
import {
  SHOP_LISTINGS,
  SHOP_TITLES,
  effectiveShopCatalog,
  ITEMS,
  EQUIPMENT,
  LANTERN_OIL_UPGRADE_MAX_TIER,
  LANTERN_OIL_UPGRADE_PRICES,
  LANTERN_OIL_UPGRADE_PER_TIER,
} from '@/data';
import { eligibleLanternUpgrades } from '@/utils/lanternOilUpgradeEligibility';
import { playSound } from '@/audio/audioService';
import type { EquipmentItem, EquipmentSlot, ItemCategory, PlayerEquipment } from '@/types';
import styles from './CharacterMenu.module.css';

interface ShopProps {
  shopId: string;
  onClose: () => void;
  /** Which tab to open on - defaults to 'buy'. Lets a caller (TownScene's shop dialogue branch)
   *  send the player straight to the Upgrade tab when that's what they asked for, instead of
   *  always landing on Buy first. */
  initialTab?: 'buy' | 'sell' | 'upgrade';
}

function defFor(itemId: string) {
  return ITEMS.find((i) => i.id === itemId) ?? EQUIPMENT.find((e) => e.id === itemId);
}

/** Whether buying `def` would be a genuine upgrade over what's currently equipped in its slot
 *  family (see slotFamily - a Charm/Spirit Totem has up to 4 possible homes, everything else just
 *  1). "Upgrade" means either an empty/unfilled slot in that family, or beating the WEAKEST
 *  currently-equipped item there (so buying it and replacing that one would help) - reuses
 *  equipmentScore, the same tier-then-stats ranking CharacterMenu's own "Best" badge is built on. */
function isEquipmentUpgrade(def: EquipmentItem, equipment: PlayerEquipment | undefined): boolean {
  const family = slotFamily(def.slot);
  const equippedScores = family
    .map((slot) => equipment?.[slot])
    .filter((id): id is string => !!id)
    .map((id) => EQUIPMENT.find((e) => e.id === id))
    .filter((d): d is EquipmentItem => !!d)
    .map(equipmentScore);
  if (equippedScores.length < family.length) return true; // at least one empty slot in the family
  return equipmentScore(def) > Math.min(...equippedScores);
}

/** Filter dimension for the Sell tab: every real ItemCategory, plus a synthesized 'equipment'
 *  bucket for anything found in EQUIPMENT (which has no `category` field of its own - see
 *  defFor's merge of the two separate item/equipment arrays). */
type SellTypeFilter = ItemCategory | 'equipment' | 'all';

const SELL_TYPE_LABELS: Record<Exclude<SellTypeFilter, 'all'>, string> = {
  consumable: 'Consumables',
  equipment: 'Equipment',
  keyItem: 'Key Items',
  lanternUpgrade: 'Lantern Upgrades',
  materials: 'Materials',
};

function sellTypeOf(itemDef: (typeof ITEMS)[number] | undefined, equipDef: (typeof EQUIPMENT)[number] | undefined): SellTypeFilter {
  if (equipDef) return 'equipment';
  return itemDef?.category ?? 'materials';
}

interface PendingSale {
  itemId: string;
  name: string;
  quantity: number;
  unitPrice: number;
}

export function Shop({ shopId, onClose, initialTab = 'buy' }: ShopProps) {
  const [tab, setTab] = useState<'buy' | 'sell' | 'upgrade'>(initialTab);
  const player = usePlayerStore((s) => s.player);
  const inventory = useInventoryStore((s) => s.items);
  const uid = useAuthStore((s) => s.user?.uid);
  const questProgress = useQuestStore((s) => s.progress);
  const bossesDefeated = useJournalStore((s) => s.journal.bossesDefeated);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  // How many of each item the "Sell" quantity stepper is currently set to - only meaningful for
  // items owned in stacks of more than 1; defaults to 1 (via ?? below) for anything not touched.
  const [sellQuantities, setSellQuantities] = useState<Record<string, number>>({});
  // Set when "Sell" is clicked, before the actual sellItem call - the confirmation overlay reads
  // this to show exactly what's about to happen, and only calls sell() once the player confirms.
  const [pendingSale, setPendingSale] = useState<PendingSale | null>(null);
  const [sellTypeFilter, setSellTypeFilter] = useState<SellTypeFilter>('all');
  const [sellSlotFilter, setSellSlotFilter] = useState<EquipmentSlot | 'all'>('all');
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
      void playSound('sfx.purchase');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not complete that purchase.');
      void playSound('sfx.ui-error');
    } finally {
      setBusy(null);
    }
  }

  async function confirmSell() {
    if (!pendingSale || busy) return;
    const { itemId, name, quantity } = pendingSale;
    setBusy(itemId);
    setError(null);
    setPendingSale(null);
    try {
      const res = await callSellItem(itemId, quantity);
      if (uid) await resyncSave(uid);
      pushToast(`Sold ${res.soldQuantity}x ${name} for ${res.goldEarned}g`);
      void playSound('sfx.sell');
      setSellQuantities((prev) => {
        const next = { ...prev };
        delete next[itemId];
        return next;
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not sell that item.');
      void playSound('sfx.ui-error');
    } finally {
      setBusy(null);
    }
  }

  async function upgrade(lanternId: string) {
    if (busy) return;
    setBusy(lanternId);
    setError(null);
    try {
      const res = await callUpgradeLanternOil(lanternId);
      if (uid) await resyncSave(uid);
      pushToast(`${itemNameFor(lanternId)} upgraded to tier ${res.newTier}/${LANTERN_OIL_UPGRADE_MAX_TIER} (max Oil now ${res.maxLanternOil}).`);
      void playSound('sfx.purchase');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not upgrade that lantern.');
      void playSound('sfx.ui-error');
    } finally {
      setBusy(null);
    }
  }

  const completedQuestIds = new Set(Object.keys(questProgress).filter((id) => questProgress[id]?.status === 'completed'));
  const catalog = effectiveShopCatalog(shopId, completedQuestIds);
  const listings = SHOP_LISTINGS.filter((l) => catalog.includes(l.itemId));
  const selectedDef = selectedItemId ? defFor(selectedItemId) : undefined;
  const selectedOwnedQuantity = selectedItemId
    ? (inventory.find((i) => i.itemId === selectedItemId)?.quantity ?? 0)
    : 0;

  // The "Upgrade" tab only appears at all once this is non-empty, so a shop with nothing eligible
  // stays exactly as it was before this feature existed.
  const upgradeableLanterns = eligibleLanternUpgrades(shopId, inventory, player?.equipment, bossesDefeated);

  function itemNameFor(itemId: string): string {
    return EQUIPMENT.find((e) => e.id === itemId)?.name ?? itemId;
  }

  return (
    <div className={styles.overlay} onClick={onClose}>
      <Panel className={styles.panel} onClick={(e: React.MouseEvent) => e.stopPropagation()}>
        <OverlayCloseButton onClick={onClose} />
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
          {upgradeableLanterns.length > 0 && (
            <button
              className={`${styles.tab} ${tab === 'upgrade' ? styles.tabActive : ''}`}
              onClick={() => setTab('upgrade')}
            >
              Upgrade Lantern
            </button>
          )}
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
                  {def && 'slot' in def && isEquipmentUpgrade(def, player?.equipment) && (
                    <BestBadge title="Better than what you have equipped in this slot" />
                  )}
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
            .filter((row): row is { entry: (typeof inventory)[number]; price: number } => row.price !== undefined)
            .filter(({ entry }) => {
              if (sellTypeFilter === 'all') return true;
              const itemDef = ITEMS.find((i) => i.id === entry.itemId);
              const equipDef = EQUIPMENT.find((e) => e.id === entry.itemId);
              return sellTypeOf(itemDef, equipDef) === sellTypeFilter;
            })
            .filter(({ entry }) => {
              if (sellTypeFilter !== 'equipment' || sellSlotFilter === 'all') return true;
              return EQUIPMENT.find((e) => e.id === entry.itemId)?.slot === sellSlotFilter;
            });

          return (
            <div>
              <div className={styles.subtabs} style={{ marginBottom: 10 }}>
                <button
                  className={`${styles.subtab} ${sellTypeFilter === 'all' ? styles.subtabActive : ''}`}
                  onClick={() => {
                    setSellTypeFilter('all');
                    setSellSlotFilter('all');
                  }}
                >
                  All
                </button>
                {(Object.keys(SELL_TYPE_LABELS) as Exclude<SellTypeFilter, 'all'>[]).map((key) => (
                  <button
                    key={key}
                    className={`${styles.subtab} ${sellTypeFilter === key ? styles.subtabActive : ''}`}
                    onClick={() => {
                      setSellTypeFilter(key);
                      setSellSlotFilter('all');
                    }}
                  >
                    {SELL_TYPE_LABELS[key]}
                  </button>
                ))}
              </div>
              {sellTypeFilter === 'equipment' && (
                <div className={styles.subtabs} style={{ marginBottom: 10 }}>
                  <button
                    className={`${styles.subtab} ${sellSlotFilter === 'all' ? styles.subtabActive : ''}`}
                    onClick={() => setSellSlotFilter('all')}
                  >
                    All Slots
                  </button>
                  {SLOT_FILTER_ORDER.map((slot) => (
                    <button
                      key={slot}
                      className={`${styles.subtab} ${sellSlotFilter === slot ? styles.subtabActive : ''}`}
                      onClick={() => setSellSlotFilter(slot)}
                    >
                      {SLOT_LABELS[slot]}
                    </button>
                  ))}
                </div>
              )}
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
                const quantity = Math.min(sellQuantities[entry.itemId] ?? 1, entry.quantity);
                return (
                  <div
                    key={entry.itemId}
                    className={`${styles.itemCard} ${isSelected ? styles.itemCardSelected : ''}`}
                    onClick={() => setSelectedItemId(entry.itemId)}
                  >
                    {iconAssetId && <img src={getAssetUrl(iconAssetId)} alt="" className={styles.icon} />}
                    <span className={styles.itemName}>{name}</span>
                    {def?.tier && <TierBadge tier={def.tier} />}
                    <span style={{ fontSize: 11, opacity: 0.8 }}>x{entry.quantity} owned</span>
                    <span style={{ fontSize: 11, opacity: 0.8 }}>{price}g each</span>
                    {isEquipped ? (
                      <span style={{ fontSize: 11, color: 'var(--fw-spirit)' }}>Equipped</span>
                    ) : (
                      <>
                        {entry.quantity > 1 && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }} onClick={(e) => e.stopPropagation()}>
                            <button
                              type="button"
                              className={styles.smallButton}
                              disabled={!!busy || quantity <= 1}
                              onClick={() => setSellQuantities((prev) => ({ ...prev, [entry.itemId]: Math.max(1, quantity - 1) }))}
                            >
                              −
                            </button>
                            <span style={{ fontSize: 12, minWidth: 18, textAlign: 'center' }}>{quantity}</span>
                            <button
                              type="button"
                              className={styles.smallButton}
                              disabled={!!busy || quantity >= entry.quantity}
                              onClick={() =>
                                setSellQuantities((prev) => ({ ...prev, [entry.itemId]: Math.min(entry.quantity, quantity + 1) }))
                              }
                            >
                              +
                            </button>
                          </div>
                        )}
                        <button
                          className={styles.smallButton}
                          disabled={!!busy}
                          onClick={(e) => {
                            e.stopPropagation();
                            setPendingSale({ itemId: entry.itemId, name, quantity, unitPrice: price });
                          }}
                        >
                          {isBusy ? 'Selling…' : `Sell${quantity > 1 ? ` x${quantity}` : ''}`}
                        </button>
                      </>
                    )}
                  </div>
                );
              })}
              </div>
            </div>
          );
        })()}

        {tab === 'upgrade' && (
          <div className={styles.grid}>
            {upgradeableLanterns.map((lanternId) => {
              const def = EQUIPMENT.find((e) => e.id === lanternId);
              const currentTier = player?.lanternOilUpgrades?.[lanternId] ?? 0;
              const maxed = currentTier >= LANTERN_OIL_UPGRADE_MAX_TIER;
              const nextPrice = maxed ? null : LANTERN_OIL_UPGRADE_PRICES[currentTier];
              const canAfford = nextPrice !== null && (player?.gold ?? 0) >= nextPrice;
              const isBusy = busy === lanternId;
              const currentBonus = currentTier * LANTERN_OIL_UPGRADE_PER_TIER;
              return (
                <div key={lanternId} className={styles.itemCard}>
                  {def?.iconAssetId && <img src={getAssetUrl(def.iconAssetId)} alt="" className={styles.icon} />}
                  <span className={styles.itemName}>{def?.name ?? lanternId}</span>
                  {def?.tier && <TierBadge tier={def.tier} />}
                  <span style={{ fontSize: 11, opacity: 0.8 }}>
                    Tier {currentTier}/{LANTERN_OIL_UPGRADE_MAX_TIER} (+{currentBonus} Oil)
                  </span>
                  <span style={{ fontSize: 11, opacity: 0.8 }}>{maxed ? 'Fully upgraded' : `Next tier: ${nextPrice}g`}</span>
                  <button
                    className={styles.smallButton}
                    disabled={!!busy || maxed || !canAfford}
                    onClick={() => upgrade(lanternId)}
                  >
                    {isBusy ? 'Upgrading…' : maxed ? 'Maxed' : 'Upgrade'}
                  </button>
                </div>
              );
            })}
          </div>
        )}

        {error && (
          <p style={{ color: 'var(--fw-danger)', fontSize: 13 }}>{error}</p>
        )}
        <p className={styles.closeHint}>Click outside or press Esc to close</p>
      </Panel>

      {selectedDef && (
        <div
          className={styles.detailOverlay}
          onClick={(e) => {
            e.stopPropagation();
            setSelectedItemId(null);
          }}
        >
          <Panel className={styles.detailPopupPanel} onClick={(e: React.MouseEvent) => e.stopPropagation()}>
            <OverlayCloseButton onClick={() => setSelectedItemId(null)} />
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
              {'ailmentResistance' in selectedDef && formatAilmentResistance(selectedDef.ailmentResistance) && (
                <p className={styles.detailStats}>{formatAilmentResistance(selectedDef.ailmentResistance)}</p>
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
          </Panel>
        </div>
      )}

      {pendingSale && (
        <div
          className={styles.overlay}
          style={{ zIndex: 30 }}
          onClick={(e) => {
            e.stopPropagation();
            setPendingSale(null);
          }}
        >
          <Panel style={{ width: 'min(360px, 90vw)', textAlign: 'center' }} onClick={(e: React.MouseEvent) => e.stopPropagation()}>
            <h3 style={{ color: 'var(--fw-accent)', margin: '0 0 12px' }}>Confirm Sale</h3>
            <p style={{ fontSize: 13, margin: '0 0 16px' }}>
              Sell {pendingSale.quantity}x {pendingSale.name} for {pendingSale.quantity * pendingSale.unitPrice}g?
            </p>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
              <button className={styles.smallButton} onClick={() => setPendingSale(null)}>
                Cancel
              </button>
              <button className={styles.smallButton} onClick={confirmSell}>
                Confirm
              </button>
            </div>
          </Panel>
        </div>
      )}
    </div>
  );
}
