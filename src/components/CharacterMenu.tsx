import { useState } from 'react';
import { Panel } from './common/Panel';
import { OverlayCloseButton } from './common/OverlayCloseButton';
import { TierBadge } from './common/TierBadge';
import { BestBadge } from './common/BestBadge';
import { getAssetUrl } from '@/assets/assetManager';
import { useInventoryStore } from '@/state/useInventoryStore';
import { usePlayerStore } from '@/state/usePlayerStore';
import { useAuthStore } from '@/state/useAuthStore';
import { callEquipItem, callUnequipItem, callUseItem, callCraftItem } from '@/firebase/functionsClient';
import { resyncSave } from '@/state/hydrate';
import { useOverlayClose } from '@/hooks/useOverlayClose';
import { ITEMS, EQUIPMENT, RECIPES, QUESTS } from '@/data';
import { EQUIPMENT_SLOTS, type EquipmentSlot } from '@/types';
import { formatAilmentResistance, formatStatBonuses } from '@/utils/statBonuses';
import { bestEquipmentIds } from '@/utils/equipmentScore';
import { isUsableEffect, itemWouldHaveEffect, itemEffectGroupOf, ITEM_EFFECT_GROUP_ORDER, ITEM_EFFECT_GROUP_LABELS } from '@/utils/itemEffect';
import { SLOT_LABELS, SLOT_FILTER_ORDER, slotFamily, isSlotUnlocked, SLOT_UNLOCK_QUEST_ID } from '@/utils/equipmentSlotLabels';
import { useQuestStore } from '@/state/useQuestStore';
import { TIER_LABELS, TIER_ORDER } from '@/utils/tier';
import { playSound } from '@/audio/audioService';
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

