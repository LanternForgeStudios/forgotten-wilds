import { Panel } from './common/Panel';
import { OverlayCloseButton } from './common/OverlayCloseButton';
import { useOverlayClose } from '@/hooks/useOverlayClose';
import { getAssetUrl } from '@/assets/assetManager';
import { itemDisplayName, itemIconAssetId } from '@/utils/itemName';
import type { DailyChestRewards } from '@/firebase/functionsClient';
import styles from './ChestRewardReveal.module.css';

interface ChestRewardRevealProps {
  tier: 'standard' | 'elite';
  rewards: DailyChestRewards;
  onClose: () => void;
}

/** A dramatic, full-screen reveal for a claimed chest's rewards - deliberately a bigger moment
 *  than the small HUD popover the claim itself happens in (see PlayerHUD.tsx), closeable the same
 *  way every other overlay in this project is (Escape, click-outside, the X button). Each reward
 *  line staggers in via CSS animation-delay rather than all appearing at once, so opening a chest
 *  with several rewards reads as a reveal, not a static list. */
export function ChestRewardReveal({ tier, rewards, onClose }: ChestRewardRevealProps) {
  useOverlayClose(onClose);
  const lines: { key: string; icon?: string; label: string }[] = [
    { key: 'gold', icon: 'icon.currency.gold', label: `${rewards.gold} Gold` },
    ...(rewards.premiumCurrency > 0
      ? [{ key: 'premium', icon: 'icon.currency.premium-currency', label: `${rewards.premiumCurrency} Premium Currency` }]
      : []),
    ...rewards.itemIds.map((itemId, i) => ({ key: `item-${i}`, icon: itemIconAssetId(itemId), label: itemDisplayName(itemId) })),
  ];

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.glow} />
      <Panel className={styles.panel} onClick={(e: React.MouseEvent) => e.stopPropagation()}>
        <OverlayCloseButton onClick={onClose} />
        <p className={styles.tierLabel}>{tier === 'elite' ? 'Elite' : 'Standard'} Chest</p>
        <h2 className={styles.title}>You found...</h2>
        <div className={styles.rewardList}>
          {lines.map((line, i) => (
            <div key={line.key} className={styles.rewardRow} style={{ animationDelay: `${0.3 + i * 0.25}s` }}>
              {line.icon && <img src={getAssetUrl(line.icon)} alt="" className={styles.icon} />}
              <span>{line.label}</span>
            </div>
          ))}
        </div>
        <button className={styles.closeButton} onClick={onClose}>
          Nice!
        </button>
      </Panel>
    </div>
  );
}
