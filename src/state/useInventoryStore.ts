import { create } from 'zustand';
import type { InventoryItem } from '@/types';

interface InventoryState {
  items: InventoryItem[];
  hydrate: (items: InventoryItem[]) => void;
}

/** Populated only from Cloud Function responses or reads of users/{uid} — never mutated locally. */
export const useInventoryStore = create<InventoryState>((set) => ({
  items: [],
  hydrate: (items) => set({ items }),
}));
