import styles from './MobileHud.module.css';

interface MobileHudProps {
  onInteract?: () => void;
  /** Omitted until Stamina/Dash is unlocked - there's no keyboard on mobile to hold Shift with,
   *  so this button is the only way to Dash there. Press-and-hold (not a tap), mirroring Shift's
   *  hold-to-run keyboard behavior - runs in whichever direction is currently faced until
   *  released, out of Stamina, or blocked. */
  onDashStart?: () => void;
  onDashStop?: () => void;
  onInventory: () => void;
  /** Also where Quests live now (its own tab, opened first by default) - there's no separate
   *  Quests button since the standalone Quest Log was folded into the Journal. */
  onJournal: () => void;
  /** Omitted outside TownScene - World Chat is only available while in a town. */
  onChat?: () => void;
  onMap: () => void;
}

/** Touch replacement for the Enter/I/J/C/M/Shift+direction keyboard shortcuts, since phones have no
 *  keyboard to press. */
export function MobileHud({ onInteract, onDashStart, onDashStop, onInventory, onJournal, onChat, onMap }: MobileHudProps) {
  return (
    <div className={styles.hud}>
      {onInteract && (
        <button className={styles.interactButton} onClick={onInteract}>
          Talk / Interact
        </button>
      )}
      {onDashStart && (
        <button
          className={styles.interactButton}
          onPointerDown={onDashStart}
          onPointerUp={onDashStop}
          onPointerLeave={onDashStop}
          onPointerCancel={onDashStop}
        >
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
        <button className={styles.menuButton} onClick={onMap}>
          Map
        </button>
        {onChat && (
          <button className={styles.menuButton} onClick={onChat}>
            Chat
          </button>
        )}
      </div>
    </div>
  );
}
