import { Panel } from './common/Panel';
import { OverlayCloseButton } from './common/OverlayCloseButton';
import { useOverlayClose } from '@/hooks/useOverlayClose';
import { getAssetUrl } from '@/assets/assetManager';
import type { RewardLine } from '@/utils/rewardLines';
import styles from './RewardPopup.module.css';

interface RewardPopupProps {
  title: string;
  subtitle?: string;
  lines: RewardLine[];
  onClose: () => void;
  closeLabel?: string;
}

/** The shared "you earned something" acknowledgment popup - a dramatic, full-screen reveal bigger
 *  than a passing toast, closeable the same way every other overlay in this project is (Escape,
 *  click-outside, the X button, the button at the bottom). Used for daily/map chest opens,
 *  world-item pickups, and quest completion rewards (items/specialties) - anywhere the player
 *  earns something and should have to acknowledge it rather than have it silently land in their
 *  inventory. Each reward line staggers in via CSS animation-delay rather than all appearing at
 *  once, so opening with several rewards reads as a reveal, not a static list. */
export function RewardPopup({ title, subtitle, lines, onClose, closeLabel = 'Nice!' }: RewardPopupProps) {
  useOverlayClose(onClose);

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.glow} />
      <Panel className={styles.panel} onClick={(e: React.MouseEvent) => e.stopPropagation()}>
        <OverlayCloseButton onClick={onClose} />
        {subtitle && <p className={styles.subtitle}>{subtitle}</p>}
        <h2 className={styles.title}>{title}</h2>
        <div className={styles.rewardList}>
          {lines.map((line, i) => (
            <div key={line.key} className={styles.rewardRow} style={{ animationDelay: `${0.3 + i * 0.25}s` }}>
              {line.icon && <img src={getAssetUrl(line.icon)} alt="" className={styles.icon} />}
              <span>{line.label}</span>
            </div>
          ))}
        </div>
        <button className={styles.closeButton} onClick={onClose}>
          {closeLabel}
        </button>
      </Panel>
    </div>
  );
}
