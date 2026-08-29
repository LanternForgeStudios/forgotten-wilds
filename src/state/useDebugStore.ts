import { create } from 'zustand';
import type { TimePhase, WeatherKind } from '@/types';

interface DebugState {
  showCollisions: boolean;
  /** null = "Auto" (normal resolveWeather resolution) - see OverworldScene.tsx/TownScene.tsx. */
  weatherOverride: WeatherKind | null;
  /** null = "Auto" (normal useTimeOfDayStore resolution). */
  timeOverride: TimePhase | null;
  /** Scrubs the sun-position clock to an arbitrary point in the cycle (0..CYCLE_DURATION_MS,
   *  see timeOfDay.ts), for watching a full shadow sweep in seconds instead of real minutes. null
   *  = not scrubbing. Takes priority over `timeOverride` when set (see OverworldScene.tsx/
   *  TownScene.tsx's effectiveSunPosition) - both are independent Debug-tab controls, but a scrub
   *  in progress should win over a forced discrete phase, not conflict with it silently. */
  cycleScrubMs: number | null;
  setShowCollisions: (value: boolean) => void;
  setWeatherOverride: (value: WeatherKind | null) => void;
  setTimeOverride: (value: TimePhase | null) => void;
  setCycleScrubMs: (value: number | null) => void;
}

/** Backs the UserProfile Debug tab (replaces the old F8 weather-cycle/F9 collision-toggle
 *  hotkeys - see PhaserExplorationCanvas.tsx and OverworldScene.tsx/TownScene.tsx). Deliberately
 *  NOT persisted (no zustand `persist` middleware, unlike useAudioSettingsStore) - a debug
 *  session shouldn't silently carry into a later real play session; it resets to normal
 *  (Auto/off) on every reload. */
export const useDebugStore = create<DebugState>((set) => ({
  showCollisions: false,
  weatherOverride: null,
  timeOverride: null,
  cycleScrubMs: null,
  setShowCollisions: (value) => set({ showCollisions: value }),
  setWeatherOverride: (value) => set({ weatherOverride: value }),
  setTimeOverride: (value) => set({ timeOverride: value }),
  setCycleScrubMs: (value) => set({ cycleScrubMs: value }),
}));
