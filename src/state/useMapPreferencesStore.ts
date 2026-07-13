import { create } from 'zustand';

interface MapPreferencesState {
  /** Quest ids the player has explicitly hidden from the mini-map. Absence means visible - every
   *  quest defaults to "Show on Map: on" without needing an explicit entry for each one. */
  hiddenQuestIds: Set<string>;
  toggle: (questId: string) => void;
}

/** Pure client-local display preference, deliberately NOT synced through a Cloud Function or
 *  persisted to users/{uid} - it has no gameplay-integrity stake (it only controls whether a
 *  marker is drawn on the mini-map), so a plain in-memory Zustand store is proportionate. Resets
 *  every session; a returning player's per-quest toggle choices won't survive a reload. */
export const useMapPreferencesStore = create<MapPreferencesState>((set, get) => ({
  hiddenQuestIds: new Set(),
  toggle: (questId) => {
    const next = new Set(get().hiddenQuestIds);
    if (next.has(questId)) next.delete(questId);
    else next.add(questId);
    set({ hiddenQuestIds: next });
  },
}));
