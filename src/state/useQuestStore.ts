import { create } from 'zustand';
import type { QuestProgress } from '@/types';

interface QuestState {
  progress: Record<string, QuestProgress>;
  hydrate: (progress: Record<string, QuestProgress>) => void;
}

/** Populated only from Cloud Function responses or reads of users/{uid} — never mutated locally. */
export const useQuestStore = create<QuestState>((set) => ({
  progress: {},
  hydrate: (progress) => set({ progress }),
}));
