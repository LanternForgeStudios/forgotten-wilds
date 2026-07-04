import styles from './MobileHud.module.css';

interface MobileHudProps {
  onInteract?: () => void;
  onQuestLog: () => void;
  onInventory: () => void;
  onJournal: () => void;
}

/** Touch replacement for the Enter/L/I/J keyboard shortcuts, since phones have no keyboard to press. */
export function MobileHud({ onInteract, onQuestLog, onInventory, onJournal }: MobileHudProps) {
  return (
    <div className={styles.hud}>
      {onInteract && (
        <button className={styles.interactButton} onClick={onInteract}>
          Talk / Interact
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
