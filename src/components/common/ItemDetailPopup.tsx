import { Panel } from './Panel';
import { OverlayCloseButton } from './OverlayCloseButton';
import { TierBadge } from './TierBadge';
import { StatBonusesText, AilmentResistanceText } from './StatBonusText';
import { LanternAbilitiesText } from './LanternAbilitiesText';
import { getAssetUrl } from '@/assets/assetManager';
import { usePlayerStore } from '@/state/usePlayerStore';
import { ITEMS, EQUIPMENT } from '@/data';
import { formatAilmentResistance, formatStatBonuses } from '@/utils/statBonuses';
import { SLOT_LABELS } from '@/utils/equipmentSlotLabels';
import { ITEM_CATEGORY_LABELS } from '@/utils/itemCategoryLabels';
import styles from '../CharacterMenu.module.css';

interface ItemDetailPopupProps {
  itemId: string;
  quantity: number;
  onClose: () => void;
}

/** The same full item/equipment detail view CharacterMenu.tsx's Inventory tab shows when a card is
 *  clicked (icon, tier, slot/category, description, stat bonuses, ailment resistance, lantern
 *  abilities, consumable effect text) - factored out here so any other screen that lists items
 *  (e.g. TradeOfferPanel.tsx) can offer the same click-to-inspect popup instead of a bare name. */
export function ItemDetailPopup({ itemId, quantity, onClose }: ItemDetailPopupProps) {
  const player = usePlayerStore((s) => s.player);
  const equipDef = EQUIPMENT.find((e) => e.id === itemId);
  const itemDef = ITEMS.find((i) => i.id === itemId);
  const name = equipDef?.name ?? itemDef?.name ?? itemId.replace(/-/g, ' ');
  const description = equipDef?.description ?? itemDef?.description ?? '';
  const iconAssetId = equipDef?.iconAssetId ?? itemDef?.iconAssetId;
  const tierDef = equipDef ?? itemDef;

  return (
    <div
      className={styles.detailOverlay}
      onClick={(e) => {
        e.stopPropagation();
        onClose();
      }}
    >
      <Panel className={styles.detailPopupPanel} onClick={(e: React.MouseEvent) => e.stopPropagation()}>
        <OverlayCloseButton onClick={onClose} />
        <div className={styles.detailPanel}>
          <div className={styles.detailHeader}>
            {iconAssetId && <img src={getAssetUrl(iconAssetId)} alt="" className={styles.detailIcon} />}
            <div>
              <p className={styles.detailName}>
                {name} {tierDef && <TierBadge tier={tierDef.tier} style={{ marginLeft: 6 }} />}
              </p>
              <p className={styles.detailMeta}>
                {equipDef ? `${SLOT_LABELS[equipDef.slot]} · x${quantity}` : `${ITEM_CATEGORY_LABELS[itemDef?.category ?? 'materials']} · x${quantity}`}
                {(equipDef?.unique ?? itemDef?.unique) && ' · Unique (cannot be lost, sold, or traded)'}
              </p>
            </div>
          </div>
          <p className={styles.detailDescription}>{description}</p>
          {equipDef && formatStatBonuses(equipDef.statBonuses) && (
            <p className={styles.detailStats}>
              <StatBonusesText bonuses={equipDef.statBonuses} />
            </p>
          )}
          {equipDef && formatAilmentResistance(equipDef.ailmentResistance) && (
            <p className={styles.detailStats}>
              <AilmentResistanceText resistances={equipDef.ailmentResistance} />
            </p>
          )}
          {equipDef?.lanternAbilityIds && (
            <LanternAbilitiesText equipDef={equipDef} oilTier={player?.lanternOilUpgrades?.[equipDef.id] ?? 0} />
          )}
          {itemDef?.effect && (
            <p className={styles.detailStats}>
              {itemDef.effect.healHpPercent ? `Restores ${Math.round(itemDef.effect.healHpPercent * 100)}% HP  ` : ''}
              {itemDef.effect.healSpiritPercent ? `Restores ${Math.round(itemDef.effect.healSpiritPercent * 100)}% Spirit  ` : ''}
              {itemDef.effect.restoreOilPercent ? `Restores ${Math.round(itemDef.effect.restoreOilPercent * 100)}% Lantern Oil  ` : ''}
              {itemDef.effect.reviveOnDefeat ? 'Revives on defeat' : ''}
            </p>
          )}
        </div>
      </Panel>
    </div>
  );
}
