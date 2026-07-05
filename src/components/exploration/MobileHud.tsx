import styles from './MobileHud.module.css';

interface MobileHudProps {
  onInteract?: () => void;
  /** Omitted until Stamina/Dash is unlocked - there's no keyboard on mobile to hold Shift with,
   *  so this button is the only way to Dash there. Dashes in whichever direction is currently faced. */
  onDash?: () => void;
  onQuestLog: () => void;
  onInventory: () => void;
  onJournal: () => void;
}

/** Touch replacement for the Enter/L/I/J/Shift+direction keyboard shortcuts, since phones have no
 *  keyboard to press. */
export function MobileHud({ onInteract, onDash, onQuestLog, onInventory, onJournal }: MobileHudProps) {
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
        <button className={styles.menuButton} onClick={onQuestLog}>
          Quests
        </button>
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
