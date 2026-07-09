import type { PlayerSave, QuestProgress } from '@/types';
import { fetchPlayerSave } from '@/firebase/saveService';
import { usePlayerStore } from './usePlayerStore';
import { useInventoryStore } from './useInventoryStore';
import { useQuestStore } from './useQuestStore';
import { useJournalStore } from './useJournalStore';
import { useWorldStateStore } from './useWorldStateStore';
import { useToastStore } from './useToastStore';
import { QUESTS } from '@/data';
import { effectiveQuestStatus } from '@/engine/quests/questStatus';

/** Fans a PlayerSave (from a Cloud Function response or a users/{uid} read) out to every store. */
export function hydrateAllStores(save: PlayerSave): void {
  usePlayerStore.getState().hydrate(save.player, save.displayName);
  useInventoryStore.getState().hydrate(save.inventory);
  useQuestStore.getState().hydrate(save.quests);
  // itemsDiscovered is newer than the other journal fields - an existing player's save won't have
  // it until their next item grant lazily backfills it server-side (grantItem), so this can
  // arrive as undefined here in the meantime.
  useJournalStore.getState().hydrate({ ...save.journal, itemsDiscovered: save.journal.itemsDiscovered ?? [] });
  useWorldStateStore
    .getState()
    .hydrate(save.openedChests ?? [], save.seenNpcDialogueVariant ?? {}, save.lastReviewedSocialAt ?? 0);
}

/** Compares quest progress before/after a resync and pushes a toast for anything that changed -
 *  a quest becoming active ("given"), an objective advancing, or a quest completing. Deliberately
 *  not run on the very first hydrate after sign-in (see resyncSave) - diffing against the
 *  pristine empty store there would spam toasts for a returning player's entire quest history. */
function toastQuestChanges(prev: Record<string, QuestProgress>, next: Record<string, QuestProgress>): void {
  const push = useToastStore.getState().push;
  for (const quest of QUESTS) {
    const prevStatus = effectiveQuestStatus(quest, prev);
    const nextStatus = effectiveQuestStatus(quest, next);
    if (prevStatus === nextStatus) {
      const prevCount = Object.values(prev[quest.id]?.objectiveCounts ?? {}).reduce((a, b) => a + b, 0);
      const nextCount = Object.values(next[quest.id]?.objectiveCounts ?? {}).reduce((a, b) => a + b, 0);
      if (nextStatus === 'active' && nextCount > prevCount) {
        push(`Quest Progress: ${quest.name}`);
      }
      continue;
    }
    if (nextStatus === 'active') push(`Quest Started: ${quest.name}`);
    else if (nextStatus === 'completed') push(`Quest Completed: ${quest.name}`);
  }
}

// resyncSave is called independently from many places in quick succession (nearly every scene
// interaction follows up its own Cloud Function call with one) with no sequencing between calls -
// without this, two overlapping resyncs can resolve out of order (a slower-to-resolve earlier
// call finishing after a faster-resolving later one) and the stale response would silently
// overwrite the fresher state it should have lost to. Same generation-counter guard already used
// for this exact class of race elsewhere in the codebase (ExplorationScene.ts, CombatScene.tsx).
let resyncGeneration = 0;

/** Re-reads users/{uid} and re-hydrates every store. Used after any Cloud Function call whose
 *  response doesn't carry the full save (talkToNpc, enterLocation, collectWorldItem, etc). */
export async function resyncSave(uid: string): Promise<void> {
  const generation = ++resyncGeneration;
  const prevProgress = useQuestStore.getState().progress;
  const save = await fetchPlayerSave(uid);
  if (!save) return;
  // A newer resyncSave call has since started - it'll apply its own (more current) result, so
  // don't let this now-stale one clobber it.
  if (generation !== resyncGeneration) return;
  toastQuestChanges(prevProgress, save.quests);
  hydrateAllStores(save);
}
