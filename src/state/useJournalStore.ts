import { create } from 'zustand';
import type { JournalState as JournalData } from '@/types';

interface JournalState {
  journal: JournalData;
  hydrate: (journal: JournalData) => void;
}

const EMPTY_JOURNAL: JournalData = {
  creaturesDiscovered: [],
  locationsVisited: [],
  loreUnlocked: [],
  bossesDefeated: [],
  itemsDiscovered: [],
};

/** Populated only from Cloud Function responses or reads of users/{uid} — never mutated locally. */
export const useJournalStore = create<JournalState>((set) => ({
  journal: EMPTY_JOURNAL,
  hydrate: (journal) => set({ journal }),
}));
