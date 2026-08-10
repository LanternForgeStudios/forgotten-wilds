import { Panel } from './common/Panel';
import { OverlayCloseButton } from './common/OverlayCloseButton';
import { useOverlayClose } from '@/hooks/useOverlayClose';
import styles from './LorePopup.module.css';

interface LorePopupProps {
  title: string;
  body: string;
  onClose: () => void;
}

/** The "you just learned something" acknowledgment popup for Lore entries - siblings with
 *  RewardPopup.tsx (same overlay/Panel/close conventions) but shaped for a full title+body
 *  passage rather than a list of icon+label reward lines, since lore text doesn't fit that row
 *  shape. Lore is story-critical and easy to miss if it only silently lands in the Journal's Lore
 *  tab, so every place a quest/combat/world-item response carries `grantedLoreIds` should surface
 *  this - see useLorePopupQueue.ts for the shared queueing/sequencing (never stacks with
 *  RewardPopup, shows after it closes). */
export function LorePopup({ title, body, onClose }: LorePopupProps) {
  useOverlayClose(onClose);

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.glow} />
      <Panel className={styles.panel} onClick={(e: React.MouseEvent) => e.stopPropagation()}>
        <OverlayCloseButton onClick={onClose} />
        <p className={styles.subtitle}>Lore Learned</p>
        <h2 className={styles.title}>{title}</h2>
        <p className={styles.body}>{body}</p>
        <button className={styles.closeButton} onClick={onClose}>
          Got it
        </button>
      </Panel>
    </div>
  );
}
