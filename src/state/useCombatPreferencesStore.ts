import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface CombatPreferencesState {
  /** Default state for the in-combat "Fast Rounds" toggle - applies to every encounter type
   *  (solo, party/Endless Battle, PvP). Each screen still owns its own local toggle state during
   *  a fight; this only seeds that toggle's initial value. */
  defaultFastRounds: boolean;
  /** Default state for the in-combat "Target All" toggle - only meaningful where a multi-enemy
   *  roster exists (solo, party/Endless Battle); PvP is always a single opponent, so this default
   *  has no effect there. */
  defaultTargetAll: boolean;
  setDefaultFastRounds: (value: boolean) => void;
  setDefaultTargetAll: (value: boolean) => void;
}

/** Device preference, not game state - same "persisted to localStorage directly, no Cloud
 *  Function round-trip" reasoning as useAudioSettingsStore, since which toggles a fight starts
 *  with has no gameplay-integrity stake (the player can still change either mid-fight). */
export const useCombatPreferencesStore = create<CombatPreferencesState>()(
  persist(
    (set) => ({
      defaultFastRounds: false,
      defaultTargetAll: false,
      setDefaultFastRounds: (defaultFastRounds) => set({ defaultFastRounds }),
      setDefaultTargetAll: (defaultTargetAll) => set({ defaultTargetAll }),
    }),
    { name: 'forgotten-wilds-combat-preferences' },
  ),
);
