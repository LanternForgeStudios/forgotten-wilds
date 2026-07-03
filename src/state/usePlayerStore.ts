import { create } from 'zustand';
import type { Player } from '@/types';

interface PlayerState {
  player: Player | null;
  displayName: string | null;
  hydrate: (player: Player, displayName: string) => void;
}

/** Populated only from Cloud Function responses or reads of users/{uid} — never mutated locally. */
export const usePlayerStore = create<PlayerState>((set) => ({
  player: null,
  displayName: null,
  hydrate: (player, displayName) => set({ player, displayName }),
}));
