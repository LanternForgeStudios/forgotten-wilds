import { playSound } from '@/audio/audioService';
import styles from './OverlayCloseButton.module.css';

interface OverlayCloseButtonProps {
  onClick: () => void;
}

/** A small "X" button pinned to a panel's top-right corner - drop as the first child inside an
 *  overlay's existing <Panel> block. Purely additive: every overlay already closes via Escape
 *  (useOverlayClose) and click-outside, this just gives that same action a discoverable, explicit
 *  button too, without touching either existing close path. */
export function OverlayCloseButton({ onClick }: OverlayCloseButtonProps) {
  return (
    <button
      type="button"
      className={styles.closeButton}
      onClick={(e) => {
        e.stopPropagation();
        void playSound('sfx.ui-close');
        onClick();
      }}
      aria-label="Close"
    >
      &times;
    </button>
  );
}
