import type { PlayerSave } from '@/types';
import { fetchPlayerSave } from '@/firebase/saveService';
import { usePlayerStore } from './usePlayerStore';
import { useInventoryStore } from './useInventoryStore';
import { useQuestStore } from './useQuestStore';
import { useJournalStore } from './useJournalStore';

/** Fans a PlayerSave (from a Cloud Function response or a users/{uid} read) out to every store. */
export function hydrateAllStores(save: PlayerSave): void {
  usePlayerStore.getState().hydrate(save.player, save.displayName);
  useInventoryStore.getState().hydrate(save.inventory);
  useQuestStore.getState().hydrate(save.quests);
  useJournalStore.getState().hydrate(save.journal);
}

/** Re-reads users/{uid} and re-hydrates every store. Used after any Cloud Function call whose
 *  response doesn't carry the full save (talkToNpc, enterLocation, collectWorldItem, etc). */
export async function resyncSave(uid: string): Promise<void> {
  const save = await fetchPlayerSave(uid);
  if (save) hydrateAllStores(save);
}
