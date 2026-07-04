import { create } from 'zustand';

interface WorldStateStore {
  openedChests: string[];
  hydrate: (openedChests: string[]) => void;
}

/** Populated only from Cloud Function responses or reads of users/{uid} — never mutated locally.
 *  Tracks world-object state (currently just which chests this player has already opened) that
 *  doesn't belong on Player/Inventory/Quest/Journal but is still server-authoritative save data. */
export const useWorldStateStore = create<WorldStateStore>((set) => ({
  openedChests: [],
  hydrate: (openedChests) => set({ openedChests }),
}));
