import { useState } from 'react';
import { buildRewardLines, type RewardLine } from '@/utils/rewardLines';
import type { QuestRewardSummary } from '@/firebase/functionsClient';

export interface RewardPopupContent {
  title: string;
  subtitle?: string;
  lines: RewardLine[];
}

/** Shared reward-acknowledgment popup (see RewardPopup.tsx) - Town/Overworld/Dungeon scenes all
 *  carried an identical `useState` for this plus an identical `showQuestRewardPopup` wrapper
 *  before this was factored out. `setRewardPopup` is still exposed directly for the several
 *  non-quest reward moments (chest opens, world-item pickups) that build their own title/lines
 *  rather than going through `showQuestRewardPopup`. Takes the caller's own `queueLorePopups` (see
 *  useLorePopupQueue) rather than owning a lore queue itself, since a quest-complete popup needs
 *  to queue any lore it granted behind the reward popup closing, and that queue is shared with
 *  other lore-granting moments (combat, world items) that have nothing to do with quest rewards. */
export function useQuestRewardPopup(queueLorePopups: (loreIds: string[] | undefined | null) => void) {
  const [rewardPopup, setRewardPopup] = useState<RewardPopupContent | null>(null);

  function showQuestRewardPopup(questRewards: QuestRewardSummary | null) {
    if (!questRewards) return;
    queueLorePopups(questRewards.grantedLoreIds);
    setRewardPopup({
      title: 'Quest Complete!',
      lines: buildRewardLines({
        xp: questRewards.xp,
        gold: questRewards.gold,
        spiritEssence: questRewards.spiritEssence,
        itemIds: questRewards.itemIds,
        skillIds: questRewards.grantedSkillIds,
      }),
    });
  }

  function closeRewardPopup() {
    setRewardPopup(null);
  }

  return { rewardPopup, setRewardPopup, showQuestRewardPopup, closeRewardPopup };
}
