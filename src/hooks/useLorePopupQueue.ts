import { useState } from 'react';
import { LORE_ENTRIES } from '@/data/lore';

export interface LorePopupEntry {
  title: string;
  body: string;
}

/** A small FIFO queue for the "Lore Learned" acknowledgment popup (see LorePopup.tsx). Lore is
 *  story-critical, so every place a quest/combat/world-item response carries `grantedLoreIds`
 *  should call `queueLorePopups` with it - queued rather than shown immediately so it never
 *  visually stacks with the shared RewardPopup (callers gate rendering on the reward popup being
 *  closed) and so multiple lore grants from one action reveal one at a time instead of all at
 *  once. Deliberately a separate, additive hook rather than folding into each scene's own
 *  (already-varied) reward-popup state - see TownScene/OverworldScene/DungeonScene for the several
 *  slightly different shapes that state takes today. */
export function useLorePopupQueue() {
  const [queue, setQueue] = useState<LorePopupEntry[]>([]);

  function queueLorePopups(loreIds: string[] | undefined | null) {
    if (!loreIds || loreIds.length === 0) return;
    const entries = loreIds
      .map((id) => LORE_ENTRIES.find((entry) => entry.id === id))
      .filter((entry): entry is (typeof LORE_ENTRIES)[number] => !!entry)
      .map((entry) => ({ title: entry.title, body: entry.body }));
    if (entries.length > 0) setQueue((q) => [...q, ...entries]);
  }

  function dismissCurrentLorePopup() {
    setQueue((q) => q.slice(1));
  }

  return { currentLorePopup: queue[0] ?? null, hasQueuedLore: queue.length > 0, queueLorePopups, dismissCurrentLorePopup };
}
