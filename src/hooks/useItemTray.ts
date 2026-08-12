import { useState } from 'react';

/** Shared "queue up to 3 consumables to use alongside this turn's action" state - identical logic
 *  used by solo combat (CombatScene.tsx), Endless Battle (EndlessBattlePanel.tsx), and PvP
 *  (PvpBattlePanel.tsx), previously hand-copied in all three.
 *
 *  `itemsUsedThisTurn` tracks items already consumed via a *previous* trip through the item menu
 *  this same turn - tray.length alone can't cap "3 items per turn", since a caller's finishItemMenu
 *  clears the tray back to [] the instant it uses a batch, which would otherwise let the player
 *  reopen Items and use another 3, repeatedly, all before ever taking their turn's real action.
 *  Callers reset it via `resetItemsUsedThisTurn` only when the player actually commits their turn's
 *  action, not when the item menu closes.
 *
 *  `ownedQuantityFor` is a callback rather than a plain value so callers can pass a closure over
 *  their own already-computed inventory list (e.g. `combatItems`) without this hook needing to know
 *  its shape. */
export function useItemTray(ownedQuantityFor: (itemId: string) => number) {
  const [tray, setTray] = useState<string[]>([]);
  const [itemsUsedThisTurn, setItemsUsedThisTurn] = useState(0);

  const queuedCountFor = (itemId: string) => tray.filter((id) => id === itemId).length;
  const canQueueMore = itemsUsedThisTurn + tray.length < 3;

  function queueItem(itemId: string) {
    if (!canQueueMore || queuedCountFor(itemId) >= ownedQuantityFor(itemId)) return;
    setTray((prev) => [...prev, itemId]);
  }

  function dequeueItem(itemId: string) {
    setTray((prev) => {
      const i = prev.lastIndexOf(itemId);
      if (i === -1) return prev;
      return [...prev.slice(0, i), ...prev.slice(i + 1)];
    });
  }

  return {
    tray,
    queuedCountFor,
    canQueueMore,
    queueItem,
    dequeueItem,
    clearTray: () => setTray([]),
    recordItemsUsed: (count: number) => setItemsUsedThisTurn((n) => n + count),
    resetItemsUsedThisTurn: () => setItemsUsedThisTurn(0),
  };
}
