import { create } from 'zustand';

interface WorldStateStore {
  openedChests: string[];
  seenNpcDialogueVariant: Record<string, string>;
  hydrate: (openedChests: string[], seenNpcDialogueVariant: Record<string, string>) => void;
}

/** Populated only from Cloud Function responses or reads of users/{uid} — never mutated locally.
 *  Tracks world-object state (which chests this player has already opened, which NPC dialogue
 *  variants they've already heard) that doesn't belong on Player/Inventory/Quest/Journal but is
 *  still server-authoritative save data. */
export const useWorldStateStore = create<WorldStateStore>((set) => ({
  openedChests: [],
  seenNpcDialogueVariant: {},
  hydrate: (openedChests, seenNpcDialogueVariant) => set({ openedChests, seenNpcDialogueVariant }),
}));