// Crafting tab: recipes (RECIPES) are keyed by their output item's own id, one recipe per
// craftable consumable - grouped by which stat the output restores (or 'cure' for an ailment-cure
// item, see utils/itemEffect.ts's itemEffectGroupOf) so the tab reads as 4 short lists instead of
// one flat 17-item grid.

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
  const questProgress = useQuestStore((s) => s.progress);
  const [busy, setBusy] = useState(false);
  useOverlayClose(onClose);

  /** Where a one-click "Equip" from the Inventory tab should land a Charm/Spirit Totem item -
   *  the family's first unlocked, empty slot, or its first unlocked slot at all if every unlocked
   *  one is already full (replacing whatever's there, same as equipping over any other slot
   *  always has). Every other item's family is just itself, so this is a no-op for them. */
  function defaultTargetSlot(defSlot: EquipmentSlot): EquipmentSlot {
    const unlockedFamily = slotFamily(defSlot).filter((s) => isSlotUnlocked(s, questProgress));
    const empty = unlockedFamily.find((s) => !player?.equipment[s]);
    return empty ?? unlockedFamily[0] ?? defSlot;
  }

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
      await callEquipItem(itemId, slot);
      if (uid) await resyncSave(uid);
      void playSound('sfx.equip');
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
      void playSound('sfx.equip');
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
      void playSound('sfx.item-use');
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
      void playSound('sfx.craft-success');
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
                      {SLOT_LABELS[slot]}
                    </button>
                  ))}
                </div>
              )}

              <div className={styles.grid}>
                {visible.length === 0 && <p style={{ fontSize: 13, opacity: 0.7 }}>Nothing here.</p>}
                {visible.map((entry) => {
                  const { equipDef, itemDef } = entry;
                  // Family-aware: a Charm/Spirit Totem counts as "equipped" if it's sitting in ANY
                  // of its family's 4 slots, not just the base one (see slotFamily's own comment).
                  const isEquipped = equipDef && slotFamily(equipDef.slot).some((s) => player?.equipment[s] === entry.itemId);
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
                            {formatAilmentResistance(equipDef.ailmentResistance) && (
                              <span style={{ fontSize: 10, color: 'var(--fw-spirit)', opacity: 0.85 }}>
                                {formatAilmentResistance(equipDef.ailmentResistance)}
                              </span>
                            )}
                          </>
                        ) : (
                          <button
                            className={styles.smallButton}
                            disabled={busy}
                            onClick={(e) => {
                              e.stopPropagation();
                              equip(entry.itemId, defaultTargetSlot(equipDef.slot));
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
                            {(selected.equipDef?.unique ?? selected.itemDef?.unique) &&
                              ' · Unique (cannot be lost, sold, or traded)'}
                          </p>
                        </div>
                      </div>
                      <p className={styles.detailDescription}>{selected.description}</p>
                      {selected.equipDef && formatStatBonuses(selected.equipDef.statBonuses) && (
                        <p className={styles.detailStats}>{formatStatBonuses(selected.equipDef.statBonuses)}</p>
                      )}
                      {selected.equipDef && formatAilmentResistance(selected.equipDef.ailmentResistance) && (
                        <p className={styles.detailStats}>{formatAilmentResistance(selected.equipDef.ailmentResistance)}</p>
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
                  </Panel>
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
              const unlocked = isSlotUnlocked(slot, questProgress);
              // A Charm/Spirit Totem item's own def.slot is always just 'charm'/'spiritTotem' (one
              // item, any of 4 slots) - slotFamily treats every other slot as its own family of 1,
              // so this reduces to the old exact-match check for them. Also excludes an item with
              // no "spare" copy beyond what's already equipped in another slot of the same family -
              // matches equipItem.ts's own ownership check, so this never offers an equip the
              // server would just reject.
              const eligible = unlocked
                ? inventory.filter((entry) => {
                    const def = EQUIPMENT.find((e) => e.id === entry.itemId);
                    if (!def || !slotFamily(slot).includes(def.slot)) return false;
                    const equippedElsewhere = Object.entries(player.equipment).filter(
                      ([s, id]) => id === entry.itemId && s !== slot,
                    ).length;
                    return entry.quantity > equippedElsewhere;
                  })
                : [];
              return (
                <div key={slot} className={styles.slotRow}>
                  <span className={styles.slotName}>{SLOT_LABELS[slot]}</span>
                  {!unlocked ? (
                    <span
                      style={{ fontSize: 12, opacity: 0.6, flex: 1 }}
                      title={`Complete "${QUESTS.find((q) => q.id === SLOT_UNLOCK_QUEST_ID[slot])?.name ?? 'the matching side quest'}" to unlock this slot.`}
                    >
                      Locked
                    </span>
                  ) : equipDef ? (
                    <>
                      <img src={getAssetUrl(equipDef.iconAssetId)} alt="" className={styles.icon} style={{ width: 32, height: 32 }} />
                      <span style={{ fontSize: 13, flex: 1 }}>
                        {equipDef.name}
                        {formatStatBonuses(equipDef.statBonuses) && (
                          <span style={{ fontSize: 11, color: 'var(--fw-spirit)', marginLeft: 8 }}>
                            {formatStatBonuses(equipDef.statBonuses)}
                          </span>
                        )}
                        {formatAilmentResistance(equipDef.ailmentResistance) && (
                          <span style={{ fontSize: 11, color: 'var(--fw-spirit)', marginLeft: 8 }}>
                            {formatAilmentResistance(equipDef.ailmentResistance)}
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
          const groups = ITEM_EFFECT_GROUP_ORDER.map((group) => ({
            group,
            recipeIds: recipeIds
              .filter((id) => itemEffectGroupOf(ITEMS.find((i) => i.id === RECIPES[id].outputItemId)) === group)
              .sort((a, b) => {
                const tierA = ITEMS.find((i) => i.id === RECIPES[a].outputItemId)?.tier;
                const tierB = ITEMS.find((i) => i.id === RECIPES[b].outputItemId)?.tier;
                return (tierA ? TIER_ORDER[tierA] : 0) - (tierB ? TIER_ORDER[tierB] : 0);
              }),
          })).filter((g) => g.recipeIds.length > 0);

          const selectedRecipe = craftingSelectedId ? RECIPES[craftingSelectedId] : undefined;
          const selectedItem = selectedRecipe ? ITEMS.find((i) => i.id === selectedRecipe.outputItemId) : undefined;
          // A material slot now accepts any of several item ids (see types/recipe.ts) - owned
          // quantity is summed across whichever of them the player actually has.
          const ownedForMaterial = (itemIds: string[]) =>
            itemIds.reduce((sum, id) => sum + (inventory.find((entry) => entry.itemId === id)?.quantity ?? 0), 0);
          const canCraft = !!selectedRecipe && selectedRecipe.materials.every((m) => ownedForMaterial(m.itemIds) >= m.quantity);

          return (
            <div>
              {groups.map(({ group, recipeIds: ids }) => (
                <div key={group} style={{ marginBottom: 14 }}>
                  <p className={styles.detailStats} style={{ margin: '0 0 6px' }}>
                    <strong>{ITEM_EFFECT_GROUP_LABELS[group]}</strong>
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
                <div
                  className={styles.detailOverlay}
                  onClick={(e) => {
                    e.stopPropagation();
                    setCraftingSelectedId(null);
                  }}
                >
                  <Panel className={styles.detailPopupPanel} onClick={(e: React.MouseEvent) => e.stopPropagation()}>
                    <OverlayCloseButton onClick={() => setCraftingSelectedId(null)} />
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
                        const owned = ownedForMaterial(m.itemIds);
                        const short = owned < m.quantity;
                        // "X or Y" when a slot accepts more than one material, so the player knows
                        // either one contributes toward the same quantity requirement.
                        const materialName = m.itemIds
                          .map((id) => ITEMS.find((i) => i.id === id)?.name ?? id.replace(/-/g, ' '))
                          .join(' or ');
                        return (
                          <p
                            key={m.itemIds.join('|')}
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
                  </Panel>
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
                .filter((entry) => {
                  const def = EQUIPMENT.find((e) => e.id === entry.itemId);
                  if (!def || !slotFamily(equipPickerSlot).includes(def.slot)) return false;
                  const equippedElsewhere = Object.entries(player?.equipment ?? {}).filter(
                    ([s, id]) => id === entry.itemId && s !== equipPickerSlot,
                  ).length;
                  return entry.quantity > equippedElsewhere;
                })
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
                      {formatAilmentResistance(def.ailmentResistance) && (
                        <span style={{ fontSize: 10, color: 'var(--fw-spirit)' }}>{formatAilmentResistance(def.ailmentResistance)}</span>
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
