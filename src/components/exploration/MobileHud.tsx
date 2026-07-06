import styles from './MobileHud.module.css';

interface MobileHudProps {
  onInteract?: () => void;
  /** Omitted until Stamina/Dash is unlocked - there's no keyboard on mobile to hold Shift with,
   *  so this button is the only way to Dash there. Dashes in whichever direction is currently faced. */
  onDash?: () => void;
  onInventory: () => void;
  /** Also where Quests live now (its own tab, opened first by default) - there's no separate
   *  Quests button since the standalone Quest Log was folded into the Journal. */
  onJournal: () => void;
}

/** Touch replacement for the Enter/I/J/Shift+direction keyboard shortcuts, since phones have no
 *  keyboard to press. */
export function MobileHud({ onInteract, onDash, onInventory, onJournal }: MobileHudProps) {
  return (
    <div className={styles.hud}>
      {onInteract && (
        <button className={styles.interactButton} onClick={onInteract}>
          Talk / Interact
        </button>
      )}
      {onDash && (
        <button className={styles.interactButton} onClick={() => onDash()}>
          Dash
        </button>
      )}
      <div className={styles.menuRow}>
        <button className={styles.menuButton} onClick={onInventory}>
          Items
        </button>
        <button className={styles.menuButton} onClick={onJournal}>
          Journal
        </button>
      </div>
    </div>
  );
}
